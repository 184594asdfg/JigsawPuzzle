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

function fetchProgress(userId) {
  if (!userId) {
    return Promise.resolve({ completedKeys: [], progress: {} })
  }
  return request.get(config.api.progress, { userId: userId }).then(function (data) {
    return {
      completedKeys: (data && data.completedKeys) ? data.completedKeys : [],
      progress: (data && data.progress) ? data.progress : {}
    }
  })
}

function saveProgress(userId, levelKey) {
  if (!userId || !levelKey) return Promise.resolve(null)
  return request.post(config.api.progress, { userId: userId, levelKey: levelKey })
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

module.exports = {
  fetchThemes: fetchThemes,
  fetchThemeDetail: fetchThemeDetail,
  fetchProgress: fetchProgress,
  saveProgress: saveProgress,
  fetchTools: fetchTools,
  grantTool: grantTool,
  consumeTool: consumeTool
}
