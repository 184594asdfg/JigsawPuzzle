/**
 * 资源预取：首页当前主题封面 + 当前关/下一关关卡图（走 API 代理）
 */
var assets = require('../js/assets')
var galleryData = require('./gallery-data')
var progress = require('./progress')
var subpackUi = require('./subpack-ui')
var stamina = require('./stamina')
var imageProxy = require('./image-proxy')
var user = require('./user')

var prefetchToken = 0
var lastPrefetchKeys = ''
var prefetchPromise = null
var lastCoverUrl = ''

function prefetchImage(url) {
  if (!url || assets.get(url) || assets.hasFailed(url)) return
  assets.load(url).catch(function () {})
}

/**
 * 分批下载图片（图集缩略图等），带重试与间隔，避免并发打满代理限流
 */
function loadImagesBatch(urls, opts) {
  opts = opts || {}
  var concurrency = opts.concurrency > 0 ? opts.concurrency : 3
  var retries = opts.retries != null ? opts.retries : 2
  var delayMs = opts.delayMs != null ? opts.delayMs : 120

  var unique = []
  var seen = {}
  for (var i = 0; i < (urls || []).length; i++) {
    var u = urls[i]
    if (!u || seen[u] || assets.get(u)) continue
    seen[u] = true
    unique.push(u)
  }
  if (!unique.length) return Promise.resolve()

  function loadOne(url, attempt) {
    if (assets.get(url)) return Promise.resolve()
    var loader = attempt > 0 ? assets.retryLoad(url) : assets.load(url)
    return loader.catch(function () {
      if (attempt >= retries) return null
      return new Promise(function (resolve) {
        setTimeout(resolve, 350 * (attempt + 1))
      }).then(function () {
        return loadOne(url, attempt + 1)
      })
    })
  }

  var index = 0
  function runBatch() {
    if (index >= unique.length) return Promise.resolve()
    var batch = unique.slice(index, index + concurrency)
    index += concurrency
    return Promise.all(batch.map(function (u) { return loadOne(u, 0) })).then(function () {
      if (index >= unique.length) return Promise.resolve()
      return new Promise(function (resolve) {
        setTimeout(resolve, delayMs)
      }).then(runBatch)
    })
  }

  return runBatch()
}

function prefetchLevelImage(url) {
  if (!url) return Promise.resolve(null)
  if (assets.get(url)) return Promise.resolve(assets.get(url))
  return assets.load(url).catch(function () { return null })
}

function resolveLevelImage(level, theme) {
  return galleryData.resolveLevelImage(theme, level.level, level)
}

/** 首页 hero 内拼图区：当前可玩主题封面（代理 URL） */
function getCurrentThemeCoverUrl() {
  if (!galleryData.isLoaded()) return ''
  var next = progress.getNextLevel(galleryData.getThemes())
  if (!next || !next.theme) return ''
  return imageProxy.resolveThemeCoverUrl(next.theme)
}

function getCurrentPlayableLevel() {
  if (!galleryData.isLoaded()) return null
  return progress.findFirstPlayableLevel(galleryData.getThemes())
}

