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
var toolRewardFly = require('../tool-reward-fly')
var addTimeAlarmFly = require('../add-time-alarm-fly')
var timeupOverlay = require('../timeup-overlay')
var mergeFx = require('../merge-fx')
var winOverlay = require('../win-overlay')
var subpackUi = require('../../utils/subpack-ui')
var galleryData = require('../../utils/gallery-data')
var prefetch = require('../../utils/prefetch')
var tools = require('../../utils/tools')
var pressAnim = require('../press-anim')
var sfx = require('../sfx')
var rewardedAd = require('../rewarded-ad')
var user = require('../../utils/user')

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
/** 整图预览会话 60 秒内可无限次打开；首次使用消耗 1 次 */
var PREVIEW_SESSION_MS = 60 * 1000
var PREVIEW_ICON_VIEWING = 'images/icons/preview3.png'
/** 拼图页纯色背景（与原先渐变主色一致） */
var PUZZLE_BG = '#d0b7eb'

/** 底部三个工具图标：显示 124×138 rpx，资源 248×276 @2x */
var BOTTOM_TOOL_W_RPX = 124
var BOTTOM_TOOL_H_RPX = 138
var BOTTOM_TOOL_GAP_RPX = 96
var BOTTOM_TOOL_BOTTOM_RPX = 48
var BOTTOM_TOOLS = [
  { action: 'addTime', path: 'images/icons/add_time.png', pathActive: 'images/icons/add_time2.png' },
  { action: 'hint', path: 'images/icons/hint.png', pathActive: 'images/icons/hint2.png' },
  { action: 'preview', path: 'images/icons/preview.png', pathActive: 'images/icons/preview2.png' }
]

function isPreviewSessionActive(screen) {
  return !!(screen && screen.previewSessionMs > 0)
}

function bottomToolIconPath(tool, screen) {
  if (
    screen &&
    toolRewardFly.isActive(screen) &&
    screen._toolRewardFly &&
    screen._toolRewardFly.type === tool.action
  ) {
    return tool.path
  }
  if (tool.action === 'preview' && isPreviewSessionActive(screen)) {
    return PREVIEW_ICON_VIEWING
  }
  var remain = tools.getRemain(tool.action)
  return remain > 0 ? tool.pathActive : tool.path
}

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
  this.timeLimitSec = opts.timeLimit > 0 ? Number(opts.timeLimit) : 0
  this.engine = null
  this.loading = true
  this.showSuccess = false
  this.showSettings = false
  this.toolModal = null
  this._navRect = null
  this._winFxMs = 0
  this._engineTouching = false
  this.countdownMs = 0
  this.countdownTotalMs = 0
  this.countdownEnded = false
  this.loadError = ''
  this._pressAnim = null
  this._toolRewardFly = null
  this._addTimeAlarmFly = null
  this._toolConsuming = false
  this.showPreviewOverlay = false
  this.previewSessionMs = 0
  this._timeupFxMs = 0
  this._winNewUnlock = false
  this._winNavigatingHome = false
  this._countdownPaused = false
}
PuzzleScreen.prototype = Object.create(BaseScreen.prototype)
PuzzleScreen.prototype.constructor = PuzzleScreen

PuzzleScreen.prototype.onEnter = function (manager) {
  BaseScreen.prototype.onEnter.call(this, manager)
  var self = this
  assets.load(PuzzleEngine.CARD_BACK_IMAGE)
  rewardedAd.init()
  assets.load(COUNTDOWN_ALARM_IMAGE)
  assets.load(PREVIEW_ICON_VIEWING)
  for (var i = 0; i < BOTTOM_TOOLS.length; i++) {
    assets.load(BOTTOM_TOOLS[i].path)
    assets.load(BOTTOM_TOOLS[i].pathActive)
  }
  settingsModal.preload()
  mergeFx.preload()
  subpackUi.preloadAll().then(function () {
    toolModal.preload()
    timeupOverlay.preload()
    winOverlay.preload()
    self._initEngine()
  }).catch(function (err) {
    console.warn('[puzzle] ui subpack preload failed', err)
    self._initEngine()
  })
}

PuzzleScreen.prototype.onExit = function () {
  rewardedAd.destroy()
  if (this.engine) {
    this.engine.destroy()
    this.engine = null
  }
}

