/**
 * 首页 hero：新解锁封面碎片从屏心飞入格子归位
 */
var draw = require('./draw')
var jigsawShape = require('./jigsaw-shape')

var SNAP_DUR_MS = 560
var FROM_SCALE = 1.28

function easeOutCubic(t) {
  var p = 1 - t
  return 1 - p * p * p
}

function cellMetrics(topArea, cols, rows, index) {
  var cellW = topArea.w / cols
  var cellH = topArea.h / rows
  var c = index % cols
  var r = Math.floor(index / cols)
  return {
    c: c,
    r: r,
    cx: topArea.x + c * cellW + cellW / 2,
    cy: topArea.y + r * cellH + cellH / 2,
    w: cellW,
    h: cellH
  }
}

/**
 * @param {object} screen HomeScreen
 * @param {object} opts - cellIndex, topArea, cols, rows, fromX, fromY, coverImg, themeId
 */
function start(screen, opts) {
  var cell = cellMetrics(opts.topArea, opts.cols, opts.rows, opts.cellIndex)
  screen._heroSliceSnap = {
    active: true,
    themeId: opts.themeId || '',
    cellIndex: opts.cellIndex,
    topArea: opts.topArea,
    cols: opts.cols,
    rows: opts.rows,
    coverImg: opts.coverImg,
    fromX: opts.fromX,
    fromY: opts.fromY,
    toX: cell.cx,
    toY: cell.cy,
    cellW: cell.w,
    cellH: cell.h,
    c: cell.c,
    r: cell.r,
    t0: Date.now(),
    dur: SNAP_DUR_MS
  }
}

function tick(screen) {
  var snap = screen._heroSliceSnap
  if (!snap || !snap.active) return
  var t = (Date.now() - snap.t0) / snap.dur
  if (t >= 1) {
    snap.active = false
    screen._heroSliceSnap = null
  }
}

function isAnimating(screen) {
  return !!(screen._heroSliceSnap && screen._heroSliceSnap.active)
}

function render(ctx, screen) {
  var snap = screen._heroSliceSnap
  if (!snap || !snap.active || !snap.coverImg) return
  var t = (Date.now() - snap.t0) / snap.dur
  if (t < 0) t = 0
  if (t > 1) t = 1
  var e = easeOutCubic(t)
  var scale = FROM_SCALE + (1 - FROM_SCALE) * e
  var cx = snap.fromX + (snap.toX - snap.fromX) * e
  var cy = snap.fromY + (snap.toY - snap.fromY) * e
  var w = snap.cellW * scale
  var h = snap.cellH * scale
  var px = cx - w / 2
  var py = cy - h / 2
  var ta = snap.topArea

  ctx.save()
  jigsawShape.piecePath(ctx, px, py, w, h, snap.c, snap.r, snap.cols, null)
  ctx.clip()
  draw.drawImageCover(ctx, snap.coverImg, ta.x, ta.y, ta.w, ta.h)
  ctx.restore()
}

function snapThemeId(screen) {
  var snap = screen._heroSliceSnap
  if (snap && snap.themeId) return snap.themeId
  var pending = screen._pendingSliceUnlock
  return pending && pending.themeId ? pending.themeId : ''
}

module.exports = {
  SNAP_DUR_MS: SNAP_DUR_MS,
  start: start,
  tick: tick,
  isAnimating: isAnimating,
  render: render,
  snapThemeId: snapThemeId
}
