const STORAGE_PROGRESS = 'puzzle_level_progress'

function readProgressMap() {
  try {
    const raw = wx.getStorageSync(STORAGE_PROGRESS)
    return raw && typeof raw === 'object' ? raw : {}
  } catch (e) {
    return {}
  }
}

function writeProgressMap(map) {
  wx.setStorageSync(STORAGE_PROGRESS, map)
}

function markLevelComplete(levelKey) {
  if (!levelKey) return
  const map = readProgressMap()
  if (map[levelKey]) return
  map[levelKey] = true
  writeProgressMap(map)
}

function isLevelComplete(levelKey) {
  return !!readProgressMap()[levelKey]
}

function countThemeCompleted(theme) {
  if (!theme || !theme.levels) return 0
  var n = 0
  for (var i = 0; i < theme.levels.length; i++) {
    if (isLevelComplete(theme.levels[i].key)) n++
  }
  return n
}

/**
 * 已完成的关卡总数（跨所有主题）
 */
function countAllCompleted(themes) {
  if (!themes || !themes.length) return 0
  var n = 0
  for (var i = 0; i < themes.length; i++) {
    n += countThemeCompleted(themes[i])
  }
  return n
}

/**
 * 全局「下一关」：返回 themes 里第一个未完成的关卡对象（包含主题信息）。
 * 若所有关卡均已完成，则回到第一关。
 *   返回结构：{ theme, level, levelIndex, globalIndex }
 */
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
  markLevelComplete,
  isLevelComplete,
  countThemeCompleted,
  countAllCompleted,
  getNextLevel
}
