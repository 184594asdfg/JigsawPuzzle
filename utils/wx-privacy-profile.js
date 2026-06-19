/**
 * 微信小程序 / 小游戏 — 隐私合规 + wx.getUserProfile 封装
 *
 * =============================================================================
 * 排查 errno:1026 要点
 * =============================================================================
 * 报错：getUserInfo:fail please go to mp open official popup
 *       or use wx.onNeedPrivacyAuthorization …
 *
 * 1. MP 后台（必做）
 *    登录 mp.weixin.qq.com → 设置 → 服务内容声明 → 用户隐私保护指引
 *    → 勾选「用户信息（昵称、头像）」→ 提交审核 → 通过后重新上传体验版/正式版
 *    提审时勾选「采集用户隐私」
 *
 * 2. 基础库版本
 *    建议 >= 2.32.3；过低无 onNeedPrivacyAuthorization / requirePrivacyAuthorize
 *    开发者工具可开「调试基础库」验证
 *
 * 3. 调用顺序踩坑（最常见）
 *    ✓ onNeedPrivacyAuthorization 在 app.onLaunch / game.js 最开头注册，全局仅一次
 *    ✓ getUserProfile 必须在「用户点击」回调的同步链路里触发（不能 setTimeout 后再调）
 *    ✓ 注册 onNeedPrivacyAuthorization 后，必须 resolve({ event: 'agree'|'disagree' })
 *    ✗ 不要先 await 网络请求再 getUserProfile（手势链断裂）
 *    ✗ 不要单独调用 wx.getUserInfo 获取头像昵称（已废弃，统一 getUserProfile）
 *    ✗ 真机调试(develop) 隐私接口常不稳定 → 请用「体验版」扫码测试
 *
 * 4. 官方隐私弹窗 vs 自定义弹窗
 *    - MP 后台开启「官方隐私弹窗」：可不写 onNeedPrivacyAuthorization
 *    - 自定义弹窗：必须 wx.onNeedPrivacyAuthorization + resolve
 *
 * =============================================================================
 * 两种监听写法
 * =============================================================================
 *
 * 【写法 A】app.js / game.js 全局监听（推荐，本项目采用）
 *
 *   // app.js（小程序）
 *   const privacy = require('./utils/wx-privacy-profile')
 *   App({
 *     onLaunch() {
 *       privacy.initPrivacyGlobal()
 *     }
 *   })
 *
 *   // game.js（小游戏，须在所有 require 之前）
 *   require('./utils/wx-privacy-profile').initPrivacyGlobal()
 *   require('./js/main.js')
 *
 * 【写法 B】页面内单独监听（仅该页使用隐私接口时）
 *
 *   // pages/profile/profile.js
 *   const privacy = require('../../utils/wx-privacy-profile')
 *   Page({
 *     onLoad() {
 *       privacy.initPrivacyOnPage(this) // 页面卸载时自动解除
 *     },
 *     async onTapAvatar() {
 *       try {
 *         const userInfo = await privacy.getUserProfileAsync({ desc: '用于展示头像昵称' })
 *         console.log(userInfo.nickName, userInfo.avatarUrl)
 *       } catch (e) { console.warn(e) }
 *     }
 *   })
 *
 * =============================================================================
 * async/await 调用示例
 * =============================================================================
 *
 *   // 须在按钮 bindtap / 点击回调里调用
 *   async onAuthorizeTap() {
 *     try {
 *       const userInfo = await getUserProfileAsync({
 *         desc: '用于在排行榜展示您的头像和昵称'
 *       })
 *       // userInfo: { nickName, avatarUrl, gender, country, province, city, language }
 *     } catch (err) {
 *       if (err && String(err.errMsg || '').indexOf('cancel') >= 0) return
 *       console.warn(err)
 *     }
 *   }
 */

var GLOBAL_FLAG = '__wxPrivacyGlobalInited__'
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

/**
 * 弹出隐私协议确认（供 onNeedPrivacyAuthorization 回调使用）
 * @param {function} resolve 微信传入的 resolve，须调用 resolve({ event })
 * @param {object} [eventInfo]
 */
