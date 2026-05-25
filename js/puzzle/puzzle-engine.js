/**
 * 拼图引擎：在指定 (boardX, boardY) 处自绘整个棋盘，支持拖拽、连通组合并、胜利判定。
 *
 * 与小程序版的渲染数据结构对齐：
 *   group = { id, x, y, w, h, tx, ty, dragging, isCompound, pieces[] }
 *   piece = { id, originalIndex, currentIndex, localX, localY, offsetX, offsetY,
 *             attTop/Right/Bottom/Left, tx, ty }
 *
 * tx/ty 用作「视觉偏移」：拖拽时直接由手指控制；落位/合并时通过 tween 平滑回到 0。
 */
var layoutMod = require('./layout')
var assets = require('../assets')
var draw = require('../draw')
var settings = require('../../utils/settings')

var SRC_IMAGE_W = 750
var SRC_IMAGE_H = 1125
var ANIM_DUR = 220
var MERGE_FX_DUR = 1100

var SOUND_MOVE = 'audio/move.mp3'
var SOUND_SWAP = 'audio/swap.mp3'
var MERGE_FX_IMAGE = 'images/merge_fx.png'

function easeOutCubic(t) {
  var p = 1 - t
  return 1 - p * p * p
}

function fisherYatesShuffle(arr) {
  var a = arr.slice()
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1))
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp
  }
  var same = true
  for (var k = 0; k < a.length; k++) {
    if (a[k] !== k) { same = false; break }
  }
  if (same && a.length > 1) {
    var t = a[0]; a[0] = a[1]; a[1] = t
  }
  return a
}

function PuzzleEngine(opts) {
  this.windowWidth = opts.windowWidth
  this.gridSize = opts.grid || 4
  this.imageSrc = opts.image
  this.boardX = 0
  this.boardY = 0
  this.layout = null
  this.image = null
  this.pieces = null
  this.groups = []
  this.dragInfo = null
  this.moves = 0
  this.solved = false
  this._anims = {}        // pieceId -> {fromTx, fromTy, t0, dur}
  this._groupAnims = {}   // groupId -> {fromTx, fromTy, t0, dur}
  this._mergeFx = null    // {x,y,w,h,t0}
  this.onWin = opts.onWin || function () {}
  this.onAnyMove = opts.onAnyMove || function () {}
  this.sfxEnabled = settings.get('sfx')
  this._initAudio()
  this._applyLayout()
}

PuzzleEngine.prototype._initAudio = function () {
  try {
    this._moveAudio = wx.createInnerAudioContext()
    this._swapAudio = wx.createInnerAudioContext()
    this._moveAudio.src = SOUND_MOVE
    this._swapAudio.src = SOUND_SWAP
  } catch (e) {
    this._moveAudio = null
    this._swapAudio = null
  }
}
PuzzleEngine.prototype.destroy = function () {
  if (this._moveAudio) { this._moveAudio.destroy && this._moveAudio.destroy(); this._moveAudio = null }
  if (this._swapAudio) { this._swapAudio.destroy && this._swapAudio.destroy(); this._swapAudio = null }
}
PuzzleEngine.prototype.setSfxEnabled = function (enabled) {
  this.sfxEnabled = !!enabled
}
PuzzleEngine.prototype._playSound = function (a) {
  if (!this.sfxEnabled || !a) return
  try { a.stop(); a.seek && a.seek(0); a.play() } catch (e) {}
}

PuzzleEngine.prototype._applyLayout = function () {
  this.layout = layoutMod.computeLayout(this.windowWidth, this.gridSize)
}

PuzzleEngine.prototype.boardSize = function () {
  return { w: this.layout.boardW, h: this.layout.boardH }
}

PuzzleEngine.prototype.setBoardPosition = function (x, y) {
  this.boardX = x
  this.boardY = y
}

// ---------------------------------------------------------------------------
//  初始化 / 洗牌
// ---------------------------------------------------------------------------

PuzzleEngine.prototype.start = function () {
  var self = this
  return new Promise(function (resolve, reject) {
    assets.load(self.imageSrc).then(function (img) {
      if (img && img.width && img.height &&
        (img.width !== SRC_IMAGE_W || img.height !== SRC_IMAGE_H)) {
        console.warn('[puzzle] image size mismatch:', img.width, img.height,
          'expected', SRC_IMAGE_W, SRC_IMAGE_H)
      }
      self.image = img
      self._initPieces()
      resolve()
    }).catch(function (err) {
      reject(err)
    })
  })
}

