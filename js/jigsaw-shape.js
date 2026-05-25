/**
 * 经典拼图轮廓：内部分割线中点带半圆凸/凹，朝向与首页 hero 网格一致（稳定伪随机）。
 */

function tabDir(r, c, type) {
  var hash = (r * 7 + c * 13 + (type === 'v' ? 1 : 17)) % 4
  return hash < 2 ? 1 : -1
}

function knobR(w, h) {
  return Math.min(w, h) * 0.18
}

/**
 * 顺时针闭合路径。att 为 true 的边与组合邻居贴合，画直线不画凸起。
 */
function piecePath(ctx, x, y, w, h, col, row, N, att) {
  var kr = knobR(w, h)
  var midX = x + w / 2
  var midY = y + h / 2
  var a = att || {}

  ctx.beginPath()
  ctx.moveTo(x, y)

  if (a.top) {
    ctx.lineTo(x + w, y)
  } else if (row === 0) {
    ctx.lineTo(x + w, y)
  } else {
    var dhTop = tabDir(row - 1, col, 'h')
    ctx.lineTo(midX - kr, y)
    ctx.arc(midX, y, kr, Math.PI, 0, dhTop === 1)
    ctx.lineTo(x + w, y)
  }

  if (a.right) {
    ctx.lineTo(x + w, y + h)
  } else if (col === N - 1) {
    ctx.lineTo(x + w, y + h)
  } else {
    var dv = tabDir(row, col, 'v')
    ctx.lineTo(x + w, midY - kr)
    ctx.arc(x + w, midY, kr, -Math.PI / 2, Math.PI / 2, dv === -1)
    ctx.lineTo(x + w, y + h)
  }

  if (a.bottom) {
    ctx.lineTo(x, y + h)
  } else if (row === N - 1) {
    ctx.lineTo(x, y + h)
  } else {
    var dhBot = tabDir(row, col, 'h')
    ctx.lineTo(midX + kr, y + h)
    ctx.arc(midX, y + h, kr, Math.PI, 0, dhBot === 1)
    ctx.lineTo(x, y + h)
  }

  if (a.left) {
    ctx.closePath()
  } else if (col === 0) {
    ctx.closePath()
  } else {
    var dvL = tabDir(row, col - 1, 'v')
    ctx.lineTo(x, midY + kr)
    ctx.arc(x, midY, kr, Math.PI / 2, -Math.PI / 2, dvL === 1)
    ctx.closePath()
  }
}

module.exports = {
  tabDir: tabDir,
  knobR: knobR,
  piecePath: piecePath
}
