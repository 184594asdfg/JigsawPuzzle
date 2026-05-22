/**
 * 首页：全屏背景 + 主视觉 + 底部三按钮（排行 / 开始 / 图集），及排行榜弹窗。
 */
var BaseScreen = require('./base-screen')
var rpx = require('../rpx')
var assets = require('../assets')
var draw = require('../draw')
var rankData = require('../../utils/rank-data')
var galleryData = require('../../utils/gallery-data')
var progress = require('../../utils/progress')

var HOME_BG = 'images/home-bg.jpg'
var HOME_HERO = 'images/home-hero.png'
var ICON_RANK = 'images/icons/rank.png'
var ICON_LEVEL = 'images/icons/level.png'
var ICON_GALLERY = 'images/icons/gallery.png'

// 底部按钮尺寸
var SIDE_BTN_SIZE_RPX = 140
var MAIN_BTN_W_RPX = 350
var MAIN_BTN_H_RPX = 170
var BOTTOM_BAR_TOP_GAP_RPX = 8
function bottomBarHeightRpx() {
  return Math.max(SIDE_BTN_SIZE_RPX, MAIN_BTN_H_RPX) + BOTTOM_BAR_TOP_GAP_RPX
}

// 按钮栏与屏幕底部的距离（只影响按钮位置）
var BOTTOM_BAR_BOTTOM_PADDING_RPX = 100
// hero 居中区域距屏幕底部的距离（只影响 hero 的居中范围，与按钮位置解耦）
var HERO_AREA_BOTTOM_PADDING_RPX = 40

// hero 上方浮层 3:4 区域（宽:高 = 3:4，叠在 hero 顶部，距 hero 左/右/上 等距）
var TOP_AREA_INSET_RPX = 32      // 距 hero 左/右/上 三边的统一内缩

function HomeScreen() {
  BaseScreen.call(this)
  this.showRank = false
  this.rankTab = 'friends'
  this.rankScrollY = 0
  this._rankDrag = null
  this._sideButtonRects = {}
}
HomeScreen.prototype = Object.create(BaseScreen.prototype)
HomeScreen.prototype.constructor = HomeScreen

HomeScreen.prototype.onEnter = function (manager) {
  BaseScreen.prototype.onEnter.call(this, manager)
}

HomeScreen.prototype.onResume = function () {
  this.showRank = false
}

// ---------------------------------------------------------------------------
//  渲染
// ---------------------------------------------------------------------------

HomeScreen.prototype.render = function (ctx) {
  var W = rpx.windowWidth()
  var H = rpx.windowHeight()

  this.resetHitZones()

  // 背景
  var bg = assets.get(HOME_BG)
  if (bg) {
    draw.drawImageCover(ctx, bg, 0, 0, W, H)
  } else {
    ctx.fillStyle = '#5b6fd8'
    ctx.fillRect(0, 0, W, H)
  }

  // 顶部渐变蒙版（贴边的可读性）
  var grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, 'rgba(0,0,0,0.05)')
  grad.addColorStop(0.45, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(0,0,0,0.35)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // 顶部品牌
  var topY = rpx.safeTop() + rpx.rpx(16)
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = rpx.rpx(16)
  ctx.shadowOffsetY = rpx.rpx(4)
  draw.fillTextCentered(
    ctx, '吉吉拼图', W / 2, topY + rpx.rpx(24),
    '700 ' + rpx.rpx(48).toFixed(0) + 'px sans-serif', '#ffffff'
  )
  ctx.restore()

  // 中部主视觉：固定长宽比 5:7，在「品牌文字下方」到「hero 区底边」之间居中
  var brandBottom = rpx.safeTop() + rpx.rpx(80)
  var heroAreaBottom =
    H - rpx.safeBottom() - rpx.rpx(HERO_AREA_BOTTOM_PADDING_RPX) - rpx.rpx(bottomBarHeightRpx())
  var heroAreaW = W - rpx.rpx(48)
  var heroAreaH = Math.max(rpx.rpx(200), heroAreaBottom - brandBottom)
  var heroX = 0, heroY = 0, heroW = 0, heroH = 0
  var hero = assets.get(HOME_HERO)
  if (hero) {
    var HERO_ASPECT = 5 / 7
    if (heroAreaW / heroAreaH > HERO_ASPECT) {
      heroH = heroAreaH
      heroW = heroH * HERO_ASPECT
    } else {
      heroW = heroAreaW
      heroH = heroW / HERO_ASPECT
    }
    heroX = (W - heroW) / 2
    heroY = brandBottom + (heroAreaH - heroH) / 2
    ctx.drawImage(hero, heroX, heroY, heroW, heroH)
  }

  // hero 上方浮层 3:4 区域（叠在 hero 顶部，距 hero 左/右/上 等距）
  if (heroW > 0) {
    var inset = rpx.rpx(TOP_AREA_INSET_RPX)
    var topAreaX = heroX + inset
    var topAreaY = heroY + inset
    var topAreaW = heroW - inset * 2
    var topAreaH = topAreaW * 4 / 3
    this._drawTopArea(ctx, topAreaX, topAreaY, topAreaW, topAreaH)

    // 主题名：在 3:4 拼图区底边 → hero 底边 之间的缝隙垂直居中
    var next = progress.getNextLevel(galleryData.THEMES)
    if (next && next.theme) {
      var gapTop = topAreaY + topAreaH
      var gapBottom = heroY + heroH
      if (gapBottom > gapTop) {
        var labelY = (gapTop + gapBottom) / 2
        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.45)'
        ctx.shadowBlur = rpx.rpx(8)
        ctx.shadowOffsetY = rpx.rpx(2)
        draw.fillTextCenteredSpacing(
          ctx, next.theme.name, heroX + heroW / 2, labelY,
          '700 ' + rpx.rpx(48).toFixed(0) + 'px sans-serif', '#663f1f',
          rpx.rpx(8)
        )
        ctx.restore()
      }
    }
  }

  // 底部三按钮
  this._drawBottomBar(ctx, W, H)

  // 排行榜弹窗
  if (this.showRank) {
    this._drawRankModal(ctx, W, H)
  }
}

