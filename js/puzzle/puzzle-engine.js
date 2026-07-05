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
var sfx = require('../sfx')
var mergeFx = require('../merge-fx')

var config = require('../../utils/app-config')

var SRC_IMAGE_W = config.levelImageW || 840
var SRC_IMAGE_H = config.levelImageH || 1260
var ANIM_DUR = 220
/** 提示移动/交换动画（比常规拖拽慢，便于看清） */
var HINT_ANIM_DUR = 2000
/** 提示程序化拖动：只移到目标方向约八成，松手后再交换落位 */
var HINT_DRAG_VISUAL_RATIO = 0.78
/** 拼合：放大还原 + 序列帧光效（时长见 merge-fx.js） */
var MERGE_FX_DUR = mergeFx.MERGE_FX_DUR_MS
/** 光效边长 = 组合块短边 × 该比例，居中，避免铺满整块 */
var MERGE_FX_SIZE_RATIO = 0.72
/** 光效峰值不透明度（lighter 混合下略降，减轻发白） */
var MERGE_FX_ALPHA = 0.62
/** 拼合组块放大峰值（1 + bump → 1.04） */
var MERGE_PULSE_BUMP = 0.04
/** 放大→还原在合并动画时长中的占比（前段抬起、后段落回） */
var MERGE_PULSE_PEAK_AT = 0.38
/** 开局：拼图区右下角叠成一摞 → 顶牌飞出 → 每块绕自身水平中线翻面 */
/** 发牌：3×3 铺开约 616ms，7×7 发牌阶段约 1.5s，中间难度线性过渡 */
var INTRO_STAGGER_MS = 42
var INTRO_FLY_DUR = 280
var INTRO_FLIP_DUR = 480
var INTRO_REF_GRID = 3
var INTRO_MAX_GRID = 7
var INTRO_SPREAD_MIN_MS = (INTRO_REF_GRID * INTRO_REF_GRID - 1) * INTRO_STAGGER_MS
var INTRO_DEAL_TARGET_MAX_MS = 1500
var INTRO_SPREAD_MAX_MS = INTRO_DEAL_TARGET_MAX_MS - INTRO_FLY_DUR

function introSpreadMs(pieceCount) {
  var n = Math.round(Math.sqrt(pieceCount))
  if (n < INTRO_REF_GRID) return INTRO_SPREAD_MIN_MS
  if (n >= INTRO_MAX_GRID) return INTRO_SPREAD_MAX_MS
  var t = (n - INTRO_REF_GRID) / (INTRO_MAX_GRID - INTRO_REF_GRID)
  return INTRO_SPREAD_MIN_MS + t * (INTRO_SPREAD_MAX_MS - INTRO_SPREAD_MIN_MS)
}

function introStaggerMs(pieceCount) {
  if (pieceCount <= 1) return 0
  return introSpreadMs(pieceCount) / (pieceCount - 1)
}

var SOUND_MOVE = 'audio/move.mp3'
var SOUND_SWAP = 'audio/swap.mp3'
/** 开局发牌/翻面时的牌背图（2:3，铺满单块内层裁切区） */
var CARD_BACK_IMAGE = 'images/puzzle-card-back.png'
/** 每格原位半透明占位（拖拽/交换动画时露出） */
var SLOT_PLACEHOLDER_FILL = 'rgba(110, 90, 130, 0.48)'
var SLOT_PLACEHOLDER_STROKE = 'rgba(70, 55, 90, 0.28)'

function easeOutCubic(t) {
  var p = 1 - t
  return 1 - p * p * p
}

/** 拼合脉冲：1 → 1+bump → 1 */
function mergePulseScale(t) {
  if (t >= 1) return 1
  if (t <= 0) return 1
  if (t <= MERGE_PULSE_PEAK_AT) {
    return 1 + MERGE_PULSE_BUMP * easeOutCubic(t / MERGE_PULSE_PEAK_AT)
  }
  return 1 + MERGE_PULSE_BUMP * (1 - easeOutCubic((t - MERGE_PULSE_PEAK_AT) / (1 - MERGE_PULSE_PEAK_AT)))
}

