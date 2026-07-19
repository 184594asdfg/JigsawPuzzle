/**
 * 拼图小游戏 API 配置
 * 与 bookSnap/config/api.js 一致：默认走线上，避免真机/预览误连 localhost。
 * 本地联调时可临时改 API.development。
 */
function getEnv() {
  try {
    var account = wx.getAccountInfoSync()
    var envVersion = account && account.miniProgram && account.miniProgram.envVersion
    if (envVersion === 'release' || envVersion === 'trial') return 'production'
  } catch (e) {}
  try {
    var info = wx.getSystemInfoSync()
    if (info.platform === 'devtools') return 'development'
  } catch (e) {}
  return 'production'
}

var API = {
  development: 'https://vapi.pastecuts.cn/booksnap/api',
  production: 'https://vapi.pastecuts.cn/booksnap/api'
}

var env = getEnv()
var baseURL = API[env] || API.production

/** 仅作备注；关卡图已走 CDN 直链 */
var cdnPrefix = 'https://cdn2.pastecuts.cn/pyGame/'

/** 开发覆盖：非空时所有关卡用该图；正式环境留空，走接口 CDN */
var allLevelsPreviewImage = ''
/** 开发覆盖：>0 时强制格数；0 使用接口返回的 grid */
var puzzleGridSize = 0
/** 接口未返回 grid 时的兜底（与后端 schema 默认一致） */
var defaultGrid = 4

function resolveGridSize(grid) {
  if (puzzleGridSize > 0) return puzzleGridSize
  if (grid != null && grid > 0) return grid
  return defaultGrid
}

/** 关卡原图 / 主题封面 CDN 出图尺寸（2:3） */
var levelImageW = 840
var levelImageH = 1260

var galleryThumbW = 404
var galleryThumbH = 596

/** CDN 直链：{cdnPrefix}{image_file}，缩略图走七牛 imageView2 */
function buildCdnImageUrl(filename, opts) {
  if (!filename) return ''
  var base = cdnPrefix + String(filename).replace(/^\/+/, '')
  if (!opts || !opts.thumb) return base
  if (base.indexOf('imageView2') >= 0) return base
  return base + '?imageView2/3/w/' + galleryThumbW + '/h/' + galleryThumbH + '/q/90/interlace/1/format/webp'
}

module.exports = {
  env: env,
  baseURL: baseURL,
  cdnPrefix: cdnPrefix,
  levelImageW: levelImageW,
  levelImageH: levelImageH,
  galleryThumbW: galleryThumbW,
  galleryThumbH: galleryThumbH,
  buildCdnImageUrl: buildCdnImageUrl,
  allLevelsPreviewImage: allLevelsPreviewImage,
  puzzleGridSize: puzzleGridSize,
  defaultGrid: defaultGrid,
  resolveGridSize: resolveGridSize,
  loginKey: 'jigsaw',
  api: {
    login: '/user/wxMiniLoginByCode',
    themes: '/jigsaw/themes',
    progress: '/jigsaw/progress',
    rank: '/jigsaw/rank',
    profile: '/user/wxProfile',
    tools: '/jigsaw/tools',
    jigsawImage: '/jigsaw/image',
    jigsawCover: '/jigsaw/cover',
    jigsawPlay: '/jigsaw/play',
    jigsawImageUrls: '/jigsaw/image-urls'
  },
  /**
   * 道具次数是否与后端同步（GET /tools、POST grant、POST consume）。
   * 后端：honocloud-main/packages/booksnap/src/routes/jigsaw/tools.ts
   */
  toolsApiEnabled: true,
  /** 拼图页道具 / 时间耗尽加时 — 激励视频 */
  rewardedAdUnitId: 'adunit-2c82047fdf284c77',
  /** 体力上限与自然恢复间隔（分钟）；看广告单次奖励 */
  staminaMax: 5,
  staminaRegenMin: 10,
  staminaAdGrant: 15
}
