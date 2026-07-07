/**
 * 拼图布局计算：与小程序版规范一致（详见 docs/PUZZLE_SIZING.md）。
 *   - 棋盘外宽 = 容器宽 ×100%
 *   - 内边距 12，块间距 0，单块 cellW×cellH（2:3）
 *   - imageTileW/H = cellW/H 扣除 border+padding
 */
var CONTAINER_RATIO = 1
var GAP = 0
var BOARD_PADDING = 12
var BORDER = 1
var PIECE_PADDING = 1
var PIECE_RADIUS = 2

function computeLayout(windowWidth, N, opts) {
  opts = opts || {}
  var maxBoardW = opts.maxBoardW != null ? opts.maxBoardW : windowWidth * CONTAINER_RATIO
  var maxBoardH = opts.maxBoardH != null ? opts.maxBoardH : Infinity

  var boardOuterW = Math.floor(Math.min(windowWidth * CONTAINER_RATIO, maxBoardW))
  var gridInnerW = boardOuterW - BOARD_PADDING * 2
  var cellW = Math.floor((gridInnerW - GAP * (N - 1)) / N)
  var cellH = Math.floor((cellW * 3) / 2)
  if (cellW < 1) cellW = 1
  if (cellH < 1) cellH = 1

  var gridW = cellW * N + GAP * (N - 1)
  var gridH = cellH * N + GAP * (N - 1)
  var boardH = gridH + BOARD_PADDING * 2

  if (maxBoardH < Infinity && boardH > maxBoardH) {
    var gridInnerH = maxBoardH - BOARD_PADDING * 2
    cellH = Math.floor((gridInnerH - GAP * (N - 1)) / N)
    cellW = Math.floor((cellH * 2) / 3)
    if (cellW < 1) cellW = 1
    if (cellH < 1) cellH = 1
    gridW = cellW * N + GAP * (N - 1)
    gridH = cellH * N + GAP * (N - 1)
    boardOuterW = gridW + BOARD_PADDING * 2
    boardH = gridH + BOARD_PADDING * 2
  }
  var stepX = cellW + GAP
  var stepY = cellH + GAP

  var imageTileW = cellW - 2 * BORDER - 2 * PIECE_PADDING
  var imageTileH = cellH - 2 * BORDER - 2 * PIECE_PADDING

  return {
    N: N,
    GAP: GAP,
    BOARD_PADDING: BOARD_PADDING,
    BORDER: BORDER,
    PIECE_PADDING: PIECE_PADDING,
    PIECE_RADIUS: PIECE_RADIUS,
    cellW: cellW,
    cellH: cellH,
    imageTileW: imageTileW,
    imageTileH: imageTileH,
    gridW: gridW,
    gridH: gridH,
    boardW: boardOuterW,
    boardH: boardH,
    stepX: stepX,
    stepY: stepY,
    imgW: cellW * N,
    imgH: cellH * N
  }
}

function slotToXY(layout, col, row) {
  return {
    x: layout.BOARD_PADDING + col * layout.stepX,
    y: layout.BOARD_PADDING + row * layout.stepY
  }
}

module.exports = {
  CONTAINER_RATIO: CONTAINER_RATIO,
  GAP: GAP,
  BOARD_PADDING: BOARD_PADDING,
  BORDER: BORDER,
  PIECE_PADDING: PIECE_PADDING,
  PIECE_RADIUS: PIECE_RADIUS,
  computeLayout: computeLayout,
  slotToXY: slotToXY
}
