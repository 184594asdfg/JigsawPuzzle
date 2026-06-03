/**
 * 关卡进度：completed_count（线性）+ 服务端同步
 */
var jigsawApi = require('./jigsaw-api')
var user = require('./user')
var galleryData = require('./gallery-data')

var STORAGE_PROGRESS = 'puzzle_progress_v2'
var LEGACY_STORAGE = 'puzzle_level_progress'
var completedCount = 0
var lastCompletedAt = null
var totalLevels = 0
var synced = false

function clearLegacyStorage() {
  try {
    wx.removeStorageSync(LEGACY_STORAGE)
  } catch (e) {}
}

function readLocal() {
  try {
    var raw = wx.getStorageSync(STORAGE_PROGRESS)
    if (!raw || typeof raw !== 'object') return null
    return raw
  } catch (e) {
    return null
  }
}

function writeLocal() {
  wx.setStorageSync(STORAGE_PROGRESS, {
    completedCount: completedCount,
    lastCompletedAt: lastCompletedAt
  })
}

function applyServerData(data) {
  completedCount = Math.max(0, (data && data.completedCount) || 0)
  lastCompletedAt = (data && data.lastCompletedAt) ? data.lastCompletedAt : null
  if (data && data.totalLevels > 0) totalLevels = data.totalLevels
  writeLocal()
  synced = true
}

function computeTotalFromThemes(themes) {
  if (totalLevels > 0) return totalLevels
  if (!themes || !themes.length) return 0
  var n = 0
  for (var i = 0; i < themes.length; i++) {
    n += getThemeLevelTotal(themes[i])
  }
  return n
}

/** 通关本关是否会推进进度（应用 mark 之前调用） */
function willAdvanceOnComplete(levelKey) {
  ensureLoaded()
  var globalIndex = getGlobalIndexForKey(galleryData.getThemes(), levelKey)
  return globalIndex > 0 && globalIndex === completedCount + 1
}

/** 首页主按钮文案：全通后显示「再玩」 */
function getMainLevelLabel(themes) {
  ensureLoaded()
  var total = computeTotalFromThemes(themes || galleryData.getThemes())
  if (total > 0 && completedCount >= total) return '再玩'
  return String(completedCount + 1)
}

function isAllLevelsComplete(themes) {
  var total = computeTotalFromThemes(themes || galleryData.getThemes())
  return total > 0 && completedCount >= total
}

function ensureLoaded() {
  if (synced) return
  var local = readLocal()
  if (local) {
    completedCount = Math.max(0, local.completedCount || 0)
    lastCompletedAt = local.lastCompletedAt || null
  }
}

function getGlobalIndexForKey(themes, levelKey) {
  if (!themes || !themes.length || !levelKey) return 0
  var idx = 0
  for (var i = 0; i < themes.length; i++) {
    var theme = themes[i]
    var total = getThemeLevelTotal(theme)
    for (var levelNum = 1; levelNum <= total; levelNum++) {
      idx++
      var key = galleryData.buildLevelKey(theme.id, levelNum)
      if (key === levelKey) return idx
    }
  }
  return 0
}

function loadFromServer() {
  clearLegacyStorage()
  ensureLoaded()
  var userId = user.getUserId()
  if (!userId) return Promise.resolve(completedCount)
  return jigsawApi.fetchProgress(userId).then(function (data) {
    applyServerData(data)
    return completedCount
  }).catch(function (err) {
    console.warn('[progress] load from server failed', err)
    return completedCount
  })
}

function markLevelComplete(levelKey) {
  if (!levelKey) return
  ensureLoaded()
  var themes = galleryData.getThemes()
  var globalIndex = getGlobalIndexForKey(themes, levelKey)
  var isNext = globalIndex === completedCount + 1
  var prevCount = completedCount
  var prevTime = lastCompletedAt

  if (isNext) {
    completedCount += 1
    lastCompletedAt = new Date().toISOString()
    writeLocal()
    try {
      require('./prefetch').resetPrefetchCache()
    } catch (e) {}
  }

  var userId = user.getUserId()
  if (!userId) return
  jigsawApi.saveProgress(userId, levelKey).then(function (data) {
    if (!data) return
    applyServerData(data)
  }).catch(function (err) {
    console.warn('[progress] save to server failed', err)
    if (isNext) {
      completedCount = prevCount
      lastCompletedAt = prevTime
      writeLocal()
    }
  })
}

function isLevelComplete(levelKey) {
  ensureLoaded()
  var themes = galleryData.getThemes()
  var globalIndex = getGlobalIndexForKey(themes, levelKey)
  return globalIndex > 0 && globalIndex <= completedCount
}

function getCompletedCount() {
  ensureLoaded()
  return completedCount
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
  ensureLoaded()
  if (!theme) return 0
  var total = getThemeLevelTotal(theme)
  var themes = galleryData.getThemes()
  if (!themes.length) return 0
  var themeStart = 0
  for (var t = 0; t < themes.length; t++) {
    if (themes[t].id === theme.id) {
      if (completedCount >= themeStart + total) return total
      if (completedCount <= themeStart) return 0
      return completedCount - themeStart
    }
    themeStart += getThemeLevelTotal(themes[t])
  }
  return 0
}

function countAllCompleted(themes) {
  ensureLoaded()
  return completedCount
}

function getNextLevel(themes) {
  if (!themes || !themes.length) return null
  var globalIdx = 0
  for (var i = 0; i < themes.length; i++) {
    var theme = themes[i]
    var total = getThemeLevelTotal(theme)
    if (!total) continue
    for (var levelNum = 1; levelNum <= total; levelNum++) {
      globalIdx++
      if (globalIdx > completedCount) {
        var lv = resolveLevel(theme, levelNum)
        return {
          theme: theme,
          level: lv,
          levelIndex: levelNum - 1,
          globalIndex: globalIdx - 1
        }
      }
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

function getLevelAfterKey(themes, levelKey) {
  if (!themes || !themes.length || !levelKey) return null
  var lv = galleryData.getLevelByKey(levelKey)
  var theme = null
  var levelNum = 0
  if (lv && lv.themeId) {
    theme = galleryData.getThemeById(lv.themeId)
    levelNum = lv.level
  }
  if (!theme || !levelNum) {
    var idx = levelKey.lastIndexOf('_')
    if (idx <= 0) return null
    theme = galleryData.getThemeById(levelKey.slice(0, idx))
    levelNum = parseInt(levelKey.slice(idx + 1), 10)
  }
  if (!theme || !levelNum || isNaN(levelNum)) return null
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

function getLevelAfterCurrent(themes) {
  if (!themes || !themes.length) return null
  var current = getNextLevel(themes)
  if (!current || !current.theme || !current.level) return null
  return getLevelAfterKey(themes, current.level.key)
}

module.exports = {
  loadFromServer: loadFromServer,
  markLevelComplete: markLevelComplete,
  isLevelComplete: isLevelComplete,
  willAdvanceOnComplete: willAdvanceOnComplete,
  getMainLevelLabel: getMainLevelLabel,
  isAllLevelsComplete: isAllLevelsComplete,
  getCompletedCount: getCompletedCount,
  countThemeCompleted: countThemeCompleted,
  countAllCompleted: countAllCompleted,
  getNextLevel: getNextLevel,
  findFirstPlayableLevel: findFirstPlayableLevel,
  getLevelAfterKey: getLevelAfterKey,
  getLevelAfterCurrent: getLevelAfterCurrent
}
