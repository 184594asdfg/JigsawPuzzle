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

function buildRankList() {
  var list = rankData.LEADERBOARD
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
  return rows
}

Page({
  data: {
    homeBg: HOME_BG,
    homeHero: HOME_HERO,
    iconRank: ICON_RANK,
    iconLevel: ICON_LEVEL,
    iconGallery: ICON_GALLERY,
    showRank: false,
    rankList: buildRankList(),
    rankTop3: buildRankList().slice(0, 3),
    myRank: rankData.MY_RANK,
    rankTab: 'week'
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
    this.setData({ showRank: true })
  },

  closeRank: function () {
    this.setData({ showRank: false })
  },

  switchRankTab: function (e) {
    var tab = e.currentTarget.dataset.tab
    if (tab === this.data.rankTab) return
    this.setData({ rankTab: tab })
  },

  noop: function () {}
})
