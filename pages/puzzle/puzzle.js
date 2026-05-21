/* ============================================================================
 *  拼图 — 840×1260 原图，2:3 竖版，3×3～7×7，拼图区域宽 100%
 *  尺寸规范见：docs/PUZZLE_SIZING.md
 * ========================================================================== */

const CONTAINER_RATIO = 1
const GAP = 0
const BOARD_PADDING = 12
const BORDER = 1
const PIECE_PADDING = 1
const PIECE_RADIUS = 2

const SRC_IMAGE_W = 840
const SRC_IMAGE_H = 1260

/**
 * 棋盘外宽 = 屏宽×100%；内区 padding 12、块间距 GAP；
 * 单块 cellW×cellH（2:3），图片区 = 扣除 border+padding 后的内框。
 */
function computeLayout(windowWidth, N) {
  const boardOuterW = Math.floor(windowWidth * CONTAINER_RATIO)
  const gridInnerW = boardOuterW - BOARD_PADDING * 2
  const cellW = Math.floor((gridInnerW - GAP * (N - 1)) / N)
  const cellH = Math.floor((cellW * 3) / 2)

  const gridW = cellW * N + GAP * (N - 1)
  const gridH = cellH * N + GAP * (N - 1)
  const stepX = cellW + GAP
  const stepY = cellH + GAP

  const imageTileW = cellW - 2 * BORDER - 2 * PIECE_PADDING
  const imageTileH = cellH - 2 * BORDER - 2 * PIECE_PADDING

  return {
    N,
    GAP,
    BOARD_PADDING,
    BORDER,
    PIECE_PADDING,
    cellW,
    cellH,
    contentW: imageTileW,
    contentH: imageTileH,
    imageTileW,
    imageTileH,
    gridW,
    gridH,
    boardW: gridW + BOARD_PADDING * 2,
    boardH: gridH + BOARD_PADDING * 2,
    stepX,
    stepY,
    imgW: imageTileW * N,
    imgH: imageTileH * N
  }
}

function slotToXY(layout, col, row) {
  return {
    x: layout.BOARD_PADDING + col * layout.stepX,
    y: layout.BOARD_PADDING + row * layout.stepY
  }
}

