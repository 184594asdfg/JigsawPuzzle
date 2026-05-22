/**
 * Canvas 2D 通用绘制助手。所有坐标使用逻辑像素。
 */

function roundedRectPath(ctx, x, y, w, h, r) {
  var maxR = Math.min(w, h) / 2
  var rr = Math.max(0, Math.min(r, maxR))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}

function roundedRectPathCorners(ctx, x, y, w, h, tl, tr, br, bl) {
  ctx.beginPath()
  ctx.moveTo(x + tl, y)
  ctx.lineTo(x + w - tr, y)
  if (tr > 0) ctx.quadraticCurveTo(x + w, y, x + w, y + tr)
  ctx.lineTo(x + w, y + h - br)
  if (br > 0) ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h)
  ctx.lineTo(x + bl, y + h)
  if (bl > 0) ctx.quadraticCurveTo(x, y + h, x, y + h - bl)
  ctx.lineTo(x, y + tl)
  if (tl > 0) ctx.quadraticCurveTo(x, y, x + tl, y)
  ctx.closePath()
}

function fillRoundedRect(ctx, x, y, w, h, r, color) {
  roundedRectPath(ctx, x, y, w, h, r)
  ctx.fillStyle = color
  ctx.fill()
}

function strokeRoundedRect(ctx, x, y, w, h, r, color, lineWidth) {
  roundedRectPath(ctx, x, y, w, h, r)
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth || 1
  ctx.stroke()
}

function drawImageCover(ctx, img, x, y, w, h) {
  if (!img || !img.width) return
  var ratio = Math.max(w / img.width, h / img.height)
  var dw = img.width * ratio
  var dh = img.height * ratio
  var dx = x + (w - dw) / 2
  var dy = y + (h - dh) / 2
  ctx.drawImage(img, dx, dy, dw, dh)
}

function drawImageContain(ctx, img, x, y, w, h) {
  if (!img || !img.width) return
  var ratio = Math.min(w / img.width, h / img.height)
  var dw = img.width * ratio
  var dh = img.height * ratio
  var dx = x + (w - dw) / 2
  var dy = y + (h - dh) / 2
  ctx.drawImage(img, dx, dy, dw, dh)
}

function fillTextCentered(ctx, text, x, y, font, color) {
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
}

function fillTextLeft(ctx, text, x, y, font, color) {
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
}

function fillTextRight(ctx, text, x, y, font, color) {
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
}

/** 截断超长文本（按字符，简单做） */
function ellipsize(ctx, text, maxWidth) {
  if (!text) return ''
  if (ctx.measureText(text).width <= maxWidth) return text
  var ell = '…'
  for (var i = text.length - 1; i > 0; i--) {
    var t = text.substring(0, i) + ell
    if (ctx.measureText(t).width <= maxWidth) return t
  }
  return ell
}

function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w &&
    y >= rect.y && y <= rect.y + rect.h
}

function drawNavArrow(ctx, cx, cy, size, color, lineWidth) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth || 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(cx + size / 2, cy - size / 2)
  ctx.lineTo(cx - size / 2, cy)
  ctx.lineTo(cx + size / 2, cy + size / 2)
  ctx.stroke()
  ctx.restore()
}

module.exports = {
  roundedRectPath: roundedRectPath,
  roundedRectPathCorners: roundedRectPathCorners,
  fillRoundedRect: fillRoundedRect,
  strokeRoundedRect: strokeRoundedRect,
  drawImageCover: drawImageCover,
  drawImageContain: drawImageContain,
  fillTextCentered: fillTextCentered,
  fillTextLeft: fillTextLeft,
  fillTextRight: fillTextRight,
  ellipsize: ellipsize,
  pointInRect: pointInRect,
  drawNavArrow: drawNavArrow
}
