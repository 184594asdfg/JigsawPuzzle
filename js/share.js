/**
 * 分享给好友：主动 wx.shareAppMessage + 右上角转发菜单
 * 图标：images/icons/share.png（切图 140×115，屏上 101×83 rpx）
 * 转发卡片图（可选）：images/share/card.png，建议 5:4
 */
var rpx = require('./rpx')
var assets = require('./assets')
var draw = require('./draw')
var progress = require('../utils/progress')
var gameClub = require('./game-club')

/** 暂时关闭首页「分享好友」图标，后续再开 */
var SHOW_SHARE_BTN = false
// var SHOW_SHARE_BTN = true

var SHARE_ICON = 'images/icons/share.png'
/** 转发消息配图；无则用小游戏默认截图 */
var SHARE_CARD_IMAGE = 'images/share/card.png'
var SHARE_TITLE = '来一局治愈系拼图吧！'
/** 切图 140×115；屏上高度与游戏圈一致 88rpx，宽按比例 */
var SHARE_SRC_W = 140
var SHARE_SRC_H = 115
var SHARE_H_RPX = 83
var SHARE_W_RPX = Math.round(SHARE_SRC_W * SHARE_H_RPX / SHARE_SRC_H)
var GAP_FROM_GAME_CLUB_RPX = 12

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

/** 分享按钮：游戏圈右侧，垂直与游戏圈居中对齐 */
function navHitRect(navY, navH, heroTopY, expand) {
  if (!SHOW_SHARE_BTN) {
    return { x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0 }
  }
  var club = gameClub.navHitRect(navY, navH, heroTopY, false)
  var w = rpx.rpx(SHARE_W_RPX)
  var h = rpx.rpx(SHARE_H_RPX)
  var x = club.x + club.w + rpx.rpx(GAP_FROM_GAME_CLUB_RPX)
  var y = club.cy - h / 2
  var pad = expand ? rpx.rpx(16) : 0
  return {
    x: x - pad,
    y: y - pad,
    w: w + pad * 2,
    h: h + pad * 2,
    cx: x + w / 2,
    cy: y + h / 2
  }
}

function drawNavIcon(ctx, navY, navH, heroTopY, scale) {
  if (!SHOW_SHARE_BTN) return null
  scale = scale == null ? 1 : scale
  var rect = navHitRect(navY, navH, heroTopY, false)
  var img = assets.get(SHARE_ICON)
  if (!img) assets.tryLoad(SHARE_ICON)

  function paint(drawable) {
    function drawFit() {
      draw.drawImageContain(ctx, drawable, rect.x, rect.y, rect.w, rect.h)
    }
    if (scale === 1) {
      drawFit()
      return
    }
    ctx.save()
    var cx = rect.cx
    var cy = rect.cy
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)
    ctx.translate(-cx, -cy)
    drawFit()
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
