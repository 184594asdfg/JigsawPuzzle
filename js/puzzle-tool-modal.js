/**
 * 拼图页底部工具弹窗（加时 / 提示 / 查看完整图）
 * 设计稿基准：750 × 855（宽 750px，高按原 1241:1414 比例）
 */
var rpx = require('./rpx')
var assets = require('./assets')
var draw = require('./draw')
var pressAnim = require('./press-anim')
var sfx = require('./sfx')
var subpackUi = require('../utils/subpack-ui')

var SRC_W = 750
var SRC_H = 855
var MODAL_ASPECT = SRC_W / SRC_H

/**
 * 屏幕显示边距与上限（与 settings-modal 独立；仍比设置弹窗略大）
 */
var MODAL_PAD_X_RPX = 56
var MODAL_PAD_Y_RPX = 52
var MODAL_MAX_WIDTH_RPX = 580
var MODAL_MAX_HEIGHT_RPX = 680

/** 右上角关闭 X 热区（750 设计稿坐标，圆形，w 与 h 保持一致） */
var CLOSE_LAYOUT = { x: 674, y: 56, w: 73, h: 73 }

/** 底部确认按钮热区（750 设计稿坐标，可按图微调） */
var CONFIRM_LAYOUT = { x: 262, y: 707, w: 226, h: 76 }

var MODAL_CONFIG = {
  addTime: {
    image: subpackUi.uiPath('images/modals/add_time_modal.png'),
    confirm: true
  },
  hint: {
    image: subpackUi.uiPath('images/modals/hint_modal.png'),
    confirm: true
  },
  preview: {
    image: subpackUi.uiPath('images/modals/preview_modal.png'),
    confirm: true
  }
}

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

function computeModalRect(W, H) {
  var padX = rpx.rpx(MODAL_PAD_X_RPX)
  var padY = rpx.rpx(MODAL_PAD_Y_RPX) + rpx.safeTop() * 0.08
  var maxW = Math.min(W - padX * 2, rpx.rpx(MODAL_MAX_WIDTH_RPX))
  var maxH = Math.min(
    H - padY * 2 - rpx.safeBottom(),
    rpx.rpx(MODAL_MAX_HEIGHT_RPX)
  )
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
  var keys = Object.keys(MODAL_CONFIG)
  for (var i = 0; i < keys.length; i++) {
    assets.load(MODAL_CONFIG[keys[i]].image)
  }
}

function getConfig(type) {
  return MODAL_CONFIG[type] || null
}

function tickToolEnter(screen, dt) {
  screen._toolEnterAnim = pressAnim.tickModalEnterAnim(screen._toolEnterAnim, dt)
}

function beginToolEnter(screen) {
  screen._toolEnterAnim = { time: 0 }
}

function clearToolEnter(screen) {
  screen._toolEnterAnim = null
}

/**
 * @param {object} handlers - { onClose, onConfirm }
 */
function drawModal(screen, ctx, W, H, type, handlers) {
  handlers = handlers || {}
  var cfg = MODAL_CONFIG[type]
  if (!cfg) return

  var onClose = handlers.onClose || function () {}
  var onConfirm = handlers.onConfirm || function () {}
  var enterAnim = screen._toolEnterAnim
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
  var img = assets.get(cfg.image)
  if (!img) assets.load(cfg.image)

  pressAnim.drawWithPressScale(ctx, cx, cy, scale, function () {
    if (img) {
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h)
    } else {
      draw.fillRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, rpx.rpx(28), '#e8f2ef')
      draw.fillTextCentered(
        ctx, '请放置 ' + cfg.image, rect.x + rect.w / 2, rect.y + rect.h / 2,
        '400 ' + rpx.rpx(24).toFixed(0) + 'px sans-serif', '#7a9a90'
      )
    }
  })

  if (canInteract) {
    var closeRect = mapDesignRect(rect, CLOSE_LAYOUT.x, CLOSE_LAYOUT.y, CLOSE_LAYOUT.w, CLOSE_LAYOUT.h)
    screen.addHitZone(closeRect, sfx.wrapClick(onClose))

    if (cfg.confirm) {
      var confirmRect = mapDesignRect(rect, CONFIRM_LAYOUT.x, CONFIRM_LAYOUT.y,
        CONFIRM_LAYOUT.w, CONFIRM_LAYOUT.h)
      screen.addHitZone(confirmRect, sfx.wrapClick(onConfirm))
    }
  }
}

module.exports = {
  SRC_W: SRC_W,
  SRC_H: SRC_H,
  preload: preload,
  getConfig: getConfig,
  computeModalRect: computeModalRect,
  drawModal: drawModal,
  beginToolEnter: beginToolEnter,
  clearToolEnter: clearToolEnter,
  tickToolEnter: tickToolEnter,
  CLOSE_LAYOUT: CLOSE_LAYOUT,
  CONFIRM_LAYOUT: CONFIRM_LAYOUT
}
