/**
 * 背景音乐：循环播放 audio/bgm.mp3，受设置「音乐」开关控制。
 */
var settings = require('../utils/settings')

var BGM_SRC = 'audio/bgm.mp3'
var audio = null
var ready = false
var playing = false

function ensure() {
  if (audio) return audio
  try {
    audio = wx.createInnerAudioContext()
    audio.loop = true
    audio.volume = 1
    audio.obeyMuteSwitch = false
    audio.onCanplay(function () {
      ready = true
      tryPlay()
    })
    audio.onPlay(function () {
      playing = true
    })
    audio.onPause(function () {
      playing = false
    })
    audio.onStop(function () {
      playing = false
    })
    audio.onError(function (err) {
      ready = false
      playing = false
      console.warn('[bgm] error', err && err.errMsg ? err.errMsg : err)
    })
    audio.src = BGM_SRC
  } catch (e) {
    console.warn('[bgm] create failed', e)
    audio = null
  }
  return audio
}

function tryPlay() {
  if (!audio || !ready || !settings.get('music')) return
  if (playing) return
  try {
    audio.play()
  } catch (e) {
    console.warn('[bgm] play failed', e)
  }
}

function sync() {
  ensure()
  if (!settings.get('music')) {
    if (audio) {
      try { audio.pause() } catch (e) {}
    }
    return
  }
  tryPlay()
}

function start() {
  ensure()
  tryPlay()
}

function pause() {
  if (!audio) return
  try { audio.pause() } catch (e) {}
}

module.exports = {
  start: start,
  sync: sync,
  pause: pause
}
