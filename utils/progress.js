/**
 * 关卡进度：本地缓存 + 服务端同步
 */
var jigsawApi = require('./jigsaw-api')
var user = require('./user')
var galleryData = require('./gallery-data')

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
  try {
    require('./prefetch').resetPrefetchCache()
  } catch (e) {}

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

function getThemeLevelTotal(theme) {
  if (!theme) return 0
  if (theme.totalLevels) return theme.totalLevels
  if (theme.levels && theme.levels.length) return theme.levels.length
  return galleryData.LEVELS_PER_THEME
}

function resolveLevel(theme, levelNum) {
  var key = galleryData.buildLevelKey(theme.id, levelNum)
  if (theme.levels && theme.levels.length) {
    for (var i = 0; i < theme.levels.length; i++) {
      if (theme.levels[i].level === levelNum || theme.levels[i].key === key) {
        return theme.levels[i]
      }
    }
  }
  return {
    key: key,
    themeId: theme.id,
    level: levelNum,
    name: '关卡 ' + levelNum,
    image: galleryData.resolveLevelImage(theme, levelNum, null),
    grid: galleryData.DEFAULT_GRID,
    timeLimit: 0
  }
}

function countThemeCompleted(theme) {
  if (!theme) return 0
  var total = getThemeLevelTotal(theme)
  var n = 0
  for (var i = 1; i <= total; i++) {
    if (isLevelComplete(galleryData.buildLevelKey(theme.id, i))) n++
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
    var total = getThemeLevelTotal(theme)
    if (!total) continue
    for (var levelNum = 1; levelNum <= total; levelNum++) {
      var lv = resolveLevel(theme, levelNum)
      if (!lv || !lv.key) continue
      if (!isLevelComplete(lv.key)) {
        return {
          theme: theme,
          level: lv,
          levelIndex: levelNum - 1,
          globalIndex: globalIdx
        }
      }
      globalIdx++
    }
  }
  var firstTheme = themes[0]
  var firstTotal = getThemeLevelTotal(firstTheme)
  if (!firstTheme || !firstTotal) return null
  return {
    theme: firstTheme,
    level: resolveLevel(firstTheme, 1),
    levelIndex: 0,
    globalIndex: 0
  }
}

function findFirstPlayableLevel(themes) {
  var next = getNextLevel(themes)
  if (!next || !next.level || !next.level.key) return null
  return next
}

/** 当前可玩关卡的下一关（同主题下一编号，否则下一主题第 1 关） */
function getLevelAfterCurrent(themes) {
  if (!themes || !themes.length) return null
  var current = getNextLevel(themes)
  if (!current || !current.theme || !current.level) return null
  var theme = current.theme
  var levelNum = current.level.level
  var total = getThemeLevelTotal(theme)
  if (levelNum < total) {
    return { theme: theme, level: resolveLevel(theme, levelNum + 1) }
  }
  for (var i = 0; i < themes.length; i++) {
    if (themes[i].id !== theme.id) continue
    if (i + 1 < themes.length) {
      var nextTheme = themes[i + 1]
      var nextTotal = getThemeLevelTotal(nextTheme)
      if (!nextTotal) return null
      return { theme: nextTheme, level: resolveLevel(nextTheme, 1) }
    }
    break
  }
  return null
}

module.exports = {
  loadFromServer: loadFromServer,
  markLevelComplete: markLevelComplete,
  isLevelComplete: isLevelComplete,
  countThemeCompleted: countThemeCompleted,
  countAllCompleted: countAllCompleted,
  getNextLevel: getNextLevel,
  findFirstPlayableLevel: findFirstPlayableLevel,
  getLevelAfterCurrent: getLevelAfterCurrent
}
