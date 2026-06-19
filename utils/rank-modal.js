/**
 * 排行榜弹窗：底图 rank_modal.png；列表行 rank_row.png；前三名 rank_1~3.png；底部「我的」rank_my_row.png + 叠字。
 */
var rpx = require('../js/rpx')
var draw = require('../js/draw')
var assets = require('../js/assets')
var pressAnim = require('../js/press-anim')
var user = require('./user')

var MODAL_IMAGE = 'images/rank/rank_modal.png'
var ROW_IMAGE = 'images/rank/rank_row.png'
var MY_ROW_IMAGE = 'images/rank/rank_my_row.png'
var MEDAL_IMAGES = {
  1: 'images/rank/rank_1.png',
  2: 'images/rank/rank_2.png',
  3: 'images/rank/rank_3.png'
}
var MEDAL_IMG_W = 100
var MEDAL_IMG_H = 117
var ROW_IMG_W = 832
var ROW_IMG_H = 156
var SRC_W = 1395
var SRC_H = 2648

var MODAL_PAD_X_RPX = 32
/** 弹框底图+列表相对 my_row 右移（1395 设计稿 px） */
var MODAL_SHIFT_X = 10
var MASK_FADE_MS = 200
var MASK_MAX_ALPHA = 0.55
var MODAL_DELAY_MS = 140
var MODAL_ENTER_MS = 300

/** 圆润卡通无衬线（系统回退） */
var FONT_FAMILY = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
var COLOR_NAME = '#000000'
var COLOR_IP = '#999999'
var COLOR_LEVEL = '#e63923'
var COLOR_LEVEL_UNIT = '#000000'
var COLOR_RANK = '#FFFFFF'
var COLOR_RANK_STROKE = '#000000'
var COLOR_HINT = '#999999'

var FONT_NAME = 48
var FONT_IP = 30
var FONT_LEVEL = 68
var FONT_RANK = 86

/** 1395×2648 设计稿坐标（与底图对齐，可按图微调） */
var LAYOUT = {
  close: { x: 1265, y: 90, w: 130, h: 130 },
  list: { x: 70, y: 300, w: 1255 },
  /** 底部「我的排名」图片区（rank_my_row.png 1331×241），列表在其上方滚动 */
  myRow: { x: 32, y: 2452, w: 1331, h: 241 },
  rowH: 200,
  rowGap: 10,
  rowPadL: 16,
  rowRankStripW: 145,
  medalOffsetX: 30,
  rankOffsetX: 30,
  rankOffsetY: 5,
  avatarSize: 118,
  avatarOffsetX: 40,
  textGap: 16,
  avatarTextGap: 32,
  nameOffsetY: 28,
  ipOffsetY: 32,
  contentOffsetY: 5,
  levelPadR: 74,
  levelOffsetY: 5
}

function formatRankLabel(rank) {
  if (rank == null || rank === '' || rank === '—') return '100+'
  if (typeof rank === 'number') {
    if (rank > 100) return '100+'
    return String(rank)
  }
  if (String(rank) === '100+') return '100+'
  var n = parseInt(rank, 10)
  if (!isNaN(n) && n > 100) return '100+'
  return String(rank)
}

function mapDesignRect(modal, dx, dy, dw, dh) {
  var sx = modal.w / SRC_W
  var sy = modal.h / SRC_H
  return {
    x: modal.x + dx * sx,
    y: modal.y + dy * sy,
    w: dw * sx,
    h: dh * sy,
    sx: sx,
    sy: sy
  }
}

function font(modal, designPx, weight) {
  var sx = modal.w / SRC_W
  return (weight || '400') + ' ' + Math.max(10, Math.round(designPx * sx)).toFixed(0) + 'px ' + FONT_FAMILY
}

function computeModalRect(W, H) {
  var pad = rpx.rpx(MODAL_PAD_X_RPX)
  var safeTop = rpx.safeTop()
  var safeBottom = rpx.safeBottom()
  var areaW = W - pad * 2
  var areaH = H - safeTop - safeBottom - pad * 2
  var modalW = areaW
  var modalH = modalW * (SRC_H / SRC_W)
  if (modalH > areaH) {
    modalH = areaH
    modalW = modalH * (SRC_W / SRC_H)
  }
  return {
    x: (W - modalW) / 2,
    y: safeTop + pad + (areaH - modalH) / 2,
    w: modalW,
    h: modalH
  }
}

function withModalShift(modal) {
  var sx = modal.w / SRC_W
  return {
    x: modal.x + MODAL_SHIFT_X * sx,
    y: modal.y,
    w: modal.w,
    h: modal.h
  }
}

function overlayAlpha(timeMs) {
  return MASK_MAX_ALPHA * Math.min(1, timeMs / MASK_FADE_MS)
}

