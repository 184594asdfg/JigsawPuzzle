/**
 * 拼图页底部工具弹窗（加时 / 提示 / 查看完整图）
 * 设计稿基准：1241 × 1414
 */
var rpx = require('./rpx')
var assets = require('./assets')
var draw = require('./draw')

var SRC_W = 1241
var SRC_H = 1414
var MODAL_ASPECT = SRC_W / SRC_H

/**
 * 屏幕显示边距（与 settings-modal.js 的 40/48 独立，勿对齐）
 * 工具弹窗设计稿更宽（1241×1414），边距更小、优先占满高度 → 比设置弹窗（862×1232）更大
 */
var MODAL_PAD_X_RPX = 12
var MODAL_PAD_Y_RPX = 24

/** 右上角关闭 X 热区（设计稿坐标，圆形，w 与 h 保持一致） */
var CLOSE_LAYOUT = { x: 1115, y: 92, w: 120, h: 120 }

/** 底部确认按钮热区（设计稿坐标，可按图微调） */
var CONFIRM_LAYOUT = { x: 433, y: 1170, w: 374, h: 126 }

var MODAL_CONFIG = {
  addTime: {
    image: 'images/modals/add_time_modal.png',
    confirm: true
  },
  hint: {
    image: 'images/modals/hint_modal.png',
    confirm: true
  },
  preview: {
    image: 'images/modals/preview_modal.png',
    confirm: false
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
  var maxW = W - padX * 2
  var maxH = H - padY * 2 - rpx.safeBottom()
  // 设置弹窗优先占满宽度（偏瘦高）；工具弹窗优先占满高度（偏宽大）
  var modalH = maxH
  var modalW = modalH * MODAL_ASPECT
  if (modalW > maxW) {
    modalW = maxW
    modalH = modalW / MODAL_ASPECT
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

/**
 * @param {object} handlers - { onClose, onConfirm }
 */
function drawModal(screen, ctx, W, H, type, handlers) {
  handlers = handlers || {}
  var cfg = MODAL_CONFIG[type]
  if (!cfg) return

  var onClose = handlers.onClose || function () {}
  var onConfirm = handlers.onConfirm || function () {}

  screen.resetHitZones()
  ctx.fillStyle = 'rgba(30,30,50,0.55)'
  ctx.fillRect(0, 0, W, H)
  screen.addHitZone({ x: 0, y: 0, w: W, h: H }, onClose)

  var rect = computeModalRect(W, H)
  screen.addHitZone(rect, function () {})

  var img = assets.get(cfg.image)
  if (!img) assets.load(cfg.image)
  if (img) {
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h)
  } else {
    draw.fillRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, rpx.rpx(28), '#e8f2ef')
    draw.fillTextCentered(
      ctx, '请放置 ' + cfg.image, rect.x + rect.w / 2, rect.y + rect.h / 2,
      '400 ' + rpx.rpx(24).toFixed(0) + 'px sans-serif', '#7a9a90'
    )
  }

  var closeRect = mapDesignRect(rect, CLOSE_LAYOUT.x, CLOSE_LAYOUT.y, CLOSE_LAYOUT.w, CLOSE_LAYOUT.h)
  screen.addHitZone(closeRect, onClose)

  if (cfg.confirm) {
    var confirmRect = mapDesignRect(rect, CONFIRM_LAYOUT.x, CONFIRM_LAYOUT.y,
      CONFIRM_LAYOUT.w, CONFIRM_LAYOUT.h)
    screen.addHitZone(confirmRect, onConfirm)
  }
}

module.exports = {
  SRC_W: SRC_W,
  SRC_H: SRC_H,
  preload: preload,
  getConfig: getConfig,
  drawModal: drawModal,
  CLOSE_LAYOUT: CLOSE_LAYOUT,
  CONFIRM_LAYOUT: CONFIRM_LAYOUT
}
