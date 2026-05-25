/** 按钮点击：轻微放大再收回（ms） */
var BTN_PRESS_ANIM_MS = 320
var BTN_PRESS_SCALE_MAX = 1.12

/** 弹窗出场：由小放大至正常尺寸 */
var MODAL_ENTER_MS = 360
var MODAL_ENTER_SCALE_MIN = 0.78
var MODAL_OVERLAY_ALPHA = 0.55

function pressScale(timeMs) {
  var p = timeMs / BTN_PRESS_ANIM_MS
  if (p >= 1) return 1
  if (p < 0.4) {
    return 1 + (BTN_PRESS_SCALE_MAX - 1) * (p / 0.4)
  }
  return BTN_PRESS_SCALE_MAX -
    (BTN_PRESS_SCALE_MAX - 1) * ((p - 0.4) / 0.6)
}

function btnScale(anim, id) {
  if (!anim || anim.id !== id) return 1
  return pressScale(anim.time)
}

function drawWithPressScale(ctx, cx, cy, scale, drawFn) {
  if (scale === 1) {
    drawFn()
    return
  }
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.translate(-cx, -cy)
  drawFn()
  ctx.restore()
}

function tickPressAnim(anim, dt) {
  if (!anim) return { anim: null, completed: false, id: null }
  anim.time += dt
  if (anim.time >= BTN_PRESS_ANIM_MS) {
    return { anim: null, completed: true, id: anim.id }
  }
  return { anim: anim, completed: false, id: null }
}

function modalEnterScale(timeMs) {
  var p = Math.min(1, timeMs / MODAL_ENTER_MS)
  var eased = 1 - Math.pow(1 - p, 3)
  return MODAL_ENTER_SCALE_MIN + (1 - MODAL_ENTER_SCALE_MIN) * eased
}

function modalOverlayAlpha(timeMs) {
  return MODAL_OVERLAY_ALPHA * Math.min(1, timeMs / (MODAL_ENTER_MS * 0.65))
}

function getModalEnterScale(enterAnim) {
  if (!enterAnim) return 1
  return modalEnterScale(enterAnim.time)
}

function isModalEntering(enterAnim) {
  return !!enterAnim
}

function tickModalEnterAnim(enterAnim, dt) {
  if (!enterAnim) return null
  enterAnim.time += dt
  if (enterAnim.time >= MODAL_ENTER_MS) return null
  return enterAnim
}

/** 全屏页面切换：淡入 + 由小放大 */
var PAGE_TRANSITION_MS = 400

function pageTransitionEase(p) {
  return 1 - Math.pow(1 - p, 3)
}

function pageTransitionScale(timeMs, durationMs) {
  durationMs = durationMs == null ? PAGE_TRANSITION_MS : durationMs
  var p = Math.min(1, timeMs / durationMs)
  var eased = pageTransitionEase(p)
  return MODAL_ENTER_SCALE_MIN + (1 - MODAL_ENTER_SCALE_MIN) * eased
}

function pageTransitionAlpha(timeMs, durationMs) {
  durationMs = durationMs == null ? PAGE_TRANSITION_MS : durationMs
  return Math.min(1, timeMs / durationMs)
}

module.exports = {
  BTN_PRESS_ANIM_MS: BTN_PRESS_ANIM_MS,
  MODAL_ENTER_MS: MODAL_ENTER_MS,
  PAGE_TRANSITION_MS: PAGE_TRANSITION_MS,
  btnScale: btnScale,
  drawWithPressScale: drawWithPressScale,
  tickPressAnim: tickPressAnim,
  modalEnterScale: modalEnterScale,
  modalOverlayAlpha: modalOverlayAlpha,
  getModalEnterScale: getModalEnterScale,
  isModalEntering: isModalEntering,
  tickModalEnterAnim: tickModalEnterAnim,
  pageTransitionScale: pageTransitionScale,
  pageTransitionAlpha: pageTransitionAlpha
}
