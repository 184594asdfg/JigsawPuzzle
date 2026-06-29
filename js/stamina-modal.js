/**
 * 体力弹窗：底图 stamina_modal.png（540×656）+ 按钮 btn_stamina_recover.png（226×93）
 */
var rpx = require('./rpx')
var assets = require('./assets')
var draw = require('./draw')
var pressAnim = require('./press-anim')
var sfx = require('./sfx')
var stamina = require('../utils/stamina')
var rewardedAd = require('./rewarded-ad')
var config = require('../utils/app-config')

var MODAL_IMAGE = 'images/icons/stamina_modal.png'
var BTN_IMAGE = 'images/icons/btn_stamina_recover.png'
var SRC_W = 540
var SRC_H = 656
var MODAL_ASPECT = SRC_W / SRC_H

var MODAL_PAD_X_RPX = 32
var MODAL_PAD_Y_RPX = 48
var MODAL_MAX_WIDTH_RPX = 540

/** 540 设计稿坐标（与底图对齐，可按图微调） */
var CLOSE_LAYOUT = { x: 478, y: 35, w: 64, h: 64 }
var BTN_LAYOUT = { x: 152, y: 502, w: 236, h: 103 }
var AD_REWARD = config.staminaAdGrant || 15
/** 调试：热区背景色（调好后可改 false） */
var SHOW_HIT_DEBUG = false
var CLOSE_HIT_DEBUG_COLOR = 'rgba(255, 80, 80, 0.45)'
var BTN_HIT_DEBUG_COLOR = 'rgba(80, 200, 120, 0.45)'

var _granting = false

function mapDesignRect(modal, dx, dy, dw, dh) {
  var sx = modal.w / SRC_W
  var sy = modal.h / SRC_H
  return {
    x: modal.x + dx * sx,
    y: modal.y + dy * sy,
    w: dw * sx,
    h: dh * sy
  }
}

function drawHitDebug(ctx, rect, color) {
  if (!SHOW_HIT_DEBUG || !rect) return
  ctx.fillStyle = color
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
}

function drawCircleHitDebug(ctx, rect, color) {
  if (!SHOW_HIT_DEBUG || !rect) return
  var cx = rect.x + rect.w / 2
  var cy = rect.y + rect.h / 2
  var radius = Math.min(rect.w, rect.h) / 2
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
}

function computeModalRect(W, H) {
  var padX = rpx.rpx(MODAL_PAD_X_RPX)
  var padY = rpx.rpx(MODAL_PAD_Y_RPX) + rpx.safeTop() * 0.1
  var maxW = Math.min(W - padX * 2, rpx.rpx(MODAL_MAX_WIDTH_RPX))
  var maxH = H - padY * 2 - rpx.safeBottom()
  var modalW = maxW
  var modalH = modalW / MODAL_ASPECT
  if (modalH > maxH) {
    modalH = maxH
    modalW = modalH * MODAL_ASPECT
  }
  return {
    x: (W - modalW) / 2,
    y: (H - modalH) / 2,
    w: modalW,
    h: modalH
  }
}

function preload() {
  assets.load(MODAL_IMAGE)
  assets.load(BTN_IMAGE)
}

function tickEnter(screen, dt) {
  screen._staminaEnterAnim = pressAnim.tickModalEnterAnim(screen._staminaEnterAnim, dt)
}

function beginEnter(screen) {
  screen._staminaEnterAnim = { time: 0 }
  rewardedAd.init()
  rewardedAd.preload()
}

function clearEnter(screen) {
  screen._staminaEnterAnim = null
}