function contentScale(timeMs) {
  if (timeMs < MODAL_DELAY_MS) return 0
  var p = Math.min(1, (timeMs - MODAL_DELAY_MS) / MODAL_ENTER_MS)
  var eased = 1 - Math.pow(1 - p, 3)
  return 0.78 + (1 - 0.78) * eased
}

function canInteract(enterAnim) {
  if (!enterAnim) return true
  return enterAnim.time >= MODAL_DELAY_MS + MODAL_ENTER_MS
}

function beginEnter(screen) {
  screen._rankEnterAnim = { time: 0 }
}

function tickEnter(screen, dt) {
  if (!screen._rankEnterAnim) return
  screen._rankEnterAnim.time += dt
  if (screen._rankEnterAnim.time >= MODAL_DELAY_MS + MODAL_ENTER_MS) {
    screen._rankEnterAnim = null
  }
}

function clearEnter(screen) {
  screen._rankEnterAnim = null
}

function drawRankMedal(ctx, modal, cx, cy, rank) {
  var path = MEDAL_IMAGES[rank]
  if (!path) return false
  var img = assets.get(path)
  if (!img) {
    assets.tryLoad(path)
    return false
  }
  var sx = modal.w / SRC_W
  var iw = MEDAL_IMG_W * sx
  var ih = MEDAL_IMG_H * sx
  ctx.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih)
  return true
}

function drawRankNumber(ctx, modal, cx, cy, label) {
  var sx = modal.w / SRC_W
  var f = font(modal, FONT_RANK, '700')
  ctx.save()
  ctx.font = f
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = Math.max(2, Math.round(6 * sx))
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.strokeStyle = COLOR_RANK_STROKE
  ctx.strokeText(label, cx, cy)
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = Math.max(2, 6 * sx)
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = Math.max(1, 3 * sx)
  ctx.fillStyle = COLOR_RANK
  ctx.fillText(label, cx, cy)
  ctx.restore()
}

function drawAvatar(ctx, modal, url, name, x, y, size) {
  var sx = modal.w / SRC_W
  var cx = x + size / 2
  var cy = y + size / 2
  var radius = size / 2
  var displayName = user.resolveNickname(name)
  var avatarUrl = user.resolveAvatarUrl(url)
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.clip()
  var img = null
  if (avatarUrl) {
    assets.tryLoad(avatarUrl)
    img = assets.get(avatarUrl)
  }
  if (img) {
    draw.drawImageCover(ctx, img, x, y, size, size)
  } else {
    ctx.fillStyle = '#c5e8dc'
    ctx.fillRect(x, y, size, size)
    draw.fillTextCentered(
      ctx, displayName.charAt(0), cx, cy,
      font(modal, 32, '600'), '#5c8a7a'
    )
  }
  ctx.restore()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = Math.max(1, 3 * sx)
  ctx.beginPath()
  ctx.arc(cx, cy, radius - sx, 0, Math.PI * 2)
  ctx.stroke()
}

function drawLevelLabel(ctx, modal, rightX, cy, levels) {
  var f = font(modal, FONT_LEVEL, '700')
  var numText = String(levels != null ? levels : 0)
  var suffix = '关'
  ctx.save()
  ctx.font = f
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  var suffixW = ctx.measureText(suffix).width
  var numW = ctx.measureText(numText).width
  ctx.fillStyle = COLOR_LEVEL
  ctx.fillText(numText, rightX - suffixW - numW, cy)
  ctx.fillStyle = COLOR_LEVEL_UNIT
  ctx.fillText(suffix, rightX - suffixW, cy)
  ctx.restore()
}

function drawRowBg(ctx, x, y, w, h) {
  var img = assets.get(ROW_IMAGE)
  if (!img) {
    assets.tryLoad(ROW_IMAGE)
    return false
  }
  ctx.drawImage(img, x, y, w, h)
  return true
}

