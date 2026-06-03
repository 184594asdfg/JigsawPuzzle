# 拼图用户进度（线性）

每用户一行：`booksnap.jigsaw_user_progress`

| 字段 | 说明 |
|------|------|
| `user_id` | PK |
| `completed_count` | 已通关总数 |
| `last_completed_at` | 最近一次新关通关时间（排行同分用） |

## API

- `GET /api/jigsaw/progress?userId=` → `completedCount`, `lastCompletedAt`, `nextLevelNum`, `totalLevels`
- `POST /api/jigsaw/progress` → `{ userId, levelKey }`，仅顺序下一关时 `advanced: true`
- `GET /api/jigsaw/rank?userId=&limit=100` → 全国榜

## 建表

执行 `honocloud-main/packages/booksnap/scripts/jigsaw_user_progress.sql`（不做旧表迁移）。

## 排行

`ORDER BY completed_count DESC, last_completed_at ASC`