/**
 * hero 上方 3:4 区域：
 *   - 当前主题图（cover 填满，3:4）
 *   - 上叠 4×4 拼图分块网格线（白色细描边）
 *   - 区域下方居中显示主题名
 */
HomeScreen.prototype._drawTopArea = function (ctx, x, y, w, h) {
  var next = progress.getNextLevel(galleryData.THEMES)
  var theme = next && next.theme ? next.theme : null

  ctx.save()
  // 圆角裁剪 + 占位底色（图未加载时显示）
  draw.roundedRectPath(ctx, x, y, w, h, rpx.rpx(24))
  ctx.clip()
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.fillRect(x, y, w, h)

  // 主题图
  var themeImg = null
  if (theme && theme.themeImage) {
    themeImg = assets.get(theme.themeImage)
    if (!themeImg) assets.load(theme.themeImage)
  }
  if (themeImg) {
    draw.drawImageCover(ctx, themeImg, x, y, w, h)
  } else if (theme) {
    // fallback：用主题卡片图
    var fallback = assets.get(galleryData.THEME_CARD_UNLOCKED)
    if (fallback) draw.drawImageCover(ctx, fallback, x, y, w, h)
  }

  // 4×4 拼图分块网格
  this._drawPuzzleGrid(ctx, x, y, w, h, 4, 4)
  ctx.restore()

  // 外圈细描边
  draw.strokeRoundedRect(
    ctx, x + 0.5, y + 0.5, w - 1, h - 1,
    rpx.rpx(24), 'rgba(255,255,255,0.16)', 1
  )
}

/**
 * 在指定矩形上叠加 cols×rows 的「带半圆凸起」的拼图块分隔线（经典 jigsaw 样式）。
 * 每条内部分割线在每格中点带一个半圆凸/凹，朝向用确定性伪随机决定（不会闪烁）。
 */
