/**
 * 图库主题与关卡（仅从接口加载；默认只拉主题摘要，关卡按需加载）
 */
var jigsawApi = require('./jigsaw-api')
var config = require('./app-config')
var imageProxy = require('./image-proxy')

var DEFAULT_GRID = config.defaultGrid || 4
var LEVELS_PER_THEME = 25

/** 图集缩略图（imageView2，相对 840×1260 原图） */
var GALLERY_THUMB_W = 404
var GALLERY_THUMB_H = 596
var GALLERY_THUMB_QUALITY = 90

var THEME_CARD_UNLOCKED = 'images/themes/theme-unlocked.png'
var THEME_CARD_LOCKED = 'images/themes/theme-locked.png'
var LEVEL_THUMB_PLACEHOLDER = 'images/themes/level-placeholder.png'

var THEMES = []
var loaded = false
var loadError = null
var loadingPromise = null
var themeLevelsLoading = {}

function buildLevelKey(themeId, levelNum) {
  return themeId + '_' + levelNum
}

function resolveLevelImage(theme, levelNum, level) {
  if (config.allLevelsPreviewImage) {
    return config.allLevelsPreviewImage
  }
  var key = (level && level.key) ? level.key : buildLevelKey(theme && theme.id, levelNum)
  return imageProxy.buildLevelImageUrl(key)
}

function resolveLevelThumbImage(theme, levelNum, level) {
  var key = (level && level.key) ? level.key : buildLevelKey(theme && theme.id, levelNum)
  return imageProxy.buildLevelImageUrl(key, { thumb: true })
}

function resolveLevelForPlay(themeId, levelKey, levelNum, partial) {
  var theme = getThemeById(themeId)
  var num = levelNum || (partial && partial.level) || 0
  var lv = partial || null
  if (theme && theme.levels && theme.levels.length) {
    for (var i = 0; i < theme.levels.length; i++) {
      if (theme.levels[i].key === levelKey ||
        theme.levels[i].level === num) {
        lv = theme.levels[i]
        num = lv.level
        break
      }
    }
  }
  var key = levelKey || buildLevelKey(themeId, num)
  return {
    key: key,
    themeId: themeId,
    level: num,
    name: (lv && lv.name) ? lv.name : ('关卡 ' + num),
    image: resolveLevelImage(theme, num, lv),
    grid: config.resolveGridSize(lv && lv.grid),
    timeLimit: lv
      ? (lv.timeLimit != null ? lv.timeLimit : (lv.timeLimitSec != null ? lv.timeLimitSec : 0))
      : 0
  }
}

function normalizeLevel(level, themeId) {
  var levelNum = level.level != null ? level.level : (level.levelNum || 0)
  var key = level.key || level.levelKey || buildLevelKey(themeId, levelNum)
  return {
    key: key,
    themeId: level.themeId || themeId || '',
    level: levelNum,
    name: level.name || '',
    grid: config.resolveGridSize(level.grid != null ? level.grid : level.gridSize),
    timeLimit: level.timeLimit != null ? level.timeLimit : (level.timeLimitSec || 0)
  }
}

function normalizeTheme(theme) {
  var id = theme.id || theme.themeId || ''
  var rawLevels = theme.levels || []
  var levels = []
  for (var i = 0; i < rawLevels.length; i++) {
    levels.push(normalizeLevel(rawLevels[i], id))
  }
  var totalLevels = theme.totalLevels != null ? theme.totalLevels : levels.length
  if (!totalLevels && levels.length) totalLevels = levels.length
  return {
    id: id,
    name: theme.name || '',
    icon: theme.icon || '',
    accent: theme.accent || '',
    themeImage: theme.themeImage || '',
    totalLevels: totalLevels,
    levels: levels,
    levelsLoaded: levels.length > 0
  }
}

function mergeThemeList(list) {
  var map = {}
  for (var i = 0; i < THEMES.length; i++) {
    map[THEMES[i].id] = THEMES[i]
  }
  THEMES.length = 0
  for (var j = 0; j < list.length; j++) {
    var incoming = normalizeTheme(list[j])
    var existing = map[incoming.id]
    if (existing && existing.levelsLoaded && existing.levels.length) {
      incoming.levels = existing.levels
      incoming.levelsLoaded = true
    }
    THEMES.push(incoming)
  }
  loaded = true
}

