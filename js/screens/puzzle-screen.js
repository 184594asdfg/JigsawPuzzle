/**
 * 拼图场景：顶部导航 + 倒计时 + 棋盘 + 底部工具栏 + 成功弹窗。
 */
var BaseScreen = require('./base-screen')
var HomeScreen = require('./home-screen')
var rpx = require('../rpx')
var assets = require('../assets')
var draw = require('../draw')
var PuzzleEngine = require('../puzzle/puzzle-engine')
var progress = require('../../utils/progress')
var settings = require('../../utils/settings')
var settingsModal = require('../settings-modal')
var toolModal = require('../puzzle-tool-modal')

/** 倒计时区域（rpx）：只设宽度，水平居中，无左右边距 */
var COUNTDOWN_WIDTH_RPX = 170
var COUNTDOWN_AREA_H_RPX = 45
var COUNTDOWN_GAP_RPX = 24
var COUNTDOWN_DURATION_MS = 3 * 60 * 1000
var COUNTDOWN_ALARM_IMAGE = 'images/icons/alarm.png'
var COUNTDOWN_ALARM_W_RPX = 60
var COUNTDOWN_ALARM_H_RPX = 60
var COUNTDOWN_ALARM_LEFT_RPX = 0
/** 时间文字相对条中心的水平偏移（正数向右） */
var COUNTDOWN_TIME_OFFSET_X_RPX = 20
var COUNTDOWN_ADD_MS = 60 * 1000

/** 底部三个工具图标：显示 124×138 rpx，资源 248×276 @2x */
var BOTTOM_TOOL_W_RPX = 124
var BOTTOM_TOOL_H_RPX = 138
var BOTTOM_TOOL_GAP_RPX = 96
var BOTTOM_TOOL_BOTTOM_RPX = 48
var BOTTOM_TOOLS = [
  { action: 'addTime', path: 'images/icons/add_time.png' },
  { action: 'hint', path: 'images/icons/hint.png' },
  { action: 'preview', path: 'images/icons/preview.png' }
]

function formatCountdown(ms) {
  var sec = Math.max(0, Math.ceil(ms / 1000))
  var m = Math.floor(sec / 60)
  var s = sec % 60
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s
}

function PuzzleScreen(opts) {
  BaseScreen.call(this)
  this.opts = opts || {}
  this.imageSrc = opts.image
  this.gridSize = opts.grid != null ? Number(opts.grid) : 4
  if (!this.gridSize || isNaN(this.gridSize)) this.gridSize = 4
  this.levelKey = opts.levelKey || ''
  this.levelLabel = opts.levelLabel || '拼图'
  this.engine = null
  this.loading = true
  this.showSuccess = false
  this.showSettings = false
  this.toolModal = null
  this._navRect = null
  this._successBtnRect = null
  this._engineTouching = false
  this.countdownMs = 0
  this.countdownTotalMs = 0
  this.countdownEnded = false
}
PuzzleScreen.prototype = Object.create(BaseScreen.prototype)
PuzzleScreen.prototype.constructor = PuzzleScreen

PuzzleScreen.prototype.onEnter = function (manager) {
  BaseScreen.prototype.onEnter.call(this, manager)
  settingsModal.preload()
  toolModal.preload()
  assets.load(COUNTDOWN_ALARM_IMAGE)
  for (var i = 0; i < BOTTOM_TOOLS.length; i++) {
    assets.load(BOTTOM_TOOLS[i].path)
  }
  this._initEngine()
}

PuzzleScreen.prototype.onExit = function () {
  if (this.engine) {
    this.engine.destroy()
    this.engine = null
  }
}