HomeScreen.prototype._drawPuzzleGrid = function (ctx, x, y, w, h, cols, rows) {
  var cellW = w / cols
  var cellH = h / rows
  var knobR = Math.min(cellW, cellH) * 0.16  // 凸起半径占格子的比例
  var lineW = Math.max(1, rpx.rpx(2))

  function dir(r, c, type) {
    // 稳定伪随机，相同 (r,c,type) 总返回相同值
    var hash = (r * 7 + c * 13 + (type === 'v' ? 1 : 17)) % 4
    return hash < 2 ? 1 : -1
  }

  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = lineW
  ctx.lineJoin = 'round'

  // 垂直内部线（每条按 rows 段，每段中点带半圆）
  for (var c = 0; c < cols - 1; c++) {
    var lineX = x + cellW * (c + 1)
    ctx.beginPath()
    ctx.moveTo(lineX, y)
    for (var r = 0; r < rows; r++) {
      var top = y + cellH * r
      var midY = top + cellH / 2
      ctx.lineTo(lineX, midY - knobR)
      // d=1 → 凸向右(顺时针)；d=-1 → 凸向左(逆时针)
      var dv = dir(r, c, 'v')
      ctx.arc(lineX, midY, knobR, -Math.PI / 2, Math.PI / 2, dv === -1)
      ctx.lineTo(lineX, top + cellH)
    }
    ctx.stroke()
  }

  // 水平内部线
  for (var rh = 0; rh < rows - 1; rh++) {
    var lineY = y + cellH * (rh + 1)
    ctx.beginPath()
    ctx.moveTo(x, lineY)
    for (var cc = 0; cc < cols; cc++) {
      var left = x + cellW * cc
      var midX = left + cellW / 2
      ctx.lineTo(midX - knobR, lineY)
      // dh=1 → 凸向下(逆时针)；dh=-1 → 凸向上(顺时针)
      var dh = dir(rh, cc, 'h')
      ctx.arc(midX, lineY, knobR, Math.PI, 0, dh === 1)
      ctx.lineTo(left + cellW, lineY)
    }
    ctx.stroke()
  }

  ctx.restore()
}

HomeScreen.prototype._drawBottomBar = function (ctx, W, H) {
  var sideSize = rpx.rpx(SIDE_BTN_SIZE_RPX)
  var mainW = rpx.rpx(MAIN_BTN_W_RPX)
  var mainH = rpx.rpx(MAIN_BTN_H_RPX)
  var paddingX = rpx.rpx(20)
  var paddingBottom = rpx.safeBottom() + rpx.rpx(BOTTOM_BAR_BOTTOM_PADDING_RPX)
  var barTop = H - paddingBottom - mainH - rpx.rpx(BOTTOM_BAR_TOP_GAP_RPX)

  var mainCx = W / 2
  var mainCy = barTop + mainH / 2

  // 左：排行
  var leftCx = paddingX + sideSize / 2 + rpx.rpx(8)
  var leftCy = mainCy
  this._drawCircleIcon(ctx, ICON_RANK, leftCx, leftCy, sideSize)
  var leftRect = {
    x: leftCx - sideSize / 2, y: leftCy - sideSize / 2,
    w: sideSize, h: sideSize
  }
  this._sideButtonRects.rank = leftRect
  var self = this
  this.addHitZone(leftRect, function () { self._openRank() })

  // 右：图集
  var rightCx = W - paddingX - sideSize / 2 - rpx.rpx(8)
  var rightCy = mainCy
  this._drawCircleIcon(ctx, ICON_GALLERY, rightCx, rightCy, sideSize)
  var rightRect = {
    x: rightCx - sideSize / 2, y: rightCy - sideSize / 2,
    w: sideSize, h: sideSize
  }
  this._sideButtonRects.gallery = rightRect
  this.addHitZone(rightRect, function () { self._openGallery() })

  // 中：关卡 N（下一关）
  var icon = assets.get(ICON_LEVEL)
  if (icon) {
    ctx.drawImage(icon, mainCx - mainW / 2, mainCy - mainH / 2, mainW, mainH)
  }
  var nextLevelNum = progress.countAllCompleted(galleryData.THEMES) + 1
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = rpx.rpx(8)
  ctx.shadowOffsetY = rpx.rpx(2)
  draw.fillTextCentered(
    ctx, '关卡' + nextLevelNum, mainCx, mainCy,
    '700 ' + rpx.rpx(56).toFixed(0) + 'px sans-serif', '#ffffff'
  )
  ctx.restore()
  var mainRect = {
    x: mainCx - mainW / 2, y: mainCy - mainH / 2,
    w: mainW, h: mainH
  }
  this.addHitZone(mainRect, function () { self._startPuzzle() })
}

