/**
 * 用户模块（两条独立链路）：
 * 1. 静默登录：wx.login → POST /user/wxMiniLoginByCode → userId，用于进度同步（不调头像昵称接口）
 * 2. 头像昵称：用户点击头像 → wx.getUserProfile（经 wx-privacy-profile 隐私合规）→ POST /user/wxProfile
 */
var config = require('./app-config')
var request = require('./request')
var privacyProfile = require('./wx-privacy-profile')

var STORAGE_KEY = 'jigsaw_user'
var DEFAULT_NICKNAME = '游客'
var cachedUser = null
var profileButton = null
var profileButtonRectKey = null

var PROFILE_DESC = privacyProfile.DEFAULT_PROFILE_DESC

function getWxPlatform() {
  try {
    return (wx.getSystemInfoSync() || {}).platform || ''
  } catch (e) {
    return ''
  }
}

function isDevtools() {
  return getWxPlatform() === 'devtools'
}

function isDevelopEnv() {
  try {
    var account = wx.getAccountInfoSync()
    var v = account && account.miniProgram && account.miniProgram.envVersion
    return v === 'develop'
  } catch (e) {
    return false
  }
}

function canUseWxProfileAuth() {
  if (isDevtools()) return false
  return !!(typeof wx !== 'undefined' && wx.getUserProfile)
}

function trimText(value) {
  if (value == null) return ''
  return String(value).trim()
}

function resolveNickname(nickname) {
  var trimmed = trimText(nickname)
  if (!trimmed || trimmed === '玩家') return DEFAULT_NICKNAME
  return trimmed
}

function resolveAvatarUrl(avatarUrl) {
  return trimText(avatarUrl)
}

function getNickname() {
  var u = getUser()
  return resolveNickname(u && u.nickname)
}

function getAvatarUrl() {
  var u = getUser()
  return resolveAvatarUrl(u && u.avatarUrl)
}

function isRealProfileNickname(nickname) {
  var t = trimText(nickname)
  if (!t) return false
  if (t === '玩家' || t === DEFAULT_NICKNAME || t === '微信用户') return false
  return true
}

function hasStoredProfile() {
  var u = getUser()
  if (!u) return false
  return isRealProfileNickname(u.nickname) && !!trimText(u.avatarUrl)
}

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

function mergeLocalProfile(nickname, avatarUrl) {
  var u = getUser()
  if (!u) return null
  if (nickname) u.nickname = trimText(nickname)
  if (avatarUrl) u.avatarUrl = trimText(avatarUrl)
  cachedUser = u
  writeStorage(u)
  return u
}

function getDisplayInfo() {
  var name = getNickname()
  var avatarUrl = getAvatarUrl()
  if (!getUserId()) {
    return {
      name: name,
      subtitle: '暂无法同步进度，请检查网络',
      avatarUrl: avatarUrl
    }
  }
  return {
    name: name,
    subtitle: '进度将自动保存',
    avatarUrl: avatarUrl
  }
}

function saveUser(remote) {
  var prev = getUser()
  var sameUser = prev && remote && prev.id === remote.id
  var nick = trimText(remote.nickname)
  var avatar = trimText(remote.avatarUrl)
  if (!nick && sameUser) nick = trimText(prev.nickname)
  if (!avatar && sameUser) avatar = trimText(prev.avatarUrl)
  var user = {
    id: remote.id,
    openid: remote.openid || (sameUser && prev.openid) || '',
    nickname: nick,
    avatarUrl: avatar,
    loginTime: Date.now()
  }
  cachedUser = user
  writeStorage(user)
  return user
}

function uploadProfile(nickname, avatarUrl) {
  var userId = getUserId()
  if (!userId) return Promise.reject(new Error('not logged in'))
  var nick = trimText(nickname)
  var avatar = trimText(avatarUrl)
  if (!nick && !avatar) return Promise.reject(new Error('empty profile'))
  return request.post(config.api.profile, {
    userId: userId,
    nickname: nick,
    avatarUrl: avatar
  }).then(function (remote) {
    mergeLocalProfile(
      (remote && remote.nickname) || nick,
      (remote && remote.avatarUrl) || avatar
    )
    try {
      require('./rank-data').refreshNational()
    } catch (e) {}
    try {
      var assets = require('../js/assets')
      var oldAvatar = getAvatarUrl()
      if (oldAvatar) assets.clear(oldAvatar)
      if (avatar) assets.clear(avatar)
    } catch (e) {}
    return getUser()
  }).catch(function (err) {
    console.warn('[user] uploadProfile failed', err)
    return Promise.reject(err || new Error('upload profile failed'))
  })
}

