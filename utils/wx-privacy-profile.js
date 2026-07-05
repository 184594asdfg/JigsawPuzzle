/**
 * 微信小游戏 — 隐私合规 + wx.getUserProfile 封装
 *
 * 官方隐私弹窗模式（未注册 onNeedPrivacyAuthorization）：
 * - 用户点击时先 wx.requirePrivacyAuthorize → 平台统一弹窗
 * - 同意后再 wx.getUserProfile
 *
 * MP 后台：设置 → 服务内容声明 → 用户隐私保护指引
 * → 勾选「用户信息（昵称、头像）」→ 启用「官方隐私弹窗」组件
 *
 * 调用注意：
 * - requirePrivacyAuthorize / getUserProfile 须在用户点击回调里同步发起（勿 setTimeout / 先 await 网络）
 * - 真机体验版测试；开发者工具隐私接口不稳定
 */

var DEFAULT_PROFILE_DESC = '用于在排行榜与个人资料展示您的头像和昵称'

/** 是否 errno 1026 / 隐私门闸错误 */
function isPrivacyGateError(err) {
  if (!err) return false
  if (err.errno === 1026) return true
  var msg = String(err.errMsg || err.message || err).toLowerCase()
  return msg.indexOf('onneedprivacyauthorization') >= 0 ||
    msg.indexOf('official popup') >= 0 ||
    msg.indexOf('announce your privacy') >= 0
}

/** 主动拉起官方隐私授权（可选，getUserProfile 前） */
function requirePrivacyAuthorizeAsync() {
  return new Promise(function (resolve, reject) {
    if (!wx.requirePrivacyAuthorize) {
      resolve()
      return
    }
    wx.requirePrivacyAuthorize({
      success: function () { resolve() },
      fail: function (err) { reject(err || new Error('requirePrivacyAuthorize fail')) }
    })
  })
}

/** 用户点击时调用（小游戏 Canvas 点头像）— 先拉起官方隐私弹窗，再 getUserProfile */
function getUserProfileFromTap(options) {
  options = options || {}
  var desc = options.desc || DEFAULT_PROFILE_DESC

  if (!wx.getUserProfile) {
    return Promise.reject(new Error('wx.getUserProfile unsupported'))
  }

  function callGetUserProfile() {
    return new Promise(function (resolve, reject) {
      wx.getUserProfile({
        desc: desc,
        success: function (res) {
          if (!res || !res.userInfo) {
            reject(new Error('getUserProfile: no userInfo'))
            return
          }
          resolve(res.userInfo)
        },
        fail: function (err) {
          reject(err || new Error('getUserProfile fail'))
        }
      })
    })
  }

  // 未注册 onNeedPrivacyAuthorization 时，须 requirePrivacyAuthorize 才会弹出平台官方弹窗
  if (!wx.requirePrivacyAuthorize) {
    return callGetUserProfile()
  }

  return requirePrivacyAuthorizeAsync().then(callGetUserProfile)
}

/** 小程序页面 async/await 用 */
function getUserProfileAsync(options) {
  options = options || {}
  var desc = options.desc || DEFAULT_PROFILE_DESC

  if (!wx.getUserProfile) {
    return Promise.reject(new Error('wx.getUserProfile unsupported'))
  }

  return requirePrivacyAuthorizeAsync().then(function () {
    return new Promise(function (resolve, reject) {
      wx.getUserProfile({
        desc: desc,
        success: function (res) {
          if (!res || !res.userInfo) {
            reject(new Error('getUserProfile: no userInfo'))
            return
          }
          resolve(res.userInfo)
        },
        fail: function (err) {
          reject(err || new Error('getUserProfile fail'))
        }
      })
    })
  })
}

/** 查询是否仍需隐私授权（调试用） */
function getPrivacySettingAsync() {
  return new Promise(function (resolve, reject) {
    if (!wx.getPrivacySetting) {
      resolve({ needAuthorization: false, privacyContractName: '' })
      return
    }
    wx.getPrivacySetting({
      success: function (res) {
        resolve({
          needAuthorization: !!(res && res.needAuthorization),
          privacyContractName: (res && res.privacyContractName) || ''
        })
      },
      fail: reject
    })
  })
}

module.exports = {
  DEFAULT_PROFILE_DESC: DEFAULT_PROFILE_DESC,
  isPrivacyGateError: isPrivacyGateError,
  requirePrivacyAuthorizeAsync: requirePrivacyAuthorizeAsync,
  getUserProfileFromTap: getUserProfileFromTap,
  getUserProfileAsync: getUserProfileAsync,
  getPrivacySettingAsync: getPrivacySettingAsync
}