PuzzleScreen.prototype._initEngine = function () {
  var self = this
  this.loading = true
  this.showSuccess = false
  this.showSettings = false
  this.toolModal = null
  this.countdownEnded = false
  this.countdownTotalMs = COUNTDOWN_DURATION_MS
  this.countdownMs = COUNTDOWN_DURATION_MS
  if (this.engine) this.engine.destroy()
  this.engine = new PuzzleEngine({
    windowWidth: rpx.windowWidth(),
    grid: this.gridSize,
    image: this.imageSrc,
    onWin: function () {
      if (self.levelKey) progress.markLevelComplete(self.levelKey)
      self.showSuccess = true
    },
    onAnyMove: function () {}
  })
  this.engine.start().then(function () {
    self.loading = false
    if (self.engine) self.engine.setSfxEnabled(settings.get('sfx'))
  }).catch(function () {
    self.loading = false
  })
}

// ---------------------------------------------------------------------------
//  渲染
// ---------------------------------------------------------------------------

PuzzleScreen.prototype.update = function (dt) {
  if (this.engine) this.engine.update(dt)
  if (
    this.engine && !this.loading && !this.showSuccess && !this.showSettings &&
    !this.toolModal && !this.countdownEnded && this.countdownMs > 0
  ) {
    this.countdownMs -= dt
    if (this.countdownMs <= 0) {
      this.countdownMs = 0
      this.countdownEnded = true
    }
  }
}

PuzzleScreen.prototype.render = function (ctx) {
  var W = rpx.windowWidth()
  var H = rpx.windowHeight()
  this.resetHitZones()

  // 渐变背景
  var grad = ctx.createLinearGradient(0, 0, W * 0.6, H)
  grad.addColorStop(0, '#5b6fd8')
  grad.addColorStop(0.45, '#6d5b9e')
  grad.addColorStop(1, '#764ba2')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // 导航
  var navY = rpx.safeTop()
  var navH = rpx.rpx(88)
  this._drawNav(ctx, navY, navH, W)

  if (this.loading || !this.engine) {
    draw.fillTextCentered(
      ctx, '加载中...', W / 2, H / 2,
      '400 ' + rpx.rpx(28).toFixed(0) + 'px sans-serif', 'rgba(255,255,255,0.85)'
    )
    return
  }

  // 倒计时区域 + 棋盘
  var countdownH = rpx.rpx(COUNTDOWN_AREA_H_RPX)
  var countdownY = navY + navH + rpx.rpx(8)
  this._drawCountdown(ctx, W, countdownY, countdownH)

  var board = this.engine.boardSize()
  var bx = Math.floor((W - board.w) / 2)
  var by = countdownY + countdownH + rpx.rpx(COUNTDOWN_GAP_RPX)
  this.engine.setBoardPosition(bx, by)
  this.engine.render(ctx)

  var self = this
  this._drawBottomTools(ctx, W, H)

  if (this.showSuccess) {
    this._drawSuccess(ctx, W, H)
    return
  }

  if (this.toolModal) {
    this._drawToolModal(ctx, W, H)
    return
  }

  if (this.showSettings) {
    this._drawSettingsModal(ctx, W, H)
  }

  // 设置图标始终显示（叠在弹窗遮罩之上）
  settingsModal.drawNavIcon(ctx, navY, navH)
  if (!this.showSettings) {
    this.addHitZone(settingsModal.navHitRect(navY, navH, true), function () { self._openSettings() })
  }
}

PuzzleScreen.prototype._drawNav = function (ctx, y, h, W) {
  draw.fillTextCentered(
    ctx, this.levelLabel, W / 2, y + h / 2,
    '600 ' + rpx.rpx(40).toFixed(0) + 'px sans-serif', '#ffffff'
  )
  this._navRect = { x: 0, y: y, w: W, h: h }
}

