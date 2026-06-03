/**
 * 拼图道具次数（全局，新用户各 3 次）
 * toolsApiEnabled=false 时仅本地计数，不请求 /jigsaw/tools/*
 */
var config = require('./app-config')
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

function ensureLocalCache() {
  if (!cached) {
    cached = {
      addTimeRemain: DEFAULT_TOOLS.addTimeRemain,
      hintRemain: DEFAULT_TOOLS.hintRemain,
      previewRemain: DEFAULT_TOOLS.previewRemain
    }
  }
  return cached
}

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

function localRemain(action) {
  var c = ensureLocalCache()
  if (action === 'addTime') return c.addTimeRemain
  if (action === 'hint') return c.hintRemain
  if (action === 'preview') return c.previewRemain
  return 0
}

function localConsume(action) {
  var c = ensureLocalCache()
  var key = action === 'addTime' ? 'addTimeRemain'
    : action === 'hint' ? 'hintRemain'
      : action === 'preview' ? 'previewRemain' : null
  if (!key || c[key] <= 0) {
    return Promise.reject(new Error('次数不足'))
  }
  c[key] -= 1
  return Promise.resolve(cached)
}

function localGrant(action, delta) {
  var c = ensureLocalCache()
  var d = delta > 0 ? delta : 1
  if (action === 'addTime') c.addTimeRemain += d
  else if (action === 'hint') c.hintRemain += d
  else if (action === 'preview') c.previewRemain += d
  return Promise.resolve(cached)
}

function fetchTools() {
  var userId = user.getUserId()
  if (!userId) {
    cached = {
      addTimeRemain: 0,
      hintRemain: 0,
      previewRemain: 0
    }
    return Promise.resolve(cached)
  }
  if (!config.toolsApiEnabled) {
    return Promise.resolve(ensureLocalCache())
  }
  return jigsawApi.fetchTools(userId).then(applyData).catch(function (err) {
    console.warn('[tools] fetch failed', err)
    return ensureLocalCache()
  })
}

function getCached() {
  return cached
}

function getRemain(action) {
  if (!user.getUserId()) return 0
  if (!cached) return 0
  return localRemain(action)
}

function grant(action, source) {
  if (!user.getUserId()) {
    return Promise.reject(new Error('未登录'))
  }
  if (!ACTION_TO_API[action]) {
    return Promise.reject(new Error('未知道具'))
  }
  if (!config.toolsApiEnabled) {
    return localGrant(action, 1)
  }
  return jigsawApi.grantTool(user.getUserId(), ACTION_TO_API[action], source || 'ad').then(function (data) {
    if (!data) return Promise.reject(new Error('未登录'))
    return applyData(data)
  })
}

function consume(action) {
  if (!user.getUserId()) {
    return Promise.reject(new Error('未登录'))
  }
  if (!ACTION_TO_API[action]) {
    return Promise.reject(new Error('未知道具'))
  }
  if (!config.toolsApiEnabled) {
    return localConsume(action)
  }
  return jigsawApi.consumeTool(user.getUserId(), ACTION_TO_API[action]).then(function (data) {
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
