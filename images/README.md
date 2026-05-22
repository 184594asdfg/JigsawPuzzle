# 图片资源

## 拼图关卡（photo1～photoN.jpg）

- 建议尺寸：**840×1260**（宽:高 = 2:3）
- 在 `utils/gallery-data.js` 的 `PUZZLE_IMAGES` 中登记文件名

## 首页背景（单独一张）

- 路径：**`images/home-bg.jpg`**（也可用 `home-bg.png`，需在 `pages/index/index.js` 里改 `HOME_BG`）
- 建议：竖屏全屏图，约 **1242×2688** 或更大，文件 &lt; 600KB 更流畅

## 首页中部大图

- 路径：**`images/home-hero.png`**（JPG 则改名为 `home-hero.jpg` 并改 `index.js` 里 `HOME_HERO`）
- 设计尺寸：**1050×2050**（宽×高，竖长图）
- 显示在背景之上、底部三个按钮之上，各机型按比例缩放不裁切（`aspectFit`）

## 首页按钮图标

见 **`images/icons/`** 目录：`rank.png`、`level.png`、`gallery.png`
