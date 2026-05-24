/**
 * 设置弹窗：拼图页 / 首页共用同一套 UI 与交互。
 */
var rpx = require('./rpx')
var assets = require('./assets')
var draw = require('./draw')
var settings = require('../utils/settings')
var bgm = require('./bgm')

var NAV_ICON = 'images/icons/setting.png'
var NAV_SIZE_RPX = 72
var NAV_LEFT_RPX = 16

var MODAL_IMAGE = 'images/settings-modal.png'
/** 设计稿 862×1232（与 puzzle-tool-modal 1241×1414 独立，屏幕尺寸逻辑勿共用） */
var SRC_W = 862
var SRC_H = 1232
var MODAL_ASPECT = SRC_W / SRC_H

/** 屏幕显示：边距与最大宽度（rpx），改这里调弹框大小 */
var MODAL_PAD_X_RPX = 72
var MODAL_PAD_Y_RPX = 56
var MODAL_MAX_WIDTH_RPX = 540

var USER = {
  name: '吉',
  id: '123456',
  avatarBg: 'images/settings/avatar-bg.png'
}

/** 开关显示区（862 设计稿）；资源图为 530×144 @2x */
var ICON_W = 265
var ICON_H = 72
var TOGGLE_X = 480

var ICON_ROWS = [
  {
    key: 'music',
    offPath: 'images/settings/icon_2.png',
    onPath: 'images/settings/icon_1.png',
    x: TOGGLE_X, y: 575, w: ICON_W, h: ICON_H
  },
  {
    key: 'sfx',
    offPath: 'images/settings/icon_4.png',
    onPath: 'images/settings/icon_3.png',
    x: TOGGLE_X, y: 705, w: ICON_W, h: ICON_H
  },
  {
    key: 'vibrate',
    offPath: 'images/settings/icon_6.png',
    onPath: 'images/settings/icon_5.png',
    x: TOGGLE_X, y: 835, w: ICON_W, h: ICON_H
  }
]

var iconNoBgCache = {}

var USER_LAYOUT = {
  avatar: { x: 148, y: 350, w: 110, h: 110 },
  name: { x: 350, y: 400, font: 42, color: '#2f6b45' },
  userId: { y: 248, font: 40, color: '#4a7a5c' }
}

var CLOSE_LAYOUT = { x: 773, y: 63, w: 88, h: 88 }

var BTN_W = 300
var BTN_H = 135
var BTN_GAP = 42
var BTN_Y = 1020
var BTN_LEFT_X = Math.floor((SRC_W - BTN_W * 2 - BTN_GAP) / 2)

var BUTTONS = [
  {
    action: 'home',
    path: 'images/settings/btn_restart.png',
    x: BTN_LEFT_X - 10,
    y: BTN_Y,
    w: BTN_W,
    h: BTN_H
  },
  {
    action: 'restart',
    path: 'images/settings/btn_home.png',
    x: BTN_LEFT_X + BTN_W + BTN_GAP + 10,
    y: BTN_Y,
    w: BTN_W,
    h: BTN_H
  }
]

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

function getImageNoBg(path) {
  if (iconNoBgCache[path]) return iconNoBgCache[path]

  var img = assets.get(path)
  if (!img || !img.width) return null

  try {
    var w = img.width
    var h = img.height
    var oc = wx.createOffscreenCanvas({ type: '2d', width: w, height: h })
    var octx = oc.getContext('2d')
    octx.drawImage(img, 0, 0, w, h)
    var imageData = octx.getImageData(0, 0, w, h)
    var data = imageData.data
    for (var i = 0; i < data.length; i += 4) {
      if (data[i] <= 28 && data[i + 1] <= 28 && data[i + 2] <= 28) {
        data[i + 3] = 0
      }
    }
    octx.putImageData(imageData, 0, 0)
    iconNoBgCache[path] = oc
    return oc
  } catch (e) {
    iconNoBgCache[path] = img
    return img
  }
}

function preload() {
  assets.load(MODAL_IMAGE)
  assets.load(NAV_ICON)
  assets.load(USER.avatarBg)
  for (var i = 0; i < ICON_ROWS.length; i++) {
    assets.load(ICON_ROWS[i].offPath)
    assets.load(ICON_ROWS[i].onPath)
  }
  for (var j = 0; j < BUTTONS.length; j++) {
    assets.load(BUTTONS[j].path)
  }
}

function navHitRect(navY, navH, expand) {
  var size = rpx.rpx(NAV_SIZE_RPX)
  var x = rpx.rpx(NAV_LEFT_RPX)
  var y = navY + (navH - size) / 2
  var pad = expand ? rpx.rpx(16) : 0
  return { x: x - pad, y: y - pad, w: size + pad * 2, h: size + pad * 2 }
}

function drawNavIcon(ctx, navY, navH) {
  var rect = navHitRect(navY, navH, false)
  var img = assets.get(NAV_ICON)
  if (!img) assets.load(NAV_ICON)
  if (img) {
    var drawable = getImageNoBg(NAV_ICON)
    if (drawable) ctx.drawImage(drawable, rect.x, rect.y, rect.w, rect.h)
  }
  return rect
}

function isNavHit(navY, navH, x, y) {
  var rect = navHitRect(navY, navH, true)
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
}