PuzzleEngine.prototype.reset = function () {
  return this.start()
}

PuzzleEngine.prototype._initPieces = function () {
  var N = this.gridSize
  var total = N * N
  var arr = []
  for (var i = 0; i < total; i++) {
    arr.push({ id: i, originalIndex: i, currentIndex: i })
  }
  var slots = []
  for (var k = 0; k < arr.length; k++) slots.push(arr[k].currentIndex)
  var shuffled = fisherYatesShuffle(slots)
  for (var j = 0; j < arr.length; j++) arr[j].currentIndex = shuffled[j]
  this.pieces = arr
  this.moves = 0
  this.solved = false
  this.dragInfo = null
  this._anims = {}
  this._groupAnims = {}
  this._mergeFx = null
  this.groups = this._buildGroups()
}

// ---------------------------------------------------------------------------
//  连通组 BFS
// ---------------------------------------------------------------------------

PuzzleEngine.prototype._findAllGroups = function () {
  var N = this.gridSize
  var byId = {}
  var bySlot = {}
  for (var i = 0; i < this.pieces.length; i++) {
    var p = this.pieces[i]
    byId[p.id] = p
    bySlot[p.currentIndex] = p
  }
  var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]
  var visited = {}
  var groups = []
  for (var k = 0; k < this.pieces.length; k++) {
    var head = this.pieces[k]
    if (visited[head.id]) continue
    var ids = []
    var queue = [head.id]
    visited[head.id] = true
    while (queue.length) {
      var id = queue.shift()
      ids.push(id)
      var cur = byId[id]
      var cCol = cur.currentIndex % N
      var cRow = Math.floor(cur.currentIndex / N)
      var oCol = cur.originalIndex % N
      var oRow = Math.floor(cur.originalIndex / N)
      for (var d = 0; d < dirs.length; d++) {
        var dc = dirs[d][0]
        var dr = dirs[d][1]
        var nc = cCol + dc
        var nr = cRow + dr
        if (nc < 0 || nc >= N || nr < 0 || nr >= N) continue
        var nb = bySlot[nr * N + nc]
        if (!nb || visited[nb.id]) continue
        var nOCol = nb.originalIndex % N
        var nORow = Math.floor(nb.originalIndex / N)
        if (nOCol - oCol === dc && nORow - oRow === dr) {
          visited[nb.id] = true
          queue.push(nb.id)
        }
      }
    }
    groups.push(ids)
  }
  return groups
}

PuzzleEngine.prototype._snapshotGroupSizes = function () {
  var sizes = {}
  var groups = this._findAllGroups()
  for (var i = 0; i < groups.length; i++) {
    var g = groups[i]
    for (var j = 0; j < g.length; j++) sizes[g[j]] = g.length
  }
  return sizes
}

PuzzleEngine.prototype._findMergedGroup = function (movedIds, sizeBefore) {
  var movedSet = {}
  for (var i = 0; i < movedIds.length; i++) movedSet[movedIds[i]] = true
  var best = null
  var groups = this._findAllGroups()
  for (var k = 0; k < groups.length; k++) {
    var ids = groups[k]
    if (ids.length < 2) continue
    var touch = false
    var maxPrev = 1
    for (var m = 0; m < ids.length; m++) {
      var id = ids[m]
      if (movedSet[id]) touch = true
      var sz = sizeBefore[id] || 1
      if (sz > maxPrev) maxPrev = sz
    }
    if (touch && ids.length > maxPrev) {
      if (!best || ids.length > best.length) best = ids
    }
  }
  return best
}

// ---------------------------------------------------------------------------
//  组数据构建
// ---------------------------------------------------------------------------