function drawRowContent(ctx, modal, item, rect) {
  var rankNum = typeof item.rank === 'number' ? item.rank : parseInt(item.rank, 10)
  var rankLabel = !isNaN(rankNum) ? String(rankNum) : formatRankLabel(item.rank)
  var sx = modal.w / SRC_W
  var x = rect.x
  var y = rect.y
  var w = rect.w
  var h = rect.h
  var cy = y + h / 2
  var stripW = w * (LAYOUT.rowRankStripW / ROW_IMG_W)
  var badgeCx = x + stripW * 0.5
  var rankCx = badgeCx + LAYOUT.rankOffsetX * sx
  var rankCy = cy + LAYOUT.rankOffsetY * sx

  if (!isNaN(rankNum) && rankNum >= 1 && rankNum <= 3) {
    var medalCx = badgeCx + LAYOUT.medalOffsetX * sx
    if (!drawRankMedal(ctx, modal, medalCx, rankCy, rankNum)) {
      drawRankNumber(ctx, modal, rankCx, rankCy, rankLabel)
    }
  } else {
    drawRankNumber(ctx, modal, rankCx, rankCy, formatRankLabel(item.rank))
  }

  var contentDy = LAYOUT.contentOffsetY * sx
  var avatarSize = LAYOUT.avatarSize * sx
  var avatarX = x + stripW + LAYOUT.textGap * sx + LAYOUT.avatarOffsetX * sx
  var avatarY = y + (h - avatarSize) / 2 + contentDy
  drawAvatar(ctx, modal, item.avatarUrl, item.name, avatarX, avatarY, avatarSize)

  var textX = avatarX + avatarSize + LAYOUT.avatarTextGap * sx
  var nameY = cy - LAYOUT.nameOffsetY * sx + contentDy
  var ipY = cy + LAYOUT.ipOffsetY * sx + contentDy
  draw.fillTextLeft(
    ctx, user.resolveNickname(item.name), textX, nameY,
    font(modal, FONT_NAME, '700'), COLOR_NAME
  )
  draw.fillTextLeft(
    ctx, 'IP:未知', textX, ipY,
    font(modal, FONT_IP, '400'), COLOR_IP
  )

  var levels = item.levels != null ? item.levels : 0
  drawLevelLabel(ctx, modal, x + w - LAYOUT.levelPadR * sx, cy + LAYOUT.levelOffsetY * sx, levels)
}

function drawRankEntry(ctx, modal, item, rect) {
  drawRowBg(ctx, rect.x, rect.y, rect.w, rect.h)
  drawRowContent(ctx, modal, item, rect)
}

function drawMyRowOverlay(ctx, modal, item, rect) {
  drawRowContent(ctx, modal, item, rect)
}

function drawMyRow(ctx, modal, rankDataApi) {
  var rect = mapDesignRect(modal, LAYOUT.myRow.x, LAYOUT.myRow.y, LAYOUT.myRow.w, LAYOUT.myRow.h)
  var img = assets.get(MY_ROW_IMAGE)
  if (img) {
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h)
  } else {
    assets.tryLoad(MY_ROW_IMAGE)
  }
  drawMyRowOverlay(ctx, modal, rankDataApi.getMyRank(), rect)
}

function drawModalImage(ctx, modal) {
  var img = assets.get(MODAL_IMAGE)
  if (!img) {
    assets.tryLoad(MODAL_IMAGE)
    return false
  }
  ctx.drawImage(img, modal.x, modal.y, modal.w, modal.h)
  return true
}

function getMyRowProfileStyle(modal) {
  var rect = mapDesignRect(modal, LAYOUT.myRow.x, LAYOUT.myRow.y, LAYOUT.myRow.w, LAYOUT.myRow.h)
  var sx = modal.w / SRC_W
  var stripW = rect.w * (LAYOUT.rowRankStripW / ROW_IMG_W)
  var avatarSize = LAYOUT.avatarSize * sx
  var avatarX = rect.x + stripW + LAYOUT.textGap * sx + LAYOUT.avatarOffsetX * sx
  var avatarY = rect.y + (rect.h - avatarSize) / 2 + LAYOUT.contentOffsetY * sx
  return {
    left: avatarX,
    top: avatarY,
    width: avatarSize,
    height: avatarSize
  }
}

function preload() {
  assets.load(MODAL_IMAGE).catch(function () {})
  assets.load(ROW_IMAGE).catch(function () {})
  assets.load(MY_ROW_IMAGE).catch(function () {})
  assets.load(MEDAL_IMAGES[1]).catch(function () {})
  assets.load(MEDAL_IMAGES[2]).catch(function () {})
  assets.load(MEDAL_IMAGES[3]).catch(function () {})
}

