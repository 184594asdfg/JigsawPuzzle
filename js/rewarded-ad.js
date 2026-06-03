/**
 * 拼图场景激励视频（单例：进入 PuzzleScreen 时 init，离开 destroy）
 */
var config = require('../utils/app-config')

var ad = null
var showing = false

function init() {
  if (ad || !wx.createRewardedVideoAd) return
  try {
    ad = wx.createRewardedVideoAd({ adUnitId: config.rewardedAdUnitId })
    ad.onError(function (err) {
      console.warn('[rewarded-ad]', err)
      showing = false
    })
    preload()
  } catch (e) {
    ad = null
  }
}

function preload() {
  if (!ad) return
  ad.load().catch(function () {})
}

function destroy() {
  if (ad) {
    try { ad.destroy() } catch (e) {}
    ad = null
  }
  showing = false
}

/**
 * @returns {Promise<boolean>} true=完整观看，false=中途关闭
 */
function show() {
  return new Promise(function (resolve, reject) {
    if (!wx.createRewardedVideoAd) {
      reject(new Error('当前环境不支持激励视频'))
      return
    }
    init()
    if (!ad) {
      reject(new Error('广告初始化失败'))
      return
    }
    if (showing) {
      reject(new Error('广告播放中，请稍候'))
      return
    }

    var settled = false
    function onClose(res) {
      if (settled) return
      settled = true
      showing = false
      try { ad.offClose(onClose) } catch (e) {}
      setTimeout(preload, 400)
      resolve(!!(res && res.isEnded))
    }

    showing = true
    ad.onClose(onClose)

    ad.show()
      .catch(function () {
        return ad.load().then(function () { return ad.show() })
      })
      .catch(function (err) {
        if (settled) return
        settled = true
        showing = false
        try { ad.offClose(onClose) } catch (e) {}
        reject(err)
      })
  })
}

module.exports = {
  init: init,
  preload: preload,
  destroy: destroy,
  show: show
}
