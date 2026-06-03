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

// baseURL = 'https://vapi.pastecuts.cn/booksnap/api'

var cdnPrefix = 'https://cdn2.pastecuts.cn/jigsaw/'

module.exports = {
  env: env,
  baseURL: baseURL,
  cdnPrefix: cdnPrefix,
  loginKey: 'jigsaw',
  api: {
    login: '/user/wxMiniLoginByCode',
    themes: '/jigsaw/themes',
    progress: '/jigsaw/progress',
    tools: '/jigsaw/tools'
  },
  /**
   * 道具次数是否与后端同步（GET /tools、POST grant、POST consume）。
   * 后端：honocloud-main/packages/booksnap/src/routes/jigsaw/tools.ts
   */
  toolsApiEnabled: true
}