/** 当前可玩关卡大图 URL（CDN 直链） */
function getCurrentLevelImageUrl() {
  var next = getCurrentPlayableLevel()
  if (!next || !next.theme || !next.level) return ''
  return resolveLevelImage(next.level, next.theme)
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

/**
 * 阻塞等待当前可玩关卡大图（启动进首页用，与封面并行）
 * @returns {Promise<{ok:boolean, skipped?:boolean, timeout?:boolean, url?:string}>}
 */
function waitForCurrentLevelImage(timeoutMs) {
  var playable = getCurrentPlayableLevel()
  if (!playable || !playable.level || !playable.level.key) {
    return Promise.resolve({ ok: true, skipped: true })
  }

  var levelKey = playable.level.key
  var url = getCurrentLevelImageUrl()
  if (!url) return Promise.resolve({ ok: true, skipped: true })
  if (assets.get(url)) return Promise.resolve({ ok: true, url: url })

  var loadP = galleryData.prefetchLevelUrls([levelKey]).catch(function () {}).then(function () {
    var freshUrl = getCurrentLevelImageUrl() || url
    return assets.load(freshUrl).then(function (img) {
      return { ok: !!img, url: freshUrl }
    }).catch(function () {
      return { ok: false, url: freshUrl }
    })
  })

  var ms = timeoutMs > 0 ? timeoutMs : 15000
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

  var levelKeys = targets.map(function (t) { return t.level.key })
  var keySig = levelKeys.join('|')
  var allCached = true
  for (var c = 0; c < targets.length; c++) {
    var url = resolveLevelImage(targets[c].level, targets[c].theme)
    if (!url || !assets.get(url)) {
      allCached = false
      break
    }
  }
  if (keySig === lastPrefetchKeys && allCached) return Promise.resolve()

  prefetchPromise = galleryData.prefetchLevelUrls(levelKeys).then(function () {
    if (token !== prefetchToken) return
    for (var i = 0; i < targets.length; i++) {
      var url = resolveLevelImage(targets[i].level, targets[i].theme)
      if (url) prefetchImage(url)
    }
    lastPrefetchKeys = keySig
  }).catch(function () {}).then(function () {
    prefetchPromise = null
  })

  return prefetchPromise
}

/**
 * 点击关卡：最短转场时间内并行拉取大图，已缓存则几乎秒进
 */
function enterPuzzleWhenReady(manager, resolved, minDelayMs) {
  if (!resolved || !resolved.key) {
    try { wx.showToast({ title: '关卡数据缺失', icon: 'none' }) } catch (e) {}
    return
  }
  stamina.loadFromStorage().then(function () {
    if (!stamina.canPlay()) {
      try {
        wx.showToast({
          title: '体力不足',
          icon: 'none',
          duration: 2000
        })
      } catch (e) {}
      return
    }
    var delay = minDelayMs > 0 ? minDelayMs : 0
    var imageUrl = resolved.image || imageProxy.buildLevelImageUrl(resolved.key)
  var loadP
  if (imageUrl) {
    loadP = prefetchLevelImage(imageUrl).catch(function () {
      return imageProxy.fetchPlayLevel(resolved.key).then(function (play) {
        if (!play || !play.imageUrl) throw new Error('no image')
        resolved.image = play.imageUrl
        return prefetchLevelImage(play.imageUrl)
      })
    })
  } else {
    loadP = imageProxy.fetchPlayLevel(resolved.key).then(function (play) {
      if (!play || !play.imageUrl) throw new Error('no image')
      resolved.image = play.imageUrl
      if (play.grid) resolved.grid = play.grid
      if (play.timeLimit) resolved.timeLimit = play.timeLimit
      return prefetchLevelImage(play.imageUrl)
    })
  }
    var waitP = delay > 0
      ? new Promise(function (resolve) { setTimeout(resolve, delay) })
      : Promise.resolve()
    var uiP = subpackUi.preloadAll().catch(function () {})
    return Promise.all([loadP, waitP, uiP]).then(function () {
      return stamina.consume(1)
    })
  }).then(function (ok) {
    if (!ok) {
      try { wx.showToast({ title: '体力不足', icon: 'none' }) } catch (e) {}
      return
    }
    var PuzzleScreen = require('../js/screens/puzzle-screen')
    manager.push(new PuzzleScreen({
      image: resolved.image,
      grid: resolved.grid,
      timeLimit: resolved.timeLimit,
      levelKey: resolved.key,
      levelLabel: resolved.name
    }))
  }).catch(function () {
    try { wx.showToast({ title: '关卡图片加载失败', icon: 'none' }) } catch (e) {}
  })
}

function resetPrefetchCache() {
  prefetchToken++
  lastPrefetchKeys = ''
  lastCoverUrl = ''
  imageProxy.clearCache()
}

function prefetchHomeAssets() {
  return Promise.all([
    prefetchCurrentThemeCover(),
    prefetchNextLevelAssets()
  ])
}

module.exports = {
  prefetchImage: prefetchImage,
  loadImagesBatch: loadImagesBatch,
  prefetchLevelImage: prefetchLevelImage,
  getCurrentThemeCoverUrl: getCurrentThemeCoverUrl,
  getCurrentLevelImageUrl: getCurrentLevelImageUrl,
  prefetchCurrentThemeCover: prefetchCurrentThemeCover,
  waitForCurrentThemeCover: waitForCurrentThemeCover,
  waitForCurrentLevelImage: waitForCurrentLevelImage,
  prefetchNextLevelAssets: prefetchNextLevelAssets,
  prefetchHomeAssets: prefetchHomeAssets,
  enterPuzzleWhenReady: enterPuzzleWhenReady,
  resetPrefetchCache: resetPrefetchCache
}