PuzzleScreen.prototype._drawCountdown = function (ctx, W, y, h) {
  var w = Math.min(W, rpx.rpx(COUNTDOWN_WIDTH_RPX))
  var x = (W - w) / 2
  var radius = h / 2
  var ratio = this.countdownTotalMs > 0 ? this.countdownMs / this.countdownTotalMs : 0

  draw.fillRoundedRect(ctx, x, y, w, h, radius, 'rgba(255,255,255,0.2)')
  draw.strokeRoundedRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius, 'rgba(255,255,255,0.35)', 1)

  var timeFont = '600 ' + rpx.rpx(28).toFixed(0) + 'px sans-serif'
  var timeColor = this.countdownEnded ? '#ffb4b4' : (ratio < 0.2 ? '#ffe0a8' : '#ffffff')
  var timeX = x + w / 2 + rpx.rpx(COUNTDOWN_TIME_OFFSET_X_RPX)

  var alarmW = rpx.rpx(COUNTDOWN_ALARM_W_RPX)
  var alarmH = rpx.rpx(COUNTDOWN_ALARM_H_RPX)
  var alarmX = x + rpx.rpx(COUNTDOWN_ALARM_LEFT_RPX)
  var alarmY = y + (h - alarmH) / 2
  var alarmImg = assets.get(COUNTDOWN_ALARM_IMAGE)
  if (!alarmImg) assets.load(COUNTDOWN_ALARM_IMAGE)
  if (alarmImg) {
    ctx.drawImage(alarmImg, alarmX, alarmY, alarmW, alarmH)
  }

  draw.fillTextCentered(ctx, formatCountdown(this.countdownMs), timeX, y + h / 2, timeFont, timeColor)
}

PuzzleScreen.prototype._drawBottomTools = function (ctx, W, H) {
  var toolW = rpx.rpx(BOTTOM_TOOL_W_RPX)
  var toolH = rpx.rpx(BOTTOM_TOOL_H_RPX)
  var gap = rpx.rpx(BOTTOM_TOOL_GAP_RPX)
  var totalW = BOTTOM_TOOLS.length * toolW + (BOTTOM_TOOLS.length - 1) * gap
  var startX = (W - totalW) / 2
  var y = H - rpx.safeBottom() - rpx.rpx(BOTTOM_TOOL_BOTTOM_RPX) - toolH
  var self = this

  for (var i = 0; i < BOTTOM_TOOLS.length; i++) {
    var tool = BOTTOM_TOOLS[i]
    var x = startX + i * (toolW + gap)
    var img = assets.get(tool.path)
    if (!img) assets.load(tool.path)
    if (img) ctx.drawImage(img, x, y, toolW, toolH)

    var rect = { x: x, y: y, w: toolW, h: toolH }
    ;(function (action) {
      self.addHitZone(rect, function () { self._onBottomTool(action) })
    })(tool.action)
  }
}

PuzzleScreen.prototype._onBottomTool = function (action) {
  if (this.showSuccess || this.showSettings || this.toolModal) return
  if (action === 'addTime' || action === 'hint' || action === 'preview') {
    this.toolModal = action
  }
}

PuzzleScreen.prototype._closeToolModal = function () {
  this.toolModal = null
}

PuzzleScreen.prototype._drawToolModal = function (ctx, W, H) {
  var self = this
  var type = this.toolModal
  toolModal.drawModal(this, ctx, W, H, type, {
    onClose: function () { self._closeToolModal() },
    onConfirm: function () {
      if (type === 'addTime') self._addCountdownTime()
      else if (type === 'hint') self._useHint()
      self._closeToolModal()
    }
  })
}

PuzzleScreen.prototype._addCountdownTime = function () {
  this.countdownMs += COUNTDOWN_ADD_MS
  this.countdownTotalMs += COUNTDOWN_ADD_MS
  this.countdownEnded = false
}

PuzzleScreen.prototype._useHint = function () {
  try {
    wx.showToast({ title: '提示已使用', icon: 'none' })
  } catch (e) {}
}

PuzzleScreen.prototype._drawPrimaryButton = function (ctx, x, y, w, h, label) {
  var grad = ctx.createLinearGradient(x, y, x + w, y + h)
  grad.addColorStop(0, '#667eea')
  grad.addColorStop(1, '#764ba2')
  draw.roundedRectPath(ctx, x, y, w, h, h / 2)
  ctx.fillStyle = grad
  ctx.fill()
  draw.fillTextCentered(
    ctx, label, x + w / 2, y + h / 2,
    '600 ' + rpx.rpx(30).toFixed(0) + 'px sans-serif', '#ffffff'
  )
}