function showPrivacyModal(resolve, eventInfo) {
  if (eventInfo && eventInfo.referrer) {
    console.log('[wx-privacy-profile] need authorization for:', eventInfo.referrer)
  }
  // 告知平台：弹窗已曝光
  resolve({ event: 'exposureAuthorization' })

  wx.showModal({
    title: '用户隐私保护提示',
    content: '我们将获取您的昵称和头像，用于排行榜与个人资料展示。是否同意《用户隐私保护指引》？',
    confirmText: '同意',
    cancelText: '拒绝',
    success: function (res) {
      resolve({ event: res.confirm ? 'agree' : 'disagree' })
    },
    fail: function () {
      resolve({ event: 'disagree' })
    }
  })
}

/**
 * 【写法 A】全局监听 — 在 app.onLaunch / game.js 入口调用一次
 * 全项目共用一个弹窗逻辑；之后任意页面/场景调 getUserProfile 均生效
 */
function initPrivacyGlobal() {
  if (typeof wx === 'undefined') return false
  if (wx[GLOBAL_FLAG]) return true
  if (!wx.onNeedPrivacyAuthorization) {
    console.warn('[wx-privacy-profile] 无 onNeedPrivacyAuthorization，请在 MP 开启官方隐私弹窗或升级基础库')
    return false
  }

  wx.onNeedPrivacyAuthorization(function (resolve, eventInfo) {
    showPrivacyModal(resolve, eventInfo)
  })

  wx[GLOBAL_FLAG] = true
  console.log('[wx-privacy-profile] initPrivacyGlobal ok')
  return true
}

/**
 * 【写法 B】页面级监听 — 在 Page.onLoad 调用
 * @param {object} pageInst Page 实例，onUnload 时标记解除（微信侧监听为全局，页面级主要用于文档示例与日志隔离）
 */
function initPrivacyOnPage(pageInst) {
  if (typeof wx === 'undefined' || !wx.onNeedPrivacyAuthorization) return false

  // 若已全局初始化，页面无需重复注册
  if (wx[GLOBAL_FLAG]) {
    if (pageInst) pageInst.__privacyPageListener = true
    return true
  }

  wx.onNeedPrivacyAuthorization(function (resolve, eventInfo) {
    console.log('[wx-privacy-profile] page listener', pageInst && pageInst.route)
    showPrivacyModal(resolve, eventInfo)
  })

  if (pageInst) {
    pageInst.__privacyPageListener = true
    var origUnload = pageInst.onUnload
    pageInst.onUnload = function () {
      pageInst.__privacyPageListener = false
      if (typeof origUnload === 'function') origUnload.call(this)
    }
  }
  return true
}

/**
 * Promise 封装：请求用户同意隐私协议（主动拉起，适合点击后、getUserProfile 之前）
 * @returns {Promise<void>}
 */
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

/**
 * 在用户点击回调里同步发起 getUserProfile（不能先 await requirePrivacyAuthorize，否则手势失效）
 * 隐私协议由 onNeedPrivacyAuthorization / 平台官方弹窗处理，此处不再前置 requirePrivacyAuthorize
 */
function getUserProfileFromTap(options) {
  options = options || {}
  var desc = options.desc || DEFAULT_PROFILE_DESC

  if (!wx.getUserProfile) {
    return Promise.reject(new Error('wx.getUserProfile unsupported'))
  }

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

/**
 * Promise 封装（小程序页面内 async/await 用；小游戏 Canvas 点头像请用 getUserProfileFromTap）
 */
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

/**
 * 查询是否仍需用户授权隐私协议（调试用）
 * @returns {Promise<{needAuthorization:boolean, privacyContractName:string}>}
 */
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
  initPrivacyGlobal: initPrivacyGlobal,
  initPrivacyOnPage: initPrivacyOnPage,
  requirePrivacyAuthorizeAsync: requirePrivacyAuthorizeAsync,
  getUserProfileFromTap: getUserProfileFromTap,
  getUserProfileAsync: getUserProfileAsync,
  getPrivacySettingAsync: getPrivacySettingAsync,
  /** 兼容旧入口 */
  initPrivacyAuthorization: initPrivacyGlobal
}
