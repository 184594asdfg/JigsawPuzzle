/**
 * 倒计时结束遮罩：标题 + 中间序列帧 + 返回首页 / 观看加时
 */
var rpx = require('./rpx')
var assets = require('./assets')
var draw = require('./draw')
var pressAnim = require('./press-anim')
var subpackUi = require('../utils/subpack-ui')

var TIMEUP_TITLE = subpackUi.uiPath('images/timeup/timeup_title.png')
var BTN_HOME = subpackUi.uiPath('images/timeup/timeup_btn_restart.png')
var BTN_WATCH_ADD_TIME = subpackUi.uiPath('images/timeup/btn_watch_add_time.png')

/** 静态路径列表，避免 devtools ignoreDevUnusedFiles 漏打包动态拼接路径 */
var FX_FRAMES = [
  subpackUi.uiPath('images/timeup/fx/timeup_fx_01.png'),
  subpackUi.uiPath('images/timeup/fx/timeup_fx_02.png'),
  subpackUi.uiPath('images/timeup/fx/timeup_fx_03.png'),
  subpackUi.uiPath('images/timeup/fx/timeup_fx_04.png'),
  subpackUi.uiPath('images/timeup/fx/timeup_fx_05.png'),
  subpackUi.uiPath('images/timeup/fx/timeup_fx_06.png'),
  subpackUi.uiPath('images/timeup/fx/timeup_fx_07.png'),
  subpackUi.uiPath('images/timeup/fx/timeup_fx_08.png'),
  subpackUi.uiPath('images/timeup/fx/timeup_fx_09.png'),
  subpackUi.uiPath('images/timeup/fx/timeup_fx_10.png'),
  subpackUi.uiPath('images/timeup/fx/timeup_fx_11.png'),
  subpackUi.uiPath('images/timeup/fx/timeup_fx_12.png'),
  subpackUi.uiPath('images/timeup/fx/timeup_fx_13.png'),
  subpackUi.uiPath('images/timeup/fx/timeup_fx_14.png'),
  subpackUi.uiPath('images/timeup/fx/timeup_fx_15.png'),
  subpackUi.uiPath('images/timeup/fx/timeup_fx_16.png'),
  subpackUi.uiPath('images/timeup/fx/timeup_fx_17.png'),
  subpackUi.uiPath('images/timeup/fx/timeup_fx_18.png'),
  subpackUi.uiPath('images/timeup/fx/timeup_fx_19.png'),
  subpackUi.uiPath('images/timeup/fx/timeup_fx_20.png')
]

var FX_FRAME_COUNT = FX_FRAMES.length
var FX_FPS = 20
var FX_DUR_MS = FX_FRAME_COUNT * 1000 / FX_FPS
var FX_LOOP = true

/** 标题「时间耗尽」@2x 728×304，屏上显示宽（rpx，略大于 364） */
var TITLE_W_RPX = 500
var BTN_W_RPX = 567 / 2
var BTN_H_RPX = 239 / 2
/** 序列帧显示尺寸（@2x 源图 444×486，此处为屏上 rpx，可按需放大） */
var FX_W_RPX = 260
var FX_H_RPX = 284

var BTN_GAP_RPX = 48
var TITLE_Y_RATIO = 0.24
var FX_Y_RATIO = 0.48
var BTN_ROW_Y_RATIO = 0.72
/** 按钮行额外下移（rpx） */
var BTN_ROW_OFFSET_Y_RPX = 50
var MASK_ALPHA = 0.72

function fxFramePath(index) {
  if (index < 0) return FX_FRAMES[0]
  if (index >= FX_FRAME_COUNT) return FX_FRAMES[FX_FRAME_COUNT - 1]
  return FX_FRAMES[index]
}

function ensureFxLoaded() {
  for (var i = 0; i < FX_FRAME_COUNT; i++) {
    var path = FX_FRAMES[i]
    if (assets.hasFailed(path)) assets.clearFailed(path)
    if (!assets.get(path) && !assets.isLoading(path)) {
      assets.load(path).catch(function () {})
    }
  }
}

function preload() {
  assets.load(TIMEUP_TITLE)
  assets.load(BTN_HOME)
  assets.load(BTN_WATCH_ADD_TIME)
  ensureFxLoaded()
}

function resetFx(screen) {
  if (!screen) return
  screen._timeupFxMs = 0
  ensureFxLoaded()
}

function tickFx(screen, dt) {
  if (!screen || !screen.countdownEnded) return
  if (screen._timeupFxMs == null) screen._timeupFxMs = 0
  screen._timeupFxMs += dt
  if (FX_LOOP) {
    while (screen._timeupFxMs >= FX_DUR_MS) {
      screen._timeupFxMs -= FX_DUR_MS
    }
  } else if (screen._timeupFxMs > FX_DUR_MS) {
    screen._timeupFxMs = FX_DUR_MS
  }
}

function getFxFrameIndex(fxMs) {
  var ms = fxMs > 0 ? fxMs : 0
  var idx = Math.floor(ms * FX_FPS / 1000)
  if (idx < 0) return 0
  if (idx >= FX_FRAME_COUNT) return FX_FRAME_COUNT - 1
  return idx
}

