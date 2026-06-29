/**
 * 小游戏入口：开场加载页 → 资源就绪 → 直接进入首页
 */
var rpx = require('./rpx')
var assets = require('./assets')
var screenManager = require('./screen-manager')
var bgm = require('./bgm')
var settings = require('../utils/settings')
var remoteSync = require('../utils/remote-sync')
var prefetch = require('../utils/prefetch')
var loadingScreen = require('./screens/loading-screen')
var settingsModal = require('./settings-modal')
var share = require('./share')
var gameClub = require('./game-club')
var subpackUi = require('../utils/subpack-ui')
var user = require('../utils/user')
var stamina = require('../utils/stamina')
require('../utils/rank-modal')

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
  loadingScreen.LOADING_LOGO,
  'images/home-hero-grid-bg.png',
  'images/icons/level.png',
  'images/icons/gallery.png',
  'images/icons/rank.png',
  'images/icons/setting.png',
  'images/icons/game-club.png',
  'images/icons/stamina_bar_bg.png',
  'images/icons/stamina_modal.png',
  'images/icons/btn_stamina_recover.png',
  'images/themes/theme-unlocked.png',
  'images/themes/theme-locked.png',
  'images/themes/level-placeholder.png',
  'images/puzzle-card-back.png',
  'images/rank/rank_modal.png',
  'images/rank/rank_row.png',
  'images/rank/rank_my_row.png',
  'images/rank/rank_1.png',
  'images/rank/rank_2.png',
  'images/rank/rank_3.png'
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

  return remoteSync.syncOnEnter().then(function () {
    splash.hint = '正在同步进度...'
    splash.progress = Math.max(splash.progress, 0.78)
    splash.hint = '正在加载界面资源...'
    splash.progress = Math.max(splash.progress, 0.82)
    return subpackUi.preloadAll()
  }).then(function () {
    splash.hint = '正在加载主题封面...'
    splash.progress = Math.max(splash.progress, 0.86)
    return prefetch.waitForCurrentThemeCover(12000)
  }).then(function (coverResult) {
    if (coverResult && coverResult.ok && !coverResult.skipped) {
      splash.hint = '加载完成'
    } else if (coverResult && coverResult.timeout) {
      splash.hint = '封面加载较慢，即将进入'
    } else if (coverResult && coverResult.skipped) {
      splash.hint = '加载完成'
    } else {
      splash.hint = '封面加载失败，即将进入'
    }
    splash.progress = Math.max(splash.progress, 0.95)
    prefetch.prefetchNextLevelAssets()
  }).catch(function (err) {
    console.warn('[main] bootstrap failed', err)
    splash.hint = '部分数据加载失败，即将进入'
    return subpackUi.preloadAll().catch(function () {}).then(function () {
      return remoteSync.syncOnEnter().catch(function () {})
    }).then(function () {
      return prefetch.waitForCurrentThemeCover(8000)
    }).catch(function () {})
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
  remoteSync.syncOnEnter().then(function () {
    return subpackUi.preloadAll().catch(function () {})
  }).then(function () {
    prefetch.prefetchHomeAssets()
  }).catch(function () {})
})
wx.onHide(function () {
  bgm.pause()
  stamina.persist()
})

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
    stamina.tickOnline(dt)
    screenManager.render(dt)
  }

  requestAnimationFrame(loop)
}

requestAnimationFrame(loop)

settings.init()
if (share.SHOW_SHARE_BTN) {
  share.initShare()
  share.preload()
}
gameClub.preload()
loadingScreen.preload()

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
