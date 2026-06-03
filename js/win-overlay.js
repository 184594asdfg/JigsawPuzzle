/**
 * 拼图通关：完整原图原地缩小 → 图上/下贴「恭喜通关」「下一关」图片
 */
var rpx = require('./rpx')
var assets = require('./assets')
var draw = require('./draw')
var puzzleLayout = require('./puzzle/layout')

var WIN_TITLE = 'images/win/win_title.png'
var WIN_NEXT = 'images/win/win_next.png'

var SHRINK_MS = 1000
var END_SCALE = 0.72
var TEXT_FADE_MS = 350
var MASK_ALPHA = 0.55

/**
 * 源图按 @3x 导出时，屏上显示宽（rpx）建议值（高由宽高比自动算）：
 * - 恭喜 3657×1146 → 宽 640（独立于拼图图宽度，可略宽于棋盘）
 * - 下一关 2714×1138 → 宽 380（按钮略窄）
 * 资源文件保持你提供的原始分辨率即可，不必再压成小图。
 */
var TITLE_W_RPX = 640
var NEXT_W_RPX = 380
var TITLE_GAP_RPX = 32
var NEXT_GAP_RPX = 32

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

function preload() {
  assets.load(WIN_TITLE)
  assets.load(WIN_NEXT)
}

function resetFx(screen) {
  if (!screen) return
  screen._winFxMs = 0
}

function tickFx(screen, dt) {
  if (!screen || !screen.showSuccess) return
  if (screen._winFxMs == null) screen._winFxMs = 0
  screen._winFxMs += dt
}

function shrinkProgress(ms) {
  if (ms <= 0) return 0
  if (ms >= SHRINK_MS) return 1
  return easeOutCubic(ms / SHRINK_MS)
}

function textAlpha(ms) {
  if (ms < SHRINK_MS) return 0
  var t = (ms - SHRINK_MS) / TEXT_FADE_MS
  return t >= 1 ? 1 : t
}

function getBoardLayout(screen) {
  if (!screen.engine) return null
  var board = screen.engine.boardSize()
  var bx = screen.engine.boardX
  var by = screen.engine.boardY
  return {
    x: bx,
    y: by,
    w: board.w,
    h: board.h,
    cx: bx + board.w / 2,
    cy: by + board.h / 2
  }
}

function computeImageRect(img, layout, scale) {
  if (!img || !img.width || !layout) return null
  var boxW = layout.w * scale
  var boxH = layout.h * scale
  var ratio = Math.min(boxW / img.width, boxH / img.height)
  var dw = img.width * ratio
  var dh = img.height * ratio
  return {
    cx: layout.cx,
    cy: layout.cy,
    top: layout.cy - dh / 2,
    bottom: layout.cy + dh / 2,
    w: dw,
    h: dh
  }
}

/** 与拼图块一致：白底 + 内缩 + 圆角图 + 1px 黑描边 */
function drawFullImageWithCardEdge(ctx, img, layout, scale) {
  var rect = computeImageRect(img, layout, scale)
  if (!rect) return null

  var x = rect.cx - rect.w / 2
  var y = rect.cy - rect.h / 2
  var w = rect.w
  var h = rect.h
  var inset = puzzleLayout.BORDER + puzzleLayout.PIECE_PADDING
  var R = puzzleLayout.PIECE_RADIUS

  draw.roundedRectPathCorners(ctx, x, y, w, h, R, R, R, R)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  var imgX = x + inset
  var imgY = y + inset
  var imgW = w - inset * 2
  var imgH = h - inset * 2
  ctx.save()
  draw.roundedRectPathCorners(ctx, imgX, imgY, imgW, imgH, R, R, R, R)
  ctx.clip()
  draw.drawImageContain(ctx, img, imgX, imgY, imgW, imgH)
  ctx.restore()

  draw.roundedRectPathCorners(ctx, x + 0.5, y + 0.5, w - 1, h - 1, R, R, R, R)
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 1
  ctx.stroke()

  return rect
}

function displaySizeFromImage(img, displayW) {
  if (!img || !img.width) {
    return { w: displayW, h: displayW * 0.3 }
  }
  var ratio = img.height / img.width
  return { w: displayW, h: displayW * ratio }
}

