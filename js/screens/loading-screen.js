/**
 * 开场加载页：全屏背景图 + 转圈加载 + 进度条
 */
var rpx = require('../rpx')
var draw = require('../draw')
var assets = require('../assets')

/** 加载页全屏背景图；可改为 images/loading-bg.jpg 使用单独切图 */
var LOADING_BG = 'images/home-bg.jpg'
/** 顶部 Logo（透明 PNG），屏上宽度为画布宽度的 80%，高度按原图比例 */
var LOADING_LOGO = 'images/loading-logo.png'

var SPINNER_R_RPX = 40
var SPINNER_TRACK_RPX = 5
var SPINNER_ARC_RPX = 6
var BAR_W_RPX = 420
var BAR_H_RPX = 12
/** Logo 顶边距安全区下沿（rpx） */
var LOGO_TOP_RPX = 88
/** 相对屏宽（0～1），与 rpx 基准 750 下 80% 一致 */
var LOGO_WIDTH_RATIO = 0.8
/** 加载区距屏幕底 + 安全区（rpx） */
var LOADING_BOTTOM_PAD_RPX = 56

function fillFallbackGradient(ctx, W, H) {
  var grad = ctx.createLinearGradient(0, 0, W * 0.6, H)
  grad.addColorStop(0, '#5b6fd8')
  grad.addColorStop(0.45, '#6d5b9e')
  grad.addColorStop(1, '#764ba2')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
}

function drawLogo(ctx, W) {
  var img = assets.get(LOADING_LOGO)
  if (!img || !img.width) {
    assets.tryLoad(LOADING_LOGO)
    return
  }
  var w = W * LOGO_WIDTH_RATIO
  var h = w * (img.height / img.width)
  var x = (W - w) / 2
  var y = rpx.safeTop() + rpx.rpx(LOGO_TOP_RPX)
  ctx.drawImage(img, x, y, w, h)
}

function drawBackground(ctx, W, H) {
  var bg = assets.get(LOADING_BG)
  if (!bg) {
    assets.tryLoad(LOADING_BG)
    fillFallbackGradient(ctx, W, H)
    return
  }
  draw.drawImageCover(ctx, bg, 0, 0, W, H)
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.fillRect(0, 0, W, H)
}

/** 自底向上：百分比 → 文案 → 进度条 → 转圈 */
function layoutLoadingFooter(W, H) {
  var cx = W / 2
  var floor = H - rpx.safeBottom() - rpx.rpx(LOADING_BOTTOM_PAD_RPX)
  var hintSize = rpx.rpx(26)
  var pctSize = rpx.rpx(22)
  var barH = rpx.rpx(BAR_H_RPX)
  var barW = W * LOGO_WIDTH_RATIO
  var spinnerR = rpx.rpx(SPINNER_R_RPX)

  var percentY = floor - pctSize * 0.5
  var hintY = percentY - pctSize * 0.5 - rpx.rpx(20) - hintSize * 0.5
  var barBottom = hintY - hintSize * 0.5 - rpx.rpx(28)
  var barY = barBottom - barH
  var spinnerCy = barY - rpx.rpx(44) - spinnerR

  return {
    cx: cx,
    barX: (W - barW) / 2,
    barY: barY,
    barW: barW,
    barH: barH,
    hintY: hintY,
    percentY: percentY,
    spinnerCy: spinnerCy
  }
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
  var footer = layoutLoadingFooter(W, H)
  var progress = Math.max(0, Math.min(1, state.progress || 0))
  var radius = footer.barH / 2

  ctx.save()
  ctx.globalAlpha = alpha

  drawBackground(ctx, W, H)
  drawLogo(ctx, W)

  drawSpinner(ctx, footer.cx, footer.spinnerCy, state.spinner || 0)

  draw.fillRoundedRect(
    ctx, footer.barX, footer.barY, footer.barW, footer.barH, radius, 'rgba(255,255,255,0.2)'
  )
  if (progress > 0.02) {
    var fillW = Math.max(footer.barH, footer.barW * progress)
    draw.fillRoundedRect(
      ctx, footer.barX, footer.barY, fillW, footer.barH, radius, 'rgba(255,255,255,0.92)'
    )
  }

  var hint = state.hint || '加载中...'
  draw.fillTextCentered(
    ctx, hint, footer.cx, footer.hintY,
    '400 ' + rpx.rpx(26).toFixed(0) + 'px sans-serif', 'rgba(255,255,255,0.88)'
  )
  draw.fillTextCentered(
    ctx, Math.floor(progress * 100) + '%', footer.cx, footer.percentY,
    '600 ' + rpx.rpx(22).toFixed(0) + 'px sans-serif', 'rgba(255,255,255,0.65)'
  )

  ctx.restore()
}

function preload() {
  assets.load(LOADING_BG).catch(function () {})
  assets.load(LOADING_LOGO).catch(function () {})
}

module.exports = {
  LOADING_BG: LOADING_BG,
  LOADING_LOGO: LOADING_LOGO,
  preload: preload,
  update: update,
  render: render,
  fillFallbackGradient: fillFallbackGradient
}
