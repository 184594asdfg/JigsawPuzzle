/**
 * 资源预取：首页当前主题封面 + 当前关/下一关关卡图
 */
var assets = require('../js/assets')
var galleryData = require('./gallery-data')
var progress = require('./progress')

var prefetchToken = 0
var lastPrefetchKeys = ''
var prefetchPromise = null
var lastCoverUrl = ''

function prefetchImage(url) {
  if (!url || assets.get(url) || assets.hasFailed(url)) return
  assets.load(url).catch(function () {})
}

function prefetchLevelImage(url) {
  if (!url) return Promise.resolve(null)
  if (assets.get(url)) return Promise.resolve(assets.get(url))
  return assets.load(url).catch(function () { return null })
}

function resolveLevelImage(level, theme) {
  return galleryData.resolveLevelImage(theme, level.level, level)
}

/** 首页 hero 内拼图区：当前可玩主题 CDN cover.jpg */
function getCurrentThemeCoverUrl() {
  if (!galleryData.isLoaded()) return ''
  var next = progress.getNextLevel(galleryData.getThemes())
  if (!next || !next.theme) return ''
  var theme = next.theme
  if (theme.imageFolder) return galleryData.buildThemeCoverUrl(theme.imageFolder)
  return theme.themeImage || ''
}

function prefetchCurrentThemeCover() {
  var url = getCurrentThemeCoverUrl()
  if (!url) return Promise.resolve(null)
  if (url === lastCoverUrl && assets.get(url)) return Promise.resolve(assets.get(url))
  lastCoverUrl = url
  return assets.load(url).catch(function () { return null })
}

/**
 * 阻塞等待当前主题封面（启动进首页用）；无 URL 视为跳过，超时后仍 resolve 以便进入
 * @returns {Promise<{ok:boolean, skipped?:boolean, timeout?:boolean, url?:string}>}
 */
function waitForCurrentThemeCover(timeoutMs) {
  var url = getCurrentThemeCoverUrl()
  if (!url) return Promise.resolve({ ok: true, skipped: true })
  if (assets.get(url)) {
    lastCoverUrl = url
    return Promise.resolve({ ok: true, url: url })
  }
  lastCoverUrl = url
  var loadP = assets.load(url).then(function (img) {
    return { ok: !!img, url: url }
  }).catch(function () {
    return { ok: false, url: url }
  })
  var ms = timeoutMs > 0 ? timeoutMs : 12000
  var timeoutP = new Promise(function (resolve) {
    setTimeout(function () {
      resolve({ ok: false, url: url, timeout: true })
    }, ms)
  })
  return Promise.race([loadP, timeoutP])
}

function collectPrefetchTargets(themes) {
  var list = []
  var seen = {}
  var current = progress.findFirstPlayableLevel(themes)
  var following = progress.getLevelAfterCurrent(themes)
  if (current && current.level && current.level.key && !seen[current.level.key]) {
    seen[current.level.key] = true
    list.push({ theme: current.theme, level: current.level })
  }
  if (following && following.level && following.level.key && !seen[following.level.key]) {
    seen[following.level.key] = true
    list.push({ theme: following.theme, level: following.level })
  }
  return list
}

function prefetchNextLevelAssets() {
  if (!galleryData.isLoaded()) return Promise.resolve()
  if (prefetchPromise) return prefetchPromise

  var token = ++prefetchToken
  var themes = galleryData.getThemes()
  var targets = collectPrefetchTargets(themes)
  if (!targets.length) return Promise.resolve()

  var keySig = targets.map(function (t) { return t.level.key }).join('|')
  var allCached = true
  for (var c = 0; c < targets.length; c++) {
    var url = resolveLevelImage(targets[c].level, targets[c].theme)
    if (!url || !assets.get(url)) {
      allCached = false
      break
    }
  }
  if (keySig === lastPrefetchKeys && allCached) return Promise.resolve()

  function prefetchTargets(items) {
    if (token !== prefetchToken) return
    for (var i = 0; i < items.length; i++) {
      var url = resolveLevelImage(items[i].level, items[i].theme)
      if (url) prefetchImage(url)
    }
    lastPrefetchKeys = keySig
  }

  var needEnsure = {}
  for (var j = 0; j < targets.length; j++) {
    if (!resolveLevelImage(targets[j].level, targets[j].theme)) {
      needEnsure[targets[j].theme.id] = true
    }
  }
  var themeIds = Object.keys(needEnsure)
  if (!themeIds.length) {
    prefetchTargets(targets)
    return Promise.resolve()
  }

  prefetchPromise = Promise.all(themeIds.map(function (id) {
    return galleryData.ensureThemeLevels(id)
  })).then(function () {
    if (token !== prefetchToken) return
    prefetchTargets(collectPrefetchTargets(themes))
  }).catch(function () {}).then(function () {
    prefetchPromise = null
  })

  return prefetchPromise
}

/**
 * 点击关卡：最短转场时间内并行拉取大图，已缓存则几乎秒进
 */
function enterPuzzleWhenReady(manager, resolved, minDelayMs) {
  if (!resolved || !resolved.image) {
    try { wx.showToast({ title: '关卡图片地址缺失', icon: 'none' }) } catch (e) {}
    return
  }
  var delay = minDelayMs > 0 ? minDelayMs : 0
  var loadP = prefetchLevelImage(resolved.image)
  var waitP = delay > 0
    ? new Promise(function (resolve) { setTimeout(resolve, delay) })
    : Promise.resolve()
  Promise.all([loadP, waitP]).then(function () {
    var PuzzleScreen = require('../js/screens/puzzle-screen')
    manager.push(new PuzzleScreen({
      image: resolved.image,
      grid: resolved.grid,
      timeLimit: resolved.timeLimit,
      levelKey: resolved.key,
      levelLabel: resolved.name
    }))
  })
}

function resetPrefetchCache() {
  prefetchToken++
  lastPrefetchKeys = ''
  lastCoverUrl = ''
}

function prefetchHomeAssets() {
  return Promise.all([
    prefetchCurrentThemeCover(),
    prefetchNextLevelAssets()
  ])
}

module.exports = {
  prefetchImage: prefetchImage,
  prefetchLevelImage: prefetchLevelImage,
  getCurrentThemeCoverUrl: getCurrentThemeCoverUrl,
  prefetchCurrentThemeCover: prefetchCurrentThemeCover,
  waitForCurrentThemeCover: waitForCurrentThemeCover,
  prefetchNextLevelAssets: prefetchNextLevelAssets,
  prefetchHomeAssets: prefetchHomeAssets,
  enterPuzzleWhenReady: enterPuzzleWhenReady,
  resetPrefetchCache: resetPrefetchCache
}
