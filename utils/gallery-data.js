/**
 * 图库主题与关卡（仅从接口加载，失败时用本地兜底）
 */
var jigsawApi = require('./jigsaw-api')

var LEVELS_PER_THEME = 6
var DEFAULT_GRID = 4

var THEME_CARD_UNLOCKED = 'images/themes/theme-unlocked.png'
var THEME_CARD_LOCKED = 'images/themes/theme-locked.png'
var LEVEL_THUMB_PLACEHOLDER = 'images/themes/level-placeholder.png'

var LEVEL_NAMES = ['初识', '进阶', '挑战', '大师', '传奇', '终极']

var FALLBACK_THEME_DEFS = [
  { id: 'meme', name: '玩梗大王', icon: '🃏', accent: '#8FB8A8', imageFolder: 'meme' },
  { id: 'comedy', name: '喜剧之王', icon: '🎭', accent: '#9BB5A8', imageFolder: 'comedy' },
  { id: 'movie', name: '经典影视', icon: '🎬', accent: '#7FAF9E', imageFolder: 'movie' },
  { id: 'pet', name: '萌宠星球', icon: '🐾', accent: '#A5C4B4', imageFolder: 'pet' },
  { id: 'food', name: '美食图鉴', icon: '🍜', accent: '#8EC4B0', imageFolder: 'food' },
  { id: 'nature', name: '自然风光', icon: '🏔', accent: '#7EB8A6', imageFolder: 'nature' },
  { id: 'anime', name: '动漫回忆', icon: '✨', accent: '#94BFAE', imageFolder: 'anime' },
  { id: 'sport', name: '体育竞技', icon: '⚽', accent: '#86B5A3', imageFolder: 'sport' },
  { id: 'art', name: '艺术典藏', icon: '🎨', accent: '#9AB8A9', imageFolder: 'art' },
  { id: 'festival', name: '节日特辑', icon: '🎉', accent: '#8AB9A7', imageFolder: 'festival' },
  { id: 'city', name: '都市印象', icon: '🌆', accent: '#7DAF9C', imageFolder: 'city' },
  { id: 'childhood', name: '童心未泯', icon: '🧸', accent: '#A0C2B2', imageFolder: 'childhood' }
]

var THEMES = []
var loaded = false
var fromApi = false
var loadingPromise = null

function buildFallbackLevels(themeId, themeName) {
  var arr = []
  for (var i = 0; i < LEVEL_NAMES.length; i++) {
    var level = i + 1
    arr.push({
      key: themeId + '_' + level,
      themeId: themeId,
      level: level,
      name: themeName + '·' + LEVEL_NAMES[i],
      image: 'images/photo1.jpg',
      grid: DEFAULT_GRID
    })
  }
  return arr
}

function buildFallbackThemes() {
  return FALLBACK_THEME_DEFS.map(function (t) {
    return {
      id: t.id,
      name: t.name,
      icon: t.icon,
      accent: t.accent,
      imageFolder: t.imageFolder,
      themeImage: 'images/themes/' + t.id + '.jpg',
      totalLevels: LEVELS_PER_THEME,
      levels: buildFallbackLevels(t.id, t.name)
    }
  })
}

function normalizeLevel(level, themeId) {
  return {
    key: level.key || level.levelKey || '',
    themeId: level.themeId || themeId || '',
    level: level.level != null ? level.level : (level.levelNum || 0),
    name: level.name || '',
    image: level.image || level.imageUrl || '',
    grid: level.grid != null ? level.grid : (level.gridSize || DEFAULT_GRID)
  }
}

function normalizeTheme(theme) {
  var id = theme.id || theme.themeId || ''
  var rawLevels = theme.levels || []
  var levels = []
  for (var i = 0; i < rawLevels.length; i++) {
    levels.push(normalizeLevel(rawLevels[i], id))
  }
  return {
    id: id,
    name: theme.name || '',
    icon: theme.icon || '',
    accent: theme.accent || '',
    imageFolder: theme.imageFolder || '',
    themeImage: theme.themeImage || theme.theme_image_url || '',
    totalLevels: theme.totalLevels != null ? theme.totalLevels : levels.length,
    levels: levels
  }
}

function setThemes(list, apiSource) {
  THEMES.length = 0
  for (var i = 0; i < list.length; i++) {
    THEMES.push(normalizeTheme(list[i]))
  }
  loaded = true
  fromApi = !!apiSource
}

function useFallback() {
  setThemes(buildFallbackThemes(), false)
  console.warn('[gallery-data] using local fallback themes')
  return THEMES
}

function loadThemes() {
  if (loadingPromise) return loadingPromise

  loadingPromise = jigsawApi.fetchThemes().then(function (list) {
    if (!list) list = []
    setThemes(list, true)
    console.log('[gallery-data] loaded from api, count:', list.length)
    return THEMES
  }).catch(function (err) {
    console.warn('[gallery-data] api failed, use fallback', err)
    return useFallback()
  }).then(function (themes) {
    loadingPromise = null
    return themes
  })

  return loadingPromise
}

function getThemes() {
  return THEMES
}

function isLoaded() {
  return loaded
}

function isFromApi() {
  return fromApi
}

function getThemeById(themeId) {
  for (var i = 0; i < THEMES.length; i++) {
    if (THEMES[i].id === themeId) return THEMES[i]
  }
  return null
}

function getAllLevels() {
  var all = []
  for (var i = 0; i < THEMES.length; i++) {
    for (var j = 0; j < THEMES[i].levels.length; j++) {
      all.push(THEMES[i].levels[j])
    }
  }
  return all
}

function collectLevelImageUrls() {
  var urls = []
  var seen = {}
  var levels = getAllLevels()
  for (var i = 0; i < levels.length; i++) {
    var src = levels[i].image
    if (src && !seen[src]) {
      seen[src] = true
      urls.push(src)
    }
  }
  for (var j = 0; j < THEMES.length; j++) {
    var cover = THEMES[j].themeImage
    if (cover && !seen[cover]) {
      seen[cover] = true
      urls.push(cover)
    }
  }
  return urls
}

module.exports = {
  LEVELS_PER_THEME: LEVELS_PER_THEME,
  DEFAULT_GRID: DEFAULT_GRID,
  THEME_CARD_UNLOCKED: THEME_CARD_UNLOCKED,
  THEME_CARD_LOCKED: THEME_CARD_LOCKED,
  LEVEL_THUMB_PLACEHOLDER: LEVEL_THUMB_PLACEHOLDER,
  loadThemes: loadThemes,
  getThemes: getThemes,
  isLoaded: isLoaded,
  isFromApi: isFromApi,
  getThemeById: getThemeById,
  getAllLevels: getAllLevels,
  collectLevelImageUrls: collectLevelImageUrls
}
