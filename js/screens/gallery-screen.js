/**
 * 图集：
 *   - 默认显示主题列表（3 列，按解锁状态切换卡片）
 *   - 点击主题进入关卡详情（3 列缩略图，已完成显示原图，未完成显示占位 + 脉冲）
 *   - 点击已完成关卡 → 遮罩浮层预览大图；点击占位图 → 仅按压动效，无其它操作
 *   - 返回：先关预览 → 详情 → 主题列表 → 上层场景
 */
var BaseScreen = require('./base-screen')
var rpx = require('../rpx')
var assets = require('../assets')
var draw = require('../draw')
var galleryData = require('../../utils/gallery-data')
var progress = require('../../utils/progress')
var remoteSync = require('../../utils/remote-sync')
var prefetch = require('../../utils/prefetch')
var imageProxy = require('../../utils/image-proxy')
var user = require('../../utils/user')
var sfx = require('../sfx')
var pressAnim = require('../press-anim')

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
  this.dataLoading = false
  this.showImagePreview = false
  this.previewImage = ''
  this.pulseKey = ''
  this._pulseTime = 0
  this.scrollY = 0
  this._scrollMax = 0
  this._drag = null
  this._themeRowsHeight = 0
  this._pressAnim = null
}
GalleryScreen.prototype = Object.create(BaseScreen.prototype)
GalleryScreen.prototype.constructor = GalleryScreen

GalleryScreen.prototype.onEnter = function (manager) {
  BaseScreen.prototype.onEnter.call(this, manager)
  var self = this
  assets.load(NAV_BACK_ICON)
  if (galleryData.isLoaded()) {
    this._refresh()
  } else {
    this.dataLoading = true
  }
  galleryData.loadThemes({ summary: true }).then(function () {
    return user.autoLogin()
  }).then(function () {
    self.dataLoading = false
    self._refresh()
  }).catch(function () {
    self.dataLoading = false
    self._refresh()
  })
  prefetch.prefetchNextLevelAssets()
}

GalleryScreen.prototype.onResume = function () {
  var self = this
  remoteSync.syncOnEnter().then(function () {
    self._refresh()
    prefetch.prefetchNextLevelAssets()
  }).catch(function () {
    self._refresh()
    prefetch.prefetchNextLevelAssets()
  })
}

GalleryScreen.prototype._refresh = function () {
  var defs = galleryData.getThemes()
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
  prefetch.prefetchNextLevelAssets()
  this.scrollY = 0
}

// ---------------------------------------------------------------------------
//  渲染
// ---------------------------------------------------------------------------

GalleryScreen.prototype._buildCurrentTheme = function (themeId) {
  var t = galleryData.getThemeById(themeId)
  if (!t) return null
  var levels = []
  var total = t.totalLevels || galleryData.LEVELS_PER_THEME
  var sourceLevels = galleryData.hasThemeLevels(t) ? t.levels : []

  for (var n = 1; n <= total; n++) {
    var l = null
    for (var i = 0; i < sourceLevels.length; i++) {
      if (sourceLevels[i].level === n) {
        l = sourceLevels[i]
        break
      }
    }
    var key = l ? l.key : galleryData.buildLevelKey(t.id, n)
    var done = progress.isLevelComplete(key)
    var image = done ? galleryData.resolveLevelImage(t, n, l) : ''
    var thumbImage = done ? galleryData.resolveLevelThumbImage(t, n, l) : ''
    levels.push({
      key: key,
      themeId: t.id,
      level: l ? l.level : n,
      name: l ? l.name : ('关卡 ' + n),
      image: image,
      thumbImage: thumbImage,
      grid: l ? l.grid : galleryData.DEFAULT_GRID,
      timeLimit: l ? l.timeLimit : 0,
      done: done
    })
  }
  return {
    id: t.id,
    name: t.name,
    totalLevels: total,
    levels: levels
  }
}

