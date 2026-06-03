# 图片资源规范

## 包内 `images/`（UI）

首页、按钮、弹窗、特效等。启动时 `main.js` → `CORE_ASSETS` 预加载。

### 分享（需自备切图）

| 路径 | 用途 | 建议 |
|------|------|------|
| `images/icons/share.png` | 首页设置下方的分享按钮 | 与 `setting.png` 同尺寸观感（约 72rpx 显示区） |
| `images/share/card.png` | 转发给好友时的卡片图（可选） | 比例 **5:4**；不提供则用系统默认截图 |

逻辑见 `js/share.js`：点击调 `wx.shareAppMessage`，右上角菜单转发走 `wx.onShareAppMessage`。

**不要**把关卡原图放进包内。

## CDN 关卡图

| 文件 | 路径 |
|------|------|
| 封面 | `{cdnPrefix}{image_folder}/cover.jpg` |
| 关卡 | `{cdnPrefix}{image_folder}/01.png` … `25.png` |

- 客户端：`utils/app-config.js` → `cdnPrefix`
- 后端：`.env` → `JIGSAW_CDN_PREFIX`（须一致，末尾 `/`）
- 出图建议：**750×1125**（2:3）

## 图集缩略

已完成关卡列表 URL 追加 `imageView2` webp 参数（`gallery-data.appendGalleryThumbParams`）。拼图页用原图 URL。

## 微信

CDN 域名需加入小游戏 **downloadFile 合法域名**。
