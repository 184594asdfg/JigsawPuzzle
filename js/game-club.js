/**
 * 游戏圈入口：首页设置与 hero 预览区之间，左对齐。
 * 图标资源就绪后设置 GAME_CLUB_ICON 即可替换占位底色。
 */
var rpx = require('./rpx')
var assets = require('./assets')
var draw = require('./draw')

/** MP 后台-游戏圈 获取的 openlink */
var GAME_CLUB_OPENLINK =
  '-SSEykJvFV3pORt5kTNpS_iD7m81-TZqwFPY3aNvDwq7Q2mpwInqioyXyVRuBjcUVUBznEtzYcgjOKCjbcrinHQM0833sGNPOWwMnvf0fSs5jK6lMzyzCFDcpDW4rR_ku_mCB2mCfBx6FIml-l0TUFj6Y-L_Rcij88kDiJRUk9eO59Z71BF7CZYfDlWbGX-9IGDdpvY1noIdFrE5ZEXPHgmBvIK_Lv1MKUi0JsKpNgfc5DWkVwRvtyZbmrVCMplxW5pAzcfhy9viy-oUOZB7yejuQM7N7OMGAfKjls9ga6WRr7M4mFKDPmJXnfDkDwk_AfXosuIUVh3Qc9mhI3gOHg'

var GAME_CLUB_ICON = 'images/icons/game-club.png'
var GAME_CLUB_SIZE_RPX = 88
var GAME_CLUB_LEFT_RPX = 16
var GAP_BELOW_SETTINGS_RPX = 8
var GAP_ABOVE_HERO_RPX = 8
/** 无图标时的占位底色 */
var PLACEHOLDER_BG = 'rgba(109, 168, 150, 0.92)'

var pageManager = null
var loadPromise = null

function getSettingsNavRect(navY, navH) {
  var size = rpx.rpx(72)
  var x = rpx.rpx(16)
  var y = navY + (navH - size) / 2
  return { x: x, y: y, w: size, h: size }
}

/**
 * @param {number} navY
 * @param {number} navH
 * @param {number|undefined} heroTopY hero 预览区顶边（px），用于夹在设置与 hero 之间
 * @param {boolean} expand
 */
function navHitRect(navY, navH, heroTopY, expand) {
  var settings = getSettingsNavRect(navY, navH)
  var size = rpx.rpx(GAME_CLUB_SIZE_RPX)
  var x = rpx.rpx(GAME_CLUB_LEFT_RPX)
  var slotTop = settings.y + settings.h + rpx.rpx(GAP_BELOW_SETTINGS_RPX)
  var y = slotTop
  if (heroTopY != null && heroTopY > 0) {
    var slotBottom = heroTopY - rpx.rpx(GAP_ABOVE_HERO_RPX)
    var slotH = slotBottom - slotTop
    if (slotH >= size) {
      y = slotTop + (slotH - size) / 2
    } else {
      y = Math.max(slotTop, slotBottom - size)
    }
  }
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

function drawNavIcon(ctx, navY, navH, heroTopY, scale) {
  scale = scale == null ? 1 : scale
  var rect = navHitRect(navY, navH, heroTopY, false)
  var img = assets.get(GAME_CLUB_ICON)
  if (!img) assets.tryLoad(GAME_CLUB_ICON)

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

  function paintPlaceholder() {
    var radius = rpx.rpx(12)
    draw.fillRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius, PLACEHOLDER_BG)
    draw.fillTextCentered(
      ctx, '圈', rect.cx, rect.cy,
      '600 ' + rpx.rpx(30).toFixed(0) + 'px sans-serif', '#ffffff'
    )
  }

  if (img) {
    paint(img)
    return rect
  }

  if (scale === 1) {
    paintPlaceholder()
  } else {
    ctx.save()
    var cx2 = rect.cx
    var cy2 = rect.cy
    ctx.translate(cx2, cy2)
    ctx.scale(scale, scale)
    ctx.translate(-cx2, -cy2)
    paintPlaceholder()
    ctx.restore()
  }
  return rect
}

function ensurePageManager() {
  if (typeof wx === 'undefined' || !wx.createPageManager) {
    return Promise.reject(new Error('unsupported'))
  }
  if (!pageManager) {
    pageManager = wx.createPageManager()
  }
  if (loadPromise) return loadPromise
  loadPromise = pageManager.load({ openlink: GAME_CLUB_OPENLINK }).catch(function (err) {
    loadPromise = null
    throw err
  })
  return loadPromise
}

function preload() {
  assets.load(GAME_CLUB_ICON).catch(function () {})
  ensurePageManager().catch(function () {})
}

function openGameClub() {
  if (typeof wx === 'undefined') return
  if (!wx.createPageManager) {
    try { wx.showToast({ title: '当前版本不支持游戏圈', icon: 'none' }) } catch (e) {}
    return
  }
  ensurePageManager()
    .then(function () {
      return pageManager.show()
    })
    .catch(function (err) {
      console.warn('[game-club] open failed', err)
      try { wx.showToast({ title: '打开游戏圈失败', icon: 'none' }) } catch (e2) {}
    })
}

module.exports = {
  GAME_CLUB_ICON: GAME_CLUB_ICON,
  GAME_CLUB_OPENLINK: GAME_CLUB_OPENLINK,
  preload: preload,
  navHitRect: navHitRect,
  drawNavIcon: drawNavIcon,
  openGameClub: openGameClub
}