PuzzleScreen.prototype._initEngine = function () {
  var self = this
  this.loading = true
  this.loadError = ''
  this.showSuccess = false
  this.showSettings = false
  settingsModal.clearSettingsEnter(this)
  this.toolModal = null
  toolModal.clearToolEnter(this)
  this._toolRewardFly = null
  this._addTimeAlarmFly = null
  this._toolConsuming = false
  this.showPreviewOverlay = false
  this.previewSessionMs = 0
  this.countdownEnded = false
  this._countdownPaused = false
  this._timeupFxMs = 0
  this._winNewUnlock = false
  this._winNavigatingHome = false
  winOverlay.resetFx(this)
  tools.fetchTools()
  var limitMs = this.timeLimitSec > 0 ? this.timeLimitSec * 1000 : COUNTDOWN_DURATION_MS
  this.countdownTotalMs = limitMs
  this.countdownMs = limitMs
  if (!this.imageSrc) {
    this.loading = false
    this.loadError = 'missing_image'
    try { wx.showToast({ title: '关卡图片地址缺失', icon: 'none' }) } catch (e) {}
    return
  }
  if (this.engine) this.engine.destroy()
  this.engine = new PuzzleEngine({
    windowWidth: rpx.windowWidth(),
    grid: this.gridSize,
    image: this.imageSrc,
    onWin: function () {
      var willAdvance = self.levelKey ? progress.willAdvanceOnComplete(self.levelKey) : false
      if (self.levelKey) progress.markLevelComplete(self.levelKey)
      self._winNewUnlock = willAdvance
      sfx.playWin()
      self.showSuccess = true
      winOverlay.resetFx(self)
    },
    onAnyMove: function () {}
  })
  var W = rpx.windowWidth()
  var navY = rpx.safeTop()
  var navH = rpx.rpx(88)
  var countdownH = rpx.rpx(COUNTDOWN_AREA_H_RPX)
  var countdownY = navY + navH + rpx.rpx(8)
  var board = this.engine.boardSize()
  this.engine.setBoardPosition(
    Math.floor((W - board.w) / 2),
    countdownY + countdownH + rpx.rpx(COUNTDOWN_GAP_RPX)
  )
  var src = this.imageSrc
  if (assets.hasFailed(src)) assets.clearFailed(src)
  if (assets.get(src)) {
    this.loading = false
  }
  this.engine.start().then(function () {
    self.loading = false
    if (self.engine) self.engine.setSfxEnabled(settings.get('sfx'))
  }).catch(function (err) {
    self.loading = false
    self.loadError = 'load_failed'
    console.warn('[puzzle] image load failed:', src, err)
    try { wx.showToast({ title: '拼图图片加载失败', icon: 'none' }) } catch (e) {}
  })
}

// ---------------------------------------------------------------------------
//  渲染
// ---------------------------------------------------------------------------

PuzzleScreen.prototype.update = function (dt) {
  if (this.engine) this.engine.update(dt)
  if (this.showSettings) settingsModal.tickSettingsEnter(this, dt)
  if (this.toolModal) toolModal.tickToolEnter(this, dt)
  toolRewardFly.tick(this)
  addTimeAlarmFly.tick(this)
  if (this.previewSessionMs > 0) {
    this.previewSessionMs -= dt
    if (this.previewSessionMs <= 0) this._endPreviewSession()
  }
  if (
    this.engine && !this.loading && !this.engine.isInputLocked() &&
    !this.showSuccess && !this.showSettings &&
    !this.toolModal &&
    !this._countdownPaused &&
    !this.countdownEnded && this.countdownMs > 0
  ) {
    this.countdownMs -= dt
    if (this.countdownMs <= 0) {
      this.countdownMs = 0
      if (!this.countdownEnded) {
        this.countdownEnded = true
        sfx.playTimeup()
        timeupOverlay.resetFx(this)
      }
    }
  }
  if (this.countdownEnded && !this.showSuccess) {
    timeupOverlay.tickFx(this, dt)
  }
  if (this.showSuccess) {
    winOverlay.tickFx(this, dt)
  }
  var tick = pressAnim.tickPressAnim(this._pressAnim, dt)
  this._pressAnim = tick.anim
  if (tick.completed) {
    if (tick.id === 'settings') this._openSettings()
    else if (tick.id === 'timeupHome') this._onTimeUpGoHome()
    else if (tick.id === 'timeupWatch') this._onTimeUpWatchAddTime()
    else this._onBottomTool(tick.id)
  }
}

