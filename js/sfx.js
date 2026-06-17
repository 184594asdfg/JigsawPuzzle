/**
 * 音效：受设置「音效」开关控制
 */
var settings = require('../utils/settings')

var SRC = {
  click: 'audio/click.mp3',
  intro_deal: 'audio/intro_deal.mp3',
  intro_flip: 'audio/intro_flip.mp3',
  /** 关卡通关（拼图胜利） */
  win: 'audio/win.mp3',
  /** 倒计时归零（时间耗尽遮罩） */
  timeup: 'audio/timeup.mp3',
  /** 拼图块拼合成组 */
  merge: 'audio/merge.mp3'
}

/**
 * 播放音量（0~1）。微信 InnerAudioContext 无分贝 API，用线性音量调节。
 * 素材建议在 DAW 里峰值约 -6dBFS，再由此处微调与 click / move 平衡。
 */
var VOLUME = {
  click: 0.65,
  intro_deal: 0.75,
  intro_flip: 0.75,
  win: 0.85,
  /** 提示音，略低于通关，避免与 BGM 抢戏 */
  timeup: 0.8,
  merge: 0.82
}

var pool = {}

function ensure(key) {
  if (pool[key]) return pool[key]
  var src = SRC[key]
  if (!src) return null
  try {
    var a = wx.createInnerAudioContext()
    a.src = src
    a.obeyMuteSwitch = false
    var vol = VOLUME[key]
    a.volume = vol != null ? vol : 1
    pool[key] = a
  } catch (e) {
    pool[key] = null
  }
  return pool[key]
}

function play(key) {
  if (!settings.get('sfx')) return
  var a = ensure(key)
  if (!a) return
  try {
    a.stop()
    if (a.seek) a.seek(0)
    a.play()
  } catch (e) {}
}

function playClick() {
  play('click')
}

function playIntroDeal() {
  play('intro_deal')
}

function playIntroFlip() {
  play('intro_flip')
}

function playWin() {
  play('win')
}

function playTimeup() {
  play('timeup')
}

function playMerge() {
  play('merge')
}

function wrapClick(fn) {
  return function () {
    playClick()
    if (typeof fn === 'function') fn()
  }
}

module.exports = {
  SRC: SRC,
  VOLUME: VOLUME,
  playClick: playClick,
  playIntroDeal: playIntroDeal,
  playIntroFlip: playIntroFlip,
  playWin: playWin,
  playTimeup: playTimeup,
  playMerge: playMerge,
  wrapClick: wrapClick
}
