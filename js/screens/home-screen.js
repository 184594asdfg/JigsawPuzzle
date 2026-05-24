/**
 * 首页：全屏背景 + 主视觉 + 底部三按钮（排行 / 开始 / 图集），及排行榜弹窗。
 */
var BaseScreen = require('./base-screen')
var rpx = require('../rpx')
var assets = require('../assets')
var draw = require('../draw')
var settingsModal = require('../settings-modal')
var rankData = require('../../utils/rank-data')
var galleryData = require('../../utils/gallery-data')
var progress = require('../../utils/progress')

var HOME_BG = 'images/home-bg.jpg'
var HOME_HERO = 'images/home-hero.png'
var ICON_RANK = 'images/icons/rank.png'
var ICON_LEVEL = 'images/icons/level.png'
var ICON_GALLERY = 'images/icons/gallery.png'

// 底部侧钮尺寸（排行 / 图库）
var SIDE_BTN_W_RPX = 110
var SIDE_BTN_H_RPX = 115
/** 排行 / 图库相对中间关卡按钮的垂直下移（rpx），可分别调 */
var SIDE_BTN_RANK_OFFSET_Y_RPX = 5
var SIDE_BTN_GALLERY_OFFSET_Y_RPX = 12
/** 侧钮与关卡按钮外缘的水平间距（rpx），越小越靠近中间 */
var SIDE_BTN_GAP_FROM_MAIN_RPX = 16
var MAIN_BTN_W_RPX = 360
var MAIN_BTN_H_RPX = 138
var BOTTOM_BAR_TOP_GAP_RPX = 8

// 按钮栏与屏幕底部的距离（只影响按钮位置）
var BOTTOM_BAR_BOTTOM_PADDING_RPX = 100
// hero 底边与底部按钮区顶边的间距
var HERO_ABOVE_BAR_GAP_RPX = 0

var BRAND_TITLE_TOP_RPX = 16
var BRAND_AREA_BOTTOM_RPX = 80
var HERO_AREA_H_PAD_RPX = 130
var HERO_AREA_MIN_H_RPX = 100
var HERO_ASPECT = 5 / 7
/** hero 相对垂直居中的额外下移（rpx） */
var HERO_OFFSET_Y_RPX = 20
var NAV_BAR_H_RPX = 88
// hero 上方浮层 3:4 区域（叠在 hero 顶部，距 hero 左/右/上 等距）
var TOP_AREA_INSET_RPX = 32

function getBottomBarMetrics(H) {
  var sideW = rpx.rpx(SIDE_BTN_W_RPX)
  var sideH = rpx.rpx(SIDE_BTN_H_RPX)
  var mainH = rpx.rpx(MAIN_BTN_H_RPX)
  var paddingBottom = rpx.safeBottom() + rpx.rpx(BOTTOM_BAR_BOTTOM_PADDING_RPX)
  var barTop = H - paddingBottom - mainH - rpx.rpx(BOTTOM_BAR_TOP_GAP_RPX)
  var mainCy = barTop + mainH / 2
  var visualTop = Math.min(
    barTop,
    mainCy + rpx.rpx(SIDE_BTN_RANK_OFFSET_Y_RPX) - sideH / 2
  )
  return {
    barTop: barTop,
    visualTop: visualTop,
    mainH: mainH,
    sideW: sideW,
    sideH: sideH,
    paddingBottom: paddingBottom,
    mainCy: mainCy
  }
}

/**
 * 首页布局（各机型共用）：先算顶/底锚点，再在中间区域 fit hero。
 * @returns {object} brand, heroArea, hero, topArea, themeLabel, bottomBar, nav
 */
