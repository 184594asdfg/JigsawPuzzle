# 拼图道具次数 — 表结构设计（已定稿）

> **规则**：按次数；**每个新用户**三种道具各 **3 次**；**任意关卡通用**（不按 `level_key` 分账）。  
> 看广告可在次数为 0 后 `grant +1`；使用前 `consume -1`。

---

## 1. 业务约定

| 道具 | `tool_type` | 消耗效果 |
|------|-------------|----------|
| 加时 | `add_time` | +60 秒倒计时 |
| 提示 | `hint` | 执行提示 |
| 整图 | `preview` | 打开整图预览 |

| 规则项 | 值 |
|--------|-----|
| 新用户初始次数 | 每种 **3** 次（仅首次创建用户道具行时写入） |
| 作用范围 | **全关卡共享**同一套余量 |
| 通关 | 不扣次数、不清零（与 `jigsaw_user_level_progress` 无关） |
| 重开关卡 | 余量不变 |
| 广告发放 | `grant +1`（可选上限见下） |
| 使用 | `consume -1`，余量为 0 时接口拒绝 |

**常量（服务端代码 / 配置）**：

```text
NEW_USER_ADD_TIME_QUOTA  = 3
NEW_USER_HINT_QUOTA      = 3
NEW_USER_PREVIEW_QUOTA   = 3
TOOL_REMAIN_MAX          = 99   // 广告累加上限，防刷
```

**发放来源 `source`（仅 API 入参，不落流水表）**：`initial`（新用户）、`ad`、`free`、`admin`

---

## 2. 核心表：用户道具余量（全局）

**表名**：`jigsaw_user_tools`  
**一行一用户**，不含 `level_key`。扣减 / 增加只改本表 `*_remain`。

```sql
CREATE TABLE booksnap.jigsaw_user_tools (
  id              SERIAL PRIMARY KEY,
  user_id         VARCHAR(64) NOT NULL,

  add_time_remain SMALLINT NOT NULL DEFAULT 3,
  hint_remain     SMALLINT NOT NULL DEFAULT 3,
  preview_remain  SMALLINT NOT NULL DEFAULT 3,

  created_at      TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP(6) NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_jigsaw_user_tools_user_id UNIQUE (user_id)
);
```

**Prisma**（`honocloud-main/packages/booksnap/prisma/schema.prisma`）：

```prisma
model JigsawUserTools {
  id            Int      @id @default(autoincrement())
  userId        String   @unique @map("user_id") @db.VarChar(64)

  addTimeRemain Int      @default(3) @map("add_time_remain") @db.SmallInt
  hintRemain    Int      @default(3) @map("hint_remain") @db.SmallInt
  previewRemain Int      @default(3) @map("preview_remain") @db.SmallInt

  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamp(6)
  updatedAt     DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamp(6)

  @@map("jigsaw_user_tools")
  @@schema("booksnap")
}
```

**新用户初始化**：`GET /tools` 时若不存在则 `INSERT` 默认 3/3/3。

---

## 3. API 草案（`/api/jigsaw`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/tools?userId=` | 拉全局余量；无行则创建 3/3/3 |
| POST | `/tools/grant` | `{ userId, toolType, source?, delta?: 1 }` |
| POST | `/tools/consume` | `{ userId, toolType }` 扣 1，0 次返回 409 |

**GET 响应示例**：

```json
{
  "userId": "xxx",
  "addTimeRemain": 3,
  "hintRemain": 2,
  "previewRemain": 1
}
```

**与现有**：

- `GET/POST /progress` — 仍只记录通关关卡。
- 进任意拼图关：请求 `GET /tools`（无需 `levelKey`）。

---

## 4. 客户端（已对接）

| 项 | 实现 |
|----|------|
| API 封装 | `utils/jigsaw-api.js`、`utils/tools.js` |
| 启动 | `main.js` 登录后 `tools.fetchTools()` 初始化/同步余量 |
| 进关 | `puzzle-screen.js` → `onEnter` / `_initEngine` 再次 `fetchTools()` |
| 登录 | `key=jigsaw` 时后端 `ensureJigsawUserTools` 无行则 INSERT 3/3/3 |
| 有余量 | 点底部按钮 → `consume` → `_runToolEffect`（整图直接开 overlay） |
| 无余量 | 弹窗 →「立刻获得」→ `grant(source:'ad')`（暂不接广告）→ 飞行动画 → `consume` → 生效 |
| 角标 | 底部三按钮绘制 `getRemain` |
| 409 | `request.js` 解析 `message`，toast「次数不足」 |

---

## 5. ER 关系

```text
users (1) ── (1) jigsaw_user_tools

users (1) ──< jigsaw_user_level_progress（通关，独立）
```

---

## 6. 迁移步骤

1. 在库中创建 `booksnap.jigsaw_user_tools`（模型见 `schema.prisma`）  
2. 若 migrate 历史漂移，可手工执行：

```sql
CREATE TABLE IF NOT EXISTS booksnap.jigsaw_user_tools (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL UNIQUE,
  add_time_remain SMALLINT NOT NULL DEFAULT 3,
  hint_remain SMALLINT NOT NULL DEFAULT 3,
  preview_remain SMALLINT NOT NULL DEFAULT 3,
  created_at TIMESTAMP(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP(6) NOT NULL DEFAULT NOW()
);
```

3. 后端：`src/routes/jigsaw/tools.ts`，挂载 `/api/jigsaw/tools`；前端已对接  
4. **存量用户补数据**（仅执行一次）：

```sql
INSERT INTO booksnap.jigsaw_user_tools (user_id, add_time_remain, hint_remain, preview_remain)
SELECT u.id, 3, 3, 3
FROM booksnap.users u
WHERE NOT EXISTS (
  SELECT 1 FROM booksnap.jigsaw_user_tools t WHERE t.user_id = u.id
);
```

**不需要** `jigsaw_tool_logs`，**不需要**改 `jigsaw_levels`。
