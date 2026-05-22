var rankData = require('../../utils/rank-data')

var DEFAULT_IMAGE = '/images/photo1.jpg'
var DEFAULT_GRID = 4
/** 首页全屏背景 */
var HOME_BG = '/images/home-bg.jpg'
/** 首页中部大图 1050×2050 → images/home-hero.png */
var HOME_HERO = '/images/home-hero.png'
/** 首页底部图标 → images/icons/ */
var ICON_RANK = '/images/icons/rank.png'
var ICON_LEVEL = '/images/icons/level.png'
var ICON_GALLERY = '/images/icons/gallery.png'

function buildRankView(tab) {
  var list = rankData.getLeaderboard(tab)
  var rows = []
  for (var i = 0; i < list.length; i++) {
    var item = list[i]
    rows.push({
      rank: item.rank,
      name: item.name,
      levels: item.levels,
      time: item.time
    })
  }
  return {
    rankList: rows,
    rankTop3: rows.slice(0, 3),
    myRank: rankData.getMyRank(tab)
  }
}

var DEFAULT_RANK_TAB = 'friends'
var defaultRankView = buildRankView(DEFAULT_RANK_TAB)

Page({
  data: {
    statusBarHeight: 20,
    homeReady: false,
    homeBg: HOME_BG,
    homeHero: HOME_HERO,
    iconRank: ICON_RANK,
    iconLevel: ICON_LEVEL,
    iconGallery: ICON_GALLERY,
    showRank: false,
    rankTab: DEFAULT_RANK_TAB,
    rankList: defaultRankView.rankList,
    rankTop3: defaultRankView.rankTop3,
    myRank: defaultRankView.myRank
  },

  onLoad: function () {
    var statusBarHeight = 20
    try {
      var info = wx.getSystemInfoSync()
      statusBarHeight = info.statusBarHeight || 20
    } catch (e) {
      /* ignore */
    }
    this._homeBgLoaded = false
    this._homeHeroLoaded = false
    this.setData({ statusBarHeight: statusBarHeight, homeReady: false })
  },

  onHomeBgLoad: function () {
    this._homeBgLoaded = true
    this.checkHomeImagesReady()
  },

  onHomeHeroLoad: function () {
    this._homeHeroLoaded = true
    this.checkHomeImagesReady()
  },

  checkHomeImagesReady: function () {
    if (this._homeBgLoaded && this._homeHeroLoaded) {
      this.setData({ homeReady: true })
    }
  },

  startPuzzle: function () {
    wx.navigateTo({
      url:
        '/pages/puzzle/puzzle?image=' +
        encodeURIComponent(DEFAULT_IMAGE) +
        '&grid=' +
        DEFAULT_GRID
    })
  },

  openGallery: function () {
    wx.navigateTo({
      url: '/pages/gallery/gallery'
    })
  },

  openRank: function () {
    var view = buildRankView(this.data.rankTab || DEFAULT_RANK_TAB)
    this.setData({
      showRank: true,
      rankList: view.rankList,
      rankTop3: view.rankTop3,
      myRank: view.myRank
    })
  },

  closeRank: function () {
    this.setData({ showRank: false })
  },

  switchRankTab: function (e) {
    var tab = e.currentTarget.dataset.tab
    if (tab === this.data.rankTab) return
    var view = buildRankView(tab)
    this.setData({
      rankTab: tab,
      rankList: view.rankList,
      rankTop3: view.rankTop3,
      myRank: view.myRank
    })
  },

  noop: function () {}
})