function isProfileCancel(err) {
  var msg = String((err && err.errMsg) || (err && err.message) || err || '')
  return msg.indexOf('cancel') >= 0 || msg.indexOf('deny') >= 0 || msg.indexOf('拒绝') >= 0
}

function normalizeAvatarStyle(style) {
  var rpxMod = require('../js/rpx')
  if (!style) return null
  var left = style.left != null ? style.left : style.x
  var top = style.top != null ? style.top : style.y
  var width = style.width != null ? style.width : style.w
  var height = style.height != null ? style.height : style.h
  if (!width || !height) return null
  return {
    left: Math.max(0, Math.round(left)),
    top: Math.max(0, Math.round(top)),
    width: Math.round(width),
    height: Math.round(height)
  }
}

function destroyProfileButton() {
  if (!profileButton) return
  try { profileButton.destroy() } catch (e) {}
  profileButton = null
  profileButtonRectKey = null
}

function parseButtonUserInfo(res) {
  if (res && res.userInfo) return res.userInfo
  if (res && res.errMsg && res.errMsg.indexOf(':ok') > -1 && res.rawData) {
    try {
      var data = JSON.parse(res.rawData)
      if (data && data.nickName) return data
    } catch (e) {}
  }
  return null
}

/** 小游戏兜底：getUserProfile 不可用时，用微信原生 createUserInfoButton（透明盖在头像上） */
function requestProfileViaUserInfoButton(style) {
  var rect = normalizeAvatarStyle(style)
  if (!rect || !wx.createUserInfoButton) {
    return Promise.reject(new Error('createUserInfoButton unsupported'))
  }
  destroyProfileButton()
  return new Promise(function (resolve, reject) {
    try {
      var radius = Math.round(Math.min(rect.width, rect.height) / 2)
      var btn = wx.createUserInfoButton({
        type: 'text',
        text: ' ',
        style: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          backgroundColor: 'rgba(0,0,0,0)',
          color: 'rgba(0,0,0,0)',
          fontSize: 1,
          lineHeight: rect.height,
          textAlign: 'center',
          borderRadius: radius
        }
      })
      profileButton = btn
      profileButtonRectKey = [rect.left, rect.top, rect.width, rect.height].join(',')
      btn.onTap(function (res) {
        var info = parseButtonUserInfo(res)
        if (!info) {
          reject(res || new Error('profile denied'))
          return
        }
        destroyProfileButton()
        uploadProfile(info.nickName, info.avatarUrl).then(resolve).catch(reject)
      })
    } catch (e) {
      destroyProfileButton()
      reject(e)
    }
  })
}

function applyProfileUserInfo(userInfo) {
  return uploadProfile(userInfo.nickName, userInfo.avatarUrl)
}

function showProfileError(err, opts) {
  opts = opts || {}
  if (isProfileCancel(err)) return
  var msg = ''
  if (err && err.errMsg) msg = String(err.errMsg)
  else if (err && err.message) msg = String(err.message)
  else if (err) msg = String(err)
  var lower = msg.toLowerCase()
  try {
    if (lower.indexOf('upload') >= 0 || lower.indexOf('http') >= 0 || lower.indexOf('请求失败') >= 0 || lower.indexOf('network') >= 0) {
      wx.showToast({ title: '资料同步失败，请检查网络', icon: 'none', duration: 2500 })
    } else if (lower.indexOf('not logged in') >= 0) {
      wx.showToast({ title: '正在登录，请稍后再试', icon: 'none', duration: 2500 })
    }
  } catch (e) {}
  console.warn('[user] profile error', err)
}

