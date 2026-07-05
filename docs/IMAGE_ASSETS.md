# 图片资源规范

## 包内 `images/`（UI）

首页、按钮、弹窗、特效等。关卡原图在 **CDN**，不要放进包内。

## 主包 4MB 限制（已做分包）

微信主包 ≤ **4MB**。大块 UI 已放入分包 **`subpack-ui/`**（`game.json` → `subpackages`），启动时在 `main.js` 里 `loadSubpackage('ui')` 后再显示首页 hero / 进拼图。

| 包 | 约体积 | 内容 |
|----|--------|------|
| **主包** | ~2.8MB | `images/` 图标/主题/设置、`audio/`、`js/` |
| **分包 ui** | ~3.2MB | `timeup/`、`modals/`、`win/`、`home-hero.png` |

主包 `images/` 约 **1.9MB**；分包内资源路径为 `subpack-ui/images/...`（见 `utils/subpack-ui.js` 的 `uiPath()`）。

**不影响原效果**：分包前后为同一批文件；启动时 `preloadAll()` 在进首页前加载 hero/timeup/modals/win 全部分包图，进拼图前再次确保已加载（与原先打进主包时资源就绪时机一致）。

当前包内图片若未分包约 **5～6MB**；主包部分建议保持 **≤2MB** 留余量给音频与代码。

### 一键压缩（本地）

```bash
cd JigsawPuzzle
python3 tools/compress_pack_images.py
```

脚本会：PNG `compress_level=9`、JPG 质量 82、对明显过大的小图按目录缩小最长边。  
更狠的体积可再用 [TinyPNG](https://tinypng.com) 过一遍。

### 导出尺寸建议（750rpx 设计稿）

| 类型 | 显示约 | 源图 @2x |
|------|--------|----------|
| 导航小图标 `icons/setting` 等 | 72rpx | **144×144** |
| 底部主按钮 `icons/level` | 360×138rpx | **720×276** |
| 设置开关 `settings/icon_*` | 设计区 ~265×72 | 按弹窗稿 **@2x** |
| 道具弹窗 `modals/*` | 屏宽 ~540rpx | 宽 **~1080px** |
| 全屏背景 `home-bg.jpg` | 全屏 | 宽 **750**，JPG 80～85 |
| `home-hero.png` | hero 框 | 宽 **750**，与网格/CDN 封面勿重复堆大图 |

### 体积大户（优先压）

| 路径 | 约占用 | 处理 |
|------|--------|------|
| `timeup/fx/timeup_fx_*.png`（20 张） | ~1.3MB | 压帧 / 减帧数 / TinyPNG |
| `modals/*.png` | ~0.9MB | 压缩 + 勿超 @2x 分辨率 |
| `merge/fx/merge_fx_*.png`（13 张） | 拼块融合序列帧 | 由 `videos/merge.mp4` 导出，单帧压缩后建议 ≤15KB |
| `home-hero.png` | ~0.6MB | 压缩；确认是否可与网格二选一 |

### 暂不打包（功能隐藏）

以下文件保留在仓库，但 **不会打进上传包**（见 `project.config.json` → `packOptions.ignore`）：

- `images/icons/rank.png`
- `images/icons/share.png`
- `images/share/**`（转发卡片，可选）

恢复排行/分享时：从 ignore 去掉对应项，并设 `SHOW_RANK_BTN` / `SHOW_SHARE_BTN` 为 `true`。

### 分享（启用时）

| 路径 | 用途 | 建议 |
|------|------|------|
| `images/icons/share.png` | 设置下方分享按钮 | **144×144 @2x** |
| `images/share/card.png` | 转发卡片（可选） | **5:4**，如 500×400 |

逻辑见 `js/share.js`。

---

## CDN 关卡图（服务端内部拉取，客户端走 API 代理）

| 文件 | 路径 |
|------|------|
| 封面 | `https://cdn2.pastecuts.cn/pyGame/{chapterId}.jpg` |
| 关卡 | `https://cdn2.pastecuts.cn/pyGame/{levelId}.jpg`（如 `10003.jpg`） |

- 后端：`.env` → `JIGSAW_CDN_PREFIX=https://cdn2.pastecuts.cn/pyGame/`
- 客户端：`wx.downloadFile` 只请求 `vapi.pastecuts.cn` 代理接口
- 出图：**840×1260**（2:3，封面与关卡原图统一）

## 图集缩略

代理接口加 `thumb=1`，服务端转发 CDN 时附带 `imageView2` 参数；拼图页用原图。

## 微信

`downloadFile` 合法域名：**`vapi.pastecuts.cn`**（关卡图经 API 代理，可不配 CDN 域名）。