/** 批量预取本主题已完成关卡的缩略图 */
GalleryScreen.prototype._prefetchDoneLevelThumbs = function (themeData) {
  if (!themeData || !themeData.levels || !themeData.levels.length) return Promise.resolve()
  if (!user.getUserId()) return Promise.resolve()
  var keys = []
  for (var i = 0; i < themeData.levels.length; i++) {
    if (themeData.levels[i].done && themeData.levels[i].key) {
      keys.push(themeData.levels[i].key)
    }
  }
  if (!keys.length) return Promise.resolve()
  return galleryData.prefetchLevelUrls(keys, { thumb: true }).then(function () {
    for (var j = 0; j < themeData.levels.length; j++) {
      var lv = themeData.levels[j]
      if (!lv.done) continue
      var src = lv.thumbImage || lv.image
      if (src) prefetch.prefetchImage(src)
    }
  }).catch(function () {})
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
  var tick = pressAnim.tickPressAnim(this._pressAnim, dt)
  this._pressAnim = tick.anim
  if (tick.completed && tick.id === 'back') this._onBack()
}

GalleryScreen.prototype.render = function (ctx) {
  var W = rpx.windowWidth()
  var H = rpx.windowHeight()
  this.resetHitZones()

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)

  if (this.dataLoading || !galleryData.isLoaded()) {
    draw.fillTextCentered(
      ctx, '加载图集中...', W / 2, H / 2,
      '400 ' + rpx.rpx(28).toFixed(0) + 'px sans-serif', TEXT_HEADER
    )
    return
  }

  if (!this.themes.length) {
    var navY = rpx.safeTop()
    var navH = rpx.rpx(88)
    this._drawNav(ctx, 0, navY, W, navH)
    var emptyHint = galleryData.getLoadError() ? '加载失败，请稍后重试' : '暂无主题数据'
    draw.fillTextCentered(
      ctx, emptyHint, W / 2, H / 2,
      '400 ' + rpx.rpx(28).toFixed(0) + 'px sans-serif', TEXT_HEADER
    )
    return
  }

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

  if (this.showImagePreview) {
    this._drawImagePreview(ctx, W, H)
  }
}

GalleryScreen.prototype._drawNavBack = function (ctx, y, h, scale) {
  scale = scale == null ? 1 : scale
  var size = rpx.rpx(NAV_BACK_SIZE_RPX)
  var cx = rpx.rpx(NAV_BACK_LEFT_RPX) + size / 2
  var cy = y + h / 2
  var x = cx - size / 2
  var iconY = cy - size / 2

  pressAnim.drawWithPressScale(ctx, cx, cy, scale, function () {
    var icon = assets.get(NAV_BACK_ICON)
    if (!icon) assets.load(NAV_BACK_ICON)
    if (icon) ctx.drawImage(icon, x, iconY, size, size)
  })

  var pad = rpx.rpx(8)
  return { x: x - pad, y: iconY - pad, w: size + pad * 2, h: size + pad * 2 }
}