PuzzleScreen.prototype.render = function (ctx) {
  var W = rpx.windowWidth()
  var H = rpx.windowHeight()
  this.resetHitZones()

  ctx.fillStyle = PUZZLE_BG
  ctx.fillRect(0, 0, W, H)

  var navY = rpx.safeTop()
  var navH = rpx.rpx(88)

  if (this.loading || !this.engine) {
    draw.fillTextCentered(
      ctx, '加载中...', W / 2, H / 2,
      '400 ' + rpx.rpx(28).toFixed(0) + 'px sans-serif', 'rgba(255,255,255,0.85)'
    )
    return
  }

  if (this.loadError || !this.engine.image) {
    draw.fillTextCentered(
      ctx, '拼图图片加载失败', W / 2, H / 2 - rpx.rpx(20),
      '400 ' + rpx.rpx(28).toFixed(0) + 'px sans-serif', 'rgba(255,255,255,0.85)'
    )
    draw.fillTextCentered(
      ctx, '请检查网络或 CDN 域名配置', W / 2, H / 2 + rpx.rpx(20),
      '400 ' + rpx.rpx(24).toFixed(0) + 'px sans-serif', 'rgba(255,255,255,0.65)'
    )
    return
  }

  var self = this

  if (this.showSuccess) {
    winOverlay.drawOverlay(this, ctx, W, H, {
      onGoHome: function () {
        sfx.playClick()
        self._goHomeAfterWin()
      }
    })
    return
  }

  this._drawNav(ctx, navY, navH, W)

  // 倒计时区域 + 棋盘
  var countdownH = rpx.rpx(COUNTDOWN_AREA_H_RPX)
  var countdownY = navY + navH + rpx.rpx(8)
  this._drawCountdown(ctx, W, countdownY, countdownH)
  this.engine.render(ctx)

  this._drawBottomTools(ctx, W, H)
  toolRewardFly.render(ctx, this)
  addTimeAlarmFly.render(ctx, this)

  if (this.showPreviewOverlay) {
    this._drawPreviewOverlay(ctx, W, H)
  }

  if (this.countdownEnded) {
    this._drawTimeUpOverlay(ctx, W, H)
    return
  }

  if (this.toolModal) {
    this._drawToolModal(ctx, W, H)
    return
  }

  if (this.showSettings) {
    this._drawSettingsModal(ctx, W, H)
  }

  // 设置图标（按压动效结束后再弹窗）
  var anim = this._pressAnim
  settingsModal.drawNavIcon(ctx, navY, navH, pressAnim.btnScale(anim, 'settings'))
  if (!this.showSettings && !anim && !this.countdownEnded &&
    !(this.engine && this.engine.isInputLocked())) {
    this.addHitZone(settingsModal.navHitRect(navY, navH, true), function () {
      self._startPressAnim('settings')
    })
  }
}

PuzzleScreen.prototype._drawNav = function (ctx, y, h, W) {
  draw.fillTextCentered(
    ctx, this.levelLabel, W / 2, y + h / 2,
    '600 ' + rpx.rpx(40).toFixed(0) + 'px sans-serif', '#ffffff'
  )
  this._navRect = { x: 0, y: y, w: W, h: h }
}

PuzzleScreen.prototype._getCountdownLayout = function (W) {
  var navY = rpx.safeTop()
  var navH = rpx.rpx(88)
  var h = rpx.rpx(COUNTDOWN_AREA_H_RPX)
  var y = navY + navH + rpx.rpx(8)
  var w = Math.min(W, rpx.rpx(COUNTDOWN_WIDTH_RPX))
  var x = (W - w) / 2
  var alarmW = rpx.rpx(COUNTDOWN_ALARM_W_RPX)
  var alarmH = rpx.rpx(COUNTDOWN_ALARM_H_RPX)
  var alarmX = x + rpx.rpx(COUNTDOWN_ALARM_LEFT_RPX)
  var alarmY = y + (h - alarmH) / 2
  return {
    x: x, y: y, w: w, h: h,
    alarmX: alarmX, alarmY: alarmY, alarmW: alarmW, alarmH: alarmH,
    alarmCx: alarmX + alarmW / 2,
    alarmCy: alarmY + alarmH / 2
  }
}