function drawModalContent(screen, ctx, W, H, rankDataApi, onClose, modal, canTap) {
  var frame = withModalShift(modal)
  var hasImage = drawModalImage(ctx, frame)
  if (!hasImage) {
    draw.fillRoundedRect(ctx, frame.x, frame.y, frame.w, frame.h, rpx.rpx(28), '#e8f5f1')
  }
  if (canTap) {
    screen.addHitZone({ x: frame.x, y: frame.y, w: frame.w, h: frame.h }, function () {})
  }

  var close = mapDesignRect(frame, LAYOUT.close.x, LAYOUT.close.y, LAYOUT.close.w, LAYOUT.close.h)
  if (canTap) screen.addHitZone(close, onClose)

  var myRect = mapDesignRect(modal, LAYOUT.myRow.x, LAYOUT.myRow.y, LAYOUT.myRow.w, LAYOUT.myRow.h)

  // 列表相对弹框底图左移 MODAL_SHIFT_X，与 modal 水平居中对齐（不用 frame 偏移）
  var listTop = mapDesignRect(modal, LAYOUT.list.x, LAYOUT.list.y, LAYOUT.list.w, 1)
  var listX = listTop.x
  var listW = listTop.w
  var listY = listTop.y
  var listBottom = myRect.y - rpx.rpx(8)
  var listH = Math.max(rpx.rpx(80), listBottom - listY)
  var rowH = LAYOUT.rowH * (modal.w / SRC_W)
  var rowGap = LAYOUT.rowGap * (modal.w / SRC_W)

  ctx.save()
  ctx.beginPath()
  ctx.rect(listX, listY, listW, listH)
  ctx.clip()

  var fullList = rankDataApi.getLeaderboard()
  if (rankDataApi.isNationalLoading()) {
    draw.fillTextCentered(
      ctx, '加载中...', listX + listW / 2, listY + listH / 2,
      font(modal, FONT_NAME, '400'), COLOR_HINT
    )
    ctx.restore()
    screen._rankMaxScroll = 0
    screen._rankListRect = canTap ? { x: listX, y: listY, w: listW, h: listH } : null
    drawMyRow(ctx, modal, rankDataApi)
    return
  }
  if (rankDataApi.isNationalError && rankDataApi.isNationalError()) {
    draw.fillTextCentered(
      ctx, '加载失败，请稍后重试', listX + listW / 2, listY + listH / 2,
      font(modal, FONT_IP, '400'), COLOR_HINT
    )
    ctx.restore()
    screen._rankMaxScroll = 0
    screen._rankListRect = canTap ? { x: listX, y: listY, w: listW, h: listH } : null
    drawMyRow(ctx, modal, rankDataApi)
    return
  }
  if (rankDataApi.isNationalLoaded() && !fullList.length) {
    draw.fillTextCentered(
      ctx, '暂无排行，快去通关吧', listX + listW / 2, listY + listH / 2,
      font(modal, FONT_IP, '400'), COLOR_HINT
    )
    ctx.restore()
    screen._rankMaxScroll = 0
    screen._rankListRect = canTap ? { x: listX, y: listY, w: listW, h: listH } : null
    drawMyRow(ctx, modal, rankDataApi)
    return
  }

  var contentY = listY - screen.rankScrollY
  var rowY = contentY
  for (var i = 0; i < fullList.length; i++) {
    drawRankEntry(ctx, modal, fullList[i], {
      x: listX,
      y: rowY,
      w: listW,
      h: rowH
    })
    rowY += rowH + rowGap
  }

  ctx.restore()

  var contentHeight = fullList.length * rowH + Math.max(0, fullList.length - 1) * rowGap
  screen._rankMaxScroll = Math.max(0, contentHeight - listH)
  screen._rankListRect = canTap ? { x: listX, y: listY, w: listW, h: listH } : null

  drawMyRow(ctx, modal, rankDataApi)

  if (canTap) {
    var myAvatar = getMyRowProfileStyle(modal)
    user.syncProfileButton(myAvatar, user.needsProfilePrompt())
    screen.addHitZone(myAvatar, function () {
      user.requestWxProfileFromTap(myAvatar).then(function () {
        try {
          wx.showToast({ title: '资料已更新', icon: 'success' })
        } catch (e) {}
      }).catch(function (err) {
        user.showProfileError(err)
      })
    })
  }
}

function drawModal(screen, ctx, W, H, rankDataApi, onClose) {
  var enterAnim = screen._rankEnterAnim
  var enterTime = enterAnim ? enterAnim.time : MODAL_DELAY_MS + MODAL_ENTER_MS
  var scale = contentScale(enterTime)
  var canTap = canInteract(enterAnim)

  screen._rankListRect = null
  screen._rankMaxScroll = 0

  ctx.fillStyle = 'rgba(30,30,50,' + overlayAlpha(enterTime) + ')'
  ctx.fillRect(0, 0, W, H)
  if (canTap) {
    screen.addHitZone({ x: 0, y: 0, w: W, h: H }, onClose)
  }

  if (scale <= 0) return

  var modal = computeModalRect(W, H)
  var cx = modal.x + modal.w / 2
  var cy = modal.y + modal.h / 2

  pressAnim.drawWithPressScale(ctx, cx, cy, scale, function () {
    drawModalContent(screen, ctx, W, H, rankDataApi, onClose, modal, canTap)
  })
}

module.exports = {
  draw: drawModal,
  preload: preload,
  computeModalRect: computeModalRect,
  getMyRowProfileStyle: getMyRowProfileStyle,
  beginEnter: beginEnter,
  tickEnter: tickEnter,
  clearEnter: clearEnter,
  formatRankLabel: formatRankLabel
}
