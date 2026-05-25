/**
 * 音效：受设置「音效」开关控制
 */
var settings = require('../utils/settings')

var SRC = {
  click: 'audio/click.mp3',
  intro_deal: 'audio/intro_deal.mp3',
  intro_flip: 'audio/intro_flip.mp3'
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

function wrapClick(fn) {
  return function () {
    playClick()
    if (typeof fn === 'function') fn()
  }
}

module.exports = {
  playClick: playClick,
  playIntroDeal: playIntroDeal,
  playIntroFlip: playIntroFlip,
  wrapClick: wrapClick
}
