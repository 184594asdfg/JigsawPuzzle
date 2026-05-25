/**
 * 轻量预取：当前主题 cover + 下一关关卡图（各 1 张）
 */
var assets = require('../js/assets')
var galleryData = require('./gallery-data')
var progress = require('./progress')

var prefetchToken = 0
var lastPrefetchKey = ''
var prefetchPromise = null

function prefetchImage(url) {
  if (!url || assets.get(url) || assets.hasFailed(url)) return
  assets.load(url).catch(function () {})
}

function prefetchNextLevelAssets() {
  if (!galleryData.isLoaded()) return Promise.resolve()
  if (prefetchPromise) return prefetchPromise

  var token = ++prefetchToken
  var next = progress.findFirstPlayableLevel(galleryData.getThemes())
  if (!next || !next.theme || !next.level || !next.level.key) {
    return Promise.resolve()
  }

  if (next.level.key === lastPrefetchKey && next.level.image && assets.get(next.level.image)) {
    return Promise.resolve()
  }

  var theme = next.theme
  var coverUrl = galleryData.buildThemeCoverUrl(theme.imageFolder) || theme.themeImage
  if (coverUrl) prefetchImage(coverUrl)

  function finish(level) {
    if (token !== prefetchToken || !level || !level.image) return
    lastPrefetchKey = level.key
    prefetchImage(level.image)
  }

  if (next.level.image) {
    finish(next.level)
    return Promise.resolve()
  }

  prefetchPromise = galleryData.ensureThemeLevels(theme.id).then(function () {
    if (token !== prefetchToken) return
    var refreshed = progress.findFirstPlayableLevel(galleryData.getThemes())
    if (refreshed && refreshed.level) finish(refreshed.level)
  }).catch(function () {}).then(function () {
    prefetchPromise = null
  })

  return prefetchPromise
}

function resetPrefetchCache() {
  prefetchToken++
  lastPrefetchKey = ''
}

module.exports = {
  prefetchNextLevelAssets: prefetchNextLevelAssets,
  resetPrefetchCache: resetPrefetchCache
}
