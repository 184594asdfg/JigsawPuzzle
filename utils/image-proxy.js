/**
 * 拼图图片 URL：CDN 直链（主题/关卡接口带 imageUrl，或本地按 imageFile 拼接）
 */
var config = require('./app-config')
var jigsawApi = require('./jigsaw-api')

var levelUrlCache = {}

function toAbsoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return ''
  if (pathOrUrl.indexOf('http') === 0) return pathOrUrl
  return pathOrUrl
}

function cacheLevelUrl(levelKey, url, opts) {
  if (!levelKey || !url) return
  var cacheKey = levelKey + (opts && opts.thumb ? ':thumb' : '')
  levelUrlCache[cacheKey] = url
}

function buildLevelImageUrl(levelKey, opts) {
  if (!levelKey) return ''
  if (config.allLevelsPreviewImage) return config.allLevelsPreviewImage

  var cacheKey = levelKey + (opts && opts.thumb ? ':thumb' : '')
  if (levelUrlCache[cacheKey]) return levelUrlCache[cacheKey]

  var level = null
  try {
    level = require('./gallery-data').getLevelByKey(levelKey)
  } catch (e) {}

  if (level) {
    if (opts && opts.thumb) {
      if (level.thumbUrl) return level.thumbUrl
      if (level.imageFile) return config.buildCdnImageUrl(level.imageFile, { thumb: true })
    } else {
      if (level.imageUrl) return level.imageUrl
      if (level.imageFile) return config.buildCdnImageUrl(level.imageFile)
    }
  }
  return ''
}

function resolveThemeCoverUrl(theme) {
  if (!theme || !theme.themeImage) return ''
  return toAbsoluteUrl(theme.themeImage)
}

function prefetchLevelUrls(levelKeys, opts) {
  if (!levelKeys || !levelKeys.length) return Promise.resolve({})

  var merged = {}
  var missing = []
  for (var i = 0; i < levelKeys.length; i++) {
    var k = levelKeys[i]
    if (!k) continue
    var url = buildLevelImageUrl(k, opts)
    if (url) {
      merged[k] = url
      cacheLevelUrl(k, url, opts)
    } else {
      missing.push(k)
    }
  }
  if (!missing.length) return Promise.resolve(merged)

  return jigsawApi.fetchImageUrls(missing, opts).then(function (data) {
    var urls = (data && data.urls) ? data.urls : {}
    var keys = Object.keys(urls)
    for (var j = 0; j < keys.length; j++) {
      var key = keys[j]
      var abs = toAbsoluteUrl(urls[key])
      cacheLevelUrl(key, abs, opts)
      merged[key] = abs
    }
    return merged
  }).catch(function () {
    return merged
  })
}

function fetchPlayLevel(levelKey) {
  if (!levelKey) return Promise.reject(new Error('levelKey required'))
  return jigsawApi.fetchPlayLevel(levelKey).then(function (data) {
    if (data && data.imageUrl) {
      data.imageUrl = toAbsoluteUrl(data.imageUrl)
      levelUrlCache[levelKey] = data.imageUrl
    }
    return data
  })
}

function clearCache() {
  levelUrlCache = {}
}

module.exports = {
  buildLevelImageUrl: buildLevelImageUrl,
  resolveThemeCoverUrl: resolveThemeCoverUrl,
  prefetchLevelUrls: prefetchLevelUrls,
  fetchPlayLevel: fetchPlayLevel,
  clearCache: clearCache,
  toAbsoluteUrl: toAbsoluteUrl
}