function drawImageByWidth(ctx, img, cx, cy, displayW) {
  if (!img || !img.width) return null
  var size = displaySizeFromImage(img, displayW)
  ctx.drawImage(img, cx - size.w / 2, cy - size.h / 2, size.w, size.h)
  return size
}

function computeLabelLayout(imageRect, titleImg, nextImg) {
  var titleW = rpx.rpx(TITLE_W_RPX)
  var nextW = rpx.rpx(NEXT_W_RPX)
  var titleGap = rpx.rpx(TITLE_GAP_RPX)
  var nextGap = rpx.rpx(NEXT_GAP_RPX)
  var titleSize = displaySizeFromImage(titleImg, titleW)
  var nextSize = displaySizeFromImage(nextImg, nextW)
  return {
    cx: imageRect.cx,
    titleCy: imageRect.top - titleGap - titleSize.h / 2,
    nextCy: imageRect.bottom + nextGap + nextSize.h / 2,
    titleW: titleSize.w,
    titleH: titleSize.h,
    nextW: nextSize.w,
    nextH: nextSize.h,
    titleFont: '700 ' + rpx.rpx(48).toFixed(0) + 'px sans-serif',
    nextFont: '600 ' + rpx.rpx(36).toFixed(0) + 'px sans-serif'
  }
}

function rectCentered(cx, cy, w, h) {
  return { x: cx - w / 2, y: cy - h / 2, w: w, h: h }
}

/**
 * @param {object} screen PuzzleScreen
 * @param {function} handlers.onGoHome - 点击「下一关」回首页
 */
function drawOverlay(screen, ctx, W, H, handlers) {
  screen.resetHitZones()

  var fxMs = screen._winFxMs != null ? screen._winFxMs : 0
  var shrinkT = shrinkProgress(fxMs)
  var scale = 1 - (1 - END_SCALE) * shrinkT
  var alpha = textAlpha(fxMs)

  ctx.fillStyle = 'rgba(0,0,0,' + (MASK_ALPHA * Math.min(1, shrinkT * 1.2 + alpha * 0.2)) + ')'
  ctx.fillRect(0, 0, W, H)

  var board = getBoardLayout(screen)
  var img = screen.engine && screen.engine.image
  var imageRect = null
  if (img && board) {
    imageRect = drawFullImageWithCardEdge(ctx, img, board, scale)
  }

  if (alpha <= 0 || !imageRect) return

  var titleImg = assets.get(WIN_TITLE)
  if (!titleImg) assets.load(WIN_TITLE)
  var nextImg = assets.get(WIN_NEXT)
  if (!nextImg) assets.load(WIN_NEXT)

  var layout = computeLabelLayout(imageRect, titleImg, nextImg)
  ctx.save()
  ctx.globalAlpha = alpha

  if (titleImg) {
    drawImageByWidth(ctx, titleImg, layout.cx, layout.titleCy, layout.titleW)
  } else {
    draw.fillTextCentered(
      ctx, '恭喜通关', layout.cx, layout.titleCy,
      layout.titleFont, '#ffffff'
    )
  }

  if (nextImg) {
    drawImageByWidth(ctx, nextImg, layout.cx, layout.nextCy, layout.nextW)
  } else {
    draw.fillTextCentered(
      ctx, '下一关', layout.cx, layout.nextCy,
      layout.nextFont, '#FFE566'
    )
  }

  ctx.restore()

  if (alpha >= 1 && handlers && handlers.onGoHome) {
    var hit = rectCentered(layout.cx, layout.nextCy, layout.nextW, layout.nextH)
    screen.addHitZone(hit, handlers.onGoHome)
  }
}

module.exports = {
  WIN_TITLE: WIN_TITLE,
  WIN_NEXT: WIN_NEXT,
  TITLE_W_RPX: TITLE_W_RPX,
  NEXT_W_RPX: NEXT_W_RPX,
  SHRINK_MS: SHRINK_MS,
  preload: preload,
  resetFx: resetFx,
  tickFx: tickFx,
  drawOverlay: drawOverlay
}