Page({
  data: {
    imageUrl: '',
    gridSize: 4,
    cellW: 0,
    cellH: 0,
    contentW: 0,
    contentH: 0,
    boardW: 0,
    boardH: 0,
    imgW: 0,
    imgH: 0,
    groups: [],
    moves: 0,
    showSuccess: false
  },

  gridSize: 4,
  layout: null,
  windowWidth: 375,
  _pieces: null,
  dragInfo: null,
  _lastMoveTime: 0,
  _settleTimer: null,

  // =========================================================================
  //  生命周期
  // =========================================================================

  onLoad(options) {
    try {
      const info = wx.getSystemInfoSync()
      this.windowWidth = info.windowWidth
    } catch (err) {
      this.windowWidth = 375
    }

    let grid = parseInt(options.grid, 10)
    if (Number.isNaN(grid) || grid < 3 || grid > 7) grid = 4
    this.gridSize = grid
    this.applyLayout()

    if (options.image) {
      this.setData({ imageUrl: decodeURIComponent(options.image) })
      this._pendingBootstrap = true
    }
  },

  onReady() {
    if (this._pendingBootstrap) {
      this._pendingBootstrap = false
      this.bootstrapPuzzle()
    }
  },

  applyLayout() {
    const layout = computeLayout(this.windowWidth, this.gridSize)
    this.layout = layout
    this.setData({
      gridSize: layout.N,
      cellW: layout.cellW,
      cellH: layout.cellH,
      contentW: layout.contentW,
      contentH: layout.contentH,
      boardW: layout.boardW,
      boardH: layout.boardH,
      imgW: layout.imgW,
      imgH: layout.imgH
    })
  },

  bootstrapPuzzle() {
    this.ensureImageSize(this.data.imageUrl)
      .then(() => this.initPuzzle())
      .catch(() => {})
  },

  /** 校验原图 840×1260；显示用「整图 + 格子偏移」，保证拼合为完整画面 */
  ensureImageSize(imagePath) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: imagePath,
        success: (info) => {
          if (info.width !== SRC_IMAGE_W || info.height !== SRC_IMAGE_H) {
            wx.showModal({
              title: '图片尺寸不符',
              content: `请使用 ${SRC_IMAGE_W}×${SRC_IMAGE_H} 像素（2:3）的素材`,
              showCancel: false,
              success: () => wx.navigateBack()
            })
            reject(new Error('invalid image size'))
            return
          }
          resolve()
        },
        fail: reject
      })
    })
  },

  // =========================================================================
  //  初始化 / 洗牌
  // =========================================================================

  initPuzzle() {
    this.clearSettleTimer()
    this.dragInfo = null

    const N = this.gridSize
    const total = N * N
    const pieces = []
    for (let i = 0; i < total; i++) {
      pieces.push({ id: i, originalIndex: i, currentIndex: i })
    }

    const slots = pieces.map(p => p.currentIndex)
    const shuffled = this.fisherYatesShuffle(slots)
    pieces.forEach((p, i) => { p.currentIndex = shuffled[i] })

    this._pieces = pieces
    this.setData({
      groups: this.buildGroups(),
      moves: 0,
      showSuccess: false
    })
  },

  fisherYatesShuffle(arr) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    if (a.every((v, idx) => v === idx)) {
      ;[a[0], a[1]] = [a[1], a[0]]
    }
    return a
  },

  // =========================================================================
  //  连通组 BFS
  // =========================================================================

  findAllGroups() {
    const N = this.gridSize
    const piecesById = {}
    const piecesBySlot = {}
    this._pieces.forEach(p => {
      piecesById[p.id] = p
      piecesBySlot[p.currentIndex] = p
    })

    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    const visited = new Set()
    const groups = []

    for (const p of this._pieces) {
      if (visited.has(p.id)) continue

      const groupIds = []
      const queue = [p.id]
      visited.add(p.id)

      while (queue.length) {
        const id = queue.shift()
        groupIds.push(id)

        const cur = piecesById[id]
        const cCol = cur.currentIndex % N
        const cRow = Math.floor(cur.currentIndex / N)
        const oCol = cur.originalIndex % N
        const oRow = Math.floor(cur.originalIndex / N)

        for (const [dc, dr] of dirs) {
          const nCol = cCol + dc
          const nRow = cRow + dr
          if (nCol < 0 || nCol >= N || nRow < 0 || nRow >= N) continue

          const neighbor = piecesBySlot[nRow * N + nCol]
          if (!neighbor || visited.has(neighbor.id)) continue

          const nOCol = neighbor.originalIndex % N
          const nORow = Math.floor(neighbor.originalIndex / N)
          if (nOCol - oCol === dc && nORow - oRow === dr) {
            visited.add(neighbor.id)
            queue.push(neighbor.id)
          }
        }
      }

      groups.push(groupIds)
    }

    return groups
  },

  // =========================================================================
  //  渲染组数据（整数坐标）
  // =========================================================================

  buildGroups(preservedVisualByPieceId = null) {
    const layout = this.layout
    const N = this.gridSize
    const { cellW, cellH, stepX, stepY } = layout

    const piecesById = {}
    const piecesBySlot = {}
    this._pieces.forEach(p => {
      piecesById[p.id] = p
      piecesBySlot[p.currentIndex] = p
    })

    const rawGroups = this.findAllGroups()

    return rawGroups.map(memberIds => {
      let minCol = Infinity
      let minRow = Infinity
      let maxCol = -Infinity
      let maxRow = -Infinity

      for (const id of memberIds) {
        const m = piecesById[id]
        const c = m.currentIndex % N
        const r = Math.floor(m.currentIndex / N)
        if (c < minCol) minCol = c
        if (r < minRow) minRow = r
        if (c > maxCol) maxCol = c
        if (r > maxRow) maxRow = r
      }

      const anchor = slotToXY(layout, minCol, minRow)
      const groupX = anchor.x
      const groupY = anchor.y
      const groupW = (maxCol - minCol + 1) * stepX - layout.GAP
      const groupH = (maxRow - minRow + 1) * stepY - layout.GAP

      const pieces = memberIds.map(id => {
        const m = piecesById[id]
        const myCol = m.currentIndex % N
        const myRow = Math.floor(m.currentIndex / N)

        const localX = (myCol - minCol) * stepX
        const localY = (myRow - minRow) * stepY

        const oCol = m.originalIndex % N
        const oRow = Math.floor(m.originalIndex / N)
        const offsetX = -oCol * layout.imageTileW
        const offsetY = -oRow * layout.imageTileH

        let tx = 0
        let ty = 0
        let noTransition = false
        if (preservedVisualByPieceId && preservedVisualByPieceId[id]) {
          const target = preservedVisualByPieceId[id]
          tx = Math.round(target.vx - (groupX + localX))
          ty = Math.round(target.vy - (groupY + localY))
          noTransition = true
        }

        return {
          id,
          originalIndex: m.originalIndex,
          currentIndex: m.currentIndex,
          localX,
          localY,
          offsetX,
          offsetY,
          tx,
          ty,
          noTransition
        }
      })

      const groupId = 'g_' + Math.min.apply(null, memberIds)

      return {
        id: groupId,
        x: groupX,
        y: groupY,
        w: groupW,
        h: groupH,
        tx: 0,
        ty: 0,
        dragging: false,
        noTransition: !!preservedVisualByPieceId,
        isCompound: pieces.length > 1,
        pieces
      }
    })
  },

  // =========================================================================
  //  拖拽
  // =========================================================================

  clearSettleTimer() {
    if (this._settleTimer) {
      clearTimeout(this._settleTimer)
      this._settleTimer = null
    }
  },

  handleTouchStart(e) {
    this.clearSettleTimer()

    const pid = Number(e.currentTarget.dataset.pid)
    if (Number.isNaN(pid)) return
    const touch = e.touches[0]

    let groupIdx = -1
    for (let i = 0; i < this.data.groups.length; i++) {
      if (this.data.groups[i].pieces.some(p => p.id === pid)) {
        groupIdx = i
        break
      }
    }
    if (groupIdx < 0) return
    const group = this.data.groups[groupIdx]

    this.dragInfo = {
      groupId: group.id,
      groupIdx,
      touchedPid: pid,
      memberIds: group.pieces.map(p => p.id),
      memberSet: new Set(group.pieces.map(p => p.id)),
      startX: touch.clientX,
      startY: touch.clientY,
      originX: group.x,
      originY: group.y
    }

    this.setData({
      [`groups[${groupIdx}].dragging`]: true,
      [`groups[${groupIdx}].noTransition`]: true
    })
  },

  handleTouchMove(e) {
    if (!this.dragInfo) return

    const now = Date.now()
    if (now - this._lastMoveTime < 16) return
    this._lastMoveTime = now

    const touch = e.touches[0]
    const dxPx = Math.round(touch.clientX - this.dragInfo.startX)
    const dyPx = Math.round(touch.clientY - this.dragInfo.startY)

    const { groupIdx } = this.dragInfo
    this.setData({
      [`groups[${groupIdx}].tx`]: dxPx,
      [`groups[${groupIdx}].ty`]: dyPx
    })
  },

  handleTouchEnd() {
    if (!this.dragInfo) return
    const info = this.dragInfo
    this.dragInfo = null

    const group = this.data.groups[info.groupIdx]
    if (!group) return

    const layout = this.layout
    const N = this.gridSize
    const dxPx = Math.round(group.tx)
    const dyPx = Math.round(group.ty)

    const colDelta = Math.round(dxPx / layout.stepX)
    const rowDelta = Math.round(dyPx / layout.stepY)

    if (colDelta === 0 && rowDelta === 0) {
      return this.settleNoSwap(info)
    }

    const piecesById = {}
    this._pieces.forEach(p => { piecesById[p.id] = p })

    const newSlotById = {}
    for (const gid of info.memberIds) {
      const m = piecesById[gid]
      const gCol = m.currentIndex % N
      const gRow = Math.floor(m.currentIndex / N)
      const newCol = gCol + colDelta
      const newRow = gRow + rowDelta
      if (newCol < 0 || newCol >= N || newRow < 0 || newRow >= N) {
        return this.settleNoSwap(info)
      }
      newSlotById[gid] = newRow * N + newCol
    }

    const oldSlotSet = new Set(info.memberIds.map(gid => piecesById[gid].currentIndex))
    const newSlotSet = new Set(Object.values(newSlotById))

    const vacatedSlots = [...oldSlotSet].filter(s => !newSlotSet.has(s))
    const displaced = this._pieces.filter(
      p => !info.memberSet.has(p.id) && newSlotSet.has(p.currentIndex)
    )

    if (displaced.length !== vacatedSlots.length) {
      return this.settleNoSwap(info)
    }

    const usedVacated = new Set()
    const displacedAssignment = {}
    for (const dp of displaced) {
      const dCol = dp.currentIndex % N
      const dRow = Math.floor(dp.currentIndex / N)
      let bestV = -1
      let bestDist = Infinity
      for (const v of vacatedSlots) {
        if (usedVacated.has(v)) continue
        const vCol = v % N
        const vRow = Math.floor(v / N)
        const dist = Math.hypot(dCol - vCol, dRow - vRow)
        if (dist < bestDist) {
          bestDist = dist
          bestV = v
        }
      }
      if (bestV < 0) return this.settleNoSwap(info)
      usedVacated.add(bestV)
      displacedAssignment[dp.id] = bestV
    }

    this.commitMove({ info, newSlotById, displacedAssignment })
  },

  commitMove({ info, newSlotById, displacedAssignment }) {
    const preserved = {}
    for (const g of this.data.groups) {
      for (const p of g.pieces) {
        preserved[p.id] = {
          vx: Math.round(g.x + g.tx + p.localX + p.tx),
          vy: Math.round(g.y + g.ty + p.localY + p.ty)
        }
      }
    }

    this._pieces = this._pieces.map(p => {
      if (newSlotById[p.id] !== undefined) {
        return { ...p, currentIndex: newSlotById[p.id] }
      }
      if (displacedAssignment[p.id] !== undefined) {
        return { ...p, currentIndex: displacedAssignment[p.id] }
      }
      return p
    })

    const newGroups = this.buildGroups(preserved)

    this.setData({
      groups: newGroups,
      moves: this.data.moves + 1
    }, () => {
      this._settleTimer = setTimeout(() => {
        this._settleTimer = null
        const updates = {}
        this.data.groups.forEach((g, gi) => {
          updates[`groups[${gi}].noTransition`] = false
          updates[`groups[${gi}].tx`] = 0
          updates[`groups[${gi}].ty`] = 0
          g.pieces.forEach((p, pi) => {
            updates[`groups[${gi}].pieces[${pi}].tx`] = 0
            updates[`groups[${gi}].pieces[${pi}].ty`] = 0
            updates[`groups[${gi}].pieces[${pi}].noTransition`] = false
          })
        })
        this.setData(updates, () => this.checkWin())
      }, 32)
    })
  },

  settleNoSwap(info) {
    const groupIdx = info.groupIdx
    const group = this.data.groups[groupIdx]
    if (!group) return

    this.setData({
      [`groups[${groupIdx}].noTransition`]: false,
      [`groups[${groupIdx}].dragging`]: false,
      [`groups[${groupIdx}].tx`]: 0,
      [`groups[${groupIdx}].ty`]: 0
    })
  },

  checkWin() {
    const isWin = this._pieces.every(p => p.currentIndex === p.originalIndex)
    if (isWin) {
      setTimeout(() => this.setData({ showSuccess: true }), 300)
    }
  },

  shufflePuzzle() {
    this.initPuzzle()
  },
  resetPuzzle() {
    this.bootstrapPuzzle()
  },
  handleSuccessClose() {
    this.bootstrapPuzzle()
  },

  goBack() {
    wx.navigateBack()
  },
  noop() {}
})
