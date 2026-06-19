/**
 * 图片资源加载器：支持包内路径与 CDN 远程 URL（远程走 wx.downloadFile）
 * 加载失败会标记 failed，不会每帧重复请求。
 */
var cache = {}

function isRemoteSrc(src) {
  return src.indexOf('http://') === 0 || src.indexOf('https://') === 0
}

function resolveSrc(src) {
  if (!isRemoteSrc(src)) return Promise.resolve(src)
  return new Promise(function (resolve, reject) {
    wx.downloadFile({
      url: src,
      success: function (res) {
        if (res.statusCode === 200 && res.tempFilePath) {
          resolve(res.tempFilePath)
          return
        }
        reject(new Error('download failed: ' + src))
      },
      fail: function (err) {
        reject(err || new Error('download failed: ' + src))
      }
    })
  })
}

function loadImage(src) {
  return new Promise(function (resolve, reject) {
    var img = wx.createImage()
    img.onload = function () { resolve(img) }
    img.onerror = function (err) {
      reject(err || new Error('image load failed: ' + src))
    }
    img.src = src
  })
}

function markFailed(src, err) {
  cache[src] = {
    ready: false,
    failed: true,
    image: null,
    promise: null,
    error: err || new Error('load failed')
  }
}

function load(src) {
  if (!src) return Promise.reject(new Error('empty src'))

  var entry = cache[src]
  if (entry && entry.ready) return Promise.resolve(entry.image)
  if (entry && entry.failed) {
    return Promise.reject(entry.error || new Error('load failed: ' + src))
  }
  if (entry && entry.promise) return entry.promise

  var promise = resolveSrc(src).then(function (resolved) {
    return loadImage(resolved)
  }).then(function (img) {
    cache[src] = {
      ready: true,
      failed: false,
      image: img,
      promise: null,
      error: null
    }
    return img
  }).catch(function (err) {
    markFailed(src, err)
    console.warn('[assets] load failed:', src, err && err.message ? err.message : err)
    throw err
  })

  cache[src] = {
    ready: false,
    failed: false,
    image: null,
    promise: promise,
    error: null
  }
  return promise
}

/** 渲染循环里用：未加载且未失败时尝试一次，失败静默 */
function tryLoad(src) {
  if (!src || get(src) || hasFailed(src) || isLoading(src)) return
  load(src).catch(function () {})
}

function loadAll(srcList) {
  return Promise.all(srcList.map(function (s) {
    return load(s).catch(function () { return null })
  }))
}

function get(src) {
  var entry = cache[src]
  return entry && entry.ready ? entry.image : null
}

function hasFailed(src) {
  var entry = cache[src]
  return !!(entry && entry.failed)
}

function isLoading(src) {
  var entry = cache[src]
  return !!(entry && entry.promise && !entry.ready && !entry.failed)
}

function size(src) {
  var img = get(src)
  if (!img) return null
  return { w: img.width, h: img.height }
}

function clearFailed(src) {
  if (!src || !cache[src]) return
  delete cache[src]
}

function clear(src) {
  if (!src || !cache[src]) return
  delete cache[src]
}

function retryLoad(src) {
  clearFailed(src)
  return load(src)
}

module.exports = {
  load: load,
  tryLoad: tryLoad,
  loadAll: loadAll,
  get: get,
  hasFailed: hasFailed,
  isLoading: isLoading,
  clearFailed: clearFailed,
  clear: clear,
  retryLoad: retryLoad,
  size: size
}
