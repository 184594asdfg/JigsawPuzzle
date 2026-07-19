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
var imageProxy = require('../../utils/image-proxy')
var progress = require('../../utils/progress')
var remoteSync = require('../../utils/remote-sync')
var prefetch = require('../../utils/prefetch')
var sfx = require('../sfx')
var pressAnim = require('../press-anim')
var jigsawShape = require('../jigsaw-shape')
var heroSliceSnap = require('../hero-slice-snap')
var shareNav = require('../share')
var gameClub = require('../game-club')
var staminaBar = require('../stamina-bar')
var staminaModal = require('../stamina-modal')
var stamina = require('../../utils/stamina')
var rankModal = require('../../utils/rank-modal')
var user = require('../../utils/user')

var HOME_BG = 'images/home-bg.jpg'
var subpackUi = require('../../utils/subpack-ui')
var HOME_HERO = subpackUi.uiPath('images/home-hero.png')
/** 5×5 拼图底图资源（设计稿 750×1000）；运行时按拼图轮廓绘交替色 + 矢量分割线 */
var HOME_HERO_GRID_BG = 'images/home-hero-grid-bg.png'
var ICON_RANK = 'images/icons/rank.png'
var ICON_LEVEL = 'images/icons/level.png'
var ICON_GALLERY = 'images/icons/gallery.png'
/** 首页底部排行入口 */
var SHOW_RANK_BTN = true

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
// hero 上方拼图预览区：设计稿 750×1000（3:4）
var TOP_AREA_W_RPX = 750
var TOP_AREA_H_RPX = 1000
var TOP_AREA_ASPECT = TOP_AREA_W_RPX / TOP_AREA_H_RPX
/** hero 内 5×5 预览格：已通过关卡数 = 显示封面碎片的块数 */
var HERO_GRID_COLS = 5
var HERO_GRID_ROWS = 5
var HERO_GRID_CELLS = HERO_GRID_COLS * HERO_GRID_ROWS
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
  var topAreaW = Math.min(rpx.rpx(TOP_AREA_W_RPX), Math.max(0, heroW - inset * 2))
  var topAreaH = topAreaW / TOP_AREA_ASPECT
  var topAreaX = heroX + (heroW - topAreaW) / 2
  var topAreaY = heroY + inset

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
  this.showStaminaModal = false
  this.rankScrollY = 0
  this._rankDrag = null
  this._sideButtonRects = {}
  this._pressAnim = null
  this._pendingSliceUnlock = null
  this._heroSliceSnap = null
  this._homeInputLockUntil = 0
}
HomeScreen.prototype = Object.create(BaseScreen.prototype)
HomeScreen.prototype.constructor = HomeScreen

HomeScreen.prototype._isInputLocked = function () {
  return this._homeInputLockUntil > 0 && Date.now() < this._homeInputLockUntil
}

HomeScreen.prototype.onEnter = function (manager) {
  BaseScreen.prototype.onEnter.call(this, manager)
  stamina.loadFromStorage()
  settingsModal.preload()
  gameClub.preload()
  staminaBar.preload()
  staminaModal.preload()
  remoteSync.syncOnEnter().then(function () {
    prefetch.prefetchHomeAssets()
  }).catch(function () {
    prefetch.prefetchHomeAssets()
  })
}

HomeScreen.prototype.onResume = function () {
  this.showRank = false
  this.showSettings = false
  this.showStaminaModal = false
  stamina.loadFromStorage()
  remoteSync.syncOnEnter().then(function () {
    prefetch.prefetchHomeAssets()
  })
}

// ---------------------------------------------------------------------------
//  更新
// ---------------------------------------------------------------------------

HomeScreen.prototype._resolveHeroTheme = function () {
  var themeId = heroSliceSnap.snapThemeId(this)
  if (themeId) {
    var t = galleryData.getThemeById(themeId)
    if (t) return t
  }
  return progress.getHeroDisplayTheme(galleryData.getThemes())
}

HomeScreen.prototype._getThemeCoverUrl = function (theme) {
  if (!theme) return ''
  return imageProxy.resolveThemeCoverUrl(theme)
}