/** 组合块外接矩形内居中取方形光效区域（按短边缩放） */
function mergeFxRectFromGroup(gx, gy, gw, gh) {
  var base = Math.min(gw, gh)
  var size = base * MERGE_FX_SIZE_RATIO
  return {
    x: gx + (gw - size) / 2,
    y: gy + (gh - size) / 2,
    w: size,
    h: size
  }
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
  this._intro = null      // { phase, stackX, stackY, ... }
  this._introPending = false
  this._inputLocked = false
  this._hintDrag = null
  this.onWin = opts.onWin || function () {}
  this.onAnyMove = opts.onAnyMove || function () {}
  this.onIntroComplete = opts.onIntroComplete || function () {}
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
    this._moveAudio.obeyMuteSwitch = false
    this._swapAudio.obeyMuteSwitch = false
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

PuzzleEngine.prototype.isInputLocked = function () {
  if (this._inputLocked) return true
  if (this._hintDrag) return true
  if (Object.keys(this._anims).length > 0) return true
  if (Object.keys(this._groupAnims).length > 0) return true
  return false
}

PuzzleEngine.prototype.isIntroPlaying = function () {
  return !!this._intro
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
  this._intro = null
  this._hintDrag = null
  this.groups = this._buildGroups()
  this._introPending = true
}

/** 拼图网格右下角那一格的左上角（棋盘内坐标） */
PuzzleEngine.prototype._introStackXY = function () {
  var L = this.layout
  var N = this.gridSize
  var br = layoutMod.slotToXY(L, N - 1, N - 1)
  return { x: br.x, y: br.y }
}

/**
 * 叠放层级：棋盘从下往上、每行从右往左依次往上盖。
 * 层 0 = 最下一排最右（牌堆底），层最大 = 最上一排最左（牌堆顶）。
 */
PuzzleEngine.prototype._introStackLayerFromSlot = function (slotIndex) {
  var N = this.gridSize
  var row = Math.floor(slotIndex / N)
  var col = slotIndex % N
  return (N - 1 - row) * N + (N - 1 - col)
}

/**
 * 在棋盘坐标已就绪后启动开局（由 render 触发）。
 * 牌堆锚在网格最后一格，与右下角拼图块位置重合。
 */
PuzzleEngine.prototype._startIntroAnim = function () {
  var L = this.layout
  var N = this.gridSize
  var total = N * N
  var stack = this._introStackXY()
  var stackBaseX = stack.x
  var stackBaseY = stack.y
  var list = []
  for (var gi = 0; gi < this.groups.length; gi++) {
    var g = this.groups[gi]
    for (var pi = 0; pi < g.pieces.length; pi++) {
      var piece = g.pieces[pi]
      list.push({
        piece: piece,
        group: g,
        layer: this._introStackLayerFromSlot(piece.currentIndex)
      })
    }
  }
  list.sort(function (a, b) { return a.layer - b.layer })
  var now = Date.now()
  var stackLayerMap = {}
  for (var si = 0; si < list.length; si++) {
    stackLayerMap[list[si].piece.id] = list[si].layer
  }
  var stagger = introStaggerMs(total)
  this._inputLocked = true
  this._intro = {
    phase: 'deal',
    showBack: true,
    stackX: stackBaseX,
    stackY: stackBaseY,
    dealEndTime: now + (total - 1) * stagger + INTRO_FLY_DUR,
    stackLayer: stackLayerMap
  }
  sfx.playIntroDeal()
  for (var order = 0; order < list.length; order++) {
    var item = list[list.length - 1 - order]
    var piece = item.piece
    var group = item.group
    var homeX = group.x + piece.localX
    var homeY = group.y + piece.localY
    // 全部叠在同一位置，层数大的后画、盖在上面
    var sx = stackBaseX
    var sy = stackBaseY
    var fromTx = sx - homeX
    var fromTy = sy - homeY
    this._anims[piece.id] = {
      fromTx: fromTx,
      fromTy: fromTy,
      t0: now + order * stagger,
      dur: INTRO_FLY_DUR,
      curTx: fromTx,
      curTy: fromTy
    }
    piece.tx = 0
    piece.ty = 0
  }
}

PuzzleEngine.prototype._groupIntroStackLayer = function (group) {
  if (!this._intro || !this._intro.stackLayer) return 0
  var max = 0
  for (var i = 0; i < group.pieces.length; i++) {
    var layer = this._intro.stackLayer[group.pieces[i].id] || 0
    if (layer > max) max = layer
  }
  return max
}

PuzzleEngine.prototype._introFlipState = function () {
  if (!this._intro || this._intro.phase !== 'flip') return null
  var t = Math.min(1, (Date.now() - this._intro.flipT0) / INTRO_FLIP_DUR)
  var showBack = t < 0.5
  var half = showBack ? t * 2 : (t - 0.5) * 2
  // 两段翻面：背面 1→窄边，正面窄边→1，避免 scaleX=0 整块消失
  var scaleX = showBack
    ? Math.cos(half * Math.PI / 2)
    : Math.sin(half * Math.PI / 2)
  if (scaleX < 0.04) scaleX = 0.04
  return {
    showBack: showBack,
    scaleX: scaleX
  }
}

PuzzleEngine.prototype._beginIntroFlip = function () {
  if (!this._intro) return
  this._intro.phase = 'flip'
  this._intro.flipT0 = Date.now()
  this._intro.showBack = true
  sfx.playIntroFlip()
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

PuzzleEngine.prototype._findMergedGroup = function (sizeBefore) {
  var best = null
  var bestGrowth = 0
  var groups = this._findAllGroups()
  for (var k = 0; k < groups.length; k++) {
    var ids = groups[k]
    if (ids.length < 2) continue
    var maxPrev = 1
    for (var m = 0; m < ids.length; m++) {
      var sz = sizeBefore[ids[m]] || 1
      if (sz > maxPrev) maxPrev = sz
    }
    var growth = ids.length - maxPrev
    if (growth <= 0) continue
    if (!best || growth > bestGrowth ||
      (growth === bestGrowth && ids.length > best.length)) {
      best = ids
      bestGrowth = growth
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
    if (t < 0) {
      a.curTx = a.fromTx
      a.curTy = a.fromTy
      continue
    }
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

  if (this._hintDrag) this._tickHintProgramDrag()

  if (this._intro) {
    if (this._intro.phase === 'deal') {
      if (now >= this._intro.dealEndTime && Object.keys(this._anims).length === 0) {
        this._beginIntroFlip()
      }
    } else if (this._intro.phase === 'flip') {
      if (now - this._intro.flipT0 >= INTRO_FLIP_DUR) {
        this._intro = null
        this._inputLocked = false
        this.onIntroComplete()
      }
    }
  }
}

PuzzleEngine.prototype._pieceTx = function (p) {
  var a = this._anims[p.id]
  if (a) {
    if (a.curTx != null) return a.curTx
    return a.fromTx || 0
  }
  return p.tx || 0
}
PuzzleEngine.prototype._pieceTy = function (p) {
  var a = this._anims[p.id]
  if (a) {
    if (a.curTy != null) return a.curTy
    return a.fromTy || 0
  }
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

PuzzleEngine.prototype._renderSlotPlaceholders = function (ctx, bx, by, L) {
  var N = this.gridSize
  var R = L.PIECE_RADIUS
  var total = N * N
  var slot, col, row, pos, x, y

  ctx.save()
  ctx.fillStyle = SLOT_PLACEHOLDER_FILL
  ctx.strokeStyle = SLOT_PLACEHOLDER_STROKE
  ctx.lineWidth = 1
  for (slot = 0; slot < total; slot++) {
    col = slot % N
    row = Math.floor(slot / N)
    pos = layoutMod.slotToXY(L, col, row)
    x = bx + pos.x
    y = by + pos.y
    draw.roundedRectPathCorners(ctx, x, y, L.cellW, L.cellH, R, R, R, R)
    ctx.fill()
    draw.roundedRectPathCorners(ctx, x + 0.5, y + 0.5, L.cellW - 1, L.cellH - 1, R, R, R, R)
    ctx.stroke()
  }
  ctx.restore()
}

PuzzleEngine.prototype.render = function (ctx) {
  if (this._introPending) {
    this._introPending = false
    this._startIntroAnim()
  }

  var bx = this.boardX
  var by = this.boardY
  var L = this.layout
  var flipSt = (this._intro && this._intro.phase === 'flip') ? this._introFlipState() : null

  // 拼图块绘制顺序：普通组 → 组合块 → 拖拽中；开局顶牌后画
  var normal = []
  var compound = []
  var dragging = null
  for (var i = 0; i < this.groups.length; i++) {
    var g = this.groups[i]
    if (g.dragging) dragging = g
    else if (g.isCompound) compound.push(g)
    else normal.push(g)
  }
  if (this._intro) {
    var self = this
    var sortByStackLayer = function (ga, gb) {
      return self._groupIntroStackLayer(gb) - self._groupIntroStackLayer(ga)
    }
    normal.sort(sortByStackLayer)
    compound.sort(sortByStackLayer)
  }
  this._renderSlotPlaceholders(ctx, bx, by, L)

  var showBack = flipSt ? flipSt.showBack : (this._intro && this._intro.showBack)
  for (var n = 0; n < normal.length; n++) {
    this._renderGroup(ctx, normal[n], bx, by, L, false, showBack, flipSt)
  }
  for (var c = 0; c < compound.length; c++) {
    this._renderGroup(ctx, compound[c], bx, by, L, false, showBack, flipSt)
  }
  if (dragging) this._renderGroup(ctx, dragging, bx, by, L, true, false, null)

  // 合并特效
  if (this._mergeFx) {
    this._renderMergeFx(ctx, bx, by)
  }
}

PuzzleEngine.prototype._mergePulseScaleForGroup = function (groupId) {
  var fx = this._mergeFx
  if (!fx || fx.groupId !== groupId || fx.t == null) return 1
  return mergePulseScale(fx.t)
}

PuzzleEngine.prototype._renderGroupDragShadow = function (ctx, bx, by, group, gtx, gty, L) {
  var pieces = group.pieces
  if (!pieces || !pieces.length) return
  var cellW = L.cellW
  var cellH = L.cellH
  var R = L.PIECE_RADIUS
  var ox = bx + group.x + gtx
  var oy = by + group.y + gty

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 4
  ctx.beginPath()
  for (var i = 0; i < pieces.length; i++) {
    var p = pieces[i]
    var att = p.att
    var tl = R
    var tr = R
    var br = R
    var bl = R
    if (p.inCompound) {
      if (att.top || att.left) tl = 0
      if (att.top || att.right) tr = 0
      if (att.bottom || att.right) br = 0
      if (att.bottom || att.left) bl = 0
    }
    var px = ox + p.localX + this._pieceTx(p)
    var py = oy + p.localY + this._pieceTy(p)
    draw.roundedRectPathCorners(ctx, px, py, cellW, cellH, tl, tr, br, bl)
  }
  // 一次 fill 产生整组外轮廓阴影，避免子块接缝处叠影
  ctx.fillStyle = 'rgba(255,255,255,0.01)'
  ctx.fill()
  ctx.restore()
}

PuzzleEngine.prototype._renderGroup = function (ctx, group, bx, by, L, withShadow, showBack, flipSt) {
  var gtx = this._groupTx(group)
  var gty = this._groupTy(group)
  var pieceShadow = withShadow && !group.isCompound
  if (withShadow && group.isCompound) {
    this._renderGroupDragShadow(ctx, bx, by, group, gtx, gty, L)
  }
  var pulse = this._mergePulseScaleForGroup(group.id)
  if (pulse !== 1) {
    var cx = bx + group.x + gtx + group.w / 2
    var cy = by + group.y + gty + group.h / 2
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(pulse, pulse)
    ctx.translate(-cx, -cy)
  }
  for (var i = 0; i < group.pieces.length; i++) {
    var p = group.pieces[i]
    var px = this._pieceTx(p)
    var py = this._pieceTy(p)
    var pieceX = bx + group.x + gtx + p.localX + px
    var pieceY = by + group.y + gty + p.localY + py
    this._renderPiece(ctx, p, pieceX, pieceY, L, pieceShadow, showBack, flipSt)
  }
  if (pulse !== 1) ctx.restore()
}

PuzzleEngine.prototype._renderPiece = function (ctx, piece, x, y, L, withShadow, showBack, flipSt) {
  var cellW = L.cellW
  var cellH = L.cellH
  if (flipSt) {
    ctx.save()
    var pcx = x + cellW / 2
    var pcy = y + cellH / 2
    ctx.translate(pcx, pcy)
    ctx.scale(flipSt.scaleX, 1)
    ctx.translate(-pcx, -pcy)
  }

  // 发牌：仅牌背图铺满整格，无白底/描边/内缩
  if (this._intro && this._intro.phase === 'deal') {
    var dealBack = assets.get(CARD_BACK_IMAGE)
    if (dealBack) {
      draw.drawImageCover(ctx, dealBack, x, y, cellW, cellH)
    } else {
      assets.tryLoad(CARD_BACK_IMAGE)
    }
    if (flipSt) ctx.restore()
    return
  }

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

  // 底色（白）；发牌/牌背阶段不铺白底，避免露出白边
  if (!showBack) {
    draw.roundedRectPathCorners(ctx, x, y, cellW, cellH, tl, tr, br, bl)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
  }

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

  // 整图按 (cellW*N)×(cellH*N) 视口绘制；开局背面用牌背图
  if (showBack) {
    var backImg = assets.get(CARD_BACK_IMAGE)
    if (!backImg) {
      assets.tryLoad(CARD_BACK_IMAGE)
      ctx.fillStyle = '#dfe6e4'
      ctx.fillRect(imgX, imgY, imgW, imgH)
    } else {
      draw.drawImageCover(ctx, backImg, imgX, imgY, imgW, imgH)
    }
  } else if (this.image) {
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
  if (flipSt) ctx.restore()
}

PuzzleEngine.prototype._renderMergeFx = function (ctx, bx, by) {
  var fx = this._mergeFx
  if (!fx || fx.t == null) return
  var path = mergeFx.framePath(mergeFx.frameIndexAt(fx.t))
  var img = assets.get(path)
  if (!img) {
    assets.tryLoad(path)
    return
  }
  var fade = fx.t < 0.15 ? (fx.t / 0.15) : (fx.t > 0.85 ? Math.max(0, 1 - (fx.t - 0.85) / 0.15) : 1)
  var alpha = fade * MERGE_FX_ALPHA
  var scale = mergePulseScale(fx.t)
  var dx = bx + fx.x
  var dy = by + fx.y
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.globalCompositeOperation = 'lighter'
  var cx = dx + fx.w / 2
  var cy = dy + fx.h / 2
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.translate(-cx, -cy)
  draw.drawImageContain(ctx, img, dx, dy, fx.w, fx.h)
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
  if (this.solved || this._inputLocked) return false
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

/** 规划一组块按格偏移移动；失败返回 null */
PuzzleEngine.prototype._planGroupMove = function (memberIds, colDelta, rowDelta) {
  var N = this.gridSize
  var byId = {}
  for (var i = 0; i < this.pieces.length; i++) byId[this.pieces[i].id] = this.pieces[i]

  var memberSet = {}
  for (var m = 0; m < memberIds.length; m++) memberSet[memberIds[m]] = true

  var newSlotById = {}
  for (var k = 0; k < memberIds.length; k++) {
    var mp = byId[memberIds[k]]
    var gCol = mp.currentIndex % N
    var gRow = Math.floor(mp.currentIndex / N)
    var nc = gCol + colDelta
    var nr = gRow + rowDelta
    if (nc < 0 || nc >= N || nr < 0 || nr >= N) return null
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
  if (displaced.length !== vacated.length) return null

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
    if (bestV < 0) return null
    used[bestV] = true
    assignment[dpiece.id] = bestV
  }

  return { newSlotById: newSlotById, assignment: assignment }
}

/** 行优先找第一个放错格的 slot（piece.originalIndex !== slot） */
PuzzleEngine.prototype._findFirstWrongSlot = function () {
  var N = this.gridSize
  var bySlot = {}
  for (var i = 0; i < this.pieces.length; i++) {
    bySlot[this.pieces[i].currentIndex] = this.pieces[i]
  }
  for (var row = 0; row < N; row++) {
    for (var col = 0; col < N; col++) {
      var slot = row * N + col
      var p = bySlot[slot]
      if (!p || p.originalIndex !== slot) return slot
    }
  }
  return -1
}

PuzzleEngine.prototype._findPieceByOriginalIndex = function (slot) {
  for (var i = 0; i < this.pieces.length; i++) {
    if (this.pieces[i].originalIndex === slot) return this.pieces[i]
  }
  return null
}

PuzzleEngine.prototype._findGroupByPieceId = function (pieceId) {
  for (var g = 0; g < this.groups.length; g++) {
    var grp = this.groups[g]
    for (var pi = 0; pi < grp.pieces.length; pi++) {
      if (grp.pieces[pi].id === pieceId) return grp
    }
  }
  return null
}

/** 落子后无法按拖拽规则交换时：正确块与错格块对调 slot */
PuzzleEngine.prototype._hintSwapPieces = function (correctPiece, wrongPiece, targetSlot) {
  var newSlotById = {}
  newSlotById[correctPiece.id] = targetSlot
  var assignment = {}
  assignment[wrongPiece.id] = correctPiece.currentIndex
  this._commitMove([correctPiece.id], newSlotById, assignment, HINT_ANIM_DUR)
}

/** 代码模拟拖拽：正确块所在组移向目标格，松手后走与 onTouchEnd 相同的交换逻辑 */
PuzzleEngine.prototype._startHintProgramDrag = function (correctPiece, wrongPiece, targetSlot) {
  var group = this._findGroupByPieceId(correctPiece.id)
  if (!group) return false

  var N = this.gridSize
  var targetCol = targetSlot % N
  var targetRow = Math.floor(targetSlot / N)
  var curCol = correctPiece.currentIndex % N
  var curRow = Math.floor(correctPiece.currentIndex / N)
  var colDelta = targetCol - curCol
  var rowDelta = targetRow - curRow
  if (colDelta === 0 && rowDelta === 0) return false

  delete this._groupAnims[group.id]
  for (var i = 0; i < group.pieces.length; i++) {
    var p = group.pieces[i]
    delete this._anims[p.id]
    p.tx = 0
    p.ty = 0
  }
  group.tx = 0
  group.ty = 0
  group.dragging = true

  var memberIds = []
  for (var m = 0; m < group.pieces.length; m++) memberIds.push(group.pieces[m].id)

  this._hintDrag = {
    group: group,
    correctPiece: correctPiece,
    wrongPiece: wrongPiece,
    targetSlot: targetSlot,
    colDelta: colDelta,
    rowDelta: rowDelta,
    memberIds: memberIds,
    t0: Date.now()
  }
  this._playSound(this._moveAudio)
  return true
}

PuzzleEngine.prototype._tickHintProgramDrag = function () {
  var h = this._hintDrag
  if (!h) return
  var L = this.layout
  var g = h.group
  var t = (Date.now() - h.t0) / HINT_ANIM_DUR
  var ratio = HINT_DRAG_VISUAL_RATIO
  if (t >= 1) {
    g.tx = Math.round(h.colDelta * L.stepX * ratio)
    g.ty = Math.round(h.rowDelta * L.stepY * ratio)
    this._finishHintProgramDrag()
    return
  }
  var e = easeOutCubic(t) * ratio
  g.tx = Math.round(h.colDelta * L.stepX * e)
  g.ty = Math.round(h.rowDelta * L.stepY * e)
}

/** 模拟松手：与手动拖拽落子同一套 _planGroupMove + _commitMove */
PuzzleEngine.prototype._finishHintProgramDrag = function () {
  var h = this._hintDrag
  if (!h) return
  this._hintDrag = null

  var g = h.group
  g.dragging = false
  var colDelta = h.colDelta
  var rowDelta = h.rowDelta
  var tx = g.tx || 0
  var ty = g.ty || 0
  g.tx = 0
  g.ty = 0

  var plan = this._planGroupMove(h.memberIds, colDelta, rowDelta)
  if (plan) {
    this._commitMove(h.memberIds, plan.newSlotById, plan.assignment, ANIM_DUR)
    return
  }

  this._hintSwapPieces(h.correctPiece, h.wrongPiece, h.targetSlot)
}

/**
 * 提示：行优先第一个错格 → 代码拖动正确块到目标格 → 自动交换
 * @returns {boolean} 是否执行了提示
 */
PuzzleEngine.prototype.applyHint = function () {
  if (this.solved || this._inputLocked || !this.pieces || this.dragInfo || this._hintDrag) {
    return false
  }

  var targetSlot = this._findFirstWrongSlot()
  if (targetSlot < 0) return false

  var bySlot = {}
  for (var i = 0; i < this.pieces.length; i++) {
    bySlot[this.pieces[i].currentIndex] = this.pieces[i]
  }

  var wrongPiece = bySlot[targetSlot]
  if (!wrongPiece) return false

  var correctPiece = this._findPieceByOriginalIndex(targetSlot)
  if (!correctPiece || correctPiece.id === wrongPiece.id) return false

  return this._startHintProgramDrag(correctPiece, wrongPiece, targetSlot)
}

PuzzleEngine.prototype.onTouchEnd = function () {
  if (!this.dragInfo) return
  var info = this.dragInfo
  this.dragInfo = null
  var group = info.group
  group.dragging = false

  var L = this.layout
  var dxPx = Math.round(group.tx)
  var dyPx = Math.round(group.ty)
  var colDelta = Math.round(dxPx / L.stepX)
  var rowDelta = Math.round(dyPx / L.stepY)

  if (colDelta === 0 && rowDelta === 0) {
    return this._settleNoSwap(group)
  }

  var plan = this._planGroupMove(info.memberIds, colDelta, rowDelta)
  if (!plan) return this._settleNoSwap(group)
  this._commitMove(info.memberIds, plan.newSlotById, plan.assignment)
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

PuzzleEngine.prototype._commitMove = function (memberIds, newSlotById, assignment, animDur) {
  var dur = animDur || ANIM_DUR
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
          fromTx: piece.tx, fromTy: piece.ty, t0: now, dur: dur,
          curTx: piece.tx, curTy: piece.ty
        }
        piece.tx = 0
        piece.ty = 0
      }
    }
  }

  // 5) 合并特效
  var mergedIds = this._findMergedGroup(sizeBefore)
  if (mergedIds) {
    var mg = this._pickGroupByMembers(mergedIds)
    if (mg) {
      var fxBox = mergeFxRectFromGroup(mg.x, mg.y, mg.w, mg.h)
      this._mergeFx = {
        groupId: mg.id,
        x: fxBox.x,
        y: fxBox.y,
        w: fxBox.w,
        h: fxBox.h,
        t0: now,
        t: 0
      }
      if (this.sfxEnabled) sfx.playMerge()
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
module.exports.CARD_BACK_IMAGE = CARD_BACK_IMAGE