function layoutHome(W, H) {
  var bar = getBottomBarMetrics(H)
  var mainW = rpx.rpx(MAIN_BTN_W_RPX)

  var brandTop = rpx.safeTop() + rpx.rpx(BRAND_TITLE_TOP_RPX)
  var brandBottom = rpx.safeTop() + rpx.rpx(BRAND_AREA_BOTTOM_RPX)
  var heroAreaBottom = bar.visualTop - rpx.rpx(HERO_ABOVE_BAR_GAP_RPX)
  var heroAreaPad = rpx.rpx(HERO_AREA_H_PAD_RPX)
  var heroAreaX = heroAreaPad / 2
  var heroAreaW = W - heroAreaPad
  var heroAreaH = Math.max(rpx.rpx(HERO_AREA_MIN_H_RPX), heroAreaBottom - brandBottom)
  var heroAreaY = brandBottom

  var heroW, heroH
  if (heroAreaW / heroAreaH > HERO_ASPECT) {
    heroH = heroAreaH
    heroW = heroH * HERO_ASPECT
  } else {
    heroW = heroAreaW
    heroH = heroW / HERO_ASPECT
  }
  if (heroH > heroAreaH) {
    heroH = heroAreaH
    heroW = heroH * HERO_ASPECT
  }
  if (heroW > heroAreaW) {
    heroW = heroAreaW
    heroH = heroW / HERO_ASPECT
  }
  var heroX = (W - heroW) / 2
  var heroY = brandBottom + Math.max(0, (heroAreaH - heroH) / 2) + rpx.rpx(HERO_OFFSET_Y_RPX)
  var heroYMax = brandBottom + heroAreaH - heroH
  if (heroY > heroYMax) heroY = heroYMax

  var inset = rpx.rpx(TOP_AREA_INSET_RPX)
  var topAreaX = heroX + inset
  var topAreaY = heroY + inset
  var topAreaW = Math.max(0, heroW - inset * 2)
  var topAreaH = topAreaW * 4 / 3

  var mainCx = W / 2
  var mainCy = bar.mainCy
  var rankCy = mainCy + rpx.rpx(SIDE_BTN_RANK_OFFSET_Y_RPX)
  var galleryCy = mainCy + rpx.rpx(SIDE_BTN_GALLERY_OFFSET_Y_RPX)
  var halfMainW = mainW / 2
  var halfMainH = bar.mainH / 2
  var halfSideW = bar.sideW / 2
  var halfSideH = bar.sideH / 2
  var sideGap = rpx.rpx(SIDE_BTN_GAP_FROM_MAIN_RPX)
  var mainLeft = mainCx - halfMainW
  var mainRight = mainCx + halfMainW
  var leftCx = mainLeft - sideGap - halfSideW
  var rightCx = mainRight + sideGap + halfSideW

  return {
    W: W,
    H: H,
    brand: {
      titleY: brandTop + rpx.rpx(24),
      top: brandTop,
      bottom: brandBottom
    },
    heroArea: { x: heroAreaX, y: heroAreaY, w: heroAreaW, h: heroAreaH },
    hero: { x: heroX, y: heroY, w: heroW, h: heroH },
    topArea: { x: topAreaX, y: topAreaY, w: topAreaW, h: topAreaH },
    themeLabel: {
      centerX: heroX + heroW / 2,
      gapTop: topAreaY + topAreaH,
      gapBottom: heroY + heroH,
      y: (topAreaY + topAreaH + heroY + heroH) / 2
    },
    bottomBar: {
      barTop: bar.barTop,
      visualTop: bar.visualTop,
      mainBtn: {
        x: mainCx - halfMainW, y: mainCy - halfMainH,
        w: mainW, h: bar.mainH, cx: mainCx, cy: mainCy
      },
      rankBtn: {
        x: leftCx - halfSideW, y: rankCy - halfSideH,
        w: bar.sideW, h: bar.sideH, cx: leftCx, cy: rankCy
      },
      galleryBtn: {
        x: rightCx - halfSideW, y: galleryCy - halfSideH,
        w: bar.sideW, h: bar.sideH, cx: rightCx, cy: galleryCy
      }
    },
    nav: { y: rpx.safeTop(), h: rpx.rpx(NAV_BAR_H_RPX) }
  }
}

function HomeScreen() {
  BaseScreen.call(this)
  this.showRank = false
  this.showSettings = false
  this.rankTab = 'friends'
  this.rankScrollY = 0
  this._rankDrag = null
  this._sideButtonRects = {}
}
HomeScreen.prototype = Object.create(BaseScreen.prototype)
HomeScreen.prototype.constructor = HomeScreen

HomeScreen.prototype.onEnter = function (manager) {
  BaseScreen.prototype.onEnter.call(this, manager)
  settingsModal.preload()
}

HomeScreen.prototype.onResume = function () {
  this.showRank = false
  this.showSettings = false
  progress.loadFromServer()
}

// ---------------------------------------------------------------------------
//  渲染
// ---------------------------------------------------------------------------

