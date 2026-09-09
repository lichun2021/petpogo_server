# 设备事件系统实现方案

PeerApi 抛事件 → petpogo-server 落库 + 推送 → App 查询/已读 + 后台查询。一组 4 类接口 + 1 张新表。

## 关键发现(和规格有出入)

1. **极光推送已完整实现**——`server/utils/jpush.ts` 现成有 `jpushToDevice(userId, deviceMac, title, content, extraData)`,按 `alias=userId` 推,extras 自动注入 `device_mac`+`type`。规格说"REST API 推送触发未接"是错的,工具齐全,只是没人在事件落库时调用它。④工作量 = 落库时调 5 行。

2. **PeerApi 回调走 `/openapi/**`**——现有 `openapi-auth.ts` 签名中间件(apiKey+timestamp+md5)已保护这个面,PeerApi 已熟悉这套(现有 push/capture 接口都用)。新建 `POST /openapi/device-event/callback`,无需新中间件。

3. **`t_fence_alert` 表基本没被使用**——`grep` 全仓没有任何路由读写它,只是 `init.sql` 里建了空表。可以安全废弃,新建统一表。

4. **设备↔宠物关联**:`t_pet.device_id` 指向 `t_device.id`(BIGINT),而 App 端用的是 `t_device.mac`(如 `ipt-xxx`)。事件表要存 `device_mac`(给 App 展示和推送用),`device_id`(BIGINT,便于关联查询)可存可不存——存 `device_mac` 字符串即可,需要时 JOIN `t_device` 拿 id。

---

## 数据模型

### 新建统一表 `t_device_event`

```sql
CREATE TABLE IF NOT EXISTS t_device_event (
  id            BIGINT       PRIMARY KEY,                -- Snowflake
  user_id       BIGINT       NOT NULL,                   -- 事件归属用户
  event_type    VARCHAR(20)  NOT NULL,                    -- breach / offline / low_battery
  device_mac   VARCHAR(50)  NOT NULL,                    -- 设备 MAC（App 展示 + 推送 extras 用）
  device_name  VARCHAR(100),                              -- 设备名冗余（落库时快照，防改名）
  pet_id        BIGINT,                                   -- 关联宠物（可选，breach 事件可能带）
  pet_name      VARCHAR(50),                              -- 宠物名冗余快照
  description   VARCHAR(500),                             -- 事件描述文案
  extra         JSON,                                     -- 扩展字段（如越界距离 distance、电量百分比）
  is_read       TINYINT      DEFAULT 0,                   -- 0=未读 1=已读
  created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_time (user_id, created_at),
  INDEX idx_user_read (user_id, is_read),
  INDEX idx_type (event_type)
) ENGINE=InnoDB COMMENT='设备事件统一表（越界/离线/低电）';
```

**关键设计**:
- `id` 用 Snowflake(`generateId()`),不用 AUTO_INCREMENT——和项目其他业务表一致
- `device_mac` 存字符串而非 BIGINT id——App 推送 extras 要 mac,展示也要 mac,直接存省一次 JOIN
- `device_name`/`pet_name` 冗余快照——防止用户后来改名导致历史事件文案失真(参照 `t_feedback` 同样设计)
- `extra` JSON 存类型特有字段(breach 的 distance、low_battery 的 battery_percent),避免给三种事件各开列
- 复合索引 `idx_user_time` 服务 App 列表(按用户+时间倒序),`idx_user_read` 服务"全部已读"更新

**`t_fence_alert` 处理**:保留表不动(避免影响可能的历史数据),新事件不再写入它。`init.sql` 里加注释标注"已废弃,改用 t_device_event"。

---

