/**
 * 图片资源加载器：小游戏环境通过 wx.createImage() 异步加载。
 */
var cache = {}

function load(src) {
  if (!src) return Promise.reject(new Error('empty src'))
  if (cache[src] && cache[src].ready) return Promise.resolve(cache[src].image)
  if (cache[src] && cache[src].promise) return cache[src].promise

  var img = wx.createImage()
  var promise = new Promise(function (resolve, reject) {
    img.onload = function () {
      cache[src].ready = true
      resolve(img)
    }
    img.onerror = function (err) {
      cache[src] = null
      reject(err || new Error('image load failed: ' + src))
    }
    img.src = src
  })
  cache[src] = { image: img, promise: promise, ready: false }
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
