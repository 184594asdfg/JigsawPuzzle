/**
 * 进入小游戏时从服务端拉取最新数据并写入本地缓存（多设备进度一致）。
 */
var galleryData = require('./gallery-data')
var user = require('./user')
var progress = require('./progress')
var tools = require('./tools')
var rankData = require('./rank-data')

function syncOnEnter() {
  return galleryData.loadThemes({ summary: true, force: true }).then(function () {
    // 静默登录：wx.login + code 换 userId，用于进度同步（不调微信头像昵称接口）
    return user.autoLogin()
  }).then(function () {
    return Promise.all([
      progress.loadFromServer({ authoritative: true }),
      tools.fetchTools(),
      rankData.loadNationalRank()
    ])
  }).then(function () {
    return user.trySyncProfileSilent()
  })
}

module.exports = {
  syncOnEnter: syncOnEnter
}
