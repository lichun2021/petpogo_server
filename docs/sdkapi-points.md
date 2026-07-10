# SDK API 文档 — 积分与计划模块

> 适用范围：移动 App（`/sdkapi/**`）
> 鉴权方式：签名 + ipet_token（详见下方「鉴权说明」）
> 积分模型：**积分批次模型** — 每笔赠送积分独立到期，只有付费计划赠送的永久积分不过期

---

## 鉴权说明

所有 `/sdkapi/**` 请求必须携带：

| Header | 说明 |
|---|---|
| `x-timestamp` | 毫秒级时间戳，与服务端偏差超过 5 分钟会被拒绝 |
| `x-signature` | `md5(timestamp + APP_API_SECRET)` |
| `Authorization` | `Bearer <ipet_token>`（需登录的接口才要） |

---

## 积分核心概念

### 积分类型（t_points_config）

积分按「类型」区分，类型决定有效期：

| type_code | 名称 | expire_days | 说明 |
|---|---|---|---|
| `permanent` | 永久积分 | 0（永不过期） | 仅付费计划可配发此类 |
| `plan_free` | Free计划积分 | 7 天 | Free 计划周期发放 |
| `plan_pro` | Pro计划积分 | 30 天 | Pro 计划周期发放 |
| `plan_promax` | ProMax计划积分 | 30 天 | ProMax 计划周期发放 |
| `checkin` | 签到积分 | 7 天 | 签到奖励发放 |

> 后台「积分类型」页可增删改这些类型与有效期。

### 积分批次（t_user_points_batch）

每笔赠送积分 = 一条独立批次记录，包含 `granted_amount`（发放量）、`remaining`（剩余）、`expire_at`（到期时间，NULL=永久）。

- **到期**：读取余额时惰性失效（`expire_at < NOW()` 的批次 `remaining` 置 0）
- **消费顺序**：先到期先扣（按 `expire_at` 升序），永久批次最后扣
- **周期发放**：由服务端 cron 每日定时发放，用户离线也照常累计

### 余额结构

```
{
  expiring:   有期限积分合计（剩余会到期的部分）
  permanent:  永久积分合计（不过期）
  total:      总计
  batches: [  批次明细（remaining > 0 的）
    { id, typeCode, remaining, expireAt, reason }
  ]
}
```

---

## 一、积分查询

### 1.1 查询积分余额

`GET /sdkapi/points/balance`

**用途**：查询当前用户的积分余额与批次明细。内部会自动触发「周期积分惰性发放」（兜底，防 cron 漏跑）和「过期批次惰性失效」。

**请求**：无参数

**响应**：
```json
{
  "expiring": 35,
  "permanent": 120,
  "total": 155,
  "batches": [
    {
      "id": "1234567890",
      "typeCode": "plan_pro",
      "remaining": 700,
      "expireAt": "2026-08-09 15:30:00",
      "reason": "购买计划(Pro)赠送周期积分"
    },
    {
      "id": "1234567891",
      "typeCode": "permanent",
      "remaining": 120,
      "expireAt": null,
      "reason": "购买计划(Pro)赠送周期积分"
    }
  ]
}
```

---

### 1.2 查询积分流水

`GET /sdkapi/points/list`

**用途**：分页查询当前用户的积分变动记录（获得/消耗）。

**请求参数**（Query）：

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `page` | number | 否 | 1 | 页码 |
| `limit` | number | 否 | 20 | 每页条数（最大 50） |

**响应**：
```json
{
  "list": [
    {
      "id": "1234567890",
      "direction": 1,
      "points_type": null,
      "type_code": "plan_pro",
      "amount": 700,
      "balance_after": 700,
      "expire_at": "2026-08-09 15:30:00",
      "reason": "购买计划(Pro)赠送周期积分",
      "ref_type": "plan_order",
      "ref_id": "55",
      "created_at": "2026-07-10 15:30:00"
    }
  ],
  "page": 1,
  "limit": 20
}
```

| 字段 | 说明 |
|---|---|
| `direction` | 1=获得 2=消耗 |
| `type_code` | 积分类型（引用 t_points_config） |
| `points_type` | 废弃字段，旧数据 1=周积分 2=永久积分，新数据为 null，向后兼容 |
| `expire_at` | 本批次到期时间（仅获得记录有值，消耗记录为对应批次的到期时间） |
| `ref_type` | 来源：`checkin` / `plan_order` / `plan_period` / `ai_consumption` / `admin_adjust` |

---

### 1.3 查询积分消费规则

`GET /sdkapi/points/rules`

**用途**：查询各类 AI 行为消耗多少积分，供 App 展示价格。

**请求**：无参数

**响应**：
```json
{
  "list": [
    { "consume_type": "image_analyze", "name": "图片情绪", "unit_points": 5, "unit_basis": "per_call" },
    { "consume_type": "voice_analyze", "name": "语音情绪", "unit_points": 5, "unit_basis": "per_call" },
    { "consume_type": "consult_q",     "name": "问诊提问", "unit_points": 10, "unit_basis": "per_call" }
  ]
}
```

