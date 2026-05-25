/**
 * 工具弹窗「立刻获得」后：奖励图标从弹窗中心飞向底部对应按钮（暂不接广告）
 */
var rpx = require('./rpx')
var assets = require('./assets')
var draw = require('./draw')

var FLY_DUR_MS = 520
var FLY_ICON_SIZE_RPX = 128

var tools = require('../utils/tools')

var ICON_BY_TYPE = {
  addTime: 'images/icons/add_time.png',
  hint: 'images/icons/hint.png',
  preview: 'images/icons/preview.png'
}

var ICON_ACTIVE_BY_TYPE = {
  addTime: 'images/icons/add_time2.png',
  hint: 'images/icons/hint2.png',
  preview: 'images/icons/preview2.png'
}

function iconPathForType(type) {
  return tools.getRemain(type) > 0 ? ICON_ACTIVE_BY_TYPE[type] : ICON_BY_TYPE[type]
}

function easeOutCubic(t) {
  var p = 1 - t
  return 1 - p * p * p
}

/**
 * @param {object} screen - PuzzleScreen
 * @param {object} opts - { type, fromX, fromY, toX, toY, onDone }
 */
function start(screen, opts) {
  screen._toolRewardFly = {
    type: opts.type,
    fromX: opts.fromX,
    fromY: opts.fromY,
    toX: opts.toX,
    toY: opts.toY,
    x: opts.fromX,
    y: opts.fromY,
    scale: 1.2,
    alpha: 1,
    t0: Date.now(),
    dur: FLY_DUR_MS,
    onDone: opts.onDone || null
  }
}

function tick(screen) {
  var fly = screen._toolRewardFly
  if (!fly) return
  var t = (Date.now() - fly.t0) / fly.dur
  if (t >= 1) {
    var done = fly.onDone
    screen._toolRewardFly = null
    if (done) done()
    return
  }
  var e = easeOutCubic(t)
  fly.x = fly.fromX + (fly.toX - fly.fromX) * e
  fly.y = fly.fromY + (fly.toY - fly.fromY) * e
  fly.scale = 1.2 - 0.2 * e
  fly.alpha = 1
}

function isActive(screen) {
  return !!screen._toolRewardFly
}

function render(ctx, screen) {
  var fly = screen._toolRewardFly
  if (!fly) return

  var size = rpx.rpx(FLY_ICON_SIZE_RPX)
  var x = fly.x - size / 2
  var y = fly.y - size / 2

  ctx.save()
  ctx.globalAlpha = fly.alpha
  ctx.translate(fly.x, fly.y)
  ctx.scale(fly.scale, fly.scale)
  ctx.translate(-fly.x, -fly.y)

  var path = iconPathForType(fly.type)
  var img = path ? assets.get(path) : null
  if (!img && path) assets.tryLoad(path)
  if (img) {
    draw.drawImageContain(ctx, img, x, y, size, size)
  }

  ctx.restore()
}

module.exports = {
  FLY_DUR_MS: FLY_DUR_MS,
  start: start,
  tick: tick,
  render: render,
  isActive: isActive
}
