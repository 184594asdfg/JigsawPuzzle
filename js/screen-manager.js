/**
 * 场景栈：顶层独占输入；每帧仅对栈顶 update/render（下层 onPause 不绘制）。
 */
function ScreenManager() {
  this.stack = []
  this.ctx = null
}

ScreenManager.prototype.attach = function (ctx) {
  this.ctx = ctx
}

ScreenManager.prototype.push = function (screen) {
  if (this.stack.length) {
    var prev = this.stack[this.stack.length - 1]
    if (prev && typeof prev.onPause === 'function') prev.onPause()
  }
  this.stack.push(screen)
  if (typeof screen.onEnter === 'function') screen.onEnter(this)
}

ScreenManager.prototype.replace = function (screen) {
  while (this.stack.length) this.pop()
  this.push(screen)
}

ScreenManager.prototype.pop = function () {
  var top = this.stack.pop()
  if (top && typeof top.onExit === 'function') top.onExit()
  if (this.stack.length) {
    var cur = this.stack[this.stack.length - 1]
    if (cur && typeof cur.onResume === 'function') cur.onResume()
  }
  return top
}

ScreenManager.prototype.top = function () {
  return this.stack.length ? this.stack[this.stack.length - 1] : null
}

ScreenManager.prototype.render = function (dt) {
  var top = this.top()
  if (!top) return
  if (typeof top.update === 'function') top.update(dt)
  if (typeof top.render === 'function') top.render(this.ctx)
}

ScreenManager.prototype._dispatch = function (method, e) {
  var top = this.top()
  if (top && typeof top[method] === 'function') top[method](e)
}

ScreenManager.prototype.onTouchStart = function (e) { this._dispatch('onTouchStart', e) }
ScreenManager.prototype.onTouchMove = function (e) { this._dispatch('onTouchMove', e) }
ScreenManager.prototype.onTouchEnd = function (e) { this._dispatch('onTouchEnd', e) }
ScreenManager.prototype.onTouchCancel = function (e) { this._dispatch('onTouchCancel', e) }

module.exports = new ScreenManager()
