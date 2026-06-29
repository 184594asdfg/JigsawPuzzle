/**
 * 场景基类：提供按钮区命中、触点归一化等通用能力。子类按需重写
 *   onEnter / onExit / onPause / onResume
 *   onTouchStart / onTouchMove / onTouchEnd / onTouchCancel
 *   update(dt) / render(ctx)
 */
function BaseScreen() {
  this.manager = null
  this._hitZones = []
}

BaseScreen.prototype.onEnter = function (manager) {
  this.manager = manager
}
BaseScreen.prototype.onExit = function () {}
BaseScreen.prototype.onPause = function () {}
BaseScreen.prototype.onResume = function () {}

BaseScreen.prototype.update = function (/* dt */) {}
BaseScreen.prototype.render = function (/* ctx */) {}

/** 触点坐标归一化为逻辑像素（与 layout / hitZone 一致） */
BaseScreen.prototype._firstTouch = function (e) {
  var t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
  if (!t) return null
  var rpxMod = require('../rpx')
  var W = rpxMod.windowWidth()
  var H = rpxMod.windowHeight()
  var x = typeof t.x === 'number' ? t.x : t.clientX
  var y = typeof t.y === 'number' ? t.y : t.clientY
  if (x > W + 2 || y > H + 2) {
    var dpr = rpxMod.pixelRatio() || 1
    x = x / dpr
    y = y / dpr
  }
  return { x: x, y: y, identifier: t.identifier }
}

/** 注册按钮命中区：rect = {x,y,w,h}, handler = function() */
BaseScreen.prototype.resetHitZones = function () {
  this._hitZones = []
}
BaseScreen.prototype.addHitZone = function (rect, handler, opts) {
  this._hitZones.push({ rect: rect, handler: handler, opts: opts || {} })
}
BaseScreen.prototype.hitZoneAt = function (x, y) {
  for (var i = this._hitZones.length - 1; i >= 0; i--) {
    var z = this._hitZones[i]
    var r = z.rect
    if (z.opts && z.opts.shape === 'circle') {
      var cx = r.x + r.w / 2
      var cy = r.y + r.h / 2
      var radius = Math.min(r.w, r.h) / 2
      var dx = x - cx
      var dy = y - cy
      if (dx * dx + dy * dy <= radius * radius) return z
      continue
    }
    if (x >= r.x && x <= r.x + r.w &&
      y >= r.y && y <= r.y + r.h) {
      return z
    }
  }
  return null
}

module.exports = BaseScreen
