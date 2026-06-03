/**
 * 分享给好友：主动 wx.shareAppMessage + 右上角转发菜单
 * 图标：images/icons/share.png（首页按钮，由设计提供）
 * 转发卡片图（可选）：images/share/card.png，建议 5:4
 */
var rpx = require('./rpx')
var assets = require('./assets')
var draw = require('./draw')
var progress = require('../utils/progress')

/** 首页设置下方的分享入口（暂时隐藏） */
var SHOW_SHARE_BTN = false

var SHARE_ICON = 'images/icons/share.png'
/** 转发消息配图；无则用小游戏默认截图 */
var SHARE_CARD_IMAGE = 'images/share/card.png'
var SHARE_TITLE = '来一局治愈系拼图吧！'
var SHARE_GAP_BELOW_SETTINGS_RPX = 14
var SHARE_SIZE_RPX = 72
var SHARE_LEFT_RPX = 16

var inited = false

function buildSharePayload() {
  var payload = {
    title: SHARE_TITLE,
    query: 'from=share'
  }
  var count = 0
  try {
    count = progress.getCompletedCount()
  } catch (e) {}
  if (count > 0) {
    payload.title = '我已通关 ' + count + ' 关，一起来拼图！'
  }
  if (assets.get(SHARE_CARD_IMAGE)) {
    payload.imageUrl = SHARE_CARD_IMAGE
  }
  return payload
}

function initShare() {
  if (inited || typeof wx === 'undefined') return
  inited = true
  try {
    if (wx.showShareMenu) {
      wx.showShareMenu({ menus: ['shareAppMessage'] })
    }
  } catch (e) {
    console.warn('[share] showShareMenu failed', e)
  }
  if (wx.onShareAppMessage) {
    wx.onShareAppMessage(function () {
      return buildSharePayload()
    })
  }
}

function shareToFriend() {
  initShare()
  if (typeof wx === 'undefined' || !wx.shareAppMessage) {
    try { wx.showToast({ title: '当前环境不支持分享', icon: 'none' }) } catch (e2) {}
    return
  }
  try {
    wx.shareAppMessage(buildSharePayload())
  } catch (err) {
    console.warn('[share] shareAppMessage failed', err)
    try { wx.showToast({ title: '分享失败，请稍后再试', icon: 'none' }) } catch (e3) {}
  }
}

function getSettingsNavRect(navY, navH) {
  var size = rpx.rpx(72)
  var x = rpx.rpx(16)
  var y = navY + (navH - size) / 2
  return { x: x, y: y, w: size, h: size }
}

/** 分享按钮区域：紧贴设置图标下方 */
function navHitRect(navY, navH, expand) {
  if (!SHOW_SHARE_BTN) {
    return { x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0 }
  }
  var settings = getSettingsNavRect(navY, navH)
  var size = rpx.rpx(SHARE_SIZE_RPX)
  var gap = rpx.rpx(SHARE_GAP_BELOW_SETTINGS_RPX)
  var x = rpx.rpx(SHARE_LEFT_RPX)
  var y = settings.y + settings.h + gap
  var pad = expand ? rpx.rpx(16) : 0
  return {
    x: x - pad,
    y: y - pad,
    w: size + pad * 2,
    h: size + pad * 2,
    cx: x + size / 2,
    cy: y + size / 2
  }
}

function drawNavIcon(ctx, navY, navH, scale) {
  if (!SHOW_SHARE_BTN) return null
  scale = scale == null ? 1 : scale
  var rect = navHitRect(navY, navH, false)
  var img = assets.get(SHARE_ICON)
  if (!img) assets.tryLoad(SHARE_ICON)

  function paint(drawable) {
    if (scale === 1) {
      ctx.drawImage(drawable, rect.x, rect.y, rect.w, rect.h)
      return
    }
    ctx.save()
    var cx = rect.cx
    var cy = rect.cy
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)
    ctx.translate(-cx, -cy)
    ctx.drawImage(drawable, rect.x, rect.y, rect.w, rect.h)
    ctx.restore()
  }

  if (img) {
    paint(img)
    return rect
  }

  draw.fillRoundedRect(
    ctx, rect.x, rect.y, rect.w, rect.h, rpx.rpx(12),
    'rgba(255,255,255,0.22)'
  )
  draw.fillTextCentered(
    ctx, '分享', rect.cx, rect.cy,
    '600 ' + rpx.rpx(22).toFixed(0) + 'px sans-serif', '#ffffff'
  )
  return rect
}

function preload() {
  assets.load(SHARE_ICON).catch(function () {})
  assets.load(SHARE_CARD_IMAGE).catch(function () {})
}

module.exports = {
  SHOW_SHARE_BTN: SHOW_SHARE_BTN,
  SHARE_ICON: SHARE_ICON,
  SHARE_CARD_IMAGE: SHARE_CARD_IMAGE,
  initShare: initShare,
  shareToFriend: shareToFriend,
  preload: preload,
  navHitRect: navHitRect,
  drawNavIcon: drawNavIcon
}