## 接口清单(5 个)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        接口全景图                                    │
├───┬───────────────────────────────────┬──────────┬─────────────────┤
│ # │ 接口                                │ 鉴权     │ 用途            │
├───┼───────────────────────────────────┼──────────┼─────────────────┤
│ 1 │ POST /openapi/device-event/callback│ openapi  │ PeerApi 回调落库 │
│   │                                     │ 签名     │ + 触发推送       │
├───┼───────────────────────────────────┼──────────┼─────────────────┤
│ 2 │ GET /sdkapi/device-event/list      │ App token│ App 拉事件列表   │
├───┼───────────────────────────────────┼──────────┼─────────────────┤
│ 3 │ POST /sdkapi/device-event/read     │ App token│ 标记单条已读     │
├───┼───────────────────────────────────┼──────────┼─────────────────┤
│ 4 │ POST /sdkapi/device-event/read-all │ App token│ 标记全部已读     │
├───┼───────────────────────────────────┼──────────┼─────────────────┤
│ 5 │ GET /api/admin/device-events       │ Admin JWT│ 后台查询事件    │
└───┴───────────────────────────────────┴──────────┴─────────────────┘
```

### 接口 1:PeerApi 事件回调(落库 + 推送)

**文件**:`server/routes/openapi/device-event/callback.post.ts`(新建,走 openapi-auth 签名中间件)

**请求体**(PeerApi 抛过来):
```json
{
  "phone": "13800138000",           // 或 "alias": "13800138000@qq.com"
  "event_type": "breach",           // breach / offline / low_battery
  "device_mac": "ipt-xxx",
  "device_name": "毛毛的项圈",       // 可选,PeerApi 可能不传,后端兜底查 t_device
  "pet_name": "豆包",               // 可选
  "description": "豆包离开了安全围栏范围",  // 可选,后端按类型生成默认文案
  "extra": { "distance": 50 }      // 可选,类型特有字段
}
```

**处理流程**:
```
1. 校验 event_type ∈ {breach, offline, low_battery}
2. 用 phone 反查 t_user 拿 user_id(参照 openapi/sound/list.get.ts:26 的做法)
   - 规范化:phone 自动补 @qq.com(兼容 PeerApi 只传手机号)
3. device_name/pet_name 未传时,查 t_device/t_pet 兜底补全
4. description 未传时,按 event_type 生成默认文案:
     breach      → "{pet_name}离开了安全围栏范围"
     offline     → "设备{device_name}已离线"
     low_battery → "设备{device_name}电量不足({extra.battery_percent}%)"
5. INSERT t_device_event (id=generateId())
6. ★ 同步触发极光推送(try/catch 兜底,失败不影响落库):
     jpushToDevice(userId, device_mac, title, content, {
       type: event_type === 'breach' ? 'fence_alert' : event_type,
       device_mac,
       pet_name
     })
     title/content 按类型生成:
       breach      → title="围栏警报"  content=description
       offline     → title="设备离线"  content=description
       low_battery→ title="电量提醒"  content=description
7. return { success: true, id }
```

**推送同步+兜底**:落库后直接 `await jpushToDevice(...)`,外层 `try/catch` 吞掉推送异常(只 console.error)。极光 API 慢时 PeerApi 多等几百毫秒,可接受。

### 接口 2:App 拉事件列表

**文件**:`server/routes/sdkapi/device-event/list.get.ts`(新建,走 signature 中间件 + requireAuth)

**Query**:
```
type      String?  类型过滤(breach/offline/low_battery)
page      int      页码(默认1)
page_size int      每页条数(默认20,最大50)
```

**返回**(严格按规格):
```json
{
  "list": [
    {
      "id": "string",
      "type": "breach",
      "pet_name": "豆包",
      "device_mac": "ipt-xxx",
      "device_name": "毛毛的项圈",
      "device_product_key": "...",   // 从 t_device.product_id 查,或 extra 里取
      "desc": "豆包离开了安全围栏范围",
      "time": 1691234567000,         // 毫秒时间戳(created_at 转 ms)
      "read": false
    }
  ],
  "total": 35,
  "page": 1
}
```

**SQL**:
```sql
SELECT id, event_type, pet_name, device_mac, device_name, description, extra, is_read, created_at
FROM t_device_event
WHERE user_id = ?  [AND event_type = ?]
ORDER BY created_at DESC
LIMIT ? OFFSET ?
```
- `device_product_key`:规格里有这个字段。`t_device` 没有叫 `product_key` 的列,只有 `product_id`(BIGINT)。我按 PeerApi 习惯把它当作设备的产品标识——从 `extra` JSON 里取,或查 `t_device.product_id`。如果 PeerApi 不传,返回 null。**这个字段语义要你确认**(见下方问题)。

### 接口 3:标记单条已读

**文件**:`server/routes/sdkapi/device-event/read.post.ts`(新建)

**Body**:`{ "event_id": "xxx" }`

**逻辑**:
```sql
UPDATE t_device_event SET is_read=1
WHERE id=? AND user_id=?    -- ★ user_id 防越权:只能标记自己的事件
```
返回 `{ success: true }`。注意 `AND user_id=?` 防止用户标记别人的事件。

### 接口 4:标记全部已读

**文件**:`server/routes/sdkapi/device-event/read-all.post.ts`(新建)

**Body**:`{}`(按 userId 鉴权)

**逻辑**:
```sql
UPDATE t_device_event SET is_read=1 WHERE user_id=? AND is_read=0
```
返回 `{ success: true, count: <受影响行数> }`(用 `result.affectedRows`)。

### 接口 5:后台查询事件 ★

**文件**:`server/routes/api/admin/device-events.get.ts`(新建,走 admin-auth JWT 中间件)

**Query**:
```
userId      String?  按 userId 精确筛
keyword     String?  按手机号/昵称模糊筛(LEFT JOIN t_user)
event_type String?  按类型筛
is_read    String?  按已读状态筛("0"/"1")
start_time String?  开始时间(YYYY-MM-DD 或 ISO)
end_time   String?  结束时间
page       int      默认1
limit      int      默认20,最大100
```

**SQL**(参照 `api/admin/points/logs.get.ts` 的模式):
```sql
SELECT e.id, e.user_id, u.phone, u.nickname, e.event_type, e.device_mac, e.device_name,
       e.pet_name, e.description, e.extra, e.is_read, e.created_at
