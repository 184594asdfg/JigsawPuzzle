/**
 * 图片资源加载器：支持包内路径与 CDN 远程 URL（远程走 wx.downloadFile）
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

function load(src) {
  if (!src) return Promise.reject(new Error('empty src'))
  if (cache[src] && cache[src].ready) return Promise.resolve(cache[src].image)
  if (cache[src] && cache[src].promise) return cache[src].promise

  var promise = resolveSrc(src).then(function (resolved) {
    return loadImage(resolved)
  }).then(function (img) {
    cache[src].ready = true
    cache[src].image = img
    return img
  }).catch(function (err) {
    cache[src] = null
    throw err
  })

  cache[src] = { image: null, promise: promise, ready: false }
  return promise
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

function size(src) {
  var img = get(src)
  if (!img) return null
  return { w: img.width, h: img.height }
}

module.exports = {
  load: load,
  loadAll: loadAll,
  get: get,
  size: size
}