HomeScreen.prototype._tryStartSliceSnap = function (layout) {
  var pending = this._pendingSliceUnlock
  if (!pending || pending.cellIndex < 0) return
  var top = layout.topArea
  if (!top || top.w <= 0) return

  var theme = galleryData.getThemeById(pending.themeId)
  var coverUrl = this._getThemeCoverUrl(theme)
  var themeImg = coverUrl ? assets.get(coverUrl) : null
  if (!themeImg) {
    if (coverUrl) assets.tryLoad(coverUrl)
    return
  }

  var W = layout.W
  var H = layout.H
  heroSliceSnap.start(this, {
    cellIndex: pending.cellIndex,
    topArea: top,
    cols: HERO_GRID_COLS,
    rows: HERO_GRID_ROWS,
    fromX: W / 2,
    fromY: H / 2,
    coverImg: themeImg,
    themeId: pending.themeId
  })
  this._pendingSliceUnlock = null
}

HomeScreen.prototype.update = function (dt) {
  if (this.showSettings) settingsModal.tickSettingsEnter(this, dt)
  if (this.showRank) rankModal.tickEnter(this, dt)
  if (this.showStaminaModal) staminaModal.tickEnter(this, dt)
  heroSliceSnap.tick(this)
  var tick = pressAnim.tickPressAnim(this._pressAnim, dt)
  this._pressAnim = tick.anim
  if (!tick.completed) return
  if (heroSliceSnap.isAnimating(this) || this._isInputLocked()) return
  var id = tick.id
  if (id === 'settings') this._openSettings()
  else if (id === 'rank') this._openRank()
  else if (id === 'share') shareNav.shareToFriend()
  else if (id === 'gameClub') gameClub.openGameClub()
  else if (id === 'gallery') this._openGallery()
  else if (id === 'main') this._startPuzzle()
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

  var heroRect = layout.hero
  var hero = assets.get(HOME_HERO)
  if (!hero) {
    assets.tryLoad(HOME_HERO)
    hero = assets.get(HOME_HERO)
  }
  if (hero && heroRect.w > 0) {
    ctx.drawImage(hero, heroRect.x, heroRect.y, heroRect.w, heroRect.h)
  }

  var topArea = layout.topArea
  if (heroRect.w > 0 && topArea.w > 0) {
    if (this._pendingSliceUnlock && !heroSliceSnap.isAnimating(this)) {
      this._tryStartSliceSnap(layout)
    }
    this._drawTopArea(ctx, topArea.x, topArea.y, topArea.w, topArea.h)
    heroSliceSnap.render(ctx, this)

    var theme = this._resolveHeroTheme()
    var label = layout.themeLabel
    if (theme && label.gapBottom > label.gapTop) {
      draw.fillTextCenteredSpacing(
        ctx, theme.name, label.centerX, label.y,
        '400 ' + rpx.rpx(48).toFixed(0) + 'px sans-serif', '#663f1f',
        rpx.rpx(8)
      )
    }
  }

  this._drawBottomBar(ctx, layout)

  if (this.showSettings) {
    this._drawSettingsModal(ctx, W, H)
  }

  // 左上：设置 + 游戏圈 + 分享（排行弹窗打开时仍先绘制，由弹窗遮罩盖住）
  var self = this
  var anim = this._pressAnim
  var navY = layout.nav.y
  var navH = layout.nav.h
  settingsModal.drawNavIcon(
    ctx, navY, navH, pressAnim.btnScale(anim, 'settings')
  )
  var heroTopY = layout.topArea && layout.topArea.y > 0 ? layout.topArea.y : layout.hero.y
  gameClub.drawNavIcon(
    ctx, navY, navH, heroTopY, pressAnim.btnScale(anim, 'gameClub')
  )
  if (shareNav.SHOW_SHARE_BTN) {
    shareNav.drawNavIcon(ctx, navY, navH, heroTopY, pressAnim.btnScale(anim, 'share'))
  }

  staminaBar.drawBar(ctx, navY, navH, heroTopY, W)

  var blockNavHits = !!anim || this.showRank || this.showSettings || this.showStaminaModal ||
    heroSliceSnap.isAnimating(this) || this._isInputLocked()
  if (!blockNavHits) {
    this.addHitZone(settingsModal.navHitRect(navY, navH, true), function () {
      self.showRank = false
      self._startPressAnim('settings')
    })
    this.addHitZone(gameClub.navHitRect(navY, navH, heroTopY, true), function () {
      self.showRank = false
      self._startPressAnim('gameClub')
    })
    if (shareNav.SHOW_SHARE_BTN) {
      this.addHitZone(shareNav.navHitRect(navY, navH, heroTopY, true), function () {
        self._startPressAnim('share')
      })
    }
    var staminaRect = staminaBar.barRect(navY, navH, heroTopY, W)
    this.addHitZone(staminaBar.bodyHitRect(staminaRect, true), function () {
      self._openStaminaModal()
    })
    this.addHitZone(staminaBar.plusHitRect(staminaRect, true), function () {
      self._openStaminaModal()
    })
  }

  // 排行榜弹窗
  if (this.showRank) {
    this._drawRankModal(ctx, W, H)
  }

  // 体力弹窗 — 最上层
  if (this.showStaminaModal) {
    this._drawStaminaModal(ctx, W, H)
  }
}