FROM t_device_event e
LEFT JOIN t_user u ON u.id = e.user_id
WHERE 1=1
  [AND e.user_id = ?]
  [AND (u.phone LIKE ? OR u.nickname LIKE ?)]
  [AND e.event_type = ?]
  [AND e.is_read = ?]
  [AND e.created_at >= ?]
  [AND e.created_at <= ?]
ORDER BY e.created_at DESC
LIMIT ? OFFSET ?
```
返回 `{ list, total, page, limit }`,list 里 id/user_id 转 String。

---

## 文件改动清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `sql/init.sql` | 修改 | 新增 `t_device_event` 建表语句;`t_fence_alert` 加注释标注废弃 |
| `server/routes/openapi/device-event/callback.post.ts` | 新建 | PeerApi 回调落库 + 推送(~60行) |
| `server/routes/sdkapi/device-event/list.get.ts` | 新建 | App 列表查询(~35行) |
| `server/routes/sdkapi/device-event/read.post.ts` | 新建 | 单条已读(~15行) |
| `server/routes/sdkapi/device-event/read-all.post.ts` | 新建 | 全部已读(~15行) |
| `server/routes/api/admin/device-events.get.ts` | 新建 | 后台查询(~50行) |

**无中间件/工具改动**——复用现有 openapi-auth、signature、admin-auth、requireAuth、jpushToDevice、generateId、useDb、useRedis。

## 运维动作

1. **建表**:在 MySQL 执行 `t_device_event` 建表语句(手动跑,项目无 migration 工具)
2. **通知 PeerApi 方**:新回调地址 `POST /openapi/device-event/callback`,走现有 openapi 签名头(x-api-key/x-timestamp/x-signature),请求体如接口1所述

## 验证方式

`npm run build` 编译通过。功能验证靠 Postman/curl 模拟 PeerApi 回调(带签名)→ 查 DB 有数据 → App 拉列表 → 标记已读 → 后台筛选查询。

## 待确认 1 个细节

规格 App 列表返回里有 `device_product_key` 字段,但 `t_device` 表没有这个列(只有 `product_id` BIGINT)。这个字段:
- 是 PeerApi 侧的概念(对方硬件产品标识)?
- 还是就是 `t_device.product_id`?
- 还是可有可无,PeerApi 传了就存 `extra` 里,App 取?

我会在实现时这样兜底:**`device_product_key` 从 `extra` JSON 里取,取不到返回 null**。这样不依赖 `t_device` 表,PeerApi 传什么存什么。如果你需要它关联 `t_device.product_id`,告诉我即可调整。