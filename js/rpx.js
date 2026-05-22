/**
 * rpx ↔ px 适配：基准宽度 750rpx
 * 在 main.js 完成系统信息初始化后调用 init({ windowWidth })
 */
var BASE = 750
var _scale = 1
var _windowWidth = 375
var _windowHeight = 667
var _safeTop = 20
var _safeBottom = 0
var _pixelRatio = 1

function init(info) {
  _windowWidth = info.windowWidth || 375
  _windowHeight = info.windowHeight || 667
  _scale = _windowWidth / BASE
  _pixelRatio = info.pixelRatio || 1
  if (info.safeArea && typeof info.safeArea.top === 'number') {
    _safeTop = info.safeArea.top
    _safeBottom = Math.max(0, _windowHeight - info.safeArea.bottom)
  } else if (typeof info.statusBarHeight === 'number') {
    _safeTop = info.statusBarHeight
  }
}

function rpx(value) {
  return value * _scale
}

function px(value) {
  return value / _scale
}

function windowWidth() { return _windowWidth }
function windowHeight() { return _windowHeight }
function safeTop() { return _safeTop }
function safeBottom() { return _safeBottom }
function pixelRatio() { return _pixelRatio }
function scale() { return _scale }

module.exports = {
  init: init,
  rpx: rpx,
  px: px,
  windowWidth: windowWidth,
  windowHeight: windowHeight,
  safeTop: safeTop,
  safeBottom: safeBottom,
  pixelRatio: pixelRatio,
  scale: scale
}
