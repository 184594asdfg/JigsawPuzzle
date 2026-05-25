/**
 * 小游戏入口：开场加载页 → 资源就绪 → 直接进入首页
 */
var rpx = require('./rpx')
var assets = require('./assets')
var screenManager = require('./screen-manager')
var bgm = require('./bgm')
var settings = require('../utils/settings')
var user = require('../utils/user')
var galleryData = require('../utils/gallery-data')
var progress = require('../utils/progress')
var prefetch = require('../utils/prefetch')
var loadingScreen = require('./screens/loading-screen')
var settingsModal = require('./settings-modal')

var canvas = wx.createCanvas()
var ctx = canvas.getContext('2d')

var info
try {
  info = wx.getSystemInfoSync()
} catch (e) {
  info = { windowWidth: 375, windowHeight: 667, pixelRatio: 1 }
}

rpx.init(info)

var W = rpx.windowWidth()
var H = rpx.windowHeight()
var DPR = rpx.pixelRatio() || 1

canvas.width = Math.round(W * DPR)
canvas.height = Math.round(H * DPR)
ctx.scale(DPR, DPR)

screenManager.attach(ctx)

GameGlobal._jp = { canvas: canvas, ctx: ctx, width: W, height: H, dpr: DPR }

var CORE_ASSETS = [
  'images/home-bg.jpg',
  'images/home-hero.png',
  'images/icons/rank.png',
  'images/icons/level.png',
  'images/icons/gallery.png',
  'images/icons/setting.png',
  'images/themes/theme-unlocked.png',
  'images/themes/theme-locked.png',
  'images/themes/level-placeholder.png',
  'images/merge_fx.png'
]

/** splash.phase: loading | done */
var splash = {
  phase: 'loading',
  progress: 0,
  hint: '正在加载资源...',
  spinner: 0,
  loadDone: false
}

var SPLASH_MIN_MS = 500
var SPLASH_DONE_HOLD_MS = 280
var splashShownAt = Date.now()

function canInteract() {
  return splash.phase === 'done'
}

function preloadAssets() {
  return new Promise(function (resolve) {
    var total = CORE_ASSETS.length
    var done = 0
    function step(i) {
      if (i >= total) {
        splash.progress = Math.max(splash.progress, 0.38)
        resolve()
        return
      }
      assets.load(CORE_ASSETS[i]).catch(function () {}).then(function () {
        done++
        splash.progress = (done / total) * 0.38
        splash.hint = '正在加载资源...'
        step(i + 1)
      })
    }
    step(0)
  })
}

function bootstrapData() {
  splash.hint = '正在加载关卡...'
  splash.progress = Math.max(splash.progress, 0.42)

  settingsModal.preload()

  var themesPromise = galleryData.loadThemes({ summary: true })
  var loginPromise = user.autoLogin()

  return Promise.all([themesPromise, loginPromise]).then(function () {
    splash.hint = '正在同步进度...'
    splash.progress = Math.max(splash.progress, 0.78)
    return progress.loadFromServer()
  }).then(function () {
    splash.progress = Math.max(splash.progress, 0.92)
    prefetch.prefetchNextLevelAssets()
  }).catch(function (err) {
    console.warn('[main] bootstrap failed', err)
    splash.hint = '部分数据加载失败，即将进入'
    return progress.loadFromServer().catch(function () {})
  })
}

function enterHome() {
  splash.phase = 'done'
  splash.progress = 1
  splash.hint = '加载完成'
  var HomeScreen = require('./screens/home-screen')
  screenManager.push(new HomeScreen())
  bgm.start()
}

function scheduleEnterHome() {
  var elapsed = Date.now() - splashShownAt
  var minWait = Math.max(0, SPLASH_MIN_MS - elapsed)
  setTimeout(function () {
    if (splash.phase !== 'loading' || !splash.loadDone) return
    splash.progress = 1
    splash.hint = '加载完成'
    setTimeout(enterHome, SPLASH_DONE_HOLD_MS)
  }, minWait)
}

wx.onTouchStart(function (e) { if (canInteract()) screenManager.onTouchStart(e) })
wx.onTouchMove(function (e) { if (canInteract()) screenManager.onTouchMove(e) })
wx.onTouchEnd(function (e) { if (canInteract()) screenManager.onTouchEnd(e) })
wx.onTouchCancel(function (e) { if (canInteract()) screenManager.onTouchCancel(e) })

wx.onShow(function () {
  if (!canInteract()) return
  bgm.sync()
  galleryData.loadThemes({ summary: true }).then(function () {
    return user.autoLogin()
  }).then(function () {
    return progress.loadFromServer()
  }).then(function () {
    prefetch.prefetchNextLevelAssets()
  }).catch(function () {})
})
wx.onHide(function () { bgm.pause() })

var lastTs = 0
function loop(ts) {
  var now = ts || Date.now()
  var dt = lastTs ? Math.min(64, now - lastTs) : 16
  lastTs = now
  ctx.clearRect(0, 0, W, H)

  if (splash.phase === 'loading') {
    loadingScreen.update(splash, dt)
    loadingScreen.render(ctx, splash, 1)
  } else {
    screenManager.render(dt)
  }

  requestAnimationFrame(loop)
}

requestAnimationFrame(loop)

settings.init()

Promise.all([
  preloadAssets(),
  bootstrapData()
]).then(function () {
  splash.loadDone = true
  scheduleEnterHome()
}).catch(function (err) {
  console.error('[main] startup failed', err)
  splash.loadDone = true
  splash.hint = '加载异常，即将进入'
  scheduleEnterHome()
})