PuzzleScreen.prototype._drawCountdown = function (ctx, W, y, h) {
  var layout = this._getCountdownLayout(W)
  var x = layout.x
  var w = layout.w
  var radius = h / 2
  var ratio = this.countdownTotalMs > 0 ? this.countdownMs / this.countdownTotalMs : 0

  draw.fillRoundedRect(ctx, x, y, w, h, radius, 'rgba(0,0,0,0.2)')

  var timeFont = '600 ' + rpx.rpx(28).toFixed(0) + 'px sans-serif'
  var timeColor = this.countdownEnded ? '#ffb4b4' : (ratio < 0.2 ? '#ffe0a8' : '#ffffff')
  var timeX = x + w / 2 + rpx.rpx(COUNTDOWN_TIME_OFFSET_X_RPX)

  var alarmImg = assets.get(COUNTDOWN_ALARM_IMAGE)
  if (!alarmImg) assets.load(COUNTDOWN_ALARM_IMAGE)
  if (alarmImg) {
    ctx.drawImage(
      alarmImg, layout.alarmX, layout.alarmY, layout.alarmW, layout.alarmH
    )
  }

  draw.fillTextCentered(ctx, formatCountdown(this.countdownMs), timeX, y + h / 2, timeFont, timeColor)
}

PuzzleScreen.prototype._getBottomToolLayout = function (W, H) {
  var toolW = rpx.rpx(BOTTOM_TOOL_W_RPX)
  var toolH = rpx.rpx(BOTTOM_TOOL_H_RPX)
  var gap = rpx.rpx(BOTTOM_TOOL_GAP_RPX)
  var totalW = BOTTOM_TOOLS.length * toolW + (BOTTOM_TOOLS.length - 1) * gap
  var startX = (W - totalW) / 2
  var y = H - rpx.safeBottom() - rpx.rpx(BOTTOM_TOOL_BOTTOM_RPX) - toolH
  var map = {}
  for (var i = 0; i < BOTTOM_TOOLS.length; i++) {
    var x = startX + i * (toolW + gap)
    map[BOTTOM_TOOLS[i].action] = {
      x: x,
      y: y,
      w: toolW,
      h: toolH,
      cx: x + toolW / 2,
      cy: y + toolH / 2
    }
  }
  return map
}

PuzzleScreen.prototype._drawPreviewToolBadge = function (ctx, x, y, toolW, toolH) {
  if (!isPreviewSessionActive(this)) return
  var sec = Math.max(0, Math.ceil(this.previewSessionMs / 1000))
  var text = String(sec)
  var tx = x + toolW - rpx.rpx(61)
  var ty = y + rpx.rpx(70)
  var badgeFont = '700 ' + rpx.rpx(27).toFixed(0) + 'px sans-serif'
  ctx.font = badgeFont
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = Math.max(2, rpx.rpx(4))
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#5C3A12'
  ctx.strokeText(text, tx, ty)
  ctx.fillStyle = '#FFE566'
  ctx.fillText(text, tx, ty)
}

PuzzleScreen.prototype._drawBottomTools = function (ctx, W, H) {
  var layout = this._getBottomToolLayout(W, H)
  var self = this
  var anim = this._pressAnim
  var blockHits = !!anim || this.showSuccess || this.showSettings || this.toolModal ||
    this.countdownEnded ||
    this.showPreviewOverlay || toolRewardFly.isActive(this) ||
    addTimeAlarmFly.isActive(this) ||
    (this.engine && this.engine.isInputLocked())

  for (var i = 0; i < BOTTOM_TOOLS.length; i++) {
    var tool = BOTTOM_TOOLS[i]
    var slot = layout[tool.action]
    var isPreview = tool.action === 'preview'
    var x = slot.x
    var y = slot.y
    var toolW = slot.w
    var toolH = slot.h

    var scale = pressAnim.btnScale(anim, tool.action)
    ;(function (t, px, py, sc) {
      var iconPath = bottomToolIconPath(t, self)
      pressAnim.drawWithPressScale(ctx, px + toolW / 2, py + toolH / 2, sc, function () {
        var img = assets.get(iconPath)
        if (!img) assets.load(iconPath)
        if (img) ctx.drawImage(img, px, py, toolW, toolH)
      })
    })(tool, x, y, scale)

    if (isPreview && isPreviewSessionActive(self)) {
      self._drawPreviewToolBadge(ctx, x, y, toolW, toolH)
    } else {
      var showRemain = tools.getRemain(tool.action)
      if (
        showRemain > 0 &&
        !(toolRewardFly.isActive(self) && self._toolRewardFly && self._toolRewardFly.type === tool.action)
      ) {
        var badgeFont = '700 ' + rpx.rpx(27).toFixed(0) + 'px sans-serif'
        draw.fillTextCentered(
          ctx, String(showRemain), x + toolW - rpx.rpx(20), y + rpx.rpx(20),
          badgeFont, '#ffffff'
        )
      }
    }

    if (!blockHits) {
      var rect = { x: x, y: y, w: toolW, h: toolH }
      ;(function (action) {
        self.addHitZone(rect, function () { self._startPressAnim(action) })
      })(tool.action)
    }
  }
}

