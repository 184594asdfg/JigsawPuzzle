/* ============================================================================
 *  拼图核心逻辑（重构版）
 *  ----------------------------------------------------------------------------
 *  设计哲学（必读，理解了这一段，整个文件你就懂了 80%）：
 *
 *  1) 真正的"父容器 (Group) + 子方块 (Piece)"两层模型：
 *       - 每个连通组对应一个 <view class="puzzle-group">  → 在 WXML 里就是父容器。
 *       - 每个方块对应一个 <view class="puzzle-piece">    → 是 group 的子节点。
 *       - 父容器承担"组的全局位置 + 整组拖拽 transform"。
 *       - 子方块承担"相对父容器的局部坐标 (Local Position) + 残差补偿"。
 *
 *  2) 棋盘格无间距（GAP = 0）：
 *       这是消除"合并瞬间整组缩水"的根本方案。
 *       传统做法：每块之间预留 GAP，成组时把 GAP "挤掉" —— 这就是你之前看到的
 *       "瞬间整体缩小"的根因（不是 scale，是几何上的向内塌缩）。
 *       工业做法：让方块的物理尺寸 CELL_W × CELL_H 恒等于"占地尺寸"，
 *       棋盘格之间间距 = 0。这样无论是否成组，方块的全局坐标都是
 *           x = PADDING + col * CELL_W
 *           y = PADDING + row * CELL_H
 *       完全恒等，零跳变。
 *       视觉上的"切割感"我们用 CSS inset box-shadow 模拟（不占布局空间）。
 *
 *  3) 坐标系换算（核心公式，背下来）：
 *       全局坐标 (Global) = 父容器全局坐标 (group.x) + 子方块局部坐标 (piece.localX)
 *       局部坐标 (Local)  = 全局坐标 - 父容器全局坐标
 *       展开就是：
 *           piece.localX = (myCol - minCol) * CELL_W
 *           piece.localY = (myRow - minRow) * CELL_H
 *       其中 minCol/minRow 是该组内"最小列/行"，决定父容器的左上角锚点。
 *
 *  4) Scale 永远是 1：
 *       本文件以及 WXSS 里，puzzle-group / puzzle-piece 没有任何 transform: scale() 操作。
 *       transform 仅用于 translate（平移）。这是"绝对尺寸锁定"的硬性保证。
 *
 *  5) 两阶段过渡（防止 commit 瞬间视觉跳变）：
 *       阶段一：noTransition=true，把数据写到最终位置，同时给受影响的 piece
 *               填一个 tx/ty "残差" —— 让"父容器位置 + 局部位置 + 残差"= 松手前的视觉位置。
 *               用户看不到任何跳变。
 *       阶段二：下一帧把 noTransition 关掉、tx/ty 清零 —— transform 的 CSS transition
 *               自然把残差"动画式归零"，方块平滑滑到目标格。
 *
 *  ========================================================================== */

// =========================
//  常量区（业务上的"物理量"）
// =========================

// 单块的物理宽 / 高（rpx）。CELL_W / CELL_H 既是"占地尺寸",决定了坐标计算。
// 关键：方块之间没有 GAP,所以相邻块的坐标差恰好等于 CELL_W / CELL_H。
const CELL_W = 180
const CELL_H = 240

const COLS = 3
const ROWS = 4

// 棋盘内边距：方块整体距棋盘四边的留白（rpx）
const PADDING = 6

// 单块外缘圆角（rpx）—— 仅出现在组的"外轮廓"上,组内邻接面为 0。
const R = 8