HomeScreen.prototype._drawCircleIcon = function (ctx, src, cx, cy, size) {
  var img = assets.get(src)
  if (img) {
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size)
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.beginPath()
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ---------------------------------------------------------------------------
//  排行榜
// ---------------------------------------------------------------------------

HomeScreen.prototype._drawRankModal = function (ctx, W, H) {
  // 遮罩 — 点遮罩外可关闭
  ctx.fillStyle = 'rgba(30,30,50,0.55)'
  ctx.fillRect(0, 0, W, H)
  var self = this
  this.addHitZone({ x: 0, y: 0, w: W, h: H }, function () { self._closeRank() })

  var padX = rpx.rpx(32)
  var padY = rpx.rpx(48) + rpx.safeTop() * 0.2
  var modalX = padX
  var modalY = padY
  var modalW = W - padX * 2
  var modalH = H - padY * 2 - rpx.safeBottom()
  draw.fillRoundedRect(ctx, modalX, modalY, modalW, modalH, rpx.rpx(28), '#e8f2ef')

  // 拦截点击穿透：注册一个空 hit zone 覆盖弹窗本身
  this.addHitZone({ x: modalX, y: modalY, w: modalW, h: modalH }, function () {})

  // 标题
  draw.fillTextCentered(
    ctx, '排行', modalX + modalW / 2, modalY + rpx.rpx(48),
    '600 ' + rpx.rpx(34).toFixed(0) + 'px sans-serif', '#3d5a52'
  )

  // 关闭按钮
  var closeX = modalX + modalW - rpx.rpx(48)
  var closeY = modalY + rpx.rpx(48)
  draw.fillTextCentered(
    ctx, '×', closeX, closeY,
    '400 ' + rpx.rpx(44).toFixed(0) + 'px sans-serif', '#7a9a90'
  )
  var closeRect = {
    x: closeX - rpx.rpx(32), y: closeY - rpx.rpx(32),
    w: rpx.rpx(64), h: rpx.rpx(64)
  }
  this.addHitZone(closeRect, function () { self._closeRank() })

  // Tabs
  var tabsY = modalY + rpx.rpx(96)
  var tabsX = modalX + rpx.rpx(28)
  var tabsW = modalW - rpx.rpx(56)
  var tabsH = rpx.rpx(72)
  draw.fillRoundedRect(ctx, tabsX, tabsY, tabsW, tabsH, rpx.rpx(36), '#d8ebe5')
  var tabW = tabsW / 2
  // active 背景
  var activeIdx = this.rankTab === 'national' ? 1 : 0
  draw.fillRoundedRect(
    ctx,
    tabsX + activeIdx * tabW + rpx.rpx(6),
    tabsY + rpx.rpx(6),
    tabW - rpx.rpx(12),
    tabsH - rpx.rpx(12),
    rpx.rpx(30),
    '#ffffff'
  )
  draw.fillTextCentered(
    ctx, '好友', tabsX + tabW / 2, tabsY + tabsH / 2,
    (activeIdx === 0 ? '600 ' : '400 ') + rpx.rpx(26).toFixed(0) + 'px sans-serif',
    activeIdx === 0 ? '#3d5a52' : '#6d8f84'
  )
  draw.fillTextCentered(
    ctx, '全国', tabsX + tabW + tabW / 2, tabsY + tabsH / 2,
    (activeIdx === 1 ? '600 ' : '400 ') + rpx.rpx(26).toFixed(0) + 'px sans-serif',
    activeIdx === 1 ? '#3d5a52' : '#6d8f84'
  )
  this.addHitZone(
    { x: tabsX, y: tabsY, w: tabW, h: tabsH },
    function () { self._switchTab('friends') }
  )
  this.addHitZone(
    { x: tabsX + tabW, y: tabsY, w: tabW, h: tabsH },
    function () { self._switchTab('national') }
  )

  // 我的排名（贴底）
  var myH = rpx.rpx(140)
  var myMarginX = rpx.rpx(20)
  var myY = modalY + modalH - myH - rpx.rpx(20)
  draw.fillRoundedRect(
    ctx, modalX + myMarginX, myY,
    modalW - myMarginX * 2, myH,
    rpx.rpx(20), '#6da896'
  )
  var my = rankData.getMyRank(this.rankTab)
  draw.fillTextLeft(
    ctx, '我的排名', modalX + myMarginX + rpx.rpx(24),
    myY + rpx.rpx(24),
    '400 ' + rpx.rpx(20).toFixed(0) + 'px sans-serif',
    'rgba(255,255,255,0.75)'
  )
  draw.fillTextLeft(
    ctx, '第 ' + my.rank + ' 名',
    modalX + myMarginX + rpx.rpx(24),
    myY + rpx.rpx(60),
    '700 ' + rpx.rpx(32).toFixed(0) + 'px sans-serif', '#ffffff'
  )
  draw.fillTextLeft(
    ctx, my.name + ' · ' + my.levels + '关 · ' + my.time,
    modalX + myMarginX + rpx.rpx(24),
    myY + rpx.rpx(100),
    '400 ' + rpx.rpx(22).toFixed(0) + 'px sans-serif', 'rgba(255,255,255,0.9)'
  )

  // 列表区裁剪
  var listY = tabsY + tabsH + rpx.rpx(16)
  var listBottom = myY - rpx.rpx(16)
  var listH = Math.max(rpx.rpx(120), listBottom - listY)

  ctx.save()
  ctx.beginPath()
  ctx.rect(modalX, listY, modalW, listH)
  ctx.clip()

  var fullList = rankData.getLeaderboard(this.rankTab)
  var top3 = fullList.slice(0, 3)

  // 滚动内容容器
  var contentY = listY - this.rankScrollY

  // 领奖台
  var podiumY = contentY
  var podiumH = rpx.rpx(180)
  this._drawPodium(ctx, modalX, podiumY, modalW, podiumH, top3)

  // 列表
  var rowsTopY = podiumY + podiumH + rpx.rpx(8)
  var rowX = modalX + rpx.rpx(20)
  var rowW = modalW - rpx.rpx(40)
  var rowH = rpx.rpx(88)

  // 列表整体卡片底色
  var rowsCount = 0
  for (var ri = 0; ri < fullList.length; ri++) {
    if (fullList[ri].rank > 3) rowsCount++
  }
  var rowsBlockH = rowsCount * rowH
  draw.fillRoundedRect(ctx, rowX, rowsTopY, rowW, rowsBlockH, rpx.rpx(20), '#ffffff')

  var rowY = rowsTopY
  for (var i = 0; i < fullList.length; i++) {
    var item = fullList[i]
    if (item.rank <= 3) continue
    this._drawRankRow(ctx, item, rowX, rowY, rowW, rowH)
    rowY += rowH
  }

  ctx.restore()

  // 计算可滚动范围
  var contentHeight = (podiumH + rpx.rpx(8) + rowsBlockH)
  this._rankMaxScroll = Math.max(0, contentHeight - listH)
  this._rankListRect = { x: modalX, y: listY, w: modalW, h: listH }
}

HomeScreen.prototype._drawPodium = function (ctx, x, y, w, h, top3) {
  var slotW = w / 3
  var slotMaxBarH = h - rpx.rpx(56)
  var bar1 = slotMaxBarH
  var bar2 = slotMaxBarH * 0.75
  var bar3 = slotMaxBarH * 0.55

  var slots = [
    { idx: 1, barH: bar2, opacity: 0.8 },
    { idx: 0, barH: bar1, opacity: 1 },
    { idx: 2, barH: bar3, opacity: 0.6 }
  ]
  var medals = ['🥇', '🥈', '🥉']
  for (var i = 0; i < slots.length; i++) {
    var s = slots[i]
    var cx = x + slotW * i + slotW / 2
    var bottomY = y + h
    var barTop = bottomY - s.barH
    var barW = slotW * 0.5
    ctx.fillStyle = 'rgba(109, 168, 150, ' + s.opacity + ')'
    ctx.fillRect(cx - barW / 2, barTop, barW, s.barH)
    var t = top3[s.idx]
    if (t) {
      draw.fillTextCentered(
        ctx, medals[s.idx], cx, barTop - rpx.rpx(40),
        '400 ' + rpx.rpx(s.idx === 0 ? 44 : 36).toFixed(0) + 'px sans-serif', '#000'
      )
      draw.fillTextCentered(
        ctx, t.name, cx, barTop + rpx.rpx(18),
        '600 ' + rpx.rpx(22).toFixed(0) + 'px sans-serif', '#3d5a52'
      )
      draw.fillTextCentered(
        ctx, t.levels + '关', cx, barTop + rpx.rpx(46),
        '400 ' + rpx.rpx(20).toFixed(0) + 'px sans-serif', '#7a9a90'
      )
    }
  }
}

HomeScreen.prototype._drawRankRow = function (ctx, item, x, y, w, h) {
  var padX = rpx.rpx(20)
  draw.fillTextCentered(
    ctx, '' + item.rank, x + padX + rpx.rpx(12), y + h / 2,
    '600 ' + rpx.rpx(26).toFixed(0) + 'px sans-serif', '#8aa89c'
  )
  var avatarX = x + padX + rpx.rpx(44)
  ctx.fillStyle = '#d8ebe5'
  ctx.beginPath()
  ctx.arc(avatarX + rpx.rpx(28), y + h / 2, rpx.rpx(28), 0, Math.PI * 2)
  ctx.fill()
  draw.fillTextCentered(
    ctx, '' + item.rank, avatarX + rpx.rpx(28), y + h / 2,
    '600 ' + rpx.rpx(22).toFixed(0) + 'px sans-serif', '#5c8a7a'
  )
  var textX = avatarX + rpx.rpx(72)
  draw.fillTextLeft(
    ctx, item.name, textX, y + h / 2 - rpx.rpx(14),
    '600 ' + rpx.rpx(26).toFixed(0) + 'px sans-serif', '#3d5a52'
  )
  draw.fillTextLeft(
    ctx, item.levels + '关 · ' + item.time, textX, y + h / 2 + rpx.rpx(16),
    '400 ' + rpx.rpx(22).toFixed(0) + 'px sans-serif', '#8aa89c'
  )
  // 分隔线
  ctx.strokeStyle = '#eef5f2'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x + padX, y + h - 0.5)
  ctx.lineTo(x + w - padX, y + h - 0.5)
  ctx.stroke()
}

