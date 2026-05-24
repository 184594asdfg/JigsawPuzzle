/**
 * 用户登录与缓存
 */
var config = require('./app-config')
var request = require('./request')

var STORAGE_KEY = 'jigsaw_user'
var cachedUser = null

function readStorage() {
  try {
    var raw = wx.getStorageSync(STORAGE_KEY)
    return raw && typeof raw === 'object' ? raw : null
  } catch (e) {
    return null
  }
}

function writeStorage(user) {
  wx.setStorageSync(STORAGE_KEY, user)
}

function getUser() {
  if (cachedUser) return cachedUser
  cachedUser = readStorage()
  return cachedUser
}

function getUserId() {
  var user = getUser()
  return user && user.id ? user.id : ''
}

function getDisplayInfo() {
  var user = getUser()
  if (!user || !user.id) {
    return { name: '游客', id: '--' }
  }
  var name = user.nickname || '吉'
  var id = user.id
  if (id.length > 8) id = id.slice(-8)
  return { name: name, id: id }
}

function saveUser(remote) {
  var user = {
    id: remote.id,
    openid: remote.openid || '',
    nickname: remote.nickname || '',
    avatarUrl: remote.avatarUrl || '',
    loginTime: Date.now()
  }
  cachedUser = user
  writeStorage(user)
  return user
}

function autoLogin() {
  return new Promise(function (resolve) {
    wx.login({
      success: function (res) {
        if (!res.code) {
          resolve(null)
          return
        }
        request.post(config.api.login, {
          code: res.code,
          key: config.loginKey
        }).then(function (remote) {
          if (!remote || !remote.id) {
            resolve(null)
            return
          }
          resolve(saveUser(remote))
        }).catch(function (err) {
          console.warn('[user] login failed', err)
          resolve(null)
        })
      },
      fail: function () {
        resolve(null)
      }
    })
  })
}

module.exports = {
  autoLogin: autoLogin,
  getUser: getUser,
  getUserId: getUserId,
  getDisplayInfo: getDisplayInfo
}