// -----------------------------------------------------------------------------
//  ★ PIECE_OVERLAP（关键）—— 渲染层"亚像素抗锯齿缝隙"的工业级解药
// -----------------------------------------------------------------------------
//  为什么需要它？
//    rpx 经过 windowWidth/750 换算到 px,绝大多数手机上是非整数（例如
//    iPhone 11 系列 414px 屏: 240rpx = 132.48px）。微信小程序渲染层
//    （X5/WKWebView）给带 transform/will-change 的元素建立独立合成层
//    (GPU compositing layer),合成时多个层之间的亚像素边界会触发抗锯齿,
//    在相邻两块之间表现为 0.5px 的"灰色模糊带",肉眼看就是"缝隙"。
//
//    更阴险的是：同一 group 内,老的 piece DOM（从旧组复用）已经稳定栅格化,
//    新加入的 piece 是第一次挂载、刚刚走完 transition,合成基线和老 piece
//    不同步,所以"老 piece ↔ 老 piece"无缝,"老 piece ↔ 新 piece"露缝。
//    这就是"竖三连里前两块没问题、第三块和第二块之间有缝"的根因。
//
//  解决思路：
//    让每个 piece 的显示尺寸比 CELL_W/CELL_H 多 PIECE_OVERLAP rpx,
//    导致相邻 piece 在物理上微微重叠。后渲染的 piece 盖住前一个的
//    "重叠边",物理上不可能露缝。
//
//    由于组内相邻 piece 在原图中也是相邻的（这是连接条件的硬性约束）,
//    多出来的 1rpx 显示的正好是邻居原图的最边缘 —— 画面是连续的,无视觉异常。
//
//  注意：坐标计算（localX/Y、group.x/y）依然基于 CELL_W/CELL_H,
//        OVERLAP 只影响"显示尺寸",不影响"几何排布"。
//        这种"几何尺寸 vs 显示尺寸"分离是 tile-based 渲染的标准技巧。
// -----------------------------------------------------------------------------
const PIECE_OVERLAP = 1

// piece 实际渲染时的物理宽高（rpx）= 坐标占地 + 微小重叠
const PIECE_W = CELL_W + PIECE_OVERLAP
const PIECE_H = CELL_H + PIECE_OVERLAP

