/**
 * 小游戏入口
 * 【隐私合规】必须在所有业务逻辑之前注册 onNeedPrivacyAuthorization，否则 getUserProfile 报 errno:1026
 */
try {
  require('./utils/wx-privacy-profile').initPrivacyGlobal()
} catch (e) {
  console.warn('[game] initPrivacyGlobal failed', e)
}
require('./js/main.js')
