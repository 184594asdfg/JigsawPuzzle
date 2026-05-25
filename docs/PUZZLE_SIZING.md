# 拼图尺寸与样式规范

> 本项目已从「微信小程序」整体迁移为「微信小游戏」，所有 UI 都在 Canvas 2D 上自绘。
> 拼图布局逻辑沉淀在 `js/puzzle/layout.js`，并被 `js/puzzle/puzzle-engine.js` 使用。

## 布局

| 项 | 值 |
|----|-----|
| 原图 | 750 × 1125（2:3） |
| 难度 | 3×3～7×7（默认 4×4） |
| 棋盘外宽 | 屏宽 **100%** |
| 棋盘内边距 | **12px** |
| 块间距 | **0px**（紧贴，靠 1px 边框分隔） |

```
cellW = floor((外宽 - 24) / N)
cellH = floor(cellW × 3 ÷ 2)
step  = cell
```

## 单块样式

| 属性 | 值 |
|------|-----|
| 背景 | `#ffffff` |
| 圆角 | `4px`（内层图 `2px`） |
| 内边距 | `1px` |
| 边框 | `1px solid #000` |
| 图片 | `aspectFill`，内层裁切窗口 100% 填满 |

图片偏移按内层格 `imageTileW × imageTileH`（扣除 border+padding）计算。