HomeScreen.prototype.render = function (ctx) {
  var W = rpx.windowWidth()
  var H = rpx.windowHeight()
  var layout = layoutHome(W, H)

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
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = rpx.rpx(16)
  ctx.shadowOffsetY = rpx.rpx(4)
  draw.fillTextCentered(
    ctx, '吉吉拼图', W / 2, layout.brand.titleY,
    '700 ' + rpx.rpx(48).toFixed(0) + 'px sans-serif', '#ffffff'
  )
  ctx.restore()

  var heroRect = layout.hero
  var hero = assets.get(HOME_HERO)
  if (hero && heroRect.w > 0) {
    ctx.drawImage(hero, heroRect.x, heroRect.y, heroRect.w, heroRect.h)
  }

  var topArea = layout.topArea
  if (heroRect.w > 0 && topArea.w > 0) {
    this._drawTopArea(ctx, topArea.x, topArea.y, topArea.w, topArea.h)

    var next = progress.getNextLevel(galleryData.getThemes())
    var label = layout.themeLabel
    if (next && next.theme && label.gapBottom > label.gapTop) {
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.45)'
      ctx.shadowBlur = rpx.rpx(8)
      ctx.shadowOffsetY = rpx.rpx(2)
      draw.fillTextCenteredSpacing(
        ctx, next.theme.name, label.centerX, label.y,
        '700 ' + rpx.rpx(48).toFixed(0) + 'px sans-serif', '#663f1f',
        rpx.rpx(8)
      )
      ctx.restore()
    }
  }

  this._drawBottomBar(ctx, layout)

  // 排行榜弹窗
  if (this.showRank) {
    this._drawRankModal(ctx, W, H)
  }

  if (this.showSettings) {
    this._drawSettingsModal(ctx, W, H)
  }

  // 设置图标始终显示（叠在弹窗遮罩之上）
  var self = this
  settingsModal.drawNavIcon(ctx, layout.nav.y, layout.nav.h)
  if (!this.showSettings) {
    this.addHitZone(settingsModal.navHitRect(layout.nav.y, layout.nav.h, true), function () {
      self.showRank = false
      self._openSettings()
    })
  }
}

/**
 * hero 上方 3:4 区域：
 *   - 当前主题图（cover 填满，3:4）
 *   - 上叠 4×4 拼图分块网格线（白色细描边）
 *   - 区域下方居中显示主题名
 */
HomeScreen.prototype._drawTopArea = function (ctx, x, y, w, h) {
  var next = progress.getNextLevel(galleryData.getThemes())
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

HomeScreen.prototype._drawBottomBar = function (ctx, layout) {
  var main = layout.bottomBar.mainBtn
  var rank = layout.bottomBar.rankBtn
  var gallery = layout.bottomBar.galleryBtn
  var self = this

  this._drawSideIcon(ctx, ICON_RANK, rank.cx, rank.cy, rank.w, rank.h)
  this._sideButtonRects.rank = rank
  this.addHitZone(rank, function () { self._openRank() })

  this._drawSideIcon(ctx, ICON_GALLERY, gallery.cx, gallery.cy, gallery.w, gallery.h)
  this._sideButtonRects.gallery = gallery
  this.addHitZone(gallery, function () { self._openGallery() })

  var icon = assets.get(ICON_LEVEL)
  if (icon) {
    ctx.drawImage(icon, main.x, main.y, main.w, main.h)
  }
  var nextLevelNum = progress.countAllCompleted(galleryData.getThemes()) + 1
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = rpx.rpx(8)
  ctx.shadowOffsetY = rpx.rpx(2)
  draw.fillTextCentered(
    ctx, '关卡' + nextLevelNum, main.cx, main.cy,
    '700 ' + rpx.rpx(56).toFixed(0) + 'px sans-serif', '#ffffff'
  )
  ctx.restore()
  this.addHitZone(main, function () { self._startPuzzle() })
}

HomeScreen.prototype._drawSideIcon = function (ctx, src, cx, cy, w, h) {
  var img = assets.get(src)
  if (img) {
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h)
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    draw.fillRoundedRect(ctx, cx - w / 2, cy - h / 2, w, h, Math.min(w, h) * 0.2, 'rgba(255,255,255,0.18)')
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

  if (!this.showRank && !this.showSettings) {
    var navY = rpx.safeTop()
    var navH = rpx.rpx(88)
    if (settingsModal.isNavHit(navY, navH, t.x, t.y)) {
      this._pendingSettingsOpen = true
      return
    }
  }

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

  if (this._pendingSettingsOpen) {
    this._pendingSettingsOpen = false
    this.showRank = false
    this._openSettings()
    return
  }

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
  this._pendingSettingsOpen = false
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
HomeScreen.prototype._openSettings = function () {
  this.showSettings = true
  this._settingsCloseLockUntil = Date.now() + 400
}
HomeScreen.prototype._closeSettings = function () {
  if (this._settingsCloseLockUntil && Date.now() < this._settingsCloseLockUntil) return
  this.showSettings = false
  this._settingsCloseLockUntil = 0
}
HomeScreen.prototype._drawSettingsModal = function (ctx, W, H) {
  var self = this
  settingsModal.drawModal(this, ctx, W, H, {
    showActionButtons: false,
    onClose: function () { self._closeSettings() }
  })
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
  var next = progress.getNextLevel(galleryData.getThemes())
  if (!next || !next.level) return
  var lv = next.level
  this.manager.push(new PuzzleScreen({
    image: lv.image,
    grid: lv.grid || galleryData.DEFAULT_GRID,
    levelKey: lv.key,
    levelLabel: '关卡' + (next.globalIndex + 1)
  }))
}

HomeScreen.layoutHome = layoutHome
module.exports = HomeScreen
