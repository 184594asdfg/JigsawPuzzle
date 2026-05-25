/**
 * 拼图道具次数（全局，新用户各 3 次）
 */
var jigsawApi = require('./jigsaw-api')
var user = require('./user')

var ACTION_TO_API = {
  addTime: 'add_time',
  hint: 'hint',
  preview: 'preview'
}

var DEFAULT_TOOLS = {
  addTimeRemain: 3,
  hintRemain: 3,
  previewRemain: 3
}

var cached = null

function applyData(data) {
  if (!data) {
    cached = null
    return null
  }
  cached = {
    addTimeRemain: Number(data.addTimeRemain) || 0,
    hintRemain: Number(data.hintRemain) || 0,
    previewRemain: Number(data.previewRemain) || 0
  }
  return cached
}

function fetchTools() {
  var userId = user.getUserId()
  if (!userId) {
    cached = {
      addTimeRemain: DEFAULT_TOOLS.addTimeRemain,
      hintRemain: DEFAULT_TOOLS.hintRemain,
      previewRemain: DEFAULT_TOOLS.previewRemain
    }
    return Promise.resolve(cached)
  }
  return jigsawApi.fetchTools(userId).then(applyData).catch(function (err) {
    console.warn('[tools] fetch failed', err)
    if (!cached) {
      cached = {
        addTimeRemain: DEFAULT_TOOLS.addTimeRemain,
        hintRemain: DEFAULT_TOOLS.hintRemain,
        previewRemain: DEFAULT_TOOLS.previewRemain
      }
    }
    return cached
  })
}

function getCached() {
  return cached
}

function getRemain(action) {
  if (!cached) {
    if (action === 'addTime') return DEFAULT_TOOLS.addTimeRemain
    if (action === 'hint') return DEFAULT_TOOLS.hintRemain
    if (action === 'preview') return DEFAULT_TOOLS.previewRemain
    return 0
  }
  if (action === 'addTime') return cached.addTimeRemain
  if (action === 'hint') return cached.hintRemain
  if (action === 'preview') return cached.previewRemain
  return 0
}

function grant(action, source) {
  var userId = user.getUserId()
  var toolType = ACTION_TO_API[action]
  if (!userId || !toolType) {
    return Promise.reject(new Error('未登录'))
  }
  return jigsawApi.grantTool(userId, toolType, source || 'ad').then(function (data) {
    if (!data) return Promise.reject(new Error('未登录'))
    return applyData(data)
  })
}

function consume(action) {
  var userId = user.getUserId()
  var toolType = ACTION_TO_API[action]
  if (!userId || !toolType) {
    return Promise.reject(new Error('未登录'))
  }
  return jigsawApi.consumeTool(userId, toolType).then(function (data) {
    if (!data) return Promise.reject(new Error('未登录'))
    return applyData(data)
  })
}

function clearCache() {
  cached = null
}

module.exports = {
  ACTION_TO_API: ACTION_TO_API,
  DEFAULT_TOOLS: DEFAULT_TOOLS,
  fetchTools: fetchTools,
  getCached: getCached,
  getRemain: getRemain,
  grant: grant,
  consume: consume,
  clearCache: clearCache
}
