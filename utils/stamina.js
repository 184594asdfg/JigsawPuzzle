/**
 * 体力：本地仅存 current；倒计时仅会话内有效，重开不保留。
 * 仅在线恢复（低于上限 10 分钟/点）；看广告可超上限。
 */
var config = require('./app-config')

var STORAGE_KEY = 'jigsaw_stamina_v2'
var MAX_STAMINA = config.staminaMax || 5
var AD_GRANT = config.staminaAdGrant || 15
var REGEN_INTERVAL_MS = (config.staminaRegenMin || 10) * 60 * 1000

var cached = {
  current: MAX_STAMINA,
  maxStamina: MAX_STAMINA
}
var localRegenRemainingMs = 0
var localRegenAnchorAt = 0
var dirty = false

function loadSavedCurrent() {
  try {
    var raw = wx.getStorageSync(STORAGE_KEY)
    if (raw && typeof raw === 'object' && raw.current != null) {
      return Math.max(0, Math.floor(Number(raw.current)))
    }
    if (raw != null && raw !== '') {
      var legacy = Number(raw)
      if (!isNaN(legacy)) return Math.max(0, Math.floor(legacy))
    }
  } catch (e) {}
  return MAX_STAMINA
}

function saveRawState() {
  if (!dirty) return
  dirty = false
  try {
    wx.setStorageSync(STORAGE_KEY, { current: cached.current })
  } catch (e) {}
}

function resetCountdown() {
  localRegenRemainingMs = 0
  localRegenAnchorAt = 0
}

function initCountdown(remainingMs) {
  if (cached.current >= cached.maxStamina) {
    resetCountdown()
    return
  }
  localRegenRemainingMs = remainingMs > 0 ? remainingMs : REGEN_INTERVAL_MS
  localRegenAnchorAt = Date.now()
}

function markDirty() {
  dirty = true
}

function loadFromStorage() {
  cached.current = loadSavedCurrent()
  cached.maxStamina = MAX_STAMINA
  return Promise.resolve(cached)
}

/** 冷启动：恢复体力，倒计时从零开始 */
function bootstrapFromStorage() {
  cached.current = loadSavedCurrent()
  cached.maxStamina = MAX_STAMINA
  resetCountdown()
}

function fetchStamina() {
  return loadFromStorage()
}

function syncRegen() {
  return loadFromStorage().then(function () { return true })
}

/**
 * 前台每帧：本地倒计时推进自然恢复（关小程序不计时，且不写入存储）。
 */
function tickOnline(dt) {
  if (cached.current >= cached.maxStamina) return

  var d = Math.max(0, Math.min(dt || 0, 200))
  if (d <= 0) return

  if (localRegenAnchorAt <= 0 && localRegenRemainingMs <= 0) {
    initCountdown(REGEN_INTERVAL_MS)
  }

  if (getRegenRemainingMs() > 0) return

  cached.current += 1
  markDirty()
  if (cached.current < cached.maxStamina) {
    initCountdown(REGEN_INTERVAL_MS)
  } else {
    resetCountdown()
  }
  saveRawState()
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
  if (cached.current >= cached.maxStamina) return 0
  if (localRegenAnchorAt <= 0) return localRegenRemainingMs || REGEN_INTERVAL_MS
  return Math.max(0, localRegenRemainingMs - (Date.now() - localRegenAnchorAt))
}

function shouldShowRegenCountdown() {
  return cached.current < cached.maxStamina && localRegenAnchorAt > 0
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

  cached.current -= amount
  if (cached.current < cached.maxStamina) {
    initCountdown(REGEN_INTERVAL_MS)
  }

  markDirty()
  saveRawState()
  return Promise.resolve(true)
}

/** 观看激励视频奖励，可超过自然恢复上限 */
function grantAdReward(amount) {
  amount = amount == null ? AD_GRANT : Math.max(1, Math.floor(amount))
  cached.current += amount
  if (cached.current >= cached.maxStamina) {
    resetCountdown()
  } else if (localRegenAnchorAt <= 0) {
    initCountdown(REGEN_INTERVAL_MS)
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

bootstrapFromStorage()