function setThemes(list) {
  mergeThemeList(list)
}

function hasThemeLevels(theme) {
  return !!(theme && theme.levelsLoaded && theme.levels && theme.levels.length)
}

function loadThemes(opts) {
  opts = opts || {}
  if (opts.force) loadingPromise = null

  if (loadingPromise) return loadingPromise

  var summary = opts.summary !== false

  loadingPromise = jigsawApi.fetchThemes({ summary: summary }).then(function (list) {
    if (!list) list = []
    loadError = null
    setThemes(list)
    console.log('[gallery-data] loaded themes, count:', list.length, summary ? '(summary)' : '(full)')
    return THEMES
  }).catch(function (err) {
    console.warn('[gallery-data] api failed', err)
    loadError = err
    setThemes([])
    throw err
  }).then(function (themes) {
    loadingPromise = null
    return themes
  }, function (err) {
    loadingPromise = null
    throw err
  })

  return loadingPromise
}

function ensureThemeLevels(themeId) {
  if (!themeId) return Promise.reject(new Error('themeId required'))

  var theme = getThemeById(themeId)
  if (hasThemeLevels(theme)) return Promise.resolve(theme)

  if (themeLevelsLoading[themeId]) return themeLevelsLoading[themeId]

  themeLevelsLoading[themeId] = jigsawApi.fetchThemeDetail(themeId).then(function (detail) {
    if (!detail) throw new Error('theme not found: ' + themeId)
    var normalized = normalizeTheme(detail)
    var target = getThemeById(themeId)
    if (target) {
      target.levels = normalized.levels
      target.totalLevels = normalized.totalLevels || normalized.levels.length
      target.levelsLoaded = normalized.levels.length > 0
    } else {
      THEMES.push(normalized)
    }
    loaded = true
    return getThemeById(themeId)
  }).then(function (result) {
    delete themeLevelsLoading[themeId]
    return result
  }, function (err) {
    delete themeLevelsLoading[themeId]
    throw err
  })

  return themeLevelsLoading[themeId]
}

function getThemes() {
  return THEMES
}

function isLoaded() {
  return loaded
}

function getLoadError() {
  return loadError
}

function getThemeById(themeId) {
  for (var i = 0; i < THEMES.length; i++) {
    if (THEMES[i].id === themeId) return THEMES[i]
  }
  return null
}

function getLevelByKey(levelKey) {
  for (var i = 0; i < THEMES.length; i++) {
    var levels = THEMES[i].levels || []
    for (var j = 0; j < levels.length; j++) {
      if (levels[j].key === levelKey) return levels[j]
    }
  }
  return null
}

module.exports = {
  DEFAULT_GRID: DEFAULT_GRID,
  LEVELS_PER_THEME: LEVELS_PER_THEME,
  THEME_CARD_UNLOCKED: THEME_CARD_UNLOCKED,
  THEME_CARD_LOCKED: THEME_CARD_LOCKED,
  LEVEL_THUMB_PLACEHOLDER: LEVEL_THUMB_PLACEHOLDER,
  loadThemes: loadThemes,
  ensureThemeLevels: ensureThemeLevels,
  hasThemeLevels: hasThemeLevels,
  getThemes: getThemes,
  isLoaded: isLoaded,
  getLoadError: getLoadError,
  getThemeById: getThemeById,
  getLevelByKey: getLevelByKey,
  buildLevelKey: buildLevelKey,
  resolveLevelImage: resolveLevelImage,
  resolveLevelThumbImage: resolveLevelThumbImage,
  resolveLevelForPlay: resolveLevelForPlay,
  prefetchLevelUrls: imageProxy.prefetchLevelUrls,
  GALLERY_THUMB_W: GALLERY_THUMB_W,
  GALLERY_THUMB_H: GALLERY_THUMB_H
}
