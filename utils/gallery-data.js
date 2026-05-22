/** 图库主题与关卡配置 */
const LEVELS_PER_THEME = 6
const DEFAULT_IMAGE = '/images/photo1.jpg'
const DEFAULT_GRID = 4

/** 已放入 images/ 的拼图原图，按关卡序号循环使用 */
const PUZZLE_IMAGES = [
  '/images/photo1.jpg',
  '/images/photo2.jpg',
  '/images/photo3.jpg',
  '/images/photo4.jpg'
]

const THEME_DEFS = [
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

const LEVEL_NAMES = ['初识', '进阶', '挑战', '大师', '传奇', '终极']

function buildLevels(themeId, themeName) {
  return LEVEL_NAMES.map((suffix, i) => {
    const level = i + 1
    return {
      key: `${themeId}_${level}`,
      themeId,
      level,
      name: `${themeName}·${suffix}`,
      image: PUZZLE_IMAGES[i % PUZZLE_IMAGES.length],
      grid: DEFAULT_GRID
    }
  })
}

const THEMES = THEME_DEFS.map(function (t) {
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
  return THEMES.find(t => t.id === themeId) || null
}

function getAllLevels() {
  return THEMES.reduce((acc, t) => acc.concat(t.levels), [])
}

module.exports = {
  LEVELS_PER_THEME,
  DEFAULT_IMAGE,
  DEFAULT_GRID,
  PUZZLE_IMAGES,
  THEMES,
  getThemeById,
  getAllLevels
}
