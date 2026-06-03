# 图片资源规范

## 包内 `images/`（UI）

首页、按钮、弹窗、特效等。关卡原图在 **CDN**，不要放进包内。

当前包内图片约 **5～6MB**，建议压到 **2～3MB** 再上传（微信主包常见 **4MB** 上限）。

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
| `icons/` + `settings/` | ~1.6MB | 小图勿上千像素宽 |
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

## CDN 关卡图

| 文件 | 路径 |
|------|------|
| 封面 | `{cdnPrefix}{image_folder}/cover.jpg` |
| 关卡 | `{cdnPrefix}{image_folder}/01.png` … `25.png` |

- 客户端：`utils/app-config.js` → `cdnPrefix`
- 后端：`.env` → `JIGSAW_CDN_PREFIX`（须一致，末尾 `/`）
- 出图：**750×1125**（2:3）

## 图集缩略

列表用 `imageView2` webp（`gallery-data.appendGalleryThumbParams`）；拼图页用原图。

## 微信

CDN 域名加入小游戏 **downloadFile 合法域名**。
