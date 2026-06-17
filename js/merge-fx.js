/**
 * 拼块融合序列帧（由 videos/merge.mp4 导出）
 * 资源路径：images/merge/fx/merge_fx_01.png … merge_fx_13.png
 */
var assets = require('./assets')

var MERGE_FX_FRAMES = [
  'images/merge/fx/merge_fx_01.png',
  'images/merge/fx/merge_fx_02.png',
  'images/merge/fx/merge_fx_03.png',
  'images/merge/fx/merge_fx_04.png',
  'images/merge/fx/merge_fx_05.png',
  'images/merge/fx/merge_fx_06.png',
  'images/merge/fx/merge_fx_07.png',
  'images/merge/fx/merge_fx_08.png',
  'images/merge/fx/merge_fx_09.png',
  'images/merge/fx/merge_fx_10.png',
  'images/merge/fx/merge_fx_11.png',
  'images/merge/fx/merge_fx_12.png',
  'images/merge/fx/merge_fx_13.png'
]

var MERGE_FX_FRAME_COUNT = MERGE_FX_FRAMES.length
/** 与源视频一致：13 帧 @30fps ≈ 433ms */
var MERGE_FX_DUR_MS = Math.round(MERGE_FX_FRAME_COUNT * 1000 / 30)

function framePath(index) {
  if (index < 0) return MERGE_FX_FRAMES[0]
  if (index >= MERGE_FX_FRAME_COUNT) return MERGE_FX_FRAMES[MERGE_FX_FRAME_COUNT - 1]
  return MERGE_FX_FRAMES[index]
}

/** @param {number} t 0~1 */
function frameIndexAt(t) {
  if (t <= 0) return 0
  if (t >= 1) return MERGE_FX_FRAME_COUNT - 1
  return Math.min(MERGE_FX_FRAME_COUNT - 1, Math.floor(t * MERGE_FX_FRAME_COUNT))
}

function preload() {
  for (var i = 0; i < MERGE_FX_FRAME_COUNT; i++) {
    assets.load(MERGE_FX_FRAMES[i]).catch(function () {})
  }
}

module.exports = {
  MERGE_FX_FRAMES: MERGE_FX_FRAMES,
  MERGE_FX_FRAME_COUNT: MERGE_FX_FRAME_COUNT,
  MERGE_FX_DUR_MS: MERGE_FX_DUR_MS,
  framePath: framePath,
  frameIndexAt: frameIndexAt,
  preload: preload
}