PuzzleScreen.prototype._onBottomTool = function (action) {
  if (this.showSuccess || this.showSettings || this.toolModal || this.countdownEnded) return
  if (toolRewardFly.isActive(this) || addTimeAlarmFly.isActive(this)) return
  if (this.engine && this.engine.isInputLocked()) return
  if (action === 'preview' && isPreviewSessionActive(this)) {
    this._openPreviewOverlay()
    return
  }
  if (tools.getRemain(action) > 0) {
    this._consumeAndApplyTool(action)
    return
  }
  if (action === 'addTime' || action === 'hint' || action === 'preview') {
    this.toolModal = action
    toolModal.beginToolEnter(this)
  }
}

PuzzleScreen.prototype._closeToolModal = function () {
  this.toolModal = null
  toolModal.clearToolEnter(this)
}

/** 激励视频播放期间暂停关卡倒计时，关闭或加载失败后恢复 */
PuzzleScreen.prototype._showRewardedAd = function () {
  var self = this
  self._countdownPaused = true
  return rewardedAd.show().then(function (completed) {
    self._countdownPaused = false
    return completed
  }, function (err) {
    self._countdownPaused = false
    throw err
  })
}

PuzzleScreen.prototype._drawToolModal = function (ctx, W, H) {
  var self = this
  var type = this.toolModal
  toolModal.drawModal(this, ctx, W, H, type, {
    onClose: function () { self._closeToolModal() },
    onConfirm: function () { self._onToolModalConfirm(type, W, H) }
  })
}

/** 观看激励视频后 grant +1，飞图标落按钮；不自动 consume，需用户再点底部按钮使用 */
PuzzleScreen.prototype._onToolModalConfirm = function (type, W, H) {
  var self = this
  var layout = this._getBottomToolLayout(W, H)
  var target = layout[type]

  var runGrantFly = function () {
    if (!target) return
    var modalRect = toolModal.computeModalRect(W, H)
    toolRewardFly.start(self, {
      type: type,
      fromX: modalRect.x + modalRect.w / 2,
      fromY: modalRect.y + modalRect.h / 2,
      toX: target.cx,
      toY: target.cy
    })
  }

  this._closeToolModal()
  this._showRewardedAd().then(function (completed) {
    if (!completed) {
      try { wx.showToast({ title: '需完整观看广告才能获得道具', icon: 'none' }) } catch (e) {}
      return
    }
    return tools.grant(type, 'ad').then(runGrantFly)
  }).catch(function (err) {
    try { wx.showToast({ title: err.message || '广告加载失败', icon: 'none' }) } catch (e) {}
  })
}

PuzzleScreen.prototype._consumeAndApplyTool = function (type) {
  var self = this
  if (this._toolConsuming) return

  if (type === 'hint') {
    if (!this.engine || this.loading) return
    if (!this.engine.applyHint()) {
      try {
        wx.showToast({
          title: this.engine.solved ? '拼图已完成' : '当前无法提示',
          icon: 'none'
        })
      } catch (e) {}
      return
    }
    this._toolConsuming = true
    tools.consume(type).then(function () {
      self._toolConsuming = false
    }).catch(function (err) {
      self._toolConsuming = false
      try { wx.showToast({ title: err.message || '次数同步失败', icon: 'none' }) } catch (e2) {}
    })
    return
  }

  this._toolConsuming = true
  tools.consume(type).then(function () {
    self._toolConsuming = false
    self._runToolEffect(type)
  }).catch(function (err) {
    self._toolConsuming = false
    try { wx.showToast({ title: err.message || '次数不足', icon: 'none' }) } catch (e) {}
  })
}

