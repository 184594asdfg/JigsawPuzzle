/**
 * 拼图图片代理 URL（走 API，不拼 CDN）
 */
var config = require('./app-config')
var request = require('./request')
var user = require('./user')
var jigsawApi = require('./jigsaw-api')

var levelUrlCache = {}
var coverUrlCache = {}

function getUserId() {
  return user.getUserId() || ''
}

function toAbsoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return ''
  if (pathOrUrl.indexOf('http') === 0) return pathOrUrl
  return request.buildUrl(pathOrUrl)
}

function appendQuery(path, key, value) {
  if (!path || !value) return path
  var sep = path.indexOf('?') >= 0 ? '&' : '?'
  return path + sep + encodeURIComponent(key) + '=' + encodeURIComponent(value)
}

function buildCoverUrl(themeId, opts) {
  if (!themeId) return ''
  var userId = getUserId()
  if (!userId) return ''
  var cacheKey = themeId + (opts && opts.thumb ? ':thumb' : '')
  if (coverUrlCache[cacheKey]) return coverUrlCache[cacheKey]

  var path = config.api.jigsawCover + '?themeId=' + encodeURIComponent(themeId)
  path = appendQuery(path, 'userId', userId)
  if (opts && opts.thumb) path = appendQuery(path, 'thumb', '1')
  var url = toAbsoluteUrl(path)
  coverUrlCache[cacheKey] = url
  return url
}

function buildLevelImageUrl(levelKey, opts) {
  if (!levelKey) return ''
  if (config.allLevelsPreviewImage) return config.allLevelsPreviewImage
  var userId = getUserId()
  if (!userId) return ''

  var cacheKey = levelKey + (opts && opts.thumb ? ':thumb' : '')
  if (levelUrlCache[cacheKey]) return levelUrlCache[cacheKey]

  var path = config.api.jigsawImage + '?levelKey=' + encodeURIComponent(levelKey)
  path = appendQuery(path, 'userId', userId)
  if (opts && opts.thumb) path = appendQuery(path, 'thumb', '1')
  var url = toAbsoluteUrl(path)
  levelUrlCache[cacheKey] = url
  return url
}

function resolveThemeCoverUrl(theme, opts) {
  if (!theme) return ''
  if (theme.themeImage) {
    var userId = getUserId()
    if (!userId) return ''
    var base = toAbsoluteUrl(theme.themeImage)
    if (base.indexOf('userId=') < 0) base = appendQuery(base, 'userId', userId)
    if (opts && opts.thumb) base = appendQuery(base, 'thumb', '1')
    return base
  }
  return buildCoverUrl(theme.id, opts)
}

function prefetchLevelUrls(levelKeys, opts) {
  var userId = getUserId()
  if (!userId || !levelKeys || !levelKeys.length) return Promise.resolve({})

  return jigsawApi.fetchImageUrls(userId, levelKeys, opts).then(function (data) {
    var urls = (data && data.urls) ? data.urls : {}
    var keys = Object.keys(urls)
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i]
      var abs = toAbsoluteUrl(urls[k])
      var cacheKey = k + (opts && opts.thumb ? ':thumb' : '')
      levelUrlCache[cacheKey] = abs
      urls[k] = abs
    }
    return urls
  })
}

function fetchPlayLevel(levelKey) {
  var userId = getUserId()
  if (!userId || !levelKey) return Promise.reject(new Error('missing userId or levelKey'))
  return jigsawApi.fetchPlayLevel(userId, levelKey).then(function (data) {
    if (data && data.imageUrl) {
      data.imageUrl = toAbsoluteUrl(data.imageUrl)
      levelUrlCache[levelKey] = data.imageUrl
    }
    return data
  })
}

function clearCache() {
  levelUrlCache = {}
  coverUrlCache = {}
}

module.exports = {
  buildCoverUrl: buildCoverUrl,
  buildLevelImageUrl: buildLevelImageUrl,
  resolveThemeCoverUrl: resolveThemeCoverUrl,
  prefetchLevelUrls: prefetchLevelUrls,
  fetchPlayLevel: fetchPlayLevel,
  clearCache: clearCache,
  toAbsoluteUrl: toAbsoluteUrl
}