PuzzleEngine.prototype._buildGroups = function (preserved) {
  var layout = this.layout
  var N = this.gridSize
  var byId = {}
  var bySlot = {}
  for (var i = 0; i < this.pieces.length; i++) {
    var p = this.pieces[i]
    byId[p.id] = p
    bySlot[p.currentIndex] = p
  }
  var raw = this._findAllGroups()
  var groups = []
  for (var g = 0; g < raw.length; g++) {
    var memberIds = raw[g]
    var minCol = Infinity, minRow = Infinity, maxCol = -Infinity, maxRow = -Infinity
    for (var mi = 0; mi < memberIds.length; mi++) {
      var m = byId[memberIds[mi]]
      var c = m.currentIndex % N
      var r = Math.floor(m.currentIndex / N)
      if (c < minCol) minCol = c
      if (r < minRow) minRow = r
      if (c > maxCol) maxCol = c
      if (r > maxRow) maxRow = r
    }
    var anchor = layoutMod.slotToXY(layout, minCol, minRow)
    var gx = anchor.x
    var gy = anchor.y
    var gw = (maxCol - minCol + 1) * layout.stepX - layout.GAP
    var gh = (maxRow - minRow + 1) * layout.stepY - layout.GAP
    var isCompound = memberIds.length > 1
    var memberSet = {}
    for (var ms = 0; ms < memberIds.length; ms++) memberSet[memberIds[ms]] = true

    var pieces = []
    for (var pi = 0; pi < memberIds.length; pi++) {
      var mm = byId[memberIds[pi]]
      var myCol = mm.currentIndex % N
      var myRow = Math.floor(mm.currentIndex / N)
      var localX = (myCol - minCol) * layout.stepX
      var localY = (myRow - minRow) * layout.stepY
      var oCol = mm.originalIndex % N
      var oRow = Math.floor(mm.originalIndex / N)
      var inset = layout.BORDER + layout.PIECE_PADDING

      var att = { top: false, right: false, bottom: false, left: false }
      if (isCompound) {
        var dirs = [
          { dc: -1, dr: 0, key: 'left' },
          { dc: 1, dr: 0, key: 'right' },
          { dc: 0, dr: -1, key: 'top' },
          { dc: 0, dr: 1, key: 'bottom' }
        ]
        for (var di = 0; di < dirs.length; di++) {
          var dd = dirs[di]
          var nCol = myCol + dd.dc
          var nRow = myRow + dd.dr
          if (nCol < 0 || nCol >= N || nRow < 0 || nRow >= N) continue
          var nb = bySlot[nRow * N + nCol]
          if (!nb || !memberSet[nb.id]) continue
          var nOCol = nb.originalIndex % N
          var nORow = Math.floor(nb.originalIndex / N)
          if (nOCol - oCol === dd.dc && nORow - oRow === dd.dr) att[dd.key] = true
        }
      }

      var offsetX = -oCol * layout.cellW - (isCompound && att.left ? 0 : inset)
      var offsetY = -oRow * layout.cellH - (isCompound && att.top ? 0 : inset)

      var initTx = 0
      var initTy = 0
      if (preserved && preserved[mm.id]) {
        initTx = preserved[mm.id].vx - (gx + localX)
        initTy = preserved[mm.id].vy - (gy + localY)
      }

      pieces.push({
        id: mm.id,
        originalIndex: mm.originalIndex,
        currentIndex: mm.currentIndex,
        localX: localX,
        localY: localY,
        offsetX: offsetX,
        offsetY: offsetY,
        att: att,
        inCompound: isCompound,
        tx: initTx,
        ty: initTy
      })
    }

    var gidNum = Math.min.apply(null, memberIds)
    groups.push({
      id: 'g_' + gidNum,
      x: gx,
      y: gy,
      w: gw,
      h: gh,
      tx: 0,
      ty: 0,
      dragging: false,
      isCompound: isCompound,
      pieces: pieces,
      _members: memberIds.slice()
    })
  }
  return groups
}

PuzzleEngine.prototype._pickGroupByMembers = function (memberIds) {
  var set = {}
  for (var i = 0; i < memberIds.length; i++) set[memberIds[i]] = true
  for (var k = 0; k < this.groups.length; k++) {
    var g = this.groups[k]
    if (g.pieces.length !== memberIds.length) continue
    var ok = true
    for (var p = 0; p < g.pieces.length; p++) {
      if (!set[g.pieces[p].id]) { ok = false; break }
    }
    if (ok) return g
  }
  return null
}

