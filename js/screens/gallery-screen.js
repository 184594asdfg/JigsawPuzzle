/**
 * 图集：
 *   - 默认显示主题列表（3 列，按解锁状态切换卡片）
 *   - 点击主题进入关卡详情（3 列缩略图，已完成显示原图，未完成显示占位 + 脉冲）
 *   - 点击已完成关卡 → 全屏预览；点击未完成 → 进入拼图关卡
 *   - 返回：先出全屏 → 详情 → 主题列表 → 上层场景
 */
var BaseScreen = require('./base-screen')
var rpx = require('../rpx')
var assets = require('../assets')
var draw = require('../draw')
var galleryData = require('../../utils/gallery-data')
var progress = require('../../utils/progress')

var BG = '#2e76ce'
var TEXT_HEADER = '#ffffff'

/** 左上角返回图标：显示 72×72 rpx，资源 72×72 @2x */
var NAV_BACK_ICON = 'images/icons/gallery_back.png'
var NAV_BACK_LEFT_RPX = 24
var NAV_BACK_SIZE_RPX = 72

function GalleryScreen() {
  BaseScreen.call(this)
  this.selectedTheme = ''
  this.currentTheme = null
  this.themes = []
  this.showFullscreen = false
  this.fullscreenImage = ''
  this.pulseKey = ''
  this._pulseTime = 0
  this.scrollY = 0
  this._scrollMax = 0
  this._drag = null
  this._themeRowsHeight = 0
}
GalleryScreen.prototype = Object.create(BaseScreen.prototype)
GalleryScreen.prototype.constructor = GalleryScreen

GalleryScreen.prototype.onEnter = function (manager) {
  BaseScreen.prototype.onEnter.call(this, manager)
  this._refresh()
  this._preloadLevelImages()
  assets.load(NAV_BACK_ICON)
}

GalleryScreen.prototype.onResume = function () {
  this._refresh()
}

GalleryScreen.prototype._refresh = function () {
  var defs = galleryData.THEMES
  var list = []
  for (var i = 0; i < defs.length; i++) {
    var t = defs[i]
    var unlocked = i === 0 || progress.countThemeCompleted(defs[i - 1]) >= defs[i - 1].totalLevels
    list.push({
      id: t.id,
      name: t.name,
      unlocked: unlocked,
      cardImage: unlocked ? galleryData.THEME_CARD_UNLOCKED : galleryData.THEME_CARD_LOCKED,
      completed: progress.countThemeCompleted(t),
      totalLevels: t.totalLevels,
      raw: t
    })
  }
  this.themes = list
  if (this.selectedTheme) {
    this.currentTheme = this._buildCurrentTheme(this.selectedTheme)
  }
  this.scrollY = 0
}

GalleryScreen.prototype._preloadLevelImages = function () {
  assets.loadAll(galleryData.PUZZLE_IMAGES)
}

GalleryScreen.prototype._buildCurrentTheme = function (themeId) {
  var t = galleryData.getThemeById(themeId)
  if (!t) return null
  var levels = []
  for (var i = 0; i < t.levels.length; i++) {
    var l = t.levels[i]
    levels.push({
      key: l.key,
      themeId: l.themeId,
      level: l.level,
      name: l.name,
      image: l.image,
      grid: l.grid,
      done: progress.isLevelComplete(l.key)
    })
  }
  return {
    id: t.id,
    name: t.name,
    totalLevels: t.totalLevels,
    levels: levels
  }
}

// ---------------------------------------------------------------------------
//  渲染
// ---------------------------------------------------------------------------

GalleryScreen.prototype.update = function (dt) {
  if (this.pulseKey) {
    this._pulseTime += dt
    if (this._pulseTime > 420) {
      this.pulseKey = ''
      this._pulseTime = 0
    }
  }
}

GalleryScreen.prototype.render = function (ctx) {
  var W = rpx.windowWidth()
  var H = rpx.windowHeight()
  this.resetHitZones()

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)

  // 导航栏
  var navY = rpx.safeTop()
  var navH = rpx.rpx(88)
  this._drawNav(ctx, 0, navY, W, navH)

  // 主体（裁剪滚动）
  var bodyY = navY + navH
  var bodyH = H - bodyY - rpx.safeBottom()
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, bodyY, W, bodyH)
  ctx.clip()

  ctx.translate(0, -this.scrollY)
  var contentBottom
  if (!this.selectedTheme) {
    contentBottom = this._drawThemeGrid(ctx, bodyY, W)
  } else {
    contentBottom = this._drawLevelGrid(ctx, bodyY, W)
  }
  ctx.restore()

  this._scrollMax = Math.max(0, contentBottom - (bodyY + bodyH))

  // 全屏预览
  if (this.showFullscreen) {
    this._drawFullscreen(ctx, W, H)
  }
}

