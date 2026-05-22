/** 图库主题与关卡配置（小游戏：使用包内相对路径，不带前导 /） */
var LEVELS_PER_THEME = 6
var DEFAULT_IMAGE = 'images/photo1.jpg'
var DEFAULT_GRID = 4

/** 图集主题卡片 240×337 → images/themes/ */
var THEME_CARD_UNLOCKED = 'images/themes/theme-unlocked.png'
var THEME_CARD_LOCKED = 'images/themes/theme-locked.png'
/** 主题详情：未完成关卡缩略图占位 */
var LEVEL_THUMB_PLACEHOLDER = 'images/themes/level-placeholder.png'

var PUZZLE_IMAGES = [
  'images/photo1.jpg',
  'images/photo2.jpg',
  'images/photo3.jpg',
  'images/photo4.jpg'
]

var THEME_DEFS = [
  { id: 'meme', name: '玩梗大王', icon: '🃏', accent: '#8FB8A8' },
  { id: 'comedy', name: '喜剧之王', icon: '🎭', accent: '#9BB5A8' },
  { id: 'movie', name: '经典影视', icon: '🎬', accent: '#7FAF9E' },
  { id: 'pet', name: '萌宠星球', icon: '🐾', accent: '#A5C4B4' },
  { id: 'food', name: '美食图鉴', icon: '🍜', accent: '#8EC4B0' },
  { id: 'nature', name: '自然风光', icon: '🏔', accent: '#7EB8A6' },
  { id: 'anime', name: '动漫回忆', icon: '✨', accent: '#94BFAE' },
  { id: 'sport', name: '体育竞技', icon: '⚽', accent: '#86B5A3' },
  { id: 'art', name: '艺术典藏', icon: '🎨', accent: '#9AB8A9' },
  { id: 'festival', name: '节日特辑', icon: '🎉', accent: '#8AB9A7' },
  { id: 'city', name: '都市印象', icon: '🌆', accent: '#7DAF9C' },
  { id: 'childhood', name: '童心未泯', icon: '🧸', accent: '#A0C2B2' }
]

var LEVEL_NAMES = ['初识', '进阶', '挑战', '大师', '传奇', '终极']

function buildLevels(themeId, themeName) {
  var arr = []
  for (var i = 0; i < LEVEL_NAMES.length; i++) {
    var level = i + 1
    arr.push({
      key: themeId + '_' + level,
      themeId: themeId,
      level: level,
      name: themeName + '·' + LEVEL_NAMES[i],
      image: PUZZLE_IMAGES[i % PUZZLE_IMAGES.length],
      grid: DEFAULT_GRID
    })
  }
  return arr
}

var THEMES = THEME_DEFS.map(function (t) {
  return {
    id: t.id,
    name: t.name,
    icon: t.icon,
    accent: t.accent,
    totalLevels: LEVELS_PER_THEME,
    levels: buildLevels(t.id, t.name)
  }
})

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

module.exports = {
  LEVELS_PER_THEME: LEVELS_PER_THEME,
  DEFAULT_IMAGE: DEFAULT_IMAGE,
  DEFAULT_GRID: DEFAULT_GRID,
  THEME_CARD_UNLOCKED: THEME_CARD_UNLOCKED,
  THEME_CARD_LOCKED: THEME_CARD_LOCKED,
  LEVEL_THUMB_PLACEHOLDER: LEVEL_THUMB_PLACEHOLDER,
  PUZZLE_IMAGES: PUZZLE_IMAGES,
  THEMES: THEMES,
  getThemeById: getThemeById,
  getAllLevels: getAllLevels
}