// ---------------------------------------------------------------------------
//  事件
// ---------------------------------------------------------------------------

HomeScreen.prototype.onTouchStart = function (e) {
  var t = this._firstTouch(e)
  if (!t) return

  if (this.showRank && this._rankListRect &&
    t.y >= this._rankListRect.y && t.y <= this._rankListRect.y + this._rankListRect.h &&
    t.x >= this._rankListRect.x && t.x <= this._rankListRect.x + this._rankListRect.w) {
    this._rankDrag = {
      startY: t.y,
      startScroll: this.rankScrollY,
      moved: false
    }
    return
  }
  this._tapStart = { x: t.x, y: t.y }
}

HomeScreen.prototype.onTouchMove = function (e) {
  if (!this._rankDrag) return
  var t = this._firstTouch(e)
  if (!t) return
  var dy = t.y - this._rankDrag.startY
  if (Math.abs(dy) > 4) this._rankDrag.moved = true
  var next = this._rankDrag.startScroll - dy
  if (next < 0) next = 0
  if (next > (this._rankMaxScroll || 0)) next = this._rankMaxScroll || 0
  this.rankScrollY = next
}

HomeScreen.prototype.onTouchEnd = function (e) {
  var t = this._firstTouch(e)
  if (!t) return

  if (this._rankDrag) {
    var drag = this._rankDrag
    this._rankDrag = null
    if (drag.moved) return
  }

  var zone = this.hitZoneAt(t.x, t.y)
  if (zone && zone.handler) zone.handler()
}

HomeScreen.prototype.onTouchCancel = function () {
  this._rankDrag = null
}

// ---------------------------------------------------------------------------
//  动作
// ---------------------------------------------------------------------------

HomeScreen.prototype._openRank = function () {
  this.showRank = true
  this.rankScrollY = 0
}
HomeScreen.prototype._closeRank = function () {
  this.showRank = false
}
HomeScreen.prototype._switchTab = function (tab) {
  if (tab === this.rankTab) return
  this.rankTab = tab
  this.rankScrollY = 0
}
HomeScreen.prototype._openGallery = function () {
  var GalleryScreen = require('./gallery-screen')
  this.manager.push(new GalleryScreen())
}
HomeScreen.prototype._startPuzzle = function () {
  var PuzzleScreen = require('./puzzle-screen')
  var next = progress.getNextLevel(galleryData.THEMES)
  if (!next || !next.level) return
  var lv = next.level
  this.manager.push(new PuzzleScreen({
    image: lv.image,
    grid: lv.grid || galleryData.DEFAULT_GRID,
    levelKey: lv.key,
    levelLabel: '关卡' + (next.globalIndex + 1)
  }))
}

module.exports = HomeScreen
