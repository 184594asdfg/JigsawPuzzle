/**
 * 体力：本地存储 current + nextRegenAt（下一格恢复完成时间戳）。
 * 低于上限时 10 分钟/点；根据时间戳计算倒计时与恢复；看广告可超上限。
 */
var config = require('./app-config')

var STORAGE_KEY = 'jigsaw_stamina_v3'
var MAX_STAMINA = config.staminaMax || 5
var AD_GRANT = config.staminaAdGrant || 15
var REGEN_INTERVAL_MS = (config.staminaRegenMin || 10) * 60 * 1000

var cached = {
  current: MAX_STAMINA,
  maxStamina: MAX_STAMINA
}
var nextRegenAt = null
var dirty = false

function loadRawState() {
  try {
    var raw = wx.getStorageSync(STORAGE_KEY)
    if (raw && typeof raw === 'object' && raw.current != null) {
      return {
        current: Math.max(0, Math.floor(Number(raw.current))),
        nextRegenAt: raw.nextRegenAt != null ? Number(raw.nextRegenAt) : null
      }
    }
    var legacy = wx.getStorageSync('jigsaw_stamina_v2')
    if (legacy && typeof legacy === 'object' && legacy.current != null) {
      return {
        current: Math.max(0, Math.floor(Number(legacy.current))),
        nextRegenAt: null
      }
    }
    if (legacy != null && legacy !== '' && typeof legacy !== 'object') {
      var n = Number(legacy)
      if (!isNaN(n)) return { current: Math.max(0, Math.floor(n)), nextRegenAt: null }
    }
  } catch (e) {}
  return { current: MAX_STAMINA, nextRegenAt: null }
}

function saveRawState() {
  if (!dirty) return
  dirty = false
  try {
    wx.setStorageSync(STORAGE_KEY, {
      current: cached.current,
      nextRegenAt: cached.current < cached.maxStamina ? nextRegenAt : null
    })
  } catch (e) {}
}

function markDirty() {
  dirty = true
}

function clearRegenTimer() {
  nextRegenAt = null
}

function startRegenTimer(fromNow) {
  if (cached.current >= cached.maxStamina) {
    clearRegenTimer()
    return
  }
  nextRegenAt = (fromNow != null ? fromNow : Date.now()) + REGEN_INTERVAL_MS
}

function applyLoadedState(state) {
  cached.current = state.current
  cached.maxStamina = MAX_STAMINA
  nextRegenAt = state.nextRegenAt
}

/** 按 nextRegenAt 推进自然恢复，返回是否有变化 */
function syncRegenFromClock() {
  if (cached.current >= cached.maxStamina) {
    if (nextRegenAt != null) {
      clearRegenTimer()
      markDirty()
      saveRawState()
    }
    return false
  }

  var now = Date.now()
  var changed = false

  if (nextRegenAt == null) {
    startRegenTimer(now)
    markDirty()
    saveRawState()
    return false
  }

  while (cached.current < cached.maxStamina && now >= nextRegenAt) {
    cached.current += 1
    changed = true
    if (cached.current < cached.maxStamina) {
      nextRegenAt += REGEN_INTERVAL_MS
    } else {
      clearRegenTimer()
    }
  }

  if (changed) {
    markDirty()
    saveRawState()
  }
  return changed
}

function loadFromStorage() {
  applyLoadedState(loadRawState())
  syncRegenFromClock()
  return Promise.resolve(cached)
}

function fetchStamina() {
  return loadFromStorage()
}

function syncRegen() {
  return loadFromStorage().then(function () { return true })
}

/** 主循环调用：刷新倒计时 UI，并在到点恢复 */
function tickOnline() {
  syncRegenFromClock()
}

function getCurrent() {
  return cached.current
}

function getMax() {
  return MAX_STAMINA
}

function canPlay() {
  return getCurrent() > 0
}

function getRegenRemainingMs() {
  if (cached.current >= cached.maxStamina || nextRegenAt == null) return 0
  return Math.max(0, nextRegenAt - Date.now())
}

function shouldShowRegenCountdown() {
  return cached.current < cached.maxStamina && nextRegenAt != null && getRegenRemainingMs() > 0
}

function formatRegenCountdown(ms) {
  if (!ms || ms <= 0) return ''
  var totalSec = Math.ceil(ms / 1000)
  var min = Math.floor(totalSec / 60)
  var sec = totalSec % 60
  var secStr = sec < 10 ? '0' + sec : String(sec)
  if (min >= 60) {
    var hour = Math.floor(min / 60)
    min = min % 60
    var minStr = min < 10 ? '0' + min : String(min)
    return hour + ':' + minStr + ':' + secStr + '后恢复'
  }
  return min + ':' + secStr + '后恢复'
}

function consume(amount) {
  amount = amount == null ? 1 : Math.max(1, Math.floor(amount))
  if (cached.current < amount) return Promise.resolve(false)

  syncRegenFromClock()
  var wasFull = cached.current >= cached.maxStamina
  cached.current -= amount

  if (cached.current < cached.maxStamina && (wasFull || nextRegenAt == null)) {
    startRegenTimer(Date.now())
  }

  markDirty()
  saveRawState()
  return Promise.resolve(true)
}

/** 观看激励视频奖励，可超过自然恢复上限 */
function grantAdReward(amount) {
  amount = amount == null ? AD_GRANT : Math.max(1, Math.floor(amount))
  syncRegenFromClock()
  cached.current += amount
  if (cached.current >= cached.maxStamina) {
    clearRegenTimer()
  } else if (nextRegenAt == null) {
    startRegenTimer(Date.now())
  }
  markDirty()
  saveRawState()
  return Promise.resolve(cached.current)
}

function isFull() {
  return getCurrent() >= getMax()
}

function persist() {
  markDirty()
  saveRawState()
}

module.exports = {
  MAX_STAMINA: MAX_STAMINA,
  AD_GRANT: AD_GRANT,
  REGEN_INTERVAL_MS: REGEN_INTERVAL_MS,
  loadFromStorage: loadFromStorage,
  fetchStamina: fetchStamina,
  syncRegen: syncRegen,
  tickOnline: tickOnline,
  persist: persist,
  getCurrent: getCurrent,
  getMax: getMax,
  canPlay: canPlay,
  isFull: isFull,
  getRegenRemainingMs: getRegenRemainingMs,
  shouldShowRegenCountdown: shouldShowRegenCountdown,
  formatRegenCountdown: formatRegenCountdown,
  consume: consume,
  grantAdReward: grantAdReward
}

applyLoadedState(loadRawState())
syncRegenFromClock()
