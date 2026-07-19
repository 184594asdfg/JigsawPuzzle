/**
 * 关卡进度：completed_count（当前有效链，推关用）+ removed_completed_count（已删主题，展示用）
 */
var jigsawApi = require('./jigsaw-api')
var user = require('./user')
var config = require('./app-config')
var galleryData = require('./gallery-data')

var STORAGE_PROGRESS = 'puzzle_progress_v2'
var LEGACY_STORAGE = 'puzzle_level_progress'
var completedCount = 0
var removedCompletedCount = 0
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
    removedCompletedCount: removedCompletedCount,
    lastCompletedAt: lastCompletedAt
  })
}

function getDisplayCompletedCount() {
  return completedCount + removedCompletedCount
}

function applyServerData(data, opts) {
  opts = opts || {}
  var authoritative = opts.authoritative !== false
  var prevCount = completedCount
  var serverCount = Math.max(0, (data && data.completedCount) || 0)
  if (authoritative) {
    completedCount = serverCount
    removedCompletedCount = Math.max(0, (data && data.removedCompletedCount) || 0)
  } else {
    completedCount = Math.max(completedCount, serverCount)
    var serverRemoved = Math.max(0, (data && data.removedCompletedCount) || 0)
    removedCompletedCount = Math.max(removedCompletedCount, serverRemoved)
  }
  if (data && data.lastCompletedAt) {
    lastCompletedAt = data.lastCompletedAt
  } else if (serverCount === 0 && removedCompletedCount === 0 && completedCount === 0) {
    lastCompletedAt = null
  }
  if (data && data.totalLevels > 0) totalLevels = data.totalLevels
  writeLocal()
  synced = true
  if (authoritative && prevCount !== completedCount) {
    try {
      require('./prefetch').resetPrefetchCache()
    } catch (e) {}
  }
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

/** 首页主按钮文案：显示 display（当前+已删）之和；全通后显示「再玩」 */
function getMainLevelLabel(themes) {
  ensureLoaded()
  var total = computeTotalFromThemes(themes || galleryData.getThemes())
  if (total > 0 && completedCount >= total) return '再玩'
  return String(getDisplayCompletedCount() + 1)
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
    removedCompletedCount = Math.max(0, local.removedCompletedCount || 0)
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

function loadFromServer(opts) {
  opts = opts || {}
  var authoritative = opts.authoritative !== false
  clearLegacyStorage()
  if (!authoritative) ensureLoaded()
  var userId = user.getUserId()
  if (!userId) {
    ensureLoaded()
    return Promise.resolve(completedCount)
  }
  return jigsawApi.fetchProgress(userId).then(function (data) {
    applyServerData(data, { authoritative: authoritative })
    return completedCount
  }).catch(function (err) {
    console.warn('[progress] load from server failed', err)
    ensureLoaded()
    return completedCount
  })
}

function markLevelComplete(levelKey) {
  if (!levelKey) return
  ensureLoaded()
  var themes = galleryData.getThemes()
  var globalIndex = getGlobalIndexForKey(themes, levelKey)
  var isNext = globalIndex === completedCount + 1

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
    applyServerData(data, { authoritative: true })
    try {
      require('./rank-data').refreshNational()
    } catch (e) {}
  }).catch(function (err) {
    console.warn('[progress] save to server failed', err)
  })
}

function isLevelComplete(levelKey) {
  ensureLoaded()
  var themes = galleryData.getThemes()
  var globalIndex = getGlobalIndexForKey(themes, levelKey)
  return globalIndex > 0 && globalIndex <= completedCount
}

/** 展示/分享/排行：当前 + 已删除 */
function getCompletedCount() {
  ensureLoaded()
  return getDisplayCompletedCount()
}

/** 推关/下一关：仅当前有效链 */
function getCurrentCompletedCount() {
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
    grid: config.resolveGridSize(0),
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
  return getDisplayCompletedCount()
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

/**
 * 首页 hero 展示用主题：刚好打完一整主题（25/50/75…）时仍显示该主题封面，
 * 不提前切到下一主题（下一关入口仍由 getNextLevel 决定）。
 */
function getHeroDisplayTheme(themes) {
  if (!themes || !themes.length) return null
  ensureLoaded()
  if (completedCount <= 0) {
    var first = getNextLevel(themes)
    return first && first.theme ? first.theme : null
  }
  var cumulative = 0
  for (var i = 0; i < themes.length; i++) {
    cumulative += getThemeLevelTotal(themes[i])
    if (completedCount === cumulative) return themes[i]
    if (completedCount < cumulative) break
  }
  var next = getNextLevel(themes)
  return next && next.theme ? next.theme : null
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
  getCurrentCompletedCount: getCurrentCompletedCount,
  getDisplayCompletedCount: getDisplayCompletedCount,
  countThemeCompleted: countThemeCompleted,
  countAllCompleted: countAllCompleted,
  getNextLevel: getNextLevel,
  getHeroDisplayTheme: getHeroDisplayTheme,
  findFirstPlayableLevel: findFirstPlayableLevel,
  getLevelAfterKey: getLevelAfterKey,
  getLevelAfterCurrent: getLevelAfterCurrent
}
