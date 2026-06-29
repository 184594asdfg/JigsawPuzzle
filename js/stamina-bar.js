/**
 * 首页体力条（方案 A）：底图含闪电 + 数字 + 右侧「+」
 * 资源：images/icons/stamina_bar_bg.png（480×151 @2x）
 */
var rpx = require('./rpx')
var assets = require('./assets')
var draw = require('./draw')
var stamina = require('../utils/stamina')

var BAR_BG = 'images/icons/stamina_bar_bg.png'
var SRC_W = 480
var SRC_H = 151
/** 屏上高度对齐导航图标区，宽度按比例 */
var BAR_H_RPX = 56
var BAR_W_RPX = BAR_H_RPX * SRC_W / SRC_H
var BAR_RIGHT_RPX = 16
var GAP_BELOW_SETTINGS_RPX = 8
var GAP_ABOVE_HERO_RPX = 8
var SETTINGS_SIZE_RPX = 72
/** 右侧「+」圆形热区：圆钮直径与条高一致 */
var PLUS_X_RATIO = (SRC_W - SRC_H) / SRC_W
var PLUS_W_RATIO = SRC_H / SRC_W
var TEXT_COLOR = '#ffffff'
var TEXT_STROKE = '#5b3f8f'
var COUNTDOWN_GAP_RPX = 6
var COUNTDOWN_FONT_RPX = 24
var COUNTDOWN_COLOR = '#6b4fa8'

function preload() {
  assets.load(BAR_BG)
}

function countdownBlockHeight() {
  if (!stamina.shouldShowRegenCountdown()) return 0
  return rpx.rpx(COUNTDOWN_GAP_RPX + COUNTDOWN_FONT_RPX)
}

function barRect(navY, navH, heroTopY, screenW) {
  var w = rpx.rpx(BAR_W_RPX)
  var h = rpx.rpx(BAR_H_RPX)
  var extraH = countdownBlockHeight()
  var totalH = h + extraH
  var x = screenW - rpx.rpx(BAR_RIGHT_RPX) - w
  var settingsY = navY + (navH - rpx.rpx(SETTINGS_SIZE_RPX)) / 2
  var slotTop = settingsY + rpx.rpx(SETTINGS_SIZE_RPX) + rpx.rpx(GAP_BELOW_SETTINGS_RPX)
  var y = slotTop
  if (heroTopY != null && heroTopY > 0) {
    var slotBottom = heroTopY - rpx.rpx(GAP_ABOVE_HERO_RPX)
    var slotH = slotBottom - slotTop
    if (slotH >= totalH) {
      y = slotTop + (slotH - totalH) / 2
    } else {
      y = Math.max(slotTop, slotBottom - totalH)
    }
  }
  return { x: x, y: y, w: w, h: h, cx: x + w / 2, cy: y + h / 2 }
}

function plusHitRect(bar, expand) {
  var pad = expand ? rpx.rpx(8) : 0
  var x = bar.x + bar.w * PLUS_X_RATIO
  var w = bar.w * PLUS_W_RATIO
  return {
    x: x - pad,
    y: bar.y - pad,
    w: w + pad * 2,
    h: bar.h + pad * 2
  }
}

function bodyHitRect(bar, expand) {
  var plus = plusHitRect(bar, false)
  var pad = expand ? rpx.rpx(6) : 0
  return {
    x: bar.x - pad,
    y: bar.y - pad,
    w: Math.max(0, plus.x - bar.x) + pad,
    h: bar.h + pad * 2
  }
}

function drawBar(ctx, navY, navH, heroTopY, screenW) {
  var bar = barRect(navY, navH, heroTopY, screenW)
  var img = assets.get(BAR_BG)
  if (!img) assets.tryLoad(BAR_BG)
  if (img) {
    ctx.drawImage(img, bar.x, bar.y, bar.w, bar.h)
  } else {
    draw.fillRoundedRect(ctx, bar.x, bar.y, bar.w, bar.h, bar.h / 2, 'rgba(90, 70, 140, 0.85)')
  }

  var current = stamina.getCurrent()
  var text = String(current)
  var fontSize = rpx.rpx(30)
  var font = '700 ' + fontSize.toFixed(0) + 'px sans-serif'
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = Math.max(2, rpx.rpx(3))
  ctx.lineJoin = 'round'
  ctx.strokeStyle = TEXT_STROKE
  ctx.strokeText(text, bar.cx, bar.cy)
  ctx.fillStyle = TEXT_COLOR
  ctx.fillText(text, bar.cx, bar.cy)

  if (stamina.shouldShowRegenCountdown()) {
    var countdown = stamina.formatRegenCountdown(stamina.getRegenRemainingMs())
    var countdownSize = rpx.rpx(COUNTDOWN_FONT_RPX)
    var countdownFont = '700 ' + countdownSize.toFixed(0) + 'px sans-serif'
    var countdownY = bar.y + bar.h + rpx.rpx(COUNTDOWN_GAP_RPX) + countdownSize * 0.55
    draw.fillTextCentered(ctx, countdown, bar.cx, countdownY, countdownFont, COUNTDOWN_COLOR)
  }

  return bar
}

module.exports = {
  preload: preload,
  barRect: barRect,
  plusHitRect: plusHitRect,
  bodyHitRect: bodyHitRect,
  drawBar: drawBar
}