PuzzleScreen.prototype._playAddTimeAlarmFly = function () {
  var W = rpx.windowWidth()
  var H = rpx.windowHeight()
  var from = this._getBottomToolLayout(W, H).addTime
  var cd = this._getCountdownLayout(W)
  if (!from) {
    this._addCountdownTime()
    return
  }
  var self = this
  addTimeAlarmFly.start(this, {
    fromX: from.cx,
    fromY: from.cy,
    toX: cd.alarmCx,
    toY: cd.alarmCy,
    onDone: function () { self._addCountdownTime() }
  })
}

PuzzleScreen.prototype._runToolEffect = function (type) {
  if (type === 'addTime') {
    this._playAddTimeAlarmFly()
  } else if (type === 'preview') {
    this._startPreviewSession()
    this._openPreviewOverlay()
  }
}

PuzzleScreen.prototype._startPreviewSession = function () {
  this.previewSessionMs = PREVIEW_SESSION_MS
}

PuzzleScreen.prototype._endPreviewSession = function () {
  this.previewSessionMs = 0
  this.showPreviewOverlay = false
}

PuzzleScreen.prototype._openPreviewOverlay = function () {
  if (!isPreviewSessionActive(this)) return
  this.showPreviewOverlay = true
}

PuzzleScreen.prototype._closePreviewOverlay = function () {
  this.showPreviewOverlay = false
}

PuzzleScreen.prototype._drawPreviewOverlay = function (ctx, W, H) {
  var self = this
  this.resetHitZones()

  ctx.fillStyle = 'rgba(0,0,0,0.72)'
  ctx.fillRect(0, 0, W, H)
  this.addHitZone({ x: 0, y: 0, w: W, h: H }, function () {
    self._closePreviewOverlay()
  })

  var pad = rpx.rpx(40)
  var top = rpx.safeTop() + rpx.rpx(100)
  var bottom = H - rpx.safeBottom() - rpx.rpx(200)
  var maxW = W - pad * 2
  var maxH = bottom - top
  if (maxH < rpx.rpx(200)) maxH = H * 0.55

  var img = this.engine && this.engine.image
  if (img && img.width && img.height) {
    var ratio = img.width / img.height
    var drawW = maxW
    var drawH = drawW / ratio
    if (drawH > maxH) {
      drawH = maxH
      drawW = drawH * ratio
    }
    var ix = (W - drawW) / 2
    var iy = top + (maxH - drawH) / 2
    ctx.drawImage(img, ix, iy, drawW, drawH)
  }

  draw.fillTextCentered(
    ctx, '点击空白处关闭', W / 2, H - rpx.safeBottom() - rpx.rpx(72),
    '400 ' + rpx.rpx(24).toFixed(0) + 'px sans-serif', 'rgba(255,255,255,0.75)'
  )
}

PuzzleScreen.prototype._addCountdownTime = function () {
  this.countdownMs += COUNTDOWN_ADD_MS
  this.countdownTotalMs += COUNTDOWN_ADD_MS
  this.countdownEnded = false
}

PuzzleScreen.prototype._drawTimeUpOverlay = function (ctx, W, H) {
  var self = this
  var pressId = this._pressAnim && (
    this._pressAnim.id === 'timeupHome' || this._pressAnim.id === 'timeupWatch'
  ) ? this._pressAnim.id : null
  timeupOverlay.drawOverlay(this, ctx, W, H, {
    onGoHome: function () { self._startPressAnim('timeupHome') },
    onWatchAddTime: function () { self._startPressAnim('timeupWatch') }
  }, pressId)
}

/** 观看激励视频后 +60 秒并继续 */
PuzzleScreen.prototype._onTimeUpWatchAddTime = function () {
  if (!this.countdownEnded || this._toolConsuming) return
  var self = this
  this._showRewardedAd().then(function (completed) {
    if (!completed) {
      try { wx.showToast({ title: '需完整观看广告才能加时', icon: 'none' }) } catch (e) {}
      return
    }
    var W = rpx.windowWidth()
    var layout = timeupOverlay.computeLayout(W, rpx.windowHeight())
    var cd = self._getCountdownLayout(W)
    self.countdownEnded = false
    addTimeAlarmFly.start(self, {
      fromX: layout.watchCx,
      fromY: layout.btnCy,
      toX: cd.alarmCx,
      toY: cd.alarmCy,
      onDone: function () { self._addCountdownTime() }
    })
  }).catch(function (err) {
    try { wx.showToast({ title: err.message || '广告加载失败', icon: 'none' }) } catch (e) {}
  })
}