function computeLayout(W, H) {
  var titleW = rpx.rpx(TITLE_W_RPX)
  var btnW = rpx.rpx(BTN_W_RPX)
  var btnH = rpx.rpx(BTN_H_RPX)
  var fxW = rpx.rpx(FX_W_RPX)
  var fxH = rpx.rpx(FX_H_RPX)
  var gap = rpx.rpx(BTN_GAP_RPX)
  return {
    titleCy: H * TITLE_Y_RATIO,
    titleW: titleW,
    fxCy: H * FX_Y_RATIO,
    fxW: fxW,
    fxH: fxH,
    btnCy: H * BTN_ROW_Y_RATIO + rpx.rpx(BTN_ROW_OFFSET_Y_RPX),
    btnW: btnW,
    btnH: btnH,
    homeCx: W / 2 - btnW / 2 - gap / 2,
    watchCx: W / 2 + btnW / 2 + gap / 2
  }
}

function rectCentered(cx, cy, w, h) {
  return { x: cx - w / 2, y: cy - h / 2, w: w, h: h }
}

function drawImageByWidth(ctx, img, cx, cy, displayW) {
  if (!img || !img.width) return
  var ratio = img.height / img.width
  var w = displayW
  var h = w * ratio
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h)
}

function rectFromImage(img, cx, cy, displayW, displayH) {
  if (img && img.width) {
    var ratio = img.height / img.width
    var w = displayW
    var h = w * ratio
    return { x: cx - w / 2, y: cy - h / 2, w: w, h: h }
  }
  return rectCentered(cx, cy, displayW, displayH)
}

function drawBtnImage(ctx, img, rect, cx, cy, scale) {
  pressAnim.drawWithPressScale(ctx, cx, cy, scale, function () {
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h)
  })
}

function drawFxFrame(ctx, W, layout, fxMs) {
  var idx = getFxFrameIndex(fxMs)
  var path = fxFramePath(idx)
  var img = assets.get(path)
  if (!img) {
    ensureFxLoaded()
    return
  }
  var nextPath = fxFramePath(idx + 1)
  if (!assets.get(nextPath)) assets.tryLoad(nextPath)

  var rect = rectFromImage(img, W / 2, layout.fxCy, layout.fxW, layout.fxH)
  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h)
}

function drawOverlay(screen, ctx, W, H, handlers, pressId) {
  screen.resetHitZones()

  ctx.fillStyle = 'rgba(0,0,0,' + MASK_ALPHA + ')'
  ctx.fillRect(0, 0, W, H)

  var layout = computeLayout(W, H)
  var fxMs = screen._timeupFxMs != null ? screen._timeupFxMs : 0

  var titleImg = assets.get(TIMEUP_TITLE)
  if (!titleImg) assets.load(TIMEUP_TITLE)
  if (titleImg) {
    drawImageByWidth(ctx, titleImg, W / 2, layout.titleCy, layout.titleW)
  }

  drawFxFrame(ctx, W, layout, fxMs)

  var homeImg = assets.get(BTN_HOME)
  if (!homeImg) assets.load(BTN_HOME)
  var watchImg = assets.get(BTN_WATCH_ADD_TIME)
  if (!watchImg) assets.load(BTN_WATCH_ADD_TIME)

  var homeRect = rectFromImage(homeImg, layout.homeCx, layout.btnCy, layout.btnW, layout.btnH)
  var watchRect = rectFromImage(watchImg, layout.watchCx, layout.btnCy, layout.btnW, layout.btnH)

  var homeScale = pressAnim.btnScale(
    pressId === 'timeupHome' ? screen._pressAnim : null, 'timeupHome'
  )
  var watchScale = pressAnim.btnScale(
    pressId === 'timeupWatch' ? screen._pressAnim : null, 'timeupWatch'
  )

  if (homeImg) {
    drawBtnImage(ctx, homeImg, homeRect, layout.homeCx, layout.btnCy, homeScale)
  }
  if (watchImg) {
    drawBtnImage(ctx, watchImg, watchRect, layout.watchCx, layout.btnCy, watchScale)
  }

  if (handlers && handlers.onGoHome) {
    screen.addHitZone(homeRect, handlers.onGoHome)
  }
  if (handlers && handlers.onWatchAddTime) {
    screen.addHitZone(watchRect, handlers.onWatchAddTime)
  }

  return {
    watchCx: layout.watchCx,
    watchCy: layout.btnCy
  }
}

module.exports = {
  FX_DUR_MS: FX_DUR_MS,
  FX_FRAME_COUNT: FX_FRAME_COUNT,
  FX_FRAMES: FX_FRAMES,
  TIMEUP_TITLE: TIMEUP_TITLE,
  BTN_HOME: BTN_HOME,
  BTN_WATCH_ADD_TIME: BTN_WATCH_ADD_TIME,
  preload: preload,
  ensureFxLoaded: ensureFxLoaded,
  resetFx: resetFx,
  tickFx: tickFx,
  computeLayout: computeLayout,
  drawOverlay: drawOverlay
}