// ---------------------------------------------------------------------------
//  动画 tick
// ---------------------------------------------------------------------------

PuzzleEngine.prototype.update = function (/* dt */) {
  var now = Date.now()
  var keys = Object.keys(this._anims)
  for (var i = 0; i < keys.length; i++) {
    var pid = keys[i]
    var a = this._anims[pid]
    var t = (now - a.t0) / a.dur
    if (t >= 1) { delete this._anims[pid]; continue }
    var k = 1 - easeOutCubic(t)
    a.curTx = a.fromTx * k
    a.curTy = a.fromTy * k
  }
  var gkeys = Object.keys(this._groupAnims)
  for (var j = 0; j < gkeys.length; j++) {
    var gid = gkeys[j]
    var ga = this._groupAnims[gid]
    var tg = (now - ga.t0) / ga.dur
    if (tg >= 1) { delete this._groupAnims[gid]; continue }
    var kg = 1 - easeOutCubic(tg)
    ga.curTx = ga.fromTx * kg
    ga.curTy = ga.fromTy * kg
  }
  if (this._mergeFx) {
    var tm = (now - this._mergeFx.t0) / MERGE_FX_DUR
    if (tm >= 1) this._mergeFx = null
    else this._mergeFx.t = tm
  }
}

PuzzleEngine.prototype._pieceTx = function (p) {
  var a = this._anims[p.id]
  if (a) return a.curTx || 0
  return p.tx || 0
}
PuzzleEngine.prototype._pieceTy = function (p) {
  var a = this._anims[p.id]
  if (a) return a.curTy || 0
  return p.ty || 0
}
PuzzleEngine.prototype._groupTx = function (g) {
  if (g.dragging) return g.tx || 0
  var ga = this._groupAnims[g.id]
  if (ga) return ga.curTx || 0
  return g.tx || 0
}
PuzzleEngine.prototype._groupTy = function (g) {
  if (g.dragging) return g.ty || 0
  var ga = this._groupAnims[g.id]
  if (ga) return ga.curTy || 0
  return g.ty || 0
}

// ---------------------------------------------------------------------------
//  渲染
// ---------------------------------------------------------------------------

PuzzleEngine.prototype.render = function (ctx) {
  var bx = this.boardX
  var by = this.boardY
  var L = this.layout
  // 棋盘外不画底色，由场景背景负责。

  // 拼图块绘制顺序：普通组 → 组合块 → 拖拽中。
  var normal = []
  var compound = []
  var dragging = null
  for (var i = 0; i < this.groups.length; i++) {
    var g = this.groups[i]
    if (g.dragging) dragging = g
    else if (g.isCompound) compound.push(g)
    else normal.push(g)
  }
  for (var n = 0; n < normal.length; n++) this._renderGroup(ctx, normal[n], bx, by, L)
  for (var c = 0; c < compound.length; c++) this._renderGroup(ctx, compound[c], bx, by, L)
  if (dragging) this._renderGroup(ctx, dragging, bx, by, L, true)

  // 合并特效
  if (this._mergeFx) {
    this._renderMergeFx(ctx, bx, by)
  }
}

PuzzleEngine.prototype._renderGroup = function (ctx, group, bx, by, L, withShadow) {
  var gtx = this._groupTx(group)
  var gty = this._groupTy(group)
  for (var i = 0; i < group.pieces.length; i++) {
    var p = group.pieces[i]
    var px = this._pieceTx(p)
    var py = this._pieceTy(p)
    var pieceX = bx + group.x + gtx + p.localX + px
    var pieceY = by + group.y + gty + p.localY + py
    this._renderPiece(ctx, p, pieceX, pieceY, L, withShadow)
  }
}