/** 转发至 wx-privacy-profile 全局初始化（game.js / app.js 入口调用） */
function initPrivacyAuthorization() {
  return privacyProfile.initPrivacyGlobal()
}

/**
 * 用户点击头像：同步 getUserProfile；小游戏失败时兜底 createUserInfoButton
 * @param {object} [style] 头像区域 {x,y,w,h}，兜底按钮定位用
 */
function requestWxProfileFromTap(style) {
  if (!getUserId()) {
    showProfileError(new Error('not logged in'))
    autoLogin().catch(function () {})
    return Promise.reject(new Error('not logged in'))
  }
  if (hasStoredProfile()) {
    return Promise.resolve(getUser())
  }
  if (isDevtools()) {
    return Promise.reject(new Error('profile env unsupported'))
  }

  return privacyProfile.getUserProfileFromTap({ desc: PROFILE_DESC })
    .then(applyProfileUserInfo)
    .catch(function (err) {
      if (isProfileCancel(err)) {
        showProfileError(err)
        throw err
      }
      console.warn('[user] getUserProfileFromTap fail, try createUserInfoButton', err)
      if (wx.createUserInfoButton && style) {
        return requestProfileViaUserInfoButton(style)
      }
      showProfileError(err)
      throw err
    })
}

/** 打开设置时预挂透明原生按钮（仅 getUserProfile 失败后的兜底场景会提示再点一次） */
function syncProfileButton(style, active) {
  if (!active || !needsProfilePrompt() || isDevtools() || !wx.createUserInfoButton) {
    destroyProfileButton()
    return
  }
  var rect = normalizeAvatarStyle(style)
  if (!rect) return
  var key = [rect.left, rect.top, rect.width, rect.height].join(',')
  if (profileButton && profileButtonRectKey === key) return
  destroyProfileButton()
  try {
    var radius = Math.round(Math.min(rect.width, rect.height) / 2)
    profileButton = wx.createUserInfoButton({
      type: 'text',
      text: ' ',
      style: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        backgroundColor: 'rgba(0,0,0,0)',
        color: 'rgba(0,0,0,0)',
        fontSize: 1,
        lineHeight: rect.height,
        textAlign: 'center',
        borderRadius: radius
      }
    })
    profileButtonRectKey = key
    profileButton.onTap(function (res) {
      var info = parseButtonUserInfo(res)
      if (!info) return
      destroyProfileButton()
      applyProfileUserInfo(info).catch(showProfileError)
    })
  } catch (e) {
    destroyProfileButton()
  }
}

function needsProfilePrompt() {
  return !!getUserId() && !hasStoredProfile()
}

function clearProfileAuthorizePending() {
  destroyProfileButton()
}

function promptAndSyncProfile(style) {
  return requestWxProfileFromTap(style)
}

function syncProfileFromWx(style) {
  return requestWxProfileFromTap(style)
}

function trySyncProfileSilent() {
  return Promise.resolve(getUserId() ? getUser() : null)
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
  DEFAULT_NICKNAME: DEFAULT_NICKNAME,
  autoLogin: autoLogin,
  getUser: getUser,
  getUserId: getUserId,
  getNickname: getNickname,
  getAvatarUrl: getAvatarUrl,
  hasStoredProfile: hasStoredProfile,
  resolveNickname: resolveNickname,
  resolveAvatarUrl: resolveAvatarUrl,
  getDisplayInfo: getDisplayInfo,
  needsProfilePrompt: needsProfilePrompt,
  isDevelopEnv: isDevelopEnv,
  canUseWxProfileAuth: canUseWxProfileAuth,
  requestWxProfileFromTap: requestWxProfileFromTap,
  syncProfileButton: syncProfileButton,
  promptAndSyncProfile: promptAndSyncProfile,
  syncProfileFromWx: syncProfileFromWx,
  trySyncProfileSilent: trySyncProfileSilent,
  destroyProfileButton: destroyProfileButton,
  clearProfileAuthorizePending: clearProfileAuthorizePending,
  showProfileError: showProfileError,
  initPrivacyAuthorization: initPrivacyAuthorization,
  privacyProfile: privacyProfile
}