/** 棋盘格底色：每格按拼图轮廓填充 #ba6f3f / #cf8653 */
HomeScreen.prototype._fillHeroGridCells = function (ctx, x, y, w, h, cols, rows) {
  var cellW = w / cols
  var cellH = h / rows
  var N = cols
  var colors = ['#ba6f3f', '#cf8653']
  var r, c, px, py
  for (r = 0; r < rows; r++) {
    for (c = 0; c < cols; c++) {
      px = x + c * cellW
      py = y + r * cellH
      ctx.save()
      jigsawShape.piecePath(ctx, px, py, cellW, cellH, c, r, N, null)
      ctx.fillStyle = colors[(r + c) % 2]
      ctx.fill()
      ctx.restore()
    }
  }
}

/** 将封面按 5×5 拼图轮廓切片（半圆凸/凹），前 sliceCount 格绘制对应区域 */
HomeScreen.prototype._drawHeroCoverSlices = function (ctx, img, x, y, w, h, cols, rows, sliceCount) {
  if (!img || sliceCount <= 0) return
  var cellW = w / cols
  var cellH = h / rows
  var N = cols
  var i, c, r, px, py
  for (i = 0; i < sliceCount; i++) {
    c = i % cols
    r = Math.floor(i / cols)
    px = x + c * cellW
    py = y + r * cellH
    ctx.save()
    jigsawShape.piecePath(ctx, px, py, cellW, cellH, c, r, N, null)
    ctx.clip()
    draw.drawImageCover(ctx, img, x, y, w, h)
    ctx.restore()
  }
}

/**
 * hero 预览：25 格底色 + 已通关 X 关则显示 X 块封面切片。
 */
HomeScreen.prototype._drawTopArea = function (ctx, x, y, w, h) {
  var theme = this._resolveHeroTheme()
  var cols = HERO_GRID_COLS
  var rows = HERO_GRID_ROWS
  var revealed = theme ? progress.countThemeCompleted(theme) : 0
  if (revealed > HERO_GRID_CELLS) revealed = HERO_GRID_CELLS
  if (heroSliceSnap.isAnimating(this) && revealed > 0) revealed -= 1

  ctx.save()
  draw.roundedRectPath(ctx, x, y, w, h, rpx.rpx(24))
  ctx.clip()
  assets.tryLoad(HOME_HERO_GRID_BG)
  this._fillHeroGridCells(ctx, x, y, w, h, cols, rows)

  var coverUrl = this._getThemeCoverUrl(theme)
  if (!coverUrl) coverUrl = prefetch.getCurrentThemeCoverUrl()
  var themeImg = coverUrl ? assets.get(coverUrl) : null
  if (!themeImg && coverUrl) assets.tryLoad(coverUrl)

  if (themeImg) {
    this._drawHeroCoverSlices(ctx, themeImg, x, y, w, h, cols, rows, revealed)
  } else if (theme && !coverUrl) {
    var fallback = assets.get(galleryData.THEME_CARD_UNLOCKED)
    if (fallback) draw.drawImageCover(ctx, fallback, x, y, w, h)
  }

  ctx.restore()

  // 外圈细描边
  draw.strokeRoundedRect(
    ctx, x + 0.5, y + 0.5, w - 1, h - 1,
    rpx.rpx(24), 'rgba(255,255,255,0.16)', 1
  )
}

