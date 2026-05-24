/** 游戏设置：音乐 / 音效 / 振动开关，本地持久化（默认均为开） */
var STORAGE_KEY = 'jigsaw_game_settings'
var STORAGE_VERSION = 2

var DEFAULTS = {
  music: true,
  sfx: true,
  vibrate: true
}

function readRaw() {
  try {
    var raw = wx.getStorageSync(STORAGE_KEY)
    if (!raw || typeof raw !== 'object') return null
    return raw
  } catch (e) {
    return null
  }
}

function writeAll(map) {
  wx.setStorageSync(STORAGE_KEY, map)
}

/** 启动时调用：无存档或旧版存档 → 默认音乐/音效/振动全开 */
function init() {
  var raw = readRaw()
  if (!raw || raw._version !== STORAGE_VERSION) {
    writeAll({
      _version: STORAGE_VERSION,
      music: DEFAULTS.music,
      sfx: DEFAULTS.sfx,
      vibrate: DEFAULTS.vibrate
    })
    return
  }
  var next = { _version: STORAGE_VERSION }
  var changed = false
  var keys = Object.keys(DEFAULTS)
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i]
    if (typeof raw[k] === 'boolean') {
      next[k] = raw[k]
    } else {
      next[k] = DEFAULTS[k]
      changed = true
    }
  }
  if (changed) writeAll(next)
}

function get(key) {
  var raw = readRaw()
  if (raw && typeof raw[key] === 'boolean') return raw[key]
  return DEFAULTS[key] !== undefined ? DEFAULTS[key] : true
}

function set(key, value) {
  if (!DEFAULTS.hasOwnProperty(key)) return
  var raw = readRaw() || {}
  raw._version = STORAGE_VERSION
  raw[key] = !!value
  writeAll(raw)
}

function toggle(key) {
  set(key, !get(key))
  return get(key)
}

module.exports = {
  STORAGE_VERSION: STORAGE_VERSION,
  DEFAULTS: DEFAULTS,
  init: init,
  get: get,
  set: set,
  toggle: toggle
}
