/**
 * 小游戏入口
 */
var rpx = require('./rpx')
var assets = require('./assets')
var screenManager = require('./screen-manager')
var bgm = require('./bgm')
var settings = require('../utils/settings')
var user = require('../utils/user')
var galleryData = require('../utils/gallery-data')
var progress = require('../utils/progress')

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
  'images/themes/theme-unlocked.png',
  'images/themes/theme-locked.png',
  'images/themes/level-placeholder.png',
  'images/merge_fx.png'
]

var appReady = false
var loadingProgress = 0
var loadingHint = '加载资源...'

function drawLoadingScreen() {
  ctx.fillStyle = '#5b6fd8'
  ctx.fillRect(0, 0, W, H)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = rpx.rpx(48).toFixed(0) + 'px sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.fillText('吉吉拼图', W / 2, H / 2 - rpx.rpx(48))
  ctx.font = rpx.rpx(26).toFixed(0) + 'px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.fillText(loadingHint, W / 2, H / 2 + rpx.rpx(8))
  ctx.fillText(Math.floor(loadingProgress * 100) + '%', W / 2, H / 2 + rpx.rpx(48))
}

function preloadAssets() {
  return new Promise(function (resolve) {
    var total = CORE_ASSETS.length
    var done = 0
    function step(i) {
      if (i >= total) {
        loadingProgress = Math.max(loadingProgress, 0.35)
        resolve()
        return
      }
      assets.load(CORE_ASSETS[i]).catch(function () {}).then(function () {
        done++
        loadingProgress = (done / total) * 0.35
        step(i + 1)
      })
    }
    step(0)
  })
}

function preloadGameplayImages() {
  var themes = galleryData.getThemes()
  var next = progress.getNextLevel(themes)
  var urls = []
  if (next && next.theme && next.theme.themeImage) urls.push(next.theme.themeImage)
  if (next && next.level && next.level.image) urls.push(next.level.image)
  if (!urls.length) return Promise.resolve()
  return assets.loadAll(urls)
}

function bootstrapData() {
  loadingHint = '加载关卡...'
  loadingProgress = 0.45

  var themesPromise = galleryData.loadThemes()
  var loginPromise = user.autoLogin()

  return Promise.all([themesPromise, loginPromise]).then(function () {
    loadingHint = '同步进度...'
    loadingProgress = 0.75
    return progress.loadFromServer()
  }).then(function () {
    loadingHint = '准备拼图...'
    loadingProgress = 0.9
    return preloadGameplayImages()
  }).catch(function (err) {
    console.warn('[main] bootstrap failed', err)
    loadingHint = '离线模式...'
    return galleryData.loadThemes().then(function () {
      return progress.loadFromServer()
    })
  })
}

wx.onTouchStart(function (e) { if (appReady) screenManager.onTouchStart(e) })
wx.onTouchMove(function (e) { if (appReady) screenManager.onTouchMove(e) })
wx.onTouchEnd(function (e) { if (appReady) screenManager.onTouchEnd(e) })
wx.onTouchCancel(function (e) { if (appReady) screenManager.onTouchCancel(e) })

wx.onShow(function () {
  if (!appReady) return
  bgm.sync()
  galleryData.loadThemes().then(function () {
    return user.autoLogin()
  }).then(function () {
    return progress.loadFromServer()
  }).catch(function () {})
})
wx.onHide(function () { bgm.pause() })

var lastTs = 0
function loop(ts) {
  var now = ts || Date.now()
  var dt = lastTs ? Math.min(64, now - lastTs) : 16
  lastTs = now
  ctx.clearRect(0, 0, W, H)
  if (!appReady) {
    drawLoadingScreen()
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
  loadingProgress = 1
  loadingHint = '完成'
  appReady = true
  bgm.start()
  var HomeScreen = require('./screens/home-screen')
  screenManager.push(new HomeScreen())
}).catch(function (err) {
  console.error('[main] startup failed', err)
  appReady = true
  var HomeScreen = require('./screens/home-screen')
  screenManager.push(new HomeScreen())
})