PuzzleScreen.prototype._onTimeUpGoHome = function () {
  if (!this.countdownEnded) return
  this.countdownEnded = false
  this._goHome()
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
      settingsModal.clearSettingsEnter(self)
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

PuzzleScreen.prototype._resolveSliceUnlock = function () {
  if (!this._winNewUnlock || !this.levelKey) return null
  var lv = galleryData.getLevelByKey(this.levelKey)
  if (!lv || !lv.themeId) return null
  var theme = galleryData.getThemeById(lv.themeId)
  if (!theme) return null
  var n = progress.countThemeCompleted(theme)
  if (n <= 0) return null
  var cellIndex = n - 1
  if (cellIndex >= HomeScreen.HERO_GRID_CELLS) {
    cellIndex = HomeScreen.HERO_GRID_CELLS - 1
  }
  return { cellIndex: cellIndex, themeId: lv.themeId }
}

PuzzleScreen.prototype._goHomeWithSliceUnlock = function (sliceUnlock, opts) {
  this.showSettings = false
  settingsModal.clearSettingsEnter(this)
  this.showSuccess = false
  this._winNavigatingHome = true
  if (this.engine) {
    this.engine.destroy()
    this.engine = null
  }
  prefetch.prefetchHomeAssets()
  this.manager.replace(HomeScreen.create(sliceUnlock, opts))
}

PuzzleScreen.prototype._goHomeAfterWin = function () {
  if (this._winNavigatingHome) return
  var shrinkDone = (this._winFxMs != null ? this._winFxMs : 0) >= winOverlay.SHRINK_MS
  if (!shrinkDone) return
  this._goHomeWithSliceUnlock(this._resolveSliceUnlock(), { fromWin: true })
}

PuzzleScreen.prototype._goHome = function () {
  this._goHomeWithSliceUnlock(null)
}

PuzzleScreen.prototype._openSettings = function () {
  if (this.showSuccess || this.countdownEnded) return
  if (this.engine && this.engine.isInputLocked()) return
  this.showSettings = true
  settingsModal.beginSettingsEnter(this)
}

PuzzleScreen.prototype._startPressAnim = function (id) {
  if (this._pressAnim) return
  if (this.loading || !this.engine || this.loadError) return
  var isTimeUp = id === 'timeupHome' || id === 'timeupWatch'
  if (isTimeUp) {
    if (!this.countdownEnded || this.showSuccess) return
    if (toolRewardFly.isActive(this) || addTimeAlarmFly.isActive(this)) return
  } else {
    if (this.showSuccess || this.showSettings || this.toolModal || this.countdownEnded) return
    if (toolRewardFly.isActive(this) || addTimeAlarmFly.isActive(this)) return
    if (this.engine && this.engine.isInputLocked()) return
  }
  sfx.playClick()
  this._pressAnim = { id: id, time: 0 }
}

PuzzleScreen.prototype._closeSettings = function () {
  user.destroyProfileButton()
  user.clearProfileAuthorizePending()
  this.showSettings = false
  settingsModal.clearSettingsEnter(this)
}

PuzzleScreen.prototype._goNextLevel = function () {
  this._goHomeAfterWin()
}

// ---------------------------------------------------------------------------
//  事件分发：导航/按钮 vs 棋盘
// ---------------------------------------------------------------------------

PuzzleScreen.prototype._isOnEngine = function (x, y) {
  if (!this.engine || this.loading || this.engine.isInputLocked() ||
    this.showSuccess || this.showSettings || this.toolModal ||
    this.countdownEnded ||
    this.showPreviewOverlay || toolRewardFly.isActive(this) ||
    addTimeAlarmFly.isActive(this)) return false
  var board = this.engine.boardSize()
  var bx = this.engine.boardX
  var by = this.engine.boardY
  return x >= bx && x <= bx + board.w && y >= by && y <= by + board.h
}

PuzzleScreen.prototype.onTouchStart = function (e) {
  var t = this._firstTouch(e)
  if (!t) return

  if (this.showSuccess) {
    this._engineTouching = false
    return
  }

  if (this.showPreviewOverlay) {
    this._engineTouching = false
    return
  }

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

  if (this.showSuccess) {
    var winZone = this.hitZoneAt(t.x, t.y)
    if (winZone && winZone.handler) winZone.handler()
    return
  }

  if (this.showPreviewOverlay) {
    sfx.playClick()
    this._closePreviewOverlay()
    return
  }

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
  this._pressAnim = null
}

module.exports = PuzzleScreen
