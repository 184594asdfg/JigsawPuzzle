/**
 * 用户：仅静默登录（wx.login + 后端换 openid），不获取微信头像与昵称。
 * 设置页只用固定展示名 + 同步状态文案，内部 userId 仅给接口用。
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

/**
 * 设置页展示（与静默登录一致，不出现「登录」按钮或真实头像昵称）
 * @returns {{ name: string, subtitle: string }}
 */
function getDisplayInfo() {
  if (!getUserId()) {
    return {
      name: '吉吉玩家',
      subtitle: '暂无法同步进度，请检查网络'
    }
  }
  return {
    name: '吉吉玩家',
    subtitle: '进度将自动保存'
  }
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
