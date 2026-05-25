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

module.exports = {
  fetchThemes: fetchThemes,
  fetchThemeDetail: fetchThemeDetail,
  fetchProgress: fetchProgress,
  saveProgress: saveProgress
}
