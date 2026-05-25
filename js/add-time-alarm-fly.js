/**
 * 使用加时道具：alarm 从底部加时按钮飞向倒计时闹钟位置后消失，再 +1 分钟
 */
var rpx = require('./rpx')
var assets = require('./assets')

var ALARM_IMAGE = 'images/icons/alarm.png'
var FLY_DUR_MS = 520
var FLY_W_RPX = 60
var FLY_H_RPX = 60
var FADE_START = 0.82

function easeOutCubic(t) {
  var p = 1 - t
  return 1 - p * p * p
}

/**
 * @param {object} screen - PuzzleScreen
 * @param {object} opts - { fromX, fromY, toX, toY, onDone }
 */
function start(screen, opts) {
  screen._addTimeAlarmFly = {
    fromX: opts.fromX,
    fromY: opts.fromY,
    toX: opts.toX,
    toY: opts.toY,
    x: opts.fromX,
    y: opts.fromY,
    scale: 1.15,
    alpha: 1,
    t0: Date.now(),
    dur: FLY_DUR_MS,
    onDone: opts.onDone || null
  }
}

function tick(screen) {
  var fly = screen._addTimeAlarmFly
  if (!fly) return
  var t = (Date.now() - fly.t0) / fly.dur
  if (t >= 1) {
    var done = fly.onDone
    screen._addTimeAlarmFly = null
    if (done) done()
    return
  }
  var e = easeOutCubic(t)
  fly.x = fly.fromX + (fly.toX - fly.fromX) * e
  fly.y = fly.fromY + (fly.toY - fly.fromY) * e
  fly.scale = 1.15 - 0.15 * e
  fly.alpha = t >= FADE_START ? 1 - (t - FADE_START) / (1 - FADE_START) : 1
}

function isActive(screen) {
  return !!screen._addTimeAlarmFly
}

function render(ctx, screen) {
  var fly = screen._addTimeAlarmFly
  if (!fly) return

  var w = rpx.rpx(FLY_W_RPX)
  var h = rpx.rpx(FLY_H_RPX)
  var x = fly.x - (w * fly.scale) / 2
  var y = fly.y - (h * fly.scale) / 2

  var img = assets.get(ALARM_IMAGE)
  if (!img) assets.load(ALARM_IMAGE)
  if (!img) return

  ctx.save()
  ctx.globalAlpha = fly.alpha
  ctx.drawImage(img, x, y, w * fly.scale, h * fly.scale)
  ctx.restore()
}

module.exports = {
  ALARM_IMAGE: ALARM_IMAGE,
  FLY_DUR_MS: FLY_DUR_MS,
  start: start,
  tick: tick,
  render: render,
  isActive: isActive
}
