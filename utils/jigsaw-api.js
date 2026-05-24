/**
 * 拼图 API
 */
var config = require('./app-config')
var request = require('./request')

function fetchThemes() {
  return request.get(config.api.themes).then(function (data) {
    return (data && data.list) ? data.list : []
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
  fetchProgress: fetchProgress,
  saveProgress: saveProgress
}