GalleryScreen.prototype._drawNav = function (ctx, x, y, w, h) {
  ctx.fillStyle = BG
  ctx.fillRect(x, y, w, h)

  var self = this
  var anim = this._pressAnim
  var backRect = this._drawNavBack(ctx, y, h, pressAnim.btnScale(anim, 'back'))
  if (!anim && !this.showImagePreview) {
    this.addHitZone(backRect, function () { self._startPressAnim('back') })
  }

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
  if (level.done && (level.thumbImage || level.image)) {
    var thumbSrc = level.thumbImage || level.image
    var img = assets.get(thumbSrc)
    if (img) {
      draw.drawImageCover(ctx, img, x, y, w, h)
    } else {
      assets.tryLoad(thumbSrc)
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

GalleryScreen.prototype._drawImagePreview = function (ctx, W, H) {
  var self = this
  this.resetHitZones()

  ctx.fillStyle = 'rgba(0,0,0,0.72)'
  ctx.fillRect(0, 0, W, H)
  this.addHitZone({ x: 0, y: 0, w: W, h: H }, function () {
    self._closeImagePreview()
  })

  var pad = rpx.rpx(40)
  var top = rpx.safeTop() + rpx.rpx(100)
  var bottom = H - rpx.safeBottom() - rpx.rpx(120)
  var maxW = W - pad * 2
  var maxH = bottom - top
  if (maxH < rpx.rpx(200)) maxH = H * 0.55

  var src = this.previewImage
  var img = src ? assets.get(src) : null
  if (!img && src) assets.tryLoad(src)
  if (img && img.width && img.height) {
    var ratio = img.width / img.height
    var drawW = maxW
    var drawH = drawW / ratio
    if (drawH > maxH) {
      drawH = maxH
      drawW = drawH * ratio
    }
    var ix = (W - drawW) / 2
    var iy = top + (maxH - drawH) / 2
    ctx.drawImage(img, ix, iy, drawW, drawH)
  }

  draw.fillTextCentered(
    ctx, '点击空白处关闭', W / 2, H - rpx.safeBottom() - rpx.rpx(56),
    '400 ' + rpx.rpx(24).toFixed(0) + 'px sans-serif', 'rgba(255,255,255,0.75)'
  )
}

// ---------------------------------------------------------------------------
//  事件
// ---------------------------------------------------------------------------

GalleryScreen.prototype.onTouchStart = function (e) {
  var t = this._firstTouch(e)
  if (!t) return
  if (this.showImagePreview) return

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

  var drag = this._drag
  this._drag = null
  if (drag && drag.moved) {
    var dy = t.y - drag.startY
    if (Math.abs(dy) > 12) return
  }

  if (this.showImagePreview) {
    var zonePreview = this.hitZoneAt(t.x, t.y)
    if (zonePreview && zonePreview.handler) zonePreview.handler()
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
  this._pressAnim = null
}

// ---------------------------------------------------------------------------
//  动作
// ---------------------------------------------------------------------------

GalleryScreen.prototype._startPressAnim = function (id) {
  if (this._pressAnim || this.showImagePreview) return
  sfx.playClick()
  this._pressAnim = { id: id, time: 0 }
}

GalleryScreen.prototype._onBack = function () {
  if (this.showImagePreview) {
    this._closeImagePreview()
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
  sfx.playClick()
  if (!item.unlocked) {
    wx.showToast({ title: '请先通关上一主题', icon: 'none' })
    return
  }
  this.selectedTheme = item.id
  this.currentTheme = this._buildCurrentTheme(item.id)
  this.scrollY = 0
  this._prefetchDoneLevelThumbs(this.currentTheme)
  prefetch.prefetchNextLevelAssets()
}

GalleryScreen.prototype._onTapLevel = function (level) {
  sfx.playClick()
  if (!level || !level.key) return

  this.pulseKey = level.key
  this._pulseTime = 0

  if (!level.done) {
    try { wx.showToast({ title: '完成前置关卡后解锁', icon: 'none' }) } catch (e) {}
    return
  }

  var resolved = galleryData.resolveLevelForPlay(
    level.themeId, level.key, level.level, level
  )
  if (!resolved.image) {
    try { wx.showToast({ title: '请先登录以查看图片', icon: 'none' }) } catch (e) {}
    return
  }
  var src = resolved.image
  if (assets.get(src)) {
    this.showImagePreview = true
    this.previewImage = src
    return
  }
  var self = this
  assets.load(src).then(function () {
    self.showImagePreview = true
    self.previewImage = src
  }).catch(function () {
    try { wx.showToast({ title: '图片加载失败', icon: 'none' }) } catch (e) {}
  })
}

GalleryScreen.prototype._closeImagePreview = function () {
  sfx.playClick()
  this.showImagePreview = false
  this.previewImage = ''
}

module.exports = GalleryScreen
