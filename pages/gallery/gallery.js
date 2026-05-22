var galleryData = require('../../utils/gallery-data')
var progress = require('../../utils/progress')

var THUMB_HEIGHT_RPX = 330

function isThemeUnlocked(themes, index) {
  if (index <= 0) return true
  var prev = themes[index - 1]
  return progress.countThemeCompleted(prev) >= prev.totalLevels
}

function buildThemes() {
  var themes = galleryData.THEMES
  var list = []
  for (var i = 0; i < themes.length; i++) {
    var t = themes[i]
    var unlocked = isThemeUnlocked(themes, i)
    list.push({
      id: t.id,
      name: t.name,
      unlocked: unlocked,
      cardImage: unlocked
        ? galleryData.THEME_CARD_UNLOCKED
        : galleryData.THEME_CARD_LOCKED,
      completed: progress.countThemeCompleted(t),
      totalLevels: t.totalLevels
    })
  }
  return list
}

function buildThemeLevels(themeId) {
  var theme = galleryData.getThemeById(themeId)
  if (!theme) return []

  var levels = []
  for (var i = 0; i < theme.levels.length; i++) {
    var l = theme.levels[i]
    levels.push({
      key: l.key,
      themeId: l.themeId,
      level: l.level,
      name: l.name,
      image: l.image,
      done: progress.isLevelComplete(l.key)
    })
  }
  return levels
}

function buildCurrentTheme(themeId) {
  var theme = galleryData.getThemeById(themeId)
  if (!theme) return null
  return {
    id: theme.id,
    name: theme.name,
    icon: theme.icon,
    accent: theme.accent,
    totalLevels: theme.totalLevels,
    levels: buildThemeLevels(themeId)
  }
}

Page({
  data: {
    statusBarHeight: 20,
    thumbHeight: THUMB_HEIGHT_RPX,
    themes: buildThemes(),
    selectedTheme: '',
    currentTheme: null,
    levelPlaceholder: galleryData.LEVEL_THUMB_PLACEHOLDER,
    showFullscreen: false,
    fullscreenImage: '',
    pulseKey: ''
  },

  onLoad: function () {
    var statusBarHeight = 20
    try {
      var info = wx.getSystemInfoSync()
      statusBarHeight = info.statusBarHeight || 20
    } catch (e) {
      /* ignore */
    }
    this.setData({
      statusBarHeight: statusBarHeight,
      themes: buildThemes()
    })
  },

  onShow: function () {
    var data = { themes: buildThemes() }
    if (this.data.selectedTheme) {
      data.currentTheme = buildCurrentTheme(this.data.selectedTheme)
    }
    this.setData(data)
  },

  onNavBack: function () {
    if (this.data.showFullscreen) {
      this.closeFullscreen()
      return
    }
    if (this.data.selectedTheme) {
      this.backToThemes()
      return
    }
    this.goBack()
  },

  goBack: function () {
    var pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
    } else {
      wx.reLaunch({ url: '/pages/index/index' })
    }
  },

  selectTheme: function (e) {
    var id = e.currentTarget.dataset.id
    var themes = this.data.themes
    var item = null
    for (var i = 0; i < themes.length; i++) {
      if (themes[i].id === id) {
        item = themes[i]
        break
      }
    }
    if (!item) return
    if (!item.unlocked) {
      wx.showToast({ title: '请先通关上一主题', icon: 'none' })
      return
    }

    this.setData({
      selectedTheme: id,
      currentTheme: buildCurrentTheme(id),
    })
  },

  backToThemes: function () {
    this.setData({
      selectedTheme: '',
      currentTheme: null,
      showFullscreen: false,
      fullscreenImage: '',
      pulseKey: '',
      themes: buildThemes()
    })
  },

  openLevelPreview: function (e) {
    var ds = e.currentTarget.dataset
    var done = ds.done === true || ds.done === 'true'
    if (done) {
      this.setData({
        showFullscreen: true,
        fullscreenImage: ds.image
      })
      return
    }
    this.playPlaceholderPulse(ds.key)
  },

  playPlaceholderPulse: function (key) {
    if (!key) return
    if (this._pulseTimer) {
      clearTimeout(this._pulseTimer)
      this._pulseTimer = null
    }
    var self = this
    this.setData({ pulseKey: '' }, function () {
      self.setData({ pulseKey: key })
      self._pulseTimer = setTimeout(function () {
        self.setData({ pulseKey: '' })
        self._pulseTimer = null
      }, 420)
    })
  },

  closeFullscreen: function () {
    this.setData({
      showFullscreen: false,
      fullscreenImage: ''
    })
  }
})
