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

module.exports = {
  markLevelComplete,
  isLevelComplete,
  countThemeCompleted
}
