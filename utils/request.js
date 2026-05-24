/**
 * wx.request 封装
 */
var config = require('./app-config')

function buildUrl(path) {
  if (path.indexOf('http') === 0) return path
  var base = config.baseURL.replace(/\/+$/, '')
  var p = path.charAt(0) === '/' ? path : '/' + path
  return base + p
}

function unwrap(body) {
  if (body && body.success) return body.data
  var msg = (body && body.message) ? body.message : '请求失败'
  throw new Error(msg)
}

function request(method, path, data) {
  var url = buildUrl(path)
  console.log('[api]', method, url)
  return new Promise(function (resolve, reject) {
    wx.request({
      url: url,
      method: method,
      data: data || {},
      header: { 'Content-Type': 'application/json' },
      success: function (res) {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error('HTTP ' + res.statusCode))
          return
        }
        try {
          resolve(unwrap(res.data))
        } catch (e) {
          reject(e)
        }
      },
      fail: function (err) {
        reject(err || new Error('network error'))
      }
    })
  })
}

module.exports = {
  get: function (path, data) { return request('GET', path, data) },
  post: function (path, data) { return request('POST', path, data) },
  buildUrl: buildUrl
}
