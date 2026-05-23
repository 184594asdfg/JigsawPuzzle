/** 游戏设置：音乐 / 音效 / 振动开关，本地持久化 */
var STORAGE_KEY = 'jigsaw_game_settings'

var DEFAULTS = {
  music: true,
  sfx: true,
  vibrate: true
}

function readAll() {
  try {
    var raw = wx.getStorageSync(STORAGE_KEY)
    if (!raw || typeof raw !== 'object') return {}
    return raw
  } catch (e) {
    return {}
  }
}

function writeAll(map) {
  wx.setStorageSync(STORAGE_KEY, map)
}

function get(key) {
  var saved = readAll()
  if (typeof saved[key] === 'boolean') return saved[key]
  return DEFAULTS[key] !== undefined ? DEFAULTS[key] : true
}

function set(key, value) {
  if (!DEFAULTS.hasOwnProperty(key)) return
  var map = readAll()
  map[key] = !!value
  writeAll(map)
}

function toggle(key) {
  set(key, !get(key))
  return get(key)
}

module.exports = {
  DEFAULTS: DEFAULTS,
  get: get,
  set: set,
  toggle: toggle
}