HomeScreen.prototype._drawBottomBar = function (ctx, layout) {
  var main = layout.bottomBar.mainBtn
  var rank = layout.bottomBar.rankBtn
  var gallery = layout.bottomBar.galleryBtn
  var self = this
  var anim = this._pressAnim
  var blockHits = !!anim || this.showRank || this.showSettings || this.showStaminaModal ||
    heroSliceSnap.isAnimating(this) || this._isInputLocked()

  if (SHOW_RANK_BTN) {
    this._drawSideIcon(
      ctx, ICON_RANK, rank.cx, rank.cy, rank.w, rank.h, pressAnim.btnScale(anim, 'rank')
    )
    this._sideButtonRects.rank = rank
    if (!blockHits) {
      this.addHitZone(rank, function () { self._startPressAnim('rank') })
    }
  }

  this._drawSideIcon(
    ctx, ICON_GALLERY, gallery.cx, gallery.cy, gallery.w, gallery.h,
    pressAnim.btnScale(anim, 'gallery')
  )
  this._sideButtonRects.gallery = gallery
  if (!blockHits) {
    this.addHitZone(gallery, function () { self._startPressAnim('gallery') })
  }

  var mainScale = pressAnim.btnScale(anim, 'main')
  var levelLabel = progress.getMainLevelLabel(galleryData.getThemes())
  var mainBtnText = levelLabel === '再玩' ? '再玩' : ('关卡' + levelLabel)
  pressAnim.drawWithPressScale(ctx, main.cx, main.cy, mainScale, function () {
    var icon = assets.get(ICON_LEVEL)
    if (icon) {
      ctx.drawImage(icon, main.x, main.y, main.w, main.h)
    }
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = rpx.rpx(8)
    ctx.shadowOffsetY = rpx.rpx(2)
    var mainFont = levelLabel === '再玩' ? rpx.rpx(48) : rpx.rpx(56)
    draw.fillTextCentered(
      ctx, mainBtnText, main.cx, main.cy,
      '700 ' + mainFont.toFixed(0) + 'px sans-serif', '#ffffff'
    )
    ctx.restore()
  })
  if (!blockHits) {
    this.addHitZone(main, function () { self._startPressAnim('main') })
  }
}

HomeScreen.prototype._drawSideIcon = function (ctx, src, cx, cy, w, h, scale) {
  scale = scale == null ? 1 : scale
  pressAnim.drawWithPressScale(ctx, cx, cy, scale, function () {
    var img = assets.get(src)
    if (img) {
      ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h)
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      draw.fillRoundedRect(
        ctx, cx - w / 2, cy - h / 2, w, h, Math.min(w, h) * 0.2, 'rgba(255,255,255,0.18)'
      )
    }
  })
}

// ---------------------------------------------------------------------------
//  排行榜
// ---------------------------------------------------------------------------

HomeScreen.prototype._drawRankModal = function (ctx, W, H) {
  var self = this
  rankModal.draw(this, ctx, W, H, rankData, function () { self._closeRank() })
}

// ---------------------------------------------------------------------------
//  事件
// ---------------------------------------------------------------------------

