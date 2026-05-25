/**
 * 开场加载页：与游戏主界面统一的渐变背景 + 转圈加载 + 进度条
 */
var rpx = require('../rpx')
var draw = require('../draw')

var SPINNER_R_RPX = 40
var SPINNER_TRACK_RPX = 5
var SPINNER_ARC_RPX = 6
var BAR_W_RPX = 420
var BAR_H_RPX = 12
var TITLE_TOP_OFFSET_RPX = 120

function fillGameGradient(ctx, W, H) {
  var grad = ctx.createLinearGradient(0, 0, W * 0.6, H)
  grad.addColorStop(0, '#5b6fd8')
  grad.addColorStop(0.45, '#6d5b9e')
  grad.addColorStop(1, '#764ba2')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
}

function drawSpinner(ctx, cx, cy, angle) {
  var r = rpx.rpx(SPINNER_R_RPX)
  var trackW = rpx.rpx(SPINNER_TRACK_RPX)
  var arcW = rpx.rpx(SPINNER_ARC_RPX)

  ctx.save()
  ctx.lineCap = 'round'

  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = trackW
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = arcW
  ctx.beginPath()
  ctx.arc(cx, cy, r, angle, angle + Math.PI * 1.35)
  ctx.stroke()
  ctx.restore()
}

function update(state, dt) {
  state.spinner = (state.spinner + dt * 0.0065) % (Math.PI * 2)
}

/**
 * @param {object} state - { progress, hint, spinner }
 * @param {number} [alpha] - 出场过渡时淡出
 */
function render(ctx, state, alpha) {
  alpha = alpha == null ? 1 : alpha
  if (alpha <= 0) return

  var W = rpx.windowWidth()
  var H = rpx.windowHeight()
  var cx = W / 2
  var contentY = H * 0.52

  ctx.save()
  ctx.globalAlpha = alpha

  fillGameGradient(ctx, W, H)

  var topGrad = ctx.createLinearGradient(0, 0, 0, H * 0.35)
  topGrad.addColorStop(0, 'rgba(0,0,0,0.12)')
  topGrad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = topGrad
  ctx.fillRect(0, 0, W, H * 0.35)

  var titleY = rpx.safeTop() + rpx.rpx(TITLE_TOP_OFFSET_RPX)
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.28)'
  ctx.shadowBlur = rpx.rpx(14)
  ctx.shadowOffsetY = rpx.rpx(4)
  draw.fillTextCentered(
    ctx, '吉吉拼图', cx, titleY,
    '700 ' + rpx.rpx(52).toFixed(0) + 'px sans-serif', '#ffffff'
  )
  ctx.restore()

  drawSpinner(ctx, cx, contentY, state.spinner || 0)

  var barW = Math.min(W - rpx.rpx(80), rpx.rpx(BAR_W_RPX))
  var barH = rpx.rpx(BAR_H_RPX)
  var barX = (W - barW) / 2
  var barY = contentY + rpx.rpx(72)
  var radius = barH / 2
  var progress = Math.max(0, Math.min(1, state.progress || 0))

  draw.fillRoundedRect(ctx, barX, barY, barW, barH, radius, 'rgba(255,255,255,0.2)')
  if (progress > 0.02) {
    var fillW = Math.max(barH, barW * progress)
    draw.fillRoundedRect(ctx, barX, barY, fillW, barH, radius, 'rgba(255,255,255,0.92)')
  }

  var hint = state.hint || '加载中...'
  draw.fillTextCentered(
    ctx, hint, cx, barY + barH + rpx.rpx(36),
    '400 ' + rpx.rpx(26).toFixed(0) + 'px sans-serif', 'rgba(255,255,255,0.88)'
  )
  draw.fillTextCentered(
    ctx, Math.floor(progress * 100) + '%', cx, barY + barH + rpx.rpx(72),
    '600 ' + rpx.rpx(22).toFixed(0) + 'px sans-serif', 'rgba(255,255,255,0.65)'
  )

  ctx.restore()
}

module.exports = {
  update: update,
  render: render,
  fillGameGradient: fillGameGradient
}