| 字段 | 说明 |
|---|---|
| `unit_points` | 每单位消耗的积分数 |
| `unit_basis` | `per_call`=按次 / `per_unit`=按上报数量 |

---

## 二、签到积分

### 2.1 查询签到状态

`GET /sdkapi/checkin/status`

**用途**：查询今日签到状态、连续天数、各奖励档位领取状态。

**请求**：无参数

**响应**：
```json
{
  "today": "2026-07-10",
  "signedInToday": true,
  "currentStreak": 5,
  "rules": [
    {
      "id": "1",
      "ruleType": 1,
      "streakDays": 1,
      "pointsAmount": 2,
      "pointsTypeCode": "checkin",
      "name": "每日签到",
      "claimed": true,
      "claimable": false
    },
    {
      "id": "3",
      "ruleType": 2,
      "streakDays": 7,
      "pointsAmount": 30,
      "pointsTypeCode": "checkin",
      "name": "连续7天",
      "claimed": false,
      "claimable": false
    }
  ]
}
```

| 字段 | 说明 |
|---|---|
| `signedInToday` | 今日是否已签到 |
| `currentStreak` | 当前连续签到天数 |
| `ruleType` | 1=每日签到奖励 2=连续签到奖励 |
| `pointsTypeCode` | 该奖励发放的积分类型（决定有效期） |
| `claimed` | 该档位是否已领取 |
| `claimable` | 是否可领取（已签到且满足条件且未领取） |

---

### 2.2 签到日历

`GET /sdkapi/checkin/calendar`

**用途**：查询签到日历（某月签到记录 + 奖励档位领取状态）。

**请求参数**（Query）：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `month` | string | 否 | 格式 `YYYY-MM`，默认当月 |

**响应**：
```json
{
  "month": "2026-07",
  "signedDays": ["2026-07-01", "2026-07-02", "2026-07-03"],
  "today": "2026-07-10",
  "signedInToday": true,
  "currentStreak": 5,
  "rewardButtons": [
    { "id": "1", "ruleType": 1, "streakDays": 1, "pointsAmount": 2, "pointsTypeCode": "checkin", "name": "每日签到", "claimed": true, "claimable": false }
  ]
}
```

---

### 2.3 签到（记录签到）

`POST /sdkapi/checkin/signin`

**用途**：记录今日签到，更新连续天数。**注意：签到本身不发积分**，积分需单独调「领取奖励」接口。

**请求体**：无

**响应**：
```json
{
  "success": true,
  "streak": 5,
  "today": "2026-07-10"
}
```

---

### 2.4 补签

`POST /sdkapi/checkin/makeup`

**用途**：补签某天（消耗每周补签配额，配额由计划 `weekly_makeup_quota` 决定）。

**请求体**：
```json
{
  "date": "2026-07-08"
}
```

**响应**：
```json
{
  "success": true,
  "streak": 5,
  "remainingQuota": 2
}
```

> 配额超限时返回 400：`本周补签配额已用完`

---

### 2.5 领取签到奖励 ★ 发积分

`POST /sdkapi/checkin/claim`

**用途**：领取每日签到或连续签到奖励，**发放积分**（写入积分批次）。

**请求体**：
```json
{
  "ruleId": "3"
}
```

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `ruleId` | string | 是 | t_checkin_rule.id |

**响应**：
```json
{
  "success": true,
  "pointsAmount": 30,
  "pointsTypeCode": "checkin",
  "balance": {
    "expiring": 37,
    "permanent": 120,
    "total": 157,
    "batches": [...]
  }
}
```

> 积分类型由签到规则的 `points_type_code` 决定（默认 `checkin`，7天有效期）。

---

## 三、会员计划

### 3.1 查询计划列表

`GET /sdkapi/plan/list`

**用途**：查询可购买的会员计划，供 App 购买页展示。

**请求**：无参数

**响应**：
```json
{
  "list": [
    {
      "id": "1",
      "plan_type": 0,
      "name": "Free",
      "price_monthly": 0,
      "price_yearly": 0,
      "duration_days": null,
      "grant_period_days": 7,
      "period_grant_amount": 70,
      "period_grant_type_code": "plan_free",
      "weekly_makeup_quota": 1,
      "description": "免费计划，每周赠送基础积分"
    },
    {
      "id": "2",
      "plan_type": 1,
      "name": "Pro",
      "price_monthly": 30.00,
      "price_yearly": 299.00,
      "duration_days": 30,
      "grant_period_days": 30,
      "period_grant_amount": 700,
      "period_grant_type_code": "plan_pro",
      "weekly_makeup_quota": 3,
      "description": "Pro 计划，每月赠送大量积分"
    }
  ]
}
```

