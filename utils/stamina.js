/**
 * 体力：自然恢复上限 staminaMax；看广告 grantAdReward 可超过上限。
 */
var config = require('./app-config')

var STORAGE_KEY = 'jigsaw_stamina_v1'
var MAX_STAMINA = config.staminaMax || 5
var AD_GRANT = config.staminaAdGrant || 15
var REGEN_INTERVAL_MS = (config.staminaRegenMin || 30) * 60 * 1000

function loadRawState() {
  try {
    var raw = wx.getStorageSync(STORAGE_KEY)
    if (raw && typeof raw === 'object' && raw.current != null) {
      return {
        current: Math.max(0, Math.floor(Number(raw.current))),
        nextRegenAt: raw.nextRegenAt != null ? Number(raw.nextRegenAt) : null
      }
    }
    if (raw != null && raw !== '') {
      var legacy = Number(raw)
      if (!isNaN(legacy)) {
        return { current: Math.max(0, Math.floor(legacy)), nextRegenAt: null }
      }
    }
  } catch (e) {}
  return defaultState()
}

function defaultState() {
  return { current: MAX_STAMINA, nextRegenAt: null }
}

function saveRawState(state) {
  try {
    wx.setStorageSync(STORAGE_KEY, {
      current: state.current,
      nextRegenAt: state.nextRegenAt
    })
  } catch (e) {}
}

/** 按时间推进自然恢复，返回是否有变化 */
function syncRegen() {
  var state = loadRawState()
  var now = Date.now()
  var changed = false
  while (state.current < MAX_STAMINA && state.nextRegenAt && now >= state.nextRegenAt) {
    state.current += 1
    changed = true
    if (state.current < MAX_STAMINA) {
      state.nextRegenAt += REGEN_INTERVAL_MS
    } else {
      state.nextRegenAt = null
    }
  }
  if (changed) saveRawState(state)
  return changed
}

function getCurrent() {
  syncRegen()
  return loadRawState().current
}

function getMax() {
  return MAX_STAMINA
}

function canPlay() {
  return getCurrent() > 0
}

/** 距离下一点体力恢复的剩余毫秒；已满则 0 */
function getRegenRemainingMs() {
  syncRegen()
  var state = loadRawState()
  if (state.current >= MAX_STAMINA || !state.nextRegenAt) return 0
  return Math.max(0, state.nextRegenAt - Date.now())
}

function formatRegenCountdown(ms) {
  if (!ms || ms <= 0) return ''
  var totalSec = Math.ceil(ms / 1000)
  var min = Math.floor(totalSec / 60)
  var sec = totalSec % 60
  if (min >= 60) {
    var hour = Math.floor(min / 60)
    min = min % 60
    return hour + '小时' + (min > 0 ? min + '分' : '') + '后恢复'
  }
  if (min > 0) return min + '分' + (sec > 0 ? sec + '秒' : '') + '后恢复'
  return sec + '秒后恢复'
}

function consume(amount) {
  syncRegen()
  amount = amount == null ? 1 : Math.max(1, Math.floor(amount))
  var state = loadRawState()
  if (state.current < amount) return false
  state.current -= amount
  if (state.current < MAX_STAMINA && !state.nextRegenAt) {
    state.nextRegenAt = Date.now() + REGEN_INTERVAL_MS
  }
  saveRawState(state)
  return true
}

function grant(amount) {
  syncRegen()
  amount = amount == null ? 1 : Math.max(1, Math.floor(amount))
  var state = loadRawState()
  if (state.current >= MAX_STAMINA) return state.current
  state.current = Math.min(MAX_STAMINA, state.current + amount)
  if (state.current >= MAX_STAMINA) {
    state.nextRegenAt = null
  } else if (!state.nextRegenAt) {
    state.nextRegenAt = Date.now() + REGEN_INTERVAL_MS
  }
  saveRawState(state)
  return state.current
}

/** 观看激励视频奖励，可超过自然恢复上限 */
function grantAdReward(amount) {
  syncRegen()
  amount = amount == null ? AD_GRANT : Math.max(1, Math.floor(amount))
  var state = loadRawState()
  state.current += amount
  if (state.current >= MAX_STAMINA) {
    state.nextRegenAt = null
  } else if (!state.nextRegenAt) {
    state.nextRegenAt = Date.now() + REGEN_INTERVAL_MS
  }
  saveRawState(state)
  return state.current
}

function isFull() {
  return getCurrent() >= MAX_STAMINA
}

module.exports = {
  MAX_STAMINA: MAX_STAMINA,
  AD_GRANT: AD_GRANT,
  REGEN_INTERVAL_MS: REGEN_INTERVAL_MS,
  syncRegen: syncRegen,
  getCurrent: getCurrent,
  getMax: getMax,
  canPlay: canPlay,
  isFull: isFull,
  getRegenRemainingMs: getRegenRemainingMs,
  formatRegenCountdown: formatRegenCountdown,
  consume: consume,
  grant: grant,
  grantAdReward: grantAdReward
}