GalleryScreen.prototype._drawNavBack = function (ctx, y, h) {
  var size = rpx.rpx(NAV_BACK_SIZE_RPX)
  var cx = rpx.rpx(NAV_BACK_LEFT_RPX) + size / 2
  var cy = y + h / 2
  var x = cx - size / 2
  var iconY = cy - size / 2

  var icon = assets.get(NAV_BACK_ICON)
  if (!icon) assets.load(NAV_BACK_ICON)
  if (icon) ctx.drawImage(icon, x, iconY, size, size)

  var pad = rpx.rpx(8)
  return { x: x - pad, y: iconY - pad, w: size + pad * 2, h: size + pad * 2 }
}

GalleryScreen.prototype._drawNav = function (ctx, x, y, w, h) {
  ctx.fillStyle = BG
  ctx.fillRect(x, y, w, h)

  var self = this
  var backRect = this._drawNavBack(ctx, y, h)
  this.addHitZone(backRect, function () { self._onBack() })

  var title = this.selectedTheme && this.currentTheme ? this.currentTheme.name : '图集'
  var fontSize = this.selectedTheme ? rpx.rpx(32) : rpx.rpx(34)
  var weight = this.selectedTheme ? '400' : '600'
  draw.fillTextCentered(
    ctx, title, w / 2, y + h / 2,
    weight + ' ' + fontSize.toFixed(0) + 'px sans-serif', TEXT_HEADER
  )
}

GalleryScreen.prototype._drawThemeGrid = function (ctx, bodyY, W) {
  var padX = rpx.rpx(32)
  var gridW = W - padX * 2
  var cardW = gridW / 3
  var aspect = 240 / 337
  var cardH = cardW / aspect
  var startY = bodyY + rpx.rpx(16)
  var x = padX
  var y = startY
  var col = 0

  for (var i = 0; i < this.themes.length; i++) {
    var item = this.themes[i]
    this._drawThemeCard(ctx, item, x + rpx.rpx(8), y + rpx.rpx(8), cardW - rpx.rpx(16), cardH - rpx.rpx(16))
    col++
    if (col >= 3) {
      col = 0
      x = padX
      y += cardH
    } else {
      x += cardW
    }
  }
  if (col !== 0) y += cardH
  return y + rpx.rpx(24)
}

GalleryScreen.prototype._drawThemeCard = function (ctx, item, x, y, w, h) {
  var img = assets.get(item.cardImage)
  ctx.save()
  draw.roundedRectPath(ctx, x, y, w, h, rpx.rpx(16))
  ctx.clip()
  if (img) {
    draw.drawImageCover(ctx, img, x, y, w, h)
  } else {
    ctx.fillStyle = item.unlocked ? '#4ea893' : '#7da89b'
    ctx.fillRect(x, y, w, h)
  }
  if (!item.unlocked) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    ctx.fillRect(x, y, w, h)
  }
  ctx.restore()

  // 进度徽标
  var badge = item.completed + '/' + item.totalLevels
  ctx.font = '600 ' + rpx.rpx(23).toFixed(0) + 'px sans-serif'
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.lineWidth = rpx.rpx(2)
  ctx.strokeStyle = '#000000'
  ctx.strokeText(badge, x + rpx.rpx(33), y + rpx.rpx(35))
  ctx.fillStyle = '#ffffff'
  ctx.fillText(badge, x + rpx.rpx(33), y + rpx.rpx(35))

  // 底部主题名
  draw.fillTextCentered(
    ctx, item.name, x + w / 2, y + h - rpx.rpx(28),
    '400 ' + rpx.rpx(29).toFixed(0) + 'px sans-serif', '#002f82'
  )

  // 命中区
  var self = this
  this.addHitZone(
    { x: x, y: y, w: w, h: h },
    function () { self._onTapTheme(item) }
  )
}

GalleryScreen.prototype._drawLevelGrid = function (ctx, bodyY, W) {
  if (!this.currentTheme) return bodyY
  var padX = rpx.rpx(32)
  var gridW = W - padX * 2
  var cardW = gridW / 3
  var startY = bodyY + rpx.rpx(16)
  var thumbH = rpx.rpx(330)
  var y = startY
  var x = padX
  var col = 0
  var levels = this.currentTheme.levels
  for (var i = 0; i < levels.length; i++) {
    var l = levels[i]
    this._drawLevelCard(ctx, l, x + rpx.rpx(8), y + rpx.rpx(8), cardW - rpx.rpx(16), thumbH - rpx.rpx(16))
    col++
    if (col >= 3) {
      col = 0
      x = padX
      y += thumbH
    } else {
      x += cardW
    }
  }
  if (col !== 0) y += thumbH
  return y + rpx.rpx(24)
}