Page({
  data: {
    imageUrl: '',

    // 让 WXML 能拿到的常量
    cellW: CELL_W,
    cellH: CELL_H,
    // ★ piece 渲染时用的物理宽高 = CELL + PIECE_OVERLAP,
    //   保证相邻 piece 重叠 PIECE_OVERLAP rpx,消除合成层亚像素缝隙。
    //   WXML 里 piece 的 width/height 必须用 pieceW/pieceH,而不是 cellW/cellH。
    pieceW: PIECE_W,
    pieceH: PIECE_H,
    padding: PADDING,

    // 整图（原图）的显示尺寸：每块里的 <image> 都按这个大小渲染，
    // 然后通过 transform 把它平移到对应位置，实现"切片"显示。
    imgW: CELL_W * COLS,
    imgH: CELL_H * ROWS,

    // 棋盘的物理尺寸（不含 GAP）
    boardW: CELL_W * COLS + PADDING * 2,
    boardH: CELL_H * ROWS + PADDING * 2,

    // 渲染数据：以"组"为顶层单位的数组
    // 形如：
    //   groups: [
    //     {
    //       id: 'g_3',          // 组的稳定标识（取组内最小 piece id）
    //       x: 6, y: 6,          // 父容器在棋盘上的全局坐标（rpx）
    //       w: 180, h: 480,      // 包围盒尺寸
    //       tx: 0, ty: 0,        // 父容器的实时拖拽偏移
    //       dragging: false,
    //       noTransition: false,
    //       isCompound: false,   // 是否为多块组合（>1 piece）
    //       pieces: [
    //         {
    //           id, originalIndex, currentIndex,
    //           localX, localY,   // 相对父容器的局部坐标（rpx）
    //           offsetX, offsetY, // 子 image 的 transform 偏移，用于显示原图切片
    //           borderRadius,     // 仅外缘圆角
    //           tx, ty,           // 残差补偿偏移（用于两阶段过渡）
    //           noTransition
    //         },
    //         ...
    //       ]
    //     },
    //     ...
    //   ]
    groups: [],

    moves: 0,
    showSuccess: false
  },

  // 屏幕 px 与 rpx 的换算系数（在 onLoad 中计算）
  rpxToPx: 1,

  // 当前所有方块的纯数据（不直接进 data，避免每次都全量 setData）
  // 形如：[{ id, originalIndex, currentIndex }, ...]
  _pieces: null,

  // 拖拽过程中的瞬态信息
  dragInfo: null,

  // 节流时间戳（touchmove 节流到 ~60fps）
  _lastMoveTime: 0,

  // 两阶段过渡使用的定时器句柄
  _settleTimer: null,

  // =========================================================================
  //  生命周期 / 初始化
  // =========================================================================

  onLoad(options) {
    try {
      const info = wx.getSystemInfoSync()
      // 触摸事件给的是 px，我们的所有坐标都是 rpx，必须做一次换算。
      // 系数 = windowWidth(px) / 750(rpx)
      this.rpxToPx = info.windowWidth / 750
    } catch (err) {
      this.rpxToPx = 0.5
    }
    if (options.image) {
      this.setData({ imageUrl: decodeURIComponent(options.image) })
      this.initPuzzle()
    }
  },

  // 重新开始游戏：生成原始方块、洗牌、构建初始 groups
  initPuzzle() {
    this.clearSettleTimer()
    this.dragInfo = null

    // 1) 生成原始方块。
    //    originalIndex 永远不变（决定该块在完整图里的位置 → 图片偏移量）。
    //    currentIndex  会随玩家拖动而变化（决定该块当前在棋盘哪个格子）。
    const pieces = []
    for (let i = 0; i < COLS * ROWS; i++) {
      pieces.push({
        id: i,
        originalIndex: i,
        currentIndex: i
      })
    }

    // 2) 洗牌：随机打乱 currentIndex 的对应关系（不动 originalIndex）。
    const slots = pieces.map(p => p.currentIndex)
    const shuffled = this.fisherYatesShuffle(slots)
    pieces.forEach((p, i) => { p.currentIndex = shuffled[i] })

    this._pieces = pieces

    // 3) 根据当前 _pieces 构建初始 groups（首次构建无需做"残差补偿"）。
    const groups = this.buildGroups()

    this.setData({
      groups,
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
    // 极端情况：洗成原序，强制交换两块避免一开局就赢
    if (a.every((v, idx) => v === idx)) {
      ;[a[0], a[1]] = [a[1], a[0]]
    }
    return a
  },

  // =========================================================================
  //  组结构：连通性识别（BFS）
  // =========================================================================

  // 判断两块在"棋盘上是否相邻 且 这种相邻关系与原图里的相邻关系完全一致"。
  // 例：A.original=(c=1,r=0)，B.original=(c=2,r=0)，原图里 B 在 A 的右边；
  //     若当前 A.current 在 (c=1,r=2)，B.current 在 (c=2,r=2)，棋盘上 B 也在 A 的右边
  //     → 满足"组"的连接条件。
  //
  // 把所有满足该条件、彼此连通的方块归为一个"组"。
  // 注意：组的判定只依赖 currentIndex / originalIndex，不依赖渲染坐标。
  findAllGroups() {
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
        const cCol = cur.currentIndex % COLS
        const cRow = Math.floor(cur.currentIndex / COLS)
        const oCol = cur.originalIndex % COLS
        const oRow = Math.floor(cur.originalIndex / COLS)

        for (const [dc, dr] of dirs) {
          const nCol = cCol + dc
          const nRow = cRow + dr
          if (nCol < 0 || nCol >= COLS || nRow < 0 || nRow >= ROWS) continue

          const neighbor = piecesBySlot[nRow * COLS + nCol]
          if (!neighbor || visited.has(neighbor.id)) continue

          const nOCol = neighbor.originalIndex % COLS
          const nORow = Math.floor(neighbor.originalIndex / COLS)
          // 连接条件：邻居在原图中的相对方位 == 邻居在棋盘上的相对方位
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
  //  组结构：渲染数据构建（坐标转换核心）
  // =========================================================================

  /**
   * 根据当前 _pieces 构建供 WXML 渲染的 groups 数组。
   *
   * @param {Object|null} preservedVisualByPieceId
   *        可选。形如 { [pieceId]: { vx, vy } }。
   *        如果传入：意味着调用者希望"该 piece 在本次重建后仍保持在全局视觉坐标 (vx, vy) 处"。
   *        我们会给这个 piece 自动填一个 tx/ty 残差，使得
   *             父容器全局坐标 + piece 局部坐标 + 残差 = (vx, vy)
   *        同时把该 piece 的 noTransition 设为 true（避免残差被 transition 化）。
   *        这是"两阶段过渡"里阶段一的核心机制。
   *
   *        如果不传：所有 piece 的 tx/ty = 0、noTransition = false。
   */
  buildGroups(preservedVisualByPieceId = null) {
    const piecesById = {}
    const piecesBySlot = {}
    this._pieces.forEach(p => {
      piecesById[p.id] = p
      piecesBySlot[p.currentIndex] = p
    })

    const rawGroups = this.findAllGroups()

    const dirs = [
      { dc: -1, dr: 0, key: 'left' },
      { dc: 1, dr: 0, key: 'right' },
      { dc: 0, dr: -1, key: 'top' },
      { dc: 0, dr: 1, key: 'bottom' }
    ]

    return rawGroups.map(memberIds => {
      // ----- (a) 找组的"最小列 / 最小行 / 最大列 / 最大行" -----
      // 父容器的左上角锚点 = (minCol, minRow)
      // 父容器的包围盒尺寸 = (maxCol-minCol+1) * CELL_W × (maxRow-minRow+1) * CELL_H
      let minCol = Infinity
      let minRow = Infinity
      let maxCol = -Infinity
      let maxRow = -Infinity

      for (const id of memberIds) {
        const m = piecesById[id]
        const c = m.currentIndex % COLS
        const r = Math.floor(m.currentIndex / COLS)
        if (c < minCol) minCol = c
        if (r < minRow) minRow = r
        if (c > maxCol) maxCol = c
        if (r > maxRow) maxRow = r
      }

      // ----- (b) 父容器的全局坐标（这是"组"在棋盘上的位置） -----
      // 这里就是坐标系换算的源头：minCol/minRow 是组内最左上的块所在棋盘格，
      // 把"棋盘 (PADDING) + 格子坐标"翻译成像素坐标，作为父容器的 left/top。
      const groupX = PADDING + minCol * CELL_W
      const groupY = PADDING + minRow * CELL_H

      // ----- (c) 包围盒尺寸（只是给 group 一个明确的 width/height，方便调试和定位） -----
      const groupW = (maxCol - minCol + 1) * CELL_W
      const groupH = (maxRow - minRow + 1) * CELL_H

      // ----- (d) 为每个成员算"局部坐标 + 切片偏移 + 圆角 + 残差补偿" -----
      const pieces = memberIds.map(id => {
        const m = piecesById[id]
        const myCol = m.currentIndex % COLS
        const myRow = Math.floor(m.currentIndex / COLS)

        // ★★ 坐标转换核心公式 ★★
        // 该 piece 在棋盘上的全局格坐标   = (myCol, myRow)
        // 父容器在棋盘上的全局格坐标     = (minCol, minRow)
        // 该 piece 相对父容器的局部格坐标 = (myCol - minCol, myRow - minRow)
        // 乘以单元像素尺寸即得局部像素坐标：
        const localX = (myCol - minCol) * CELL_W
        const localY = (myRow - minRow) * CELL_H

        // 子 image 的偏移：让那张完整大图的"正确切片"出现在这个 piece 框内。
        // 例：originalIndex 对应原图第 (oCol, oRow) 格，那么把整张图向左上各平移
        //     (oCol*CELL_W, oRow*CELL_H)，再用 piece 的 overflow:hidden 裁出来。
        const oCol = m.originalIndex % COLS
        const oRow = Math.floor(m.originalIndex / COLS)
        const offsetX = -oCol * CELL_W
        const offsetY = -oRow * CELL_H

        // ----- 圆角策略：仅出现在组的"外轮廓"上 -----
        // 检查该 piece 的四个方向是否有"同组邻居"（即在原图里也是邻接的、且当前也在棋盘上邻接）。
        // 如果某方向有同组邻居 → 该方向不需要圆角（与邻居贴合）。
        const att = { top: false, right: false, bottom: false, left: false }
        for (const { dc, dr, key } of dirs) {
          const nCol = myCol + dc
          const nRow = myRow + dr
          if (nCol < 0 || nCol >= COLS || nRow < 0 || nRow >= ROWS) continue
          const neighbor = piecesBySlot[nRow * COLS + nCol]
          if (!neighbor) continue
          const nOCol = neighbor.originalIndex % COLS
          const nORow = Math.floor(neighbor.originalIndex / COLS)
          if (nOCol - oCol === dc && nORow - oRow === dr) att[key] = true
        }
        const tl = (att.top || att.left) ? 0 : R
        const tr = (att.top || att.right) ? 0 : R
        const br = (att.bottom || att.right) ? 0 : R
        const bl = (att.bottom || att.left) ? 0 : R

        // ----- 残差补偿（两阶段过渡的阶段一） -----
        // 目标：本次 build 之后，piece 的视觉位置 = preserved.vx/vy（即松手前的位置）。
        //
        //   视觉位置 = groupX + localX + tx
        //   要让它等于 vx：tx = vx - (groupX + localX)
        //
        // 设置 noTransition=true 是为了让"残差 tx/ty"瞬间生效（不经过 transition 动画），
        // 否则会看到 piece 从原位"飞"过来，反而引入额外动画。
        let tx = 0
        let ty = 0
        let noTransition = false
        if (preservedVisualByPieceId && preservedVisualByPieceId[id]) {
          const target = preservedVisualByPieceId[id]
          tx = target.vx - (groupX + localX)
          ty = target.vy - (groupY + localY)
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
          borderRadius: `${tl}rpx ${tr}rpx ${br}rpx ${bl}rpx`,
          tx,
          ty,
          noTransition
        }
      })

      // 用组内最小 piece id 作为组的稳定标识，保证 WXML wx:key 命中、DOM 节点尽量复用。
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
        // 若调用者传了 preserved，意味着本次是"两阶段过渡的阶段一"，
        // 父容器也必须 noTransition，让它瞬移到 newX/newY 而不经历过渡。
        noTransition: !!preservedVisualByPieceId,
        isCompound: pieces.length > 1,
        pieces
      }
    })
  },

  // =========================================================================
  //  拖拽：start / move / end
  // =========================================================================

  clearSettleTimer() {
    if (this._settleTimer) {
      clearTimeout(this._settleTimer)
      this._settleTimer = null
    }
  },

  // 触摸开始：事件现在挂在"具体的 piece"上,而不是 group 包围盒。
  //
  // 为什么要这么改：
  //   旧方案把 catchtouchstart 挂在 .puzzle-group 上,group 是一个矩形包围盒。
  //   对于 L 形组合（如"第一行 3 块 + 第二行第 1 块"）,它的包围盒是
  //   3*CELL_W × 2*CELL_H,但右下角那两个格子其实没有该组的 piece。
  //   这个"空矩形 DOM 区域"会盖住下层真正住在那里的独立碎片,导致
  //   "点单独碎片却拖走了组合块"的 bug。
  //
  // 现在的方案：
  //   1) WXSS 给 .puzzle-group 设 pointer-events: none,矩形包围盒对触摸透明。
  //   2) WXSS 给 .puzzle-piece 设 pointer-events: auto,具体方块接管事件。
  //   3) WXML 把 catchtouchstart 等挂在 piece 上,data-pid 带上 piece 自己的 id。
  //   4) 这里根据 pid 反查它属于哪个 group,再去拖那个 group。
  //
  // 命中规则因此变成"严格按方块的真实矩形区域",独立碎片永远不会被组合块的
  // 包围盒拦截 —— 这是真正的"精确识别触摸目标"。
  handleTouchStart(e) {
    this.clearSettleTimer()

    // pid 是 piece 的 id。小程序 dataset 一般保留字面量类型,这里加一道 Number 防御。
    const pid = Number(e.currentTarget.dataset.pid)
    if (Number.isNaN(pid)) return
    const touch = e.touches[0]

    // 反查该 piece 所属的 group
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

    // 让该组进入"拖拽态"：
    //   - dragging=true     ：CSS 可加上浮起阴影、提升 z-index
    //   - noTransition=true ：拖拽中 transform 跟随手指即时响应,不要 transition 拖泥带水
    //
    // 注意：单独碎片本身也是一个 group（只含 1 个 piece,isCompound=false）,
    //       逻辑完全一致 —— 点单独碎片就是把它所在的"单成员组"提进拖拽态。
    //       所以"拖整组"和"拖单块"在这里是同一套代码,差别只是组里成员的多少。
    this.setData({
      [`groups[${groupIdx}].dragging`]: true,
      [`groups[${groupIdx}].noTransition`]: true
    })
  },

  // 触摸移动：只更新被拖那个组的父容器 tx/ty
  // 注意：组内子方块的 localX/Y 完全不动，子方块"被父容器整体平移"——这就是
  //       "丝滑拖拽与坐标转换"的物理实现：只改父，不动子。
  handleTouchMove(e) {
    if (!this.dragInfo) return

    // 60fps 节流，避免短时间内大量 setData
    const now = Date.now()
    if (now - this._lastMoveTime < 16) return
    this._lastMoveTime = now

    const touch = e.touches[0]
    // 触摸事件是 px，转成 rpx
    const dxRpx = (touch.clientX - this.dragInfo.startX) / this.rpxToPx
    const dyRpx = (touch.clientY - this.dragInfo.startY) / this.rpxToPx

    const { groupIdx } = this.dragInfo
    this.setData({
      [`groups[${groupIdx}].tx`]: dxRpx,
      [`groups[${groupIdx}].ty`]: dyRpx
    })
  },

  // 触摸结束：量化位移到整数格，判断是否触发交换
  handleTouchEnd() {
    if (!this.dragInfo) return
    const info = this.dragInfo
    this.dragInfo = null

    const group = this.data.groups[info.groupIdx]
    if (!group) {
      // 异常防御：groupIdx 失效就只能放弃
      return
    }

    const dxRpx = group.tx
    const dyRpx = group.ty

    // 把像素位移量化到整数格数（一格 = 一个 CELL_W / CELL_H）
    const colDelta = Math.round(dxRpx / CELL_W)
    const rowDelta = Math.round(dyRpx / CELL_H)

    if (colDelta === 0 && rowDelta === 0) {
      return this.settleNoSwap(info)
    }

    // ----- 校验目标格全部合法 -----
    const piecesById = {}
    this._pieces.forEach(p => { piecesById[p.id] = p })

    const newSlotById = {}
    for (const gid of info.memberIds) {
      const m = piecesById[gid]
      const gCol = m.currentIndex % COLS
      const gRow = Math.floor(m.currentIndex / COLS)
      const newCol = gCol + colDelta
      const newRow = gRow + rowDelta
      if (newCol < 0 || newCol >= COLS || newRow < 0 || newRow >= ROWS) {
        return this.settleNoSwap(info)
      }
      newSlotById[gid] = newRow * COLS + newCol
    }

    // ----- 找出被挤出的"非组员" -----
    // 拖动后：组员占据了一些新格子；这些新格子里如果原本有非组员，就要把他们换到
    // 组员腾出来的空格（oldSlot \ newSlot）里。
    const oldSlotSet = new Set(info.memberIds.map(gid => piecesById[gid].currentIndex))
    const newSlotSet = new Set(Object.values(newSlotById))

    const vacatedSlots = [...oldSlotSet].filter(s => !newSlotSet.has(s))
    const displaced = this._pieces.filter(
      p => !info.memberSet.has(p.id) && newSlotSet.has(p.currentIndex)
    )

    if (displaced.length !== vacatedSlots.length) {
      // 不可能成立的几何 → 放弃
      return this.settleNoSwap(info)
    }

    // 就近映射 displaced → vacatedSlots（贪心，按曼哈顿/欧氏距离最近优先）
    const usedVacated = new Set()
    const displacedAssignment = {}
    for (const dp of displaced) {
      const dCol = dp.currentIndex % COLS
      const dRow = Math.floor(dp.currentIndex / COLS)
      let bestV = -1
      let bestDist = Infinity
      for (const v of vacatedSlots) {
        if (usedVacated.has(v)) continue
        const vCol = v % COLS
        const vRow = Math.floor(v / COLS)
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

  // =========================================================================
  //  提交位移：两阶段过渡（核心保证视觉无跳变）
  // =========================================================================

  commitMove({ info, newSlotById, displacedAssignment }) {
    // ---------------------------------------------------------------
    // 阶段 0：先快照每个 piece 此刻的"全局视觉位置"
    //         全局视觉位置 = group.x + group.tx + piece.localX + piece.tx
    //         （拖拽中的组 tx/ty 不为 0；其他组 tx/ty = 0；piece.tx/ty 一般 = 0）
    // ---------------------------------------------------------------
    const preserved = {}
    for (const g of this.data.groups) {
      for (const p of g.pieces) {
        preserved[p.id] = {
          vx: g.x + g.tx + p.localX + p.tx,
          vy: g.y + g.ty + p.localY + p.ty
        }
      }
    }

    // ---------------------------------------------------------------
    // 阶段 0.5：更新内部 _pieces 的 currentIndex
    // ---------------------------------------------------------------
    this._pieces = this._pieces.map(p => {
      if (newSlotById[p.id] !== undefined) {
        return { ...p, currentIndex: newSlotById[p.id] }
      }
      if (displacedAssignment[p.id] !== undefined) {
        return { ...p, currentIndex: displacedAssignment[p.id] }
      }
      return p
    })

    // ---------------------------------------------------------------
    // 阶段 1：重建 groups（带视觉位置保持）。
    //         传入 preserved 后，buildGroups 会自动给每个 piece 填残差 tx/ty
    //         并把 noTransition 设为 true，使得：
    //              新父容器全局位置 + 新局部位置 + 残差 = 原视觉位置
    //         玩家肉眼看上去：方块还在松手时的那个位置，没有任何跳变。
    //
    //         同时新的 groups 里 dragging 全是 false（buildGroups 默认设的）—— 
    //         这也是"拖拽态"被自动清理的地方。
    // ---------------------------------------------------------------
    const newGroups = this.buildGroups(preserved)

    this.setData({
      groups: newGroups,
      moves: this.data.moves + 1
    }, () => {
      // 等待至少一帧，让阶段 1 的渲染生效（残差就位、视觉无跳变）。
      // 32ms ≈ 两帧，留足缓冲让小程序渲染引擎完成"先固定不动"的那一帧。
      this._settleTimer = setTimeout(() => {
        this._settleTimer = null

        // ---------------------------------------------------------------
        // 阶段 2：关闭 noTransition + 清零 tx/ty。
        //         CSS transition 会把所有残差"动画式归零"，方块平滑过渡到目标格。
        //
        // 注意路径写法：要遍历 data.groups 把每个 group / 每个 piece 都更新。
        // 由于 setData 支持深层路径，性能可接受（一次 setData，多个路径合并）。
        // ---------------------------------------------------------------
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

  // 无交换（colDelta=0,rowDelta=0 或边界非法）：把父容器 tx/ty 平滑收回 0
  // 这种情况下 groups 结构不会变，只需要让被拖那个组"弹回去"。
  settleNoSwap(info) {
    const groupIdx = info.groupIdx
    const group = this.data.groups[groupIdx]
    if (!group) return

    // 关键：必须先关掉 noTransition（让 transition 恢复），然后设 tx/ty=0，
    //       这样 transform 的归零过程才是动画式的，而不是瞬移。
    // 同时 dragging 切回 false，让视觉样式从"浮起"过渡回普通态。
    this.setData({
      [`groups[${groupIdx}].noTransition`]: false,
      [`groups[${groupIdx}].dragging`]: false,
      [`groups[${groupIdx}].tx`]: 0,
      [`groups[${groupIdx}].ty`]: 0
    })
  },

  // =========================================================================
  //  胜利判定 / 其他工具
  // =========================================================================

  checkWin() {
    const isWin = this._pieces.every(p => p.currentIndex === p.originalIndex)
    if (isWin) {
      setTimeout(() => this.setData({ showSuccess: true }), 300)
    }
  },

  shufflePuzzle() { this.initPuzzle() },
  resetPuzzle() { this.initPuzzle() },
  handleSuccessClose() { this.initPuzzle() },

  goBack() { wx.navigateBack() },
  noop() {}
})