PuzzleEngine.prototype._renderPiece = function (ctx, piece, x, y, L, withShadow) {
  var cellW = L.cellW
  var cellH = L.cellH
  var inset = L.BORDER + L.PIECE_PADDING
  var att = piece.att
  var R = L.PIECE_RADIUS

  // 计算每边圆角
  var tl = R, tr = R, br = R, bl = R
  if (piece.inCompound) {
    if (att.top || att.left) tl = 0
    if (att.top || att.right) tr = 0
    if (att.bottom || att.right) br = 0
    if (att.bottom || att.left) bl = 0
  }

  ctx.save()
  if (withShadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.35)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetY = 4
  }

  // 底色（白）
  draw.roundedRectPathCorners(ctx, x, y, cellW, cellH, tl, tr, br, bl)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  ctx.restore()

  // 内部图片裁剪框
  var imgX, imgY, imgW, imgH
  if (piece.inCompound) {
    var leftInset = att.left ? 0 : inset
    var topInset = att.top ? 0 : inset
    var rightInset = att.right ? 0 : inset
    var bottomInset = att.bottom ? 0 : inset
    imgX = x + leftInset
    imgY = y + topInset
    imgW = cellW - leftInset - rightInset
    imgH = cellH - topInset - bottomInset
  } else {
    imgX = x + inset
    imgY = y + inset
    imgW = cellW - inset * 2
    imgH = cellH - inset * 2
  }

  ctx.save()
  // 内层圆角裁剪
  var itl = piece.inCompound ? (att.top || att.left ? 0 : R) : R
  var itr = piece.inCompound ? (att.top || att.right ? 0 : R) : R
  var ibr = piece.inCompound ? (att.bottom || att.right ? 0 : R) : R
  var ibl = piece.inCompound ? (att.bottom || att.left ? 0 : R) : R
  draw.roundedRectPathCorners(ctx, imgX, imgY, imgW, imgH, itl, itr, ibr, ibl)
  ctx.clip()

  // 整图按 (cellW*N)×(cellH*N) 视口绘制；imgX 是 piece 的图片裁剪窗口左上角，
  // piece.offsetX 已包含「相对 imgX 的图片左上角偏移」（含 inset），直接相加即可。
  if (this.image) {
    var fullW = this.layout.imgW
    var fullH = this.layout.imgH
    var drawX = imgX + piece.offsetX
    var drawY = imgY + piece.offsetY
    ctx.drawImage(this.image, drawX, drawY, fullW, fullH)
  } else {
    ctx.fillStyle = '#bcd2ce'
    ctx.fillRect(imgX, imgY, imgW, imgH)
  }
  ctx.restore()

  // 描边（仅独立块或组合块的外侧边）
  if (!piece.inCompound) {
    draw.roundedRectPathCorners(ctx, x + 0.5, y + 0.5, cellW - 1, cellH - 1, tl, tr, br, bl)
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 1
    ctx.stroke()
  } else {
    // 仅画 4 条没贴邻居的外边
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 1
    ctx.beginPath()
    if (!att.top) { ctx.moveTo(x, y + 0.5); ctx.lineTo(x + cellW, y + 0.5) }
    if (!att.bottom) { ctx.moveTo(x, y + cellH - 0.5); ctx.lineTo(x + cellW, y + cellH - 0.5) }
    if (!att.left) { ctx.moveTo(x + 0.5, y); ctx.lineTo(x + 0.5, y + cellH) }
    if (!att.right) { ctx.moveTo(x + cellW - 0.5, y); ctx.lineTo(x + cellW - 0.5, y + cellH) }
    ctx.stroke()
  }
}

PuzzleEngine.prototype._renderMergeFx = function (ctx, bx, by) {
  var fx = this._mergeFx
  var img = assets.get(MERGE_FX_IMAGE)
  if (!img) return
  var t = fx.t
  var alpha = t < 0.2 ? (t / 0.2) : (t > 0.7 ? Math.max(0, 1 - (t - 0.7) / 0.3) : 1)
  var scale = 0.88 + Math.min(1, t * 2) * 0.12
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.globalCompositeOperation = 'lighter'
  var cx = bx + fx.x + fx.w / 2
  var cy = by + fx.y + fx.h / 2
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.translate(-cx, -cy)
  draw.drawImageContain(ctx, img, bx + fx.x, by + fx.y, fx.w, fx.h)
  ctx.restore()
}

// ---------------------------------------------------------------------------
//  命中测试 / 拖拽
// ---------------------------------------------------------------------------