| 字段 | 说明 |
|---|---|
| `price_monthly` | 月费价格（元），0=无月费档 |
| `price_yearly` | 年费价格（元），0=无年费档 |
| `grant_period_days` | 积分发放周期（天）：每 N 天发一次 |
| `period_grant_amount` | 每周期发放的积分数量 |
| `period_grant_type_code` | 发放的积分类型（决定有效期，`permanent`=永久） |

---

### 3.2 查询当前订阅

`GET /sdkapi/plan/current`

**用途**：查询当前用户的订阅状态。

**请求**：无参数

**响应**：
```json
{
  "planId": "2",
  "planType": 1,
  "name": "Pro",
  "status": "active",
  "startAt": "2026-07-01T10:00:00.000Z",
  "expireAt": "2026-07-31T10:00:00.000Z"
}
```

| 字段 | 说明 |
|---|---|
| `planType` | 有效计划类型（已过期则返回 0=Free） |
| `status` | `active`=有效 / `expired`=已过期（自动降级为 Free） |
| `expireAt` | 到期时间（Free 为 null） |

---

### 3.3 创建购买订单 ★

`POST /sdkapi/plan/order`

**用途**：生成一条计划购买订单（占位，不接第三方支付，由管理后台人工确认支付）。

**请求体**：
```json
{
  "planId": "2",
  "period": "monthly"
}
```

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `planId` | string | 是 | t_plan.id |
| `period` | string | 是 | `monthly`=月费 / `yearly`=年费 |

**响应**：
```json
{
  "orderId": "55",
  "planId": "2",
  "planName": "Pro",
  "period": "monthly",
  "amount": 30.00,
  "status": 0
}
```

| 字段 | 说明 |
|---|---|
| `amount` | 实际金额（按 period 取 price_monthly 或 price_yearly） |
| `status` | 0=待支付 |

---

### 3.4 查询订单状态

`GET /sdkapi/plan/order/{orderId}`

**用途**：查询单笔订单支付状态（下单后轮询用）。

**路径参数**：

| 参数 | 说明 |
|---|---|
| `orderId` | 订单 ID |

**响应**：
```json
{
  "orderId": "55",
  "planId": "2",
  "planName": "Pro",
  "period": "monthly",
  "amount": 30.00,
  "status": 1,
  "createdAt": "2026-07-10T15:00:00.000Z",
  "paidAt": "2026-07-10T15:30:00.000Z",
  "expireAt": "2026-08-09T15:30:00.000Z"
}
```

| 字段 | 说明 |
|---|---|
| `status` | 0=待支付 1=已支付(管理员确认) 2=已取消 |
| `expireAt` | 订阅到期时间（月费=支付后30天，年费=支付后365天，仅 status=1 有值） |

---

## 四、积分消费（AI 调用）

> App 端的 AI 接口（图片分析/语音分析/AI问诊）**不直接扣积分**。
> 积分扣减由 AI 服务完成后，通过 OpenAPI 回调 `/openapi/ai/consumption` 上报，由后台按消费规则扣减。

### 消费流程

```
App 调用 AI → AI 服务处理 → AI 服务回调 POST /openapi/ai/consumption → 后台扣积分
```

App 端无需关心扣分逻辑，只需在调用前用 `GET /sdkapi/points/balance` 检查余额是否充足（可参考 `GET /sdkapi/points/rules` 的单价）。

---

## 附：后台管理接口（/api/admin/**，供参考）

App 开发者一般不直接调用，这里列出与积分/计划相关的后台接口供联调参考：

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/admin/plans` | GET | 计划列表 |
| `/api/admin/plans/{id}` | PUT | 编辑计划（月费/年费/积分类型/周期等） |
| `/api/admin/plans` | POST | 新建计划 |
| `/api/admin/plans/{id}` | DELETE | 删除计划 |
| `/api/admin/plans/orders` | GET | 订单列表 |
| `/api/admin/plans/orders/{id}/confirm` | PUT | 确认订单支付 → 自动开通计划+发积分 |
| `/api/admin/points/config` | GET/POST | 积分类型配置 |
| `/api/admin/points/config/{id}` | PUT/DELETE | 编辑/删除积分类型 |
| `/api/admin/points/rules` | GET/POST | AI 消费规则 |
| `/api/admin/points/logs` | GET | 积分流水 |
| `/api/admin/users/{id}/points` | PUT | 手动调整用户积分 |
| `/api/admin/checkin/rules` | GET/POST | 签到奖励档位 |

---

## 附：积分发放来源（ref_type）对照

| ref_type | 触发场景 | 说明 |
|---|---|---|
| `checkin` | 领取签到奖励 | 按 t_checkin_rule 配置的金额和类型 |
| `plan_order` | 购买/确认计划 | 立即发一批周期积分 |
| `plan_period` | 定时任务发放 | cron 每日扫描，到点发一批 |
| `migration` | 历史数据迁移 | 一次性迁移旧余额 |
| `admin_adjust` | 管理员手动调整 | 后台用户管理页操作 |
| `ai_consumption` | AI 消费扣减 | 方向=消耗（direction=2） |
