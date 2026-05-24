/**
 * 拼图小游戏 API 配置
 */
function getEnv() {
  try {
    var info = wx.getSystemInfoSync()
    if (info.platform === 'devtools') return 'development'
  } catch (e) {}
  return 'production'
}

var env = getEnv()

var baseURL = env === 'development'
  ? 'http://localhost:3003/api'
  : 'https://vapi.pastecuts.cn/booksnap/api'

module.exports = {
  env: env,
  baseURL: baseURL,
  loginKey: 'jigsaw',
  api: {
    login: '/user/wxMiniLoginByCode',
    themes: '/jigsaw/themes',
    progress: '/jigsaw/progress'
  }
}
