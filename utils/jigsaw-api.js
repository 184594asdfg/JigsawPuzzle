/**
 * 拼图 API
 */
var config = require('./app-config')
var request = require('./request')

function fetchThemes(opts) {
  var summary = !opts || opts.summary !== false
  var query = summary ? { summary: 1 } : {}
  return request.get(config.api.themes, query).then(function (data) {
    return (data && data.list) ? data.list : []
  })
}

function fetchThemeDetail(themeId) {
  if (!themeId) return Promise.reject(new Error('themeId required'))
  return request.get(config.api.themes + '/' + themeId).then(function (data) {
    return data && data.theme ? data.theme : null
  })
}

function normalizeProgress(data) {
  if (!data) {
    return {
      completedCount: 0,
      removedCompletedCount: 0,
      displayCompletedCount: 0,
      lastCompletedAt: null,
      nextLevelNum: 1,
      totalLevels: 0
    }
  }
  var count = data.completedCount != null ? data.completedCount : 0
  var removed = data.removedCompletedCount != null ? data.removedCompletedCount : 0
  var display = data.displayCompletedCount != null
    ? data.displayCompletedCount
    : count + removed
  return {
    completedCount: count,
    removedCompletedCount: removed,
    displayCompletedCount: display,
    lastCompletedAt: data.lastCompletedAt || null,
    nextLevelNum: data.nextLevelNum != null ? data.nextLevelNum : count + 1,
    totalLevels: data.totalLevels || 0,
    advanced: !!data.advanced
  }
}

function fetchProgress(userId) {
  if (!userId) {
    return Promise.resolve(normalizeProgress(null))
  }
  return request.get(config.api.progress, { userId: userId }).then(function (data) {
    return normalizeProgress(data)
  })
}

function saveProgress(userId, levelKey) {
  if (!userId || !levelKey) return Promise.resolve(null)
  return request.post(config.api.progress, { userId: userId, levelKey: levelKey }).then(function (data) {
    return normalizeProgress(data)
  })
}

function fetchRank(userId, opts) {
  var query = { limit: (opts && opts.limit) || 100 }
  if (userId) query.userId = userId
  return request.get(config.api.rank, query).then(function (data) {
    return {
      list: (data && data.list) ? data.list : [],
      myRank: data && data.myRank != null ? data.myRank : null,
      myCompletedCount: (data && data.myCompletedCount) || 0,
      myLastCompletedAt: (data && data.myLastCompletedAt) || null
    }
  })
}

function fetchTools(userId) {
  if (!userId) {
    return Promise.resolve({
      addTimeRemain: 3,
      hintRemain: 3,
      previewRemain: 3
    })
  }
  return request.get(config.api.tools, { userId: userId })
}

function grantTool(userId, toolType, source) {
  if (!userId || !toolType) return Promise.resolve(null)
  return request.post(config.api.tools + '/grant', {
    userId: userId,
    toolType: toolType,
    source: source || 'ad'
  })
}

function consumeTool(userId, toolType) {
  if (!userId || !toolType) return Promise.resolve(null)
  return request.post(config.api.tools + '/consume', {
    userId: userId,
    toolType: toolType
  })
}

function fetchPlayLevel(userId, levelKey) {
  if (!userId || !levelKey) return Promise.reject(new Error('userId and levelKey required'))
  return request.get(config.api.jigsawPlay, { userId: userId, levelKey: levelKey })
}

function fetchImageUrls(userId, levelKeys, opts) {
  if (!userId || !levelKeys || !levelKeys.length) return Promise.resolve({ urls: {} })
  var keys = levelKeys.join(',')
  var query = { userId: userId, keys: keys }
  if (opts && opts.thumb) query.thumb = 1
  return request.get(config.api.jigsawImageUrls, query)
}

module.exports = {
  fetchThemes: fetchThemes,
  fetchThemeDetail: fetchThemeDetail,
  fetchProgress: fetchProgress,
  saveProgress: saveProgress,
  fetchRank: fetchRank,
  fetchTools: fetchTools,
  grantTool: grantTool,
  consumeTool: consumeTool,
  fetchPlayLevel: fetchPlayLevel,
  fetchImageUrls: fetchImageUrls
}