HomeScreen.prototype.onTouchStart = function (e) {
  var t = this._firstTouch(e)
  if (!t) return

  if (!this.showRank && !this.showSettings && !this.showStaminaModal) {
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
    this._startPressAnim('settings')
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
  this._pressAnim = null
}

// ---------------------------------------------------------------------------
//  动作
// ---------------------------------------------------------------------------

HomeScreen.prototype._startPressAnim = function (id) {
  if (this._pressAnim) return
  if (id === 'settings' && this.showSettings) return
  if (id === 'share' && (this.showRank || this.showSettings || this.showStaminaModal)) return
  if (id === 'gameClub' && (this.showRank || this.showSettings || this.showStaminaModal)) return
  if (id !== 'settings' && id !== 'share' && id !== 'gameClub' &&
    (this.showRank || this.showSettings || this.showStaminaModal)) return
  sfx.playClick()
  this._pressAnim = { id: id, time: 0 }
}

HomeScreen.prototype._openRank = function () {
  rankModal.preload()
  rankModal.beginEnter(this)
  this.showRank = true
  this.rankScrollY = 0
  rankData.refreshNational()
}
HomeScreen.prototype._closeRank = function () {
  sfx.playClick()
  user.destroyProfileButton()
  user.clearProfileAuthorizePending()
  rankModal.clearEnter(this)
  this.showRank = false
}
HomeScreen.prototype._openSettings = function () {
  this.showSettings = true
  settingsModal.beginSettingsEnter(this)
  this._settingsCloseLockUntil = Date.now() + 400
}
HomeScreen.prototype._closeSettings = function () {
  if (this._settingsCloseLockUntil && Date.now() < this._settingsCloseLockUntil) return
  user.destroyProfileButton()
  user.clearProfileAuthorizePending()
  this.showSettings = false
  settingsModal.clearSettingsEnter(this)
  this._settingsCloseLockUntil = 0
}
HomeScreen.prototype._drawSettingsModal = function (ctx, W, H) {
  var self = this
  settingsModal.drawModal(this, ctx, W, H, {
    showActionButtons: false,
    onClose: function () { self._closeSettings() }
  })
}
HomeScreen.prototype._openGallery = function () {
  var GalleryScreen = require('./gallery-screen')
  this.manager.push(new GalleryScreen())
}
HomeScreen.prototype._openStaminaModal = function () {
  sfx.playClick()
  this.showRank = false
  this.showStaminaModal = true
  staminaModal.beginEnter(this)
}
HomeScreen.prototype._closeStaminaModal = function () {
  this.showStaminaModal = false
  staminaModal.clearEnter(this)
}
HomeScreen.prototype._drawStaminaModal = function (ctx, W, H) {
  var self = this
  staminaModal.drawModal(this, ctx, W, H, {
    onClose: function () { self._closeStaminaModal() }
  })
}
HomeScreen.prototype._startPuzzle = function () {
  var self = this
  stamina.loadFromStorage().then(function () {
    if (!stamina.canPlay()) {
      self._openStaminaModal()
      return
    }
    function openLevel(next) {
    if (!next || !next.level || !next.level.key || !next.theme) {
      try {
        wx.showToast({ title: '暂无关卡数据', icon: 'none' })
      } catch (e) {}
      return
    }
    var resolved = galleryData.resolveLevelForPlay(
      next.theme.id, next.level.key, next.level.level, next.level
    )
    function goPlay() {
      if (!resolved.image) {
        try { wx.showToast({ title: '图片地址缺失', icon: 'none' }) } catch (e) {}
        return
      }
      prefetch.enterPuzzleWhenReady(self.manager, resolved, 0)
    }
    if (resolved.image) {
      goPlay()
      return
    }
    galleryData.prefetchLevelUrls([resolved.key]).then(function (urlMap) {
      resolved.image = (urlMap && urlMap[resolved.key])
        || imageProxy.buildLevelImageUrl(resolved.key)
      if (!resolved.image) {
        return imageProxy.fetchPlayLevel(resolved.key).then(function (play) {
          if (play && play.imageUrl) resolved.image = play.imageUrl
        })
      }
    }).then(goPlay).catch(function () {
      try { wx.showToast({ title: '关卡图片加载失败', icon: 'none' }) } catch (e) {}
    })
  }

  function tryOpen() {
    var next = progress.findFirstPlayableLevel(galleryData.getThemes())
    if (!next || !next.theme) {
      openLevel(null)
      return
    }
    galleryData.ensureThemeLevels(next.theme.id).then(function () {
      openLevel(progress.findFirstPlayableLevel(galleryData.getThemes()))
    }).catch(function () {
      openLevel(next)
    })
  }

  if (!galleryData.isLoaded() || !galleryData.getThemes().length) {
    galleryData.loadThemes({ summary: true }).then(tryOpen).catch(tryOpen)
    return
  }
  tryOpen()
  })
}

/**
 * @param {{ cellIndex: number, themeId: string }|null} sliceUnlock
 * @param {{ fromWin?: boolean }|null} opts
 */
HomeScreen.create = function (sliceUnlock, opts) {
  var screen = new HomeScreen()
  if (opts && opts.fromWin) {
    screen._homeInputLockUntil = Date.now() + 700
  }
  if (sliceUnlock && sliceUnlock.cellIndex >= 0 && sliceUnlock.themeId) {
    screen._pendingSliceUnlock = {
      cellIndex: sliceUnlock.cellIndex,
      themeId: sliceUnlock.themeId
    }
  }
  return screen
}

HomeScreen.layoutHome = layoutHome
HomeScreen.HERO_GRID_CELLS = HERO_GRID_CELLS
module.exports = HomeScreen