/** 给定屏幕坐标 (sx, sy)：返回 {group, piece} 或 null */
PuzzleEngine.prototype._hitTest = function (sx, sy) {
  var bx = this.boardX
  var by = this.boardY
  var L = this.layout
  // 倒序，让顶层（compound / dragging）优先
  for (var i = this.groups.length - 1; i >= 0; i--) {
    var g = this.groups[i]
    var gtx = this._groupTx(g)
    var gty = this._groupTy(g)
    for (var j = 0; j < g.pieces.length; j++) {
      var p = g.pieces[j]
      var ptx = this._pieceTx(p)
      var pty = this._pieceTy(p)
      var px = bx + g.x + gtx + p.localX + ptx
      var py = by + g.y + gty + p.localY + pty
      if (sx >= px && sx <= px + L.cellW && sy >= py && sy <= py + L.cellH) {
        return { group: g, piece: p }
      }
    }
  }
  return null
}

PuzzleEngine.prototype.onTouchStart = function (sx, sy) {
  if (this.solved) return false
  // 进行中的动画期间允许抓取（用户体验考虑：抓住后清零原 anim）
  var hit = this._hitTest(sx, sy)
  if (!hit) return false
  var g = hit.group
  this.dragInfo = {
    group: g,
    startX: sx,
    startY: sy,
    memberIds: g.pieces.map(function (p) { return p.id })
  }
  g.dragging = true
  // 清掉此组所有动画
  delete this._groupAnims[g.id]
  for (var i = 0; i < g.pieces.length; i++) {
    var p = g.pieces[i]
    delete this._anims[p.id]
    p.tx = 0
    p.ty = 0
  }
  g.tx = 0
  g.ty = 0
  this._playSound(this._moveAudio)
  this.onAnyMove()
  return true
}

PuzzleEngine.prototype.onTouchMove = function (sx, sy) {
  if (!this.dragInfo) return
  var dx = Math.round(sx - this.dragInfo.startX)
  var dy = Math.round(sy - this.dragInfo.startY)
  this.dragInfo.group.tx = dx
  this.dragInfo.group.ty = dy
}

PuzzleEngine.prototype.onTouchEnd = function () {
  if (!this.dragInfo) return
  var info = this.dragInfo
  this.dragInfo = null
  var group = info.group
  group.dragging = false

  var L = this.layout
  var N = this.gridSize
  var dxPx = Math.round(group.tx)
  var dyPx = Math.round(group.ty)
  var colDelta = Math.round(dxPx / L.stepX)
  var rowDelta = Math.round(dyPx / L.stepY)

  if (colDelta === 0 && rowDelta === 0) {
    return this._settleNoSwap(group)
  }

  var byId = {}
  for (var i = 0; i < this.pieces.length; i++) byId[this.pieces[i].id] = this.pieces[i]

  var memberIds = info.memberIds
  var memberSet = {}
  for (var m = 0; m < memberIds.length; m++) memberSet[memberIds[m]] = true

  var newSlotById = {}
  for (var k = 0; k < memberIds.length; k++) {
    var mp = byId[memberIds[k]]
    var gCol = mp.currentIndex % N
    var gRow = Math.floor(mp.currentIndex / N)
    var nc = gCol + colDelta
    var nr = gRow + rowDelta
    if (nc < 0 || nc >= N || nr < 0 || nr >= N) return this._settleNoSwap(group)
    newSlotById[mp.id] = nr * N + nc
  }
  var oldSlotSet = {}
  var newSlotSet = {}
  for (var s = 0; s < memberIds.length; s++) {
    oldSlotSet[byId[memberIds[s]].currentIndex] = true
    newSlotSet[newSlotById[memberIds[s]]] = true
  }
  var vacated = []
  for (var v in oldSlotSet) {
    var vi = parseInt(v, 10)
    if (!newSlotSet[vi]) vacated.push(vi)
  }
  var displaced = []
  for (var dp = 0; dp < this.pieces.length; dp++) {
    var pp = this.pieces[dp]
    if (memberSet[pp.id]) continue
    if (newSlotSet[pp.currentIndex]) displaced.push(pp)
  }
  if (displaced.length !== vacated.length) {
    return this._settleNoSwap(group)
  }

  var used = {}
  var assignment = {}
  for (var dd = 0; dd < displaced.length; dd++) {
    var dpiece = displaced[dd]
    var dCol = dpiece.currentIndex % N
    var dRow = Math.floor(dpiece.currentIndex / N)
    var bestV = -1
    var bestDist = Infinity
    for (var vv = 0; vv < vacated.length; vv++) {
      var vIdx = vacated[vv]
      if (used[vIdx]) continue
      var vCol = vIdx % N
      var vRow = Math.floor(vIdx / N)
      var dist = Math.hypot(dCol - vCol, dRow - vRow)
      if (dist < bestDist) { bestDist = dist; bestV = vIdx }
    }
    if (bestV < 0) return this._settleNoSwap(group)
    used[bestV] = true
    assignment[dpiece.id] = bestV
  }

  this._commitMove(memberIds, newSlotById, assignment)
}

