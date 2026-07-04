# 拼图用户进度（线性）

每用户一行：`booksnap.jigsaw_user_progress`

| 字段 | 说明 |
|------|------|
| `user_id` | PK |
| `completed_count` | **当前有效关卡链**进度（推关、下一关、顺序校验） |
| `removed_completed_count` | **已删除/下线主题**上的进度（不参与推关） |
| `last_completed_at` | 最近一次新关通关时间（排行同分用） |

展示/排行总关数 = `completed_count + removed_completed_count`

## API

- `GET /api/jigsaw/progress?userId=` → `completedCount`, `removedCompletedCount`, `displayCompletedCount`, `nextLevelNum`, `totalLevels`
- `POST /api/jigsaw/progress` → `{ userId, levelKey }`，仅顺序下一关时推进 `completedCount`
- `GET /api/jigsaw/rank` → 按 `displayCompletedCount` 排序

## 删除主题时迁移

执行 `honocloud-main/packages/booksnap/scripts/jigsaw_migrate_removed_theme_progress.sql`  
修改其中的 `deleted_start`、`deleted_count` 后跑一遍，保证用户展示进度不变、推关从新主题继续。

## 排行

`ORDER BY (completed_count + removed_completed_count) DESC, last_completed_at ASC`
