/**
 * 拼图场景：顶部导航 + 棋盘 + 底部「重新开始」 + 成功弹窗。
 * 真正的棋盘渲染与交互在 PuzzleEngine 中完成。
 */
var BaseScreen = require('./base-screen')
var rpx = require('../rpx')
var draw = require('../draw')
var PuzzleEngine = require('../puzzle/puzzle-engine')
var progress = require('../../utils/progress')

function PuzzleScreen(opts) {
  BaseScreen.call(this)
  this.opts = opts || {}
  this.imageSrc = opts.image
  this.gridSize = opts.grid || 4
  this.levelKey = opts.levelKey || ''
  this.levelLabel = opts.levelLabel || '拼图'
  this.engine = null
  this.loading = true
  this.showSuccess = false
  this._navRect = null
  this._restartRect = null
  this._successBtnRect = null
  this._engineTouching = false
}
PuzzleScreen.prototype = Object.create(BaseScreen.prototype)
PuzzleScreen.prototype.constructor = PuzzleScreen

PuzzleScreen.prototype.onEnter = function (manager) {
  BaseScreen.prototype.onEnter.call(this, manager)
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
  }).catch(function () {
    self.loading = false
  })
}

// ---------------------------------------------------------------------------
//  渲染
// ---------------------------------------------------------------------------

PuzzleScreen.prototype.update = function (dt) {
  if (this.engine) this.engine.update(dt)
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

  // 计算棋盘位置（横向居中、顶部留导航 + 边距）
  var board = this.engine.boardSize()
  var bx = Math.floor((W - board.w) / 2)
  var by = navY + navH + rpx.rpx(16)
  this.engine.setBoardPosition(bx, by)
  this.engine.render(ctx)

  // 底部「重新开始」
  var btnW = W - rpx.rpx(60)
  var btnH = rpx.rpx(88)
  var btnX = (W - btnW) / 2
  var btnY = H - rpx.safeBottom() - rpx.rpx(30) - btnH
  this._drawPrimaryButton(ctx, btnX, btnY, btnW, btnH, '重新开始')
  this._restartRect = { x: btnX, y: btnY, w: btnW, h: btnH }
  var self = this
  this.addHitZone(this._restartRect, function () { self._initEngine() })

  if (this.showSuccess) {
    this._drawSuccess(ctx, W, H)
  }
}

PuzzleScreen.prototype._drawNav = function (ctx, y, h, W) {
  // 返回区
  draw.drawNavArrow(ctx, rpx.rpx(36), y + h / 2, rpx.rpx(20), '#ffffff', rpx.rpx(4))
  var self = this
  this.addHitZone(
    { x: 0, y: y, w: rpx.rpx(80), h: h },
    function () { self._goBack() }
  )
  // 标题
  draw.fillTextCentered(
    ctx, this.levelLabel, W / 2, y + h / 2,
    '600 ' + rpx.rpx(40).toFixed(0) + 'px sans-serif', '#ffffff'
  )
  this._navRect = { x: 0, y: y, w: W, h: h }
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
  if (!this.engine || this.loading || this.showSuccess) return false
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

PuzzleScreen.prototype._goBack = function () {
  if (this.showSuccess) {
    this.showSuccess = false
    return
  }
  this.manager.pop()
}

module.exports = PuzzleScreen