PuzzleEngine.prototype.onTouchCancel = function () {
  if (this.dragInfo) {
    var g = this.dragInfo.group
    this._settleNoSwap(g)
    this.dragInfo = null
  }
}

PuzzleEngine.prototype._settleNoSwap = function (group) {
  // 把 group.tx/ty 用动画归零
  var dx = group.tx || 0
  var dy = group.ty || 0
  group.tx = 0
  group.ty = 0
  if (dx !== 0 || dy !== 0) {
    this._groupAnims[group.id] = {
      fromTx: dx, fromTy: dy, t0: Date.now(), dur: ANIM_DUR, curTx: dx, curTy: dy
    }
  }
}

PuzzleEngine.prototype._commitMove = function (memberIds, newSlotById, assignment) {
  var hasDisplaced = false
  for (var k in assignment) { hasDisplaced = true; break }
  if (hasDisplaced) this._playSound(this._swapAudio)

  var sizeBefore = this._snapshotGroupSizes()

  // 1) 视觉位置快照（屏幕坐标）
  var preserved = {}
  for (var i = 0; i < this.groups.length; i++) {
    var g = this.groups[i]
    var gtx = this._groupTx(g)
    var gty = this._groupTy(g)
    for (var j = 0; j < g.pieces.length; j++) {
      var p = g.pieces[j]
      var ptx = this._pieceTx(p)
      var pty = this._pieceTy(p)
      preserved[p.id] = {
        vx: g.x + gtx + p.localX + ptx,
        vy: g.y + gty + p.localY + pty
      }
    }
  }

  // 2) 更新 slot
  for (var n = 0; n < this.pieces.length; n++) {
    var pp = this.pieces[n]
    if (newSlotById[pp.id] !== undefined) pp.currentIndex = newSlotById[pp.id]
    else if (assignment[pp.id] !== undefined) pp.currentIndex = assignment[pp.id]
  }

  // 3) 重建组
  this.groups = this._buildGroups(preserved)
  this.moves++

  // 4) 启动每块的 tx/ty 回零动画
  var now = Date.now()
  for (var gi = 0; gi < this.groups.length; gi++) {
    var gg = this.groups[gi]
    for (var pi = 0; pi < gg.pieces.length; pi++) {
      var piece = gg.pieces[pi]
      if (Math.abs(piece.tx) > 0.5 || Math.abs(piece.ty) > 0.5) {
        this._anims[piece.id] = {
          fromTx: piece.tx, fromTy: piece.ty, t0: now, dur: ANIM_DUR,
          curTx: piece.tx, curTy: piece.ty
        }
        piece.tx = 0
        piece.ty = 0
      }
    }
  }

  // 5) 合并特效
  var mergedIds = this._findMergedGroup(memberIds, sizeBefore)
  if (mergedIds) {
    var mg = this._pickGroupByMembers(mergedIds)
    if (mg) {
      var pad = 8
      this._mergeFx = {
        x: Math.max(0, mg.x - pad),
        y: Math.max(0, mg.y - pad),
        w: mg.w + pad * 2,
        h: mg.h + pad * 2,
        t0: now,
        t: 0
      }
    }
  }

  this.onAnyMove()
  this._checkWin()
}

PuzzleEngine.prototype._checkWin = function () {
  var win = true
  for (var i = 0; i < this.pieces.length; i++) {
    if (this.pieces[i].currentIndex !== this.pieces[i].originalIndex) { win = false; break }
  }
  if (win) {
    this.solved = true
    var self = this
    setTimeout(function () { self.onWin() }, 300)
  }
}

module.exports = PuzzleEngine