GalleryScreen.prototype._drawLevelCard = function (ctx, level, x, y, w, h) {
  var scale = 1
  if (this.pulseKey === level.key) {
    var p = this._pulseTime / 420
    if (p < 0.4) {
      scale = 1 + (1.12 - 1) * (p / 0.4)
    } else {
      scale = 1.12 - (1.12 - 1) * ((p - 0.4) / 0.6)
    }
  }

  ctx.save()
  var cx = x + w / 2
  var cy = y + h / 2
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.translate(-cx, -cy)
  draw.roundedRectPath(ctx, x, y, w, h, rpx.rpx(16))
  ctx.clip()
  if (level.done) {
    var img = assets.get(level.image)
    if (img) {
      draw.drawImageCover(ctx, img, x, y, w, h)
    } else {
      assets.load(level.image)
      ctx.fillStyle = '#1f5c9c'
      ctx.fillRect(x, y, w, h)
    }
  } else {
    var ph = assets.get(galleryData.LEVEL_THUMB_PLACEHOLDER)
    if (ph) {
      draw.drawImageCover(ctx, ph, x, y, w, h)
    } else {
      ctx.fillStyle = '#1f5c9c'
      ctx.fillRect(x, y, w, h)
    }
  }
  ctx.restore()

  var self = this
  this.addHitZone(
    { x: x, y: y, w: w, h: h },
    function () { self._onTapLevel(level) }
  )
}

GalleryScreen.prototype._drawFullscreen = function (ctx, W, H) {
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, W, H)
  var img = assets.get(this.fullscreenImage)
  if (img) draw.drawImageContain(ctx, img, 0, 0, W, H)

  // 关闭按钮
  var closeX = W - rpx.rpx(56)
  var closeY = rpx.safeTop() + rpx.rpx(48)
  draw.fillTextCentered(
    ctx, '×', closeX, closeY,
    '400 ' + rpx.rpx(48).toFixed(0) + 'px sans-serif', '#ffffff'
  )
  // 全屏点击/关闭按钮，都关
  var self = this
  this.resetHitZones()
  this.addHitZone(
    { x: 0, y: 0, w: W, h: H },
    function () { self._closeFullscreen() }
  )
}

// ---------------------------------------------------------------------------
//  事件
// ---------------------------------------------------------------------------

GalleryScreen.prototype.onTouchStart = function (e) {
  var t = this._firstTouch(e)
  if (!t) return
  if (this.showFullscreen) return

  var navH = rpx.rpx(88)
  var bodyY = rpx.safeTop() + navH
  if (t.y > bodyY) {
    this._drag = {
      startY: t.y, startScroll: this.scrollY, moved: false
    }
  } else {
    this._drag = null
  }
}

GalleryScreen.prototype.onTouchMove = function (e) {
  if (!this._drag) return
  var t = this._firstTouch(e)
  if (!t) return
  var dy = t.y - this._drag.startY
  if (Math.abs(dy) > 4) this._drag.moved = true
  var next = this._drag.startScroll - dy
  if (next < 0) next = 0
  if (next > this._scrollMax) next = this._scrollMax
  this.scrollY = next
}

GalleryScreen.prototype.onTouchEnd = function (e) {
  var t = this._firstTouch(e)
  if (!t) return

  if (this._drag && this._drag.moved) {
    this._drag = null
    return
  }
  this._drag = null

  if (this.showFullscreen) {
    var zoneFs = this.hitZoneAt(t.x, t.y)
    if (zoneFs && zoneFs.handler) zoneFs.handler()
    return
  }

  // 导航栏命中（不参与滚动偏移）
  var navH = rpx.rpx(88)
  var bodyY = rpx.safeTop() + navH
  if (t.y <= bodyY) {
    var zoneNav = this.hitZoneAt(t.x, t.y)
    if (zoneNav && zoneNav.handler) zoneNav.handler()
    return
  }

  // body 命中需要加回 scrollY
  var zone = this.hitZoneAt(t.x, t.y + this.scrollY)
  if (zone && zone.handler) zone.handler()
}

GalleryScreen.prototype.onTouchCancel = function () {
  this._drag = null
}

// ---------------------------------------------------------------------------
//  动作
// ---------------------------------------------------------------------------

GalleryScreen.prototype._onBack = function () {
  if (this.showFullscreen) {
    this._closeFullscreen()
    return
  }
  if (this.selectedTheme) {
    this.selectedTheme = ''
    this.currentTheme = null
    this.pulseKey = ''
    this.scrollY = 0
    this._refresh()
    return
  }
  this.manager.pop()
}

GalleryScreen.prototype._onTapTheme = function (item) {
  if (!item.unlocked) {
    wx.showToast({ title: '请先通关上一主题', icon: 'none' })
    return
  }
  this.selectedTheme = item.id
  this.currentTheme = this._buildCurrentTheme(item.id)
  this.scrollY = 0
}

GalleryScreen.prototype._onTapLevel = function (level) {
  if (level.done) {
    this.showFullscreen = true
    this.fullscreenImage = level.image
    return
  }
  // 未完成 → 触发脉冲并打开拼图关卡
  this.pulseKey = level.key
  this._pulseTime = 0
  var self = this
  setTimeout(function () {
    var PuzzleScreen = require('./puzzle-screen')
    self.manager.push(new PuzzleScreen({
      image: level.image,
      grid: level.grid || 4,
      levelKey: level.key,
      levelLabel: '关卡' + level.level
    }))
  }, 320)
}

GalleryScreen.prototype._closeFullscreen = function () {
  this.showFullscreen = false
  this.fullscreenImage = ''
}

module.exports = GalleryScreen
