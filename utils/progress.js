/**
 * 关卡进度：本地缓存 + 服务端同步
 */
var jigsawApi = require('./jigsaw-api')
var user = require('./user')

var STORAGE_PROGRESS = 'puzzle_level_progress'
var progressMap = null
var synced = false

function readLocalMap() {
  try {
    var raw = wx.getStorageSync(STORAGE_PROGRESS)
    return raw && typeof raw === 'object' ? raw : {}
  } catch (e) {
    return {}
  }
}

function writeLocalMap(map) {
  wx.setStorageSync(STORAGE_PROGRESS, map)
}

function ensureMap() {
  if (!progressMap) progressMap = readLocalMap()
  return progressMap
}

function mergeServerProgress(data) {
  var keys = (data && data.completedKeys) ? data.completedKeys.slice() : []
  if (!keys.length && data && data.progress) {
    keys = Object.keys(data.progress).filter(function (k) {
      return !!data.progress[k]
    })
  }
  var map = {}
  for (var i = 0; i < keys.length; i++) {
    map[keys[i]] = true
  }
  progressMap = map
  writeLocalMap(map)
  synced = true
  return map
}

function loadFromServer() {
  var userId = user.getUserId()
  if (!userId) {
    ensureMap()
    return Promise.resolve(ensureMap())
  }
  return jigsawApi.fetchProgress(userId).then(function (data) {
    return mergeServerProgress(data)
  }).catch(function (err) {
    console.warn('[progress] load from server failed', err)
    ensureMap()
    return progressMap
  })
}

function markLevelComplete(levelKey) {
  if (!levelKey) return
  var map = ensureMap()
  var alreadyDone = !!map[levelKey]
  map[levelKey] = true
  writeLocalMap(map)

  var userId = user.getUserId()
  if (!userId) return
  if (alreadyDone) return
  jigsawApi.saveProgress(userId, levelKey).catch(function (err) {
    console.warn('[progress] save to server failed', err)
  })
}

function isLevelComplete(levelKey) {
  return !!ensureMap()[levelKey]
}

function countThemeCompleted(theme) {
  if (!theme || !theme.levels) return 0
  var n = 0
  for (var i = 0; i < theme.levels.length; i++) {
    if (isLevelComplete(theme.levels[i].key)) n++
  }
  return n
}

function countAllCompleted(themes) {
  if (!themes || !themes.length) return 0
  var n = 0
  for (var i = 0; i < themes.length; i++) {
    n += countThemeCompleted(themes[i])
  }
  return n
}

function getNextLevel(themes) {
  if (!themes || !themes.length) return null
  var globalIdx = 0
  for (var i = 0; i < themes.length; i++) {
    var theme = themes[i]
    for (var j = 0; j < theme.levels.length; j++) {
      var lv = theme.levels[j]
      if (!isLevelComplete(lv.key)) {
        return {
          theme: theme,
          level: lv,
          levelIndex: j,
          globalIndex: globalIdx
        }
      }
      globalIdx++
    }
  }
  return {
    theme: themes[0],
    level: themes[0].levels[0],
    levelIndex: 0,
    globalIndex: 0
  }
}

module.exports = {
  loadFromServer: loadFromServer,
  markLevelComplete: markLevelComplete,
  isLevelComplete: isLevelComplete,
  countThemeCompleted: countThemeCompleted,
  countAllCompleted: countAllCompleted,
  getNextLevel: getNextLevel
}