function computeModalRect(W, H) {
  var padX = rpx.rpx(MODAL_PAD_X_RPX)
  var padY = rpx.rpx(MODAL_PAD_Y_RPX) + rpx.safeTop() * 0.15
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

function drawImage(ctx, slot, path) {
  var img = assets.get(path)
  if (!img) {
    assets.load(path)
    return
  }
  var drawable = getImageNoBg(path)
  if (drawable) ctx.drawImage(drawable, slot.x, slot.y, slot.w, slot.h)
}

/** 开关图（530×144 透明 PNG），按显示区缩放，不再抠黑底 */
function drawToggleIcon(ctx, slot, path) {
  var img = assets.get(path)
  if (!img) {
    assets.load(path)
    return
  }
  ctx.drawImage(img, slot.x, slot.y, slot.w, slot.h)
}

function drawOverlay(screen, ctx, modal, handlers) {
  var sx = modal.w / SRC_W
  var ul = USER_LAYOUT
  var onToggle = handlers.onToggle

  var av = mapDesignRect(modal, ul.avatar.x, ul.avatar.y, ul.avatar.w, ul.avatar.h)
  var avatarImg = assets.get(USER.avatarBg)
  if (avatarImg) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(av.x + av.w / 2, av.y + av.h / 2, Math.min(av.w, av.h) / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(avatarImg, av.x, av.y, av.w, av.h)
    ctx.restore()
  } else {
    ctx.fillStyle = 'rgba(180, 220, 190, 0.85)'
    ctx.beginPath()
    ctx.arc(av.x + av.w / 2, av.y + av.h / 2, Math.min(av.w, av.h) / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(120, 170, 130, 0.6)'
    ctx.lineWidth = Math.max(1, 2 * sx)
    ctx.stroke()
  }

  draw.fillTextLeft(
    ctx, USER.name,
    modal.x + ul.name.x * sx, modal.y + ul.name.y * sx,
    '700 ' + Math.round(ul.name.font * sx) + 'px sans-serif', ul.name.color
  )

  draw.fillTextCentered(
    ctx, 'id:' + USER.id,
    modal.x + modal.w / 2, modal.y + ul.userId.y * sx,
    '600 ' + Math.round(ul.userId.font * sx) + 'px sans-serif', ul.userId.color
  )

  for (var i = 0; i < ICON_ROWS.length; i++) {
    drawIconRow(screen, ctx, modal, ICON_ROWS[i], onToggle)
  }

  if (handlers.showActionButtons !== false) {
    for (var j = 0; j < BUTTONS.length; j++) {
      drawButton(screen, ctx, modal, BUTTONS[j], handlers)
    }
  }
}

function drawIconRow(screen, ctx, modal, row, onToggle) {
  var slot = mapDesignRect(modal, row.x, row.y, row.w, row.h)
  var path = settings.get(row.key) ? row.onPath : row.offPath
  drawToggleIcon(ctx, slot, path)
  screen.addHitZone(slot, function () {
    settings.toggle(row.key)
    if (row.key === 'music') bgm.sync()
    if (onToggle) onToggle(row.key)
  })
}

function drawButton(screen, ctx, modal, btn, handlers) {
  var slot = mapDesignRect(modal, btn.x, btn.y, btn.w, btn.h)
  drawImage(ctx, slot, btn.path)
  screen.addHitZone(slot, function () {
    if (btn.action === 'restart' && handlers.onRestart) {
      handlers.onRestart()
    } else if (btn.action === 'home' && handlers.onHome) {
      handlers.onHome()
    }
  })
}

function drawModal(screen, ctx, W, H, handlers) {
  handlers = handlers || {}
  var onClose = handlers.onClose || function () {}

  screen.resetHitZones()
  ctx.fillStyle = 'rgba(30,30,50,0.55)'
  ctx.fillRect(0, 0, W, H)

  screen.addHitZone({ x: 0, y: 0, w: W, h: H }, onClose)

  var rect = computeModalRect(W, H)
  screen.addHitZone(rect, function () {})

  var img = assets.get(MODAL_IMAGE)
  if (!img) assets.load(MODAL_IMAGE)

  if (img) {
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h)
    drawOverlay(screen, ctx, rect, handlers)
  } else {
    draw.fillRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, rpx.rpx(28), '#e8f2ef')
    draw.fillTextCentered(
      ctx, '设置', rect.x + rect.w / 2, rect.y + rect.h / 2 - rpx.rpx(20),
      '600 ' + rpx.rpx(34).toFixed(0) + 'px sans-serif', '#3d5a52'
    )
    draw.fillTextCentered(
      ctx, '请放置 settings-modal.png', rect.x + rect.w / 2, rect.y + rect.h / 2 + rpx.rpx(28),
      '400 ' + rpx.rpx(24).toFixed(0) + 'px sans-serif', '#7a9a90'
    )
  }

  var closeRect = mapDesignRect(rect, CLOSE_LAYOUT.x, CLOSE_LAYOUT.y, CLOSE_LAYOUT.w, CLOSE_LAYOUT.h)
  if (!img) {
    var closeSize = rpx.rpx(64)
    closeRect = {
      x: rect.x + rect.w - closeSize + rpx.rpx(8),
      y: rect.y - rpx.rpx(8),
      w: closeSize,
      h: closeSize
    }
    draw.fillTextCentered(
      ctx, '×', closeRect.x + closeRect.w / 2, closeRect.y + closeRect.h / 2,
      '400 ' + rpx.rpx(44).toFixed(0) + 'px sans-serif', '#ffffff'
    )
  }
  screen.addHitZone(closeRect, onClose)
}

module.exports = {
  SRC_W: SRC_W,
  SRC_H: SRC_H,
  MODAL_MAX_WIDTH_RPX: MODAL_MAX_WIDTH_RPX,
  MODAL_PAD_X_RPX: MODAL_PAD_X_RPX,
  preload: preload,
  navHitRect: navHitRect,
  isNavHit: isNavHit,
  drawNavIcon: drawNavIcon,
  drawModal: drawModal,
  computeModalRect: computeModalRect
}
