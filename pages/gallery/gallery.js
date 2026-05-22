var galleryData = require('../../utils/gallery-data')
var progress = require('../../utils/progress')

var THUMB_HEIGHT_RPX = 330
var GRID_OPTIONS = [3, 4, 5, 6, 7]

function buildSections() {
  var themes = galleryData.THEMES
  var sections = []
  for (var i = 0; i < themes.length; i++) {
    var t = themes[i]
    var levels = []
    for (var j = 0; j < t.levels.length; j++) {
      var l = t.levels[j]
      levels.push({
        key: l.key,
        themeId: l.themeId,
        level: l.level,
        name: l.name,
        image: l.image,
        done: progress.isLevelComplete(l.key)
      })
    }
    sections.push({
      id: t.id,
      name: t.name,
      completed: progress.countThemeCompleted(t),
      totalLevels: t.totalLevels,
      levels: levels
    })
  }
  return sections
}

Page({
  data: {
    statusBarHeight: 20,
    thumbHeight: THUMB_HEIGHT_RPX,
    sections: buildSections(),
    gridOptions: GRID_OPTIONS,
    gridSize: galleryData.DEFAULT_GRID,
    selectedKey: '',
    selectedName: '',
    selectedImage: '',
    selectedTheme: '',
    selectedLevel: 0,
    hasSelection: false
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
      sections: buildSections()
    })
  },

  onShow: function () {
    this.setData({ sections: buildSections() })
  },

  goBack: function () {
    var pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
    } else {
      wx.reLaunch({ url: '/pages/index/index' })
    }
  },

  selectGrid: function (e) {
    var grid = parseInt(e.currentTarget.dataset.grid, 10)
    if (grid >= 3 && grid <= 7) {
      this.setData({ gridSize: grid })
    }
  },

  selectLevel: function (e) {
    var ds = e.currentTarget.dataset
    this.setData({
      selectedKey: ds.key,
      selectedName: ds.name,
      selectedImage: ds.image,
      selectedTheme: ds.theme,
      selectedLevel: ds.level,
      hasSelection: true
    })
  },

  startSelected: function () {
    if (!this.data.hasSelection) {
      wx.showToast({ title: '请先选择关卡', icon: 'none' })
      return
    }
    var d = this.data
    wx.navigateTo({
      url:
        '/pages/puzzle/puzzle?image=' +
        encodeURIComponent(d.selectedImage) +
        '&grid=' +
        d.gridSize +
        '&theme=' +
        d.selectedTheme +
        '&level=' +
        d.selectedLevel
    })
  }
})
