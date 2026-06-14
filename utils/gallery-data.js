/**
 * 图库主题与关卡（仅从接口加载；默认只拉主题摘要，关卡按需加载）
 */
var jigsawApi = require('./jigsaw-api')
var config = require('./app-config')

var DEFAULT_GRID = config.defaultGrid || 4
var LEVELS_PER_THEME = 25

/** 图集关卡格 1x 缩略图（CDN imageView2，与 bookSnap 一致） */
var GALLERY_THUMB_W = 180
var GALLERY_THUMB_H = 266
var GALLERY_THUMB_QUALITY = 85

var THEME_CARD_UNLOCKED = 'images/themes/theme-unlocked.png'
var THEME_CARD_LOCKED = 'images/themes/theme-locked.png'
var LEVEL_THUMB_PLACEHOLDER = 'images/themes/level-placeholder.png'

var THEMES = []
var loaded = false
var loadError = null
var loadingPromise = null
var themeLevelsLoading = {}

function isAbsoluteUrl(url) {
  return url.indexOf('http://') === 0 || url.indexOf('https://') === 0
}

function stripLocalhostPath(url) {
  return String(url).replace(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/?/i, '')
}

/** 将接口相对路径或目录片段拼成完整 CDN URL */
function ensureCdnUrl(urlOrPath) {
  if (!urlOrPath) return ''
  var s = String(urlOrPath).trim()
  if (!s) return ''
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(s)) {
    s = stripLocalhostPath(s)
  }
  if (isAbsoluteUrl(s)) return s
  var prefix = config.cdnPrefix || ''
  if (!prefix) return s
  if (prefix.charAt(prefix.length - 1) !== '/') prefix += '/'
  var path = s.replace(/^\/+/, '')
  if (path.indexOf('jigsaw/') === 0) path = path.slice('jigsaw/'.length)
  return prefix + path
}

function buildThemeCoverUrl(imageFolder) {
  if (!imageFolder) return ''
  var prefix = config.cdnPrefix || ''
  if (!prefix) return ''
  if (prefix.charAt(prefix.length - 1) !== '/') prefix += '/'
  var folder = imageFolder.replace(/^\/+/, '').replace(/\/+$/, '')
  return prefix + folder + '/cover.jpg'
}

function buildLevelKey(themeId, levelNum) {
  return themeId + '_' + levelNum
}

function buildLevelImageUrl(imageFolder, levelNum) {
  if (!imageFolder || !levelNum) return ''
  var prefix = config.cdnPrefix || ''
  if (!prefix) return ''
  if (prefix.charAt(prefix.length - 1) !== '/') prefix += '/'
  var folder = imageFolder.replace(/^\/+/, '').replace(/\/+$/, '')
  var num = levelNum < 10 ? '0' + levelNum : String(levelNum)
  return prefix + folder + '/' + num + '.jpg'
}

/** CDN 原图 URL 追加缩略图处理参数（仅用于图集列表展示） */
function appendGalleryThumbParams(url) {
  if (!url || url.indexOf('http') !== 0) return url
  if (url.indexOf('imageView2') >= 0) return url
  return url + '?imageView2/3/w/' + GALLERY_THUMB_W + '/h/' + GALLERY_THUMB_H +
    '/q/' + GALLERY_THUMB_QUALITY + '/interlace/1/format/webp'
}

function resolveLevelImage(theme, levelNum, level) {
  if (config.allLevelsPreviewImage) {
    return config.allLevelsPreviewImage
  }
  if (level && level.image) return ensureCdnUrl(level.image)
  if (theme && theme.imageFolder && levelNum) {
    return buildLevelImageUrl(theme.imageFolder, levelNum)
  }
  return ''
}

function resolveLevelThumbImage(theme, levelNum, level) {
  var full = resolveLevelImage(theme, levelNum, level)
  return full ? appendGalleryThumbParams(full) : ''
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
    timeLimit: (lv && lv.timeLimit) ? lv.timeLimit : 0
  }
}

function normalizeLevel(level, themeId, imageFolder) {
  var levelNum = level.level != null ? level.level : (level.levelNum || 0)
  var image = ensureCdnUrl(level.image || level.imageUrl || '')
  if (!image && imageFolder && levelNum) {
    image = buildLevelImageUrl(imageFolder, levelNum)
  }
  return {
    key: level.key || level.levelKey || '',
    themeId: level.themeId || themeId || '',
    level: levelNum,
    name: level.name || '',
    image: image,
    grid: config.resolveGridSize(level.grid != null ? level.grid : level.gridSize),
    timeLimit: level.timeLimit != null ? level.timeLimit : (level.timeLimitSec || 0)
  }
}

function normalizeTheme(theme) {
  var id = theme.id || theme.themeId || ''
  var rawLevels = theme.levels || []
  var imageFolder = theme.imageFolder || ''
  var levels = []
  for (var i = 0; i < rawLevels.length; i++) {
    levels.push(normalizeLevel(rawLevels[i], id, imageFolder))
  }
  var totalLevels = theme.totalLevels != null ? theme.totalLevels : levels.length
  if (!totalLevels && levels.length) totalLevels = levels.length
  return {
    id: id,
    name: theme.name || '',
    icon: theme.icon || '',
    accent: theme.accent || '',
    imageFolder: theme.imageFolder || '',
    themeImage: ensureCdnUrl(theme.themeImage || theme.theme_image_url || '') ||
      buildThemeCoverUrl(theme.imageFolder || ''),
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
  if (loadingPromise) return loadingPromise

  var summary = !opts || opts.summary !== false

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
  ensureCdnUrl: ensureCdnUrl,
  buildThemeCoverUrl: buildThemeCoverUrl,
  buildLevelImageUrl: buildLevelImageUrl,
  buildLevelKey: buildLevelKey,
  appendGalleryThumbParams: appendGalleryThumbParams,
  resolveLevelImage: resolveLevelImage,
  resolveLevelThumbImage: resolveLevelThumbImage,
  resolveLevelForPlay: resolveLevelForPlay,
  GALLERY_THUMB_W: GALLERY_THUMB_W,
  GALLERY_THUMB_H: GALLERY_THUMB_H
}
