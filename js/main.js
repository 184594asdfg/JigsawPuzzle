/**
 * 小游戏入口：初始化全屏 Canvas、加载核心资源、推入首页场景、启动渲染循环。
 */
var rpx = require('./rpx')
var assets = require('./assets')
var screenManager = require('./screen-manager')
var bgm = require('./bgm')
var settings = require('../utils/settings')

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

var GLOBAL = {
  canvas: canvas,
  ctx: ctx,
  width: W,
  height: H,
  dpr: DPR
}
GameGlobal._jp = GLOBAL

// ---------------------------------------------------------------------------
//  关键资源预加载
// ---------------------------------------------------------------------------
var CORE_ASSETS = [
  'images/home-bg.jpg',
  'images/home-hero.png',
  'images/icons/rank.png',
  'images/icons/level.png',
  'images/icons/gallery.png',
  'images/themes/theme-unlocked.png',
  'images/themes/theme-locked.png',
  'images/themes/level-placeholder.png',
  'images/photo1.jpg',
  'images/merge_fx.png'
]

function drawLoadingScreen(progress) {
  ctx.fillStyle = '#5b6fd8'
  ctx.fillRect(0, 0, W, H)
  ctx.font = (rpx.rpx(48)).toFixed(0) + 'px sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('吉吉拼图', W / 2, H / 2 - rpx.rpx(40))
  ctx.font = (rpx.rpx(26)).toFixed(0) + 'px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText('加载中 ' + Math.floor(progress * 100) + '%', W / 2, H / 2 + rpx.rpx(40))
}

function preload() {
  return new Promise(function (resolve) {
    var total = CORE_ASSETS.length
    var done = 0
    drawLoadingScreen(0)

    function step(idx) {
      if (idx >= total) {
        resolve()
        return
      }
      assets.load(CORE_ASSETS[idx]).catch(function () {}).then(function () {
        done++
        drawLoadingScreen(done / total)
        step(idx + 1)
      })
    }
    step(0)
  })
}

// ---------------------------------------------------------------------------
//  输入与渲染循环
// ---------------------------------------------------------------------------
wx.onTouchStart(function (e) { screenManager.onTouchStart(e) })
wx.onTouchMove(function (e) { screenManager.onTouchMove(e) })
wx.onTouchEnd(function (e) { screenManager.onTouchEnd(e) })
wx.onTouchCancel(function (e) { screenManager.onTouchCancel(e) })

wx.onShow(function () { bgm.sync() })
wx.onHide(function () { bgm.pause() })

var lastTs = 0
function loop(ts) {
  var now = ts || Date.now()
  var dt = lastTs ? Math.min(64, now - lastTs) : 16
  lastTs = now
  ctx.clearRect(0, 0, W, H)
  screenManager.render(dt)
  requestAnimationFrame(loop)
}

// ---------------------------------------------------------------------------
//  启动
// ---------------------------------------------------------------------------
preload().then(function () {
  settings.init()
  bgm.start()
  var HomeScreen = require('./screens/home-screen')
  screenManager.push(new HomeScreen())
  requestAnimationFrame(loop)
})
