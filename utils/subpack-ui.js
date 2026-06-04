/**
 * UI 分包：timeup / modals / win / home-hero（减小主包，满足 4MB）
 * 资源路径与分包前一致，仅增加 subpack-ui/ 前缀；须 preloadAll 后再展示相关 UI。
 */
var assets = require('../js/assets')

var SUBPACK_NAME = 'ui'
var SUBPACK_ROOT = 'subpack-ui/'

var ready = false
var loading = null
var assetsReady = false
var assetsLoading = null

/** 与分包内文件一一对应，启动/进拼图前整包预加载，避免动效缺图 */
var UI_IMAGE_PATHS = [
  'images/home-hero.png',
  'images/timeup/timeup_title.png',
  'images/timeup/timeup_btn_restart.png',
  'images/timeup/btn_watch_add_time.png',
  'images/modals/add_time_modal.png',
  'images/modals/hint_modal.png',
  'images/modals/preview_modal.png',
  'images/win/win_title.png',
  'images/win/win_next.png'
]

;(function () {
  var i
  for (i = 1; i <= 20; i++) {
    UI_IMAGE_PATHS.push(
      'images/timeup/fx/timeup_fx_' + (i < 10 ? '0' + i : String(i)) + '.png'
    )
  }
})()

function uiPath(relativePath) {
  var p = relativePath || ''
  if (p.indexOf(SUBPACK_ROOT) === 0) return p
  if (p.indexOf('images/') === 0) return SUBPACK_ROOT + p
  return SUBPACK_ROOT + 'images/' + p
}

function ensureUiSubpack() {
  if (ready) return Promise.resolve()
  if (loading) return loading

  if (typeof wx === 'undefined' || !wx.loadSubpackage) {
    ready = true
    return Promise.resolve()
  }

  loading = new Promise(function (resolve, reject) {
    wx.loadSubpackage({
      name: SUBPACK_NAME,
      success: function () {
        ready = true
        loading = null
        resolve()
      },
      fail: function (err) {
        loading = null
        reject(err || new Error('loadSubpackage ui failed'))
      }
    })
  })

  return loading
}

function loadOne(path) {
  return assets.load(uiPath(path)).catch(function () { return null })
}

/**
 * 下载分包并预加载其中全部图片（与改分包前首屏/拼图表现一致）
 */
function preloadAll() {
  if (assetsReady) return Promise.resolve()
  if (assetsLoading) return assetsLoading

  assetsLoading = ensureUiSubpack().then(function () {
    var tasks = []
    for (var i = 0; i < UI_IMAGE_PATHS.length; i++) {
      tasks.push(loadOne(UI_IMAGE_PATHS[i]))
    }
    return Promise.all(tasks)
  }).then(function () {
    assetsReady = true
    assetsLoading = null
  }).catch(function (err) {
    assetsLoading = null
    console.warn('[subpack-ui] preloadAll failed', err)
    throw err
  })

  return assetsLoading
}

function isUiSubpackReady() {
  return ready
}

function isUiAssetsReady() {
  return assetsReady
}

module.exports = {
  SUBPACK_NAME: SUBPACK_NAME,
  SUBPACK_ROOT: SUBPACK_ROOT,
  UI_IMAGE_PATHS: UI_IMAGE_PATHS,
  uiPath: uiPath,
  ensureUiSubpack: ensureUiSubpack,
  preloadAll: preloadAll,
  isUiSubpackReady: isUiSubpackReady,
  isUiAssetsReady: isUiAssetsReady
}
