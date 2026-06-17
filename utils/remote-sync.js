/**
 * 进入小游戏时从服务端拉取最新数据并写入本地缓存（多设备进度一致）。
 */
var galleryData = require('./gallery-data')
var user = require('./user')
var progress = require('./progress')
var tools = require('./tools')

function syncOnEnter() {
  return galleryData.loadThemes({ summary: true, force: true }).then(function () {
    return user.autoLogin()
  }).then(function () {
    return Promise.all([
      progress.loadFromServer({ authoritative: true }),
      tools.fetchTools()
    ])
  })
}

module.exports = {
  syncOnEnter: syncOnEnter
}