PuzzleScreen.prototype._drawSettingsModal = function (ctx, W, H) {
  var self = this
  settingsModal.drawModal(this, ctx, W, H, {
    onClose: function () { self._closeSettings() },
    onRestart: function () {
      self.showSettings = false
      self._initEngine()
    },
    onHome: function () { self._goHome() },
    onToggle: function (key) {
      if (key === 'sfx' && self.engine) {
        self.engine.setSfxEnabled(settings.get('sfx'))
      }
    }
  })
}

PuzzleScreen.prototype._goHome = function () {
  this.showSettings = false
  this.showSuccess = false
  this.manager.replace(new HomeScreen())
}

PuzzleScreen.prototype._openSettings = function () {
  if (this.showSuccess) return
  this.showSettings = true
}

PuzzleScreen.prototype._closeSettings = function () {
  this.showSettings = false
}

PuzzleScreen.prototype._drawSuccess = function (ctx, W, H) {
  this.resetHitZones()
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(0, 0, W, H)

  var modalW = W - rpx.rpx(80)
  var modalH = rpx.rpx(440)
  var modalX = (W - modalW) / 2
  var modalY = (H - modalH) / 2
  draw.fillRoundedRect(ctx, modalX, modalY, modalW, modalH, rpx.rpx(32), '#ffffff')

  draw.fillTextCentered(
    ctx, '🎉', modalX + modalW / 2, modalY + rpx.rpx(110),
    '400 ' + rpx.rpx(80).toFixed(0) + 'px sans-serif', '#000'
  )
  draw.fillTextCentered(
    ctx, '挑战成功！', modalX + modalW / 2, modalY + rpx.rpx(210),
    '700 ' + rpx.rpx(40).toFixed(0) + 'px sans-serif', '#333'
  )
  draw.fillTextCentered(
    ctx, '恭喜你完成了拼图', modalX + modalW / 2, modalY + rpx.rpx(270),
    '400 ' + rpx.rpx(28).toFixed(0) + 'px sans-serif', '#666'
  )

  var btnW = modalW - rpx.rpx(80)
  var btnH = rpx.rpx(88)
  var btnX = modalX + (modalW - btnW) / 2
  var btnY = modalY + modalH - btnH - rpx.rpx(40)
  this._drawPrimaryButton(ctx, btnX, btnY, btnW, btnH, '再玩一次')
  this._successBtnRect = { x: btnX, y: btnY, w: btnW, h: btnH }
  var self = this
  this.addHitZone(this._successBtnRect, function () { self._initEngine() })
}

// ---------------------------------------------------------------------------
//  事件分发：导航/按钮 vs 棋盘
// ---------------------------------------------------------------------------

PuzzleScreen.prototype._isOnEngine = function (x, y) {
  if (!this.engine || this.loading || this.showSuccess || this.showSettings || this.toolModal) return false
  var board = this.engine.boardSize()
  var bx = this.engine.boardX
  var by = this.engine.boardY
  return x >= bx && x <= bx + board.w && y >= by && y <= by + board.h
}

PuzzleScreen.prototype.onTouchStart = function (e) {
  var t = this._firstTouch(e)
  if (!t) return

  if (this._isOnEngine(t.x, t.y)) {
    var ok = this.engine.onTouchStart(t.x, t.y)
    this._engineTouching = !!ok
    return
  }
  this._engineTouching = false
}

PuzzleScreen.prototype.onTouchMove = function (e) {
  if (!this._engineTouching) return
  var t = this._firstTouch(e)
  if (!t) return
  this.engine.onTouchMove(t.x, t.y)
}

PuzzleScreen.prototype.onTouchEnd = function (e) {
  var t = this._firstTouch(e)
  if (!t) return
  if (this._engineTouching) {
    this._engineTouching = false
    this.engine.onTouchEnd()
    return
  }
  var zone = this.hitZoneAt(t.x, t.y)
  if (zone && zone.handler) zone.handler()
}

PuzzleScreen.prototype.onTouchCancel = function () {
  if (this._engineTouching && this.engine) this.engine.onTouchCancel()
  this._engineTouching = false
}

module.exports = PuzzleScreen