function watchAdRecover(onDone) {
  if (_granting) return
  stamina.loadFromStorage()
  _granting = true
  try { wx.showLoading({ title: '广告加载中', mask: true }) } catch (e) {}
  rewardedAd.init()
  rewardedAd.show().then(function (completed) {
    if (!completed) {
      try { wx.showToast({ title: '需完整观看广告才能恢复体力', icon: 'none' }) } catch (e2) {}
      return
    }
    stamina.grantAdReward(AD_REWARD).then(function () {
      try { wx.showToast({ title: '体力+' + AD_REWARD, icon: 'success' }) } catch (e3) {}
      if (onDone) onDone()
    })
  }).catch(function (err) {
    try {
      wx.showToast({ title: (err && err.message) || '广告加载失败', icon: 'none' })
    } catch (e4) {}
  }).then(function () {
    _granting = false
    try { wx.hideLoading() } catch (e5) {}
  })
}

/**
 * @param {object} handlers - { onClose }
 */
function drawModal(screen, ctx, W, H, handlers) {
  handlers = handlers || {}
  var onClose = handlers.onClose || function () {}

  var enterAnim = screen._staminaEnterAnim
  var enterTime = enterAnim ? enterAnim.time : pressAnim.MODAL_ENTER_MS
  var scale = pressAnim.getModalEnterScale(enterAnim)
  var canInteract = !pressAnim.isModalEntering(enterAnim)
  var overlayAlpha = pressAnim.modalOverlayAlpha(enterTime)

  screen.resetHitZones()
  ctx.fillStyle = 'rgba(30,30,50,' + overlayAlpha + ')'
  ctx.fillRect(0, 0, W, H)

  if (canInteract) {
    screen.addHitZone({ x: 0, y: 0, w: W, h: H }, sfx.wrapClick(onClose))
  }

  var rect = computeModalRect(W, H)
  if (canInteract) {
    screen.addHitZone(rect, function () {})
  }

  var cx = rect.x + rect.w / 2
  var cy = rect.y + rect.h / 2
  var modalImg = assets.get(MODAL_IMAGE)
  if (!modalImg) assets.load(MODAL_IMAGE)
  var btnImg = assets.get(BTN_IMAGE)
  if (!btnImg) assets.load(BTN_IMAGE)

  var btnLayout = BTN_LAYOUT
  var closeLayout = CLOSE_LAYOUT

  pressAnim.drawWithPressScale(ctx, cx, cy, scale, function () {
    if (modalImg) {
      ctx.drawImage(modalImg, rect.x, rect.y, rect.w, rect.h)
    } else {
      draw.fillRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, rpx.rpx(24), '#e8f8fc')
    }

    var closeRect = mapDesignRect(rect, closeLayout.x, closeLayout.y, closeLayout.w, closeLayout.h)
    var btnRect = mapDesignRect(rect, btnLayout.x, btnLayout.y, btnLayout.w, btnLayout.h)
    drawCircleHitDebug(ctx, closeRect, CLOSE_HIT_DEBUG_COLOR)
    drawHitDebug(ctx, btnRect, BTN_HIT_DEBUG_COLOR)

    if (btnImg) {
      ctx.drawImage(btnImg, btnRect.x, btnRect.y, btnRect.w, btnRect.h)
    } else {
      draw.fillRoundedRect(ctx, btnRect.x, btnRect.y, btnRect.w, btnRect.h, btnRect.h / 2, '#3db8b0')
    }
  })

  if (canInteract) {
    var closeHit = mapDesignRect(rect, closeLayout.x, closeLayout.y, closeLayout.w, closeLayout.h)
    screen.addHitZone(closeHit, sfx.wrapClick(onClose), { shape: 'circle' })

    var confirmHit = mapDesignRect(rect, btnLayout.x, btnLayout.y, btnLayout.w, btnLayout.h)
    screen.addHitZone(confirmHit, sfx.wrapClick(function () {
      watchAdRecover(onClose)
    }))
  }
}

module.exports = {
  preload: preload,
  computeModalRect: computeModalRect,
  drawModal: drawModal,
  beginEnter: beginEnter,
  clearEnter: clearEnter,
  tickEnter: tickEnter,
  watchAdRecover: watchAdRecover
}
