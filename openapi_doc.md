# PetPogo OpenAPI — 接口文档

**版本**: v1.2
**Base URL**: `http://115.29.196.61:3000`

---

## 鉴权机制

所有 `/openapi/` 接口均需在 HTTP Header 中携带以下三个字段：

| Header | 类型 | 说明 |
|--------|------|------|
| `x-api-key` | `string` | 分配给接入方的 API Key |
| `x-timestamp` | `string` | 当前毫秒时间戳（UTC），**5 分钟内有效** |
| `x-signature` | `string` | 请求签名（见下方计算方式） |

### 签名算法

```
signature = md5(apiKey + timestamp + apiSecret)
```

> [!IMPORTANT]
> `timestamp` 与服务器时差不得超过 **5 分钟**，否则返回 403。
> `apiKey` 和 `apiSecret` 需妥善保管，请勿泄露。

### 接入凭证

| 字段 | 值 |
|------|----|
| `apiKey` | `ce96786dcc394fddeb521d0e` |
| `apiSecret` | `bec1adf7ad77c6e38d3a7599926d9b4203b3ff34f797c2cf` |

---

## 签名示例

**Python**

```python
import hashlib, time, requests

API_KEY    = "ce96786dcc394fddeb521d0e"
API_SECRET = "bec1adf7ad77c6e38d3a7599926d9b4203b3ff34f797c2cf"

def build_headers():
    ts  = str(int(time.time() * 1000))
    sig = hashlib.md5(f"{API_KEY}{ts}{API_SECRET}".encode()).hexdigest()
    return {"x-api-key": API_KEY, "x-timestamp": ts, "x-signature": sig,
            "Content-Type": "application/json"}

resp = requests.post(
    "http://115.29.196.61:3000/openapi/push",
    headers=build_headers(),
    json={"targetType": "alias", "alias": ["18616717926@qq.com"], "title": "新订单", "content": "请处理"}
)
print(resp.json())
```

**Java**

```java
import java.security.MessageDigest;
import java.net.http.*;
import java.net.URI;
import java.time.Instant;

public class PetPogoOpenAPI {
    static final String API_KEY    = "ce96786dcc394fddeb521d0e";
    static final String API_SECRET = "bec1adf7ad77c6e38d3a7599926d9b4203b3ff34f797c2cf";

    static String md5(String s) throws Exception {
        var md = MessageDigest.getInstance("MD5");
        var sb = new StringBuilder();
        for (byte b : md.digest(s.getBytes())) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    public static void main(String[] args) throws Exception {
        String ts  = String.valueOf(Instant.now().toEpochMilli());
        String sig = md5(API_KEY + ts + API_SECRET);
        var body   = "{\"targetType\":\"alias\",\"alias\":[\"18616717926@qq.com\"],\"title\":\"测试\",\"content\":\"内容\"}";

        var req = HttpRequest.newBuilder()
            .uri(URI.create("http://115.29.196.61:3000/openapi/push"))
            .header("x-api-key", API_KEY).header("x-timestamp", ts)
            .header("x-signature", sig).header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body)).build();

        System.out.println(HttpClient.newHttpClient()
            .send(req, HttpResponse.BodyHandlers.ofString()).body());
    }
}
```

**Node.js**

```js
const crypto = require('crypto')
const API_KEY    = 'ce96786dcc394fddeb521d0e'
const API_SECRET = 'bec1adf7ad77c6e38d3a7599926d9b4203b3ff34f797c2cf'

async function push(payload) {
  const ts  = Date.now().toString()
  const sig = crypto.createHash('md5').update(`${API_KEY}${ts}${API_SECRET}`).digest('hex')
  const res = await fetch('http://115.29.196.61:3000/openapi/push', {
    method: 'POST',
    headers: { 'x-api-key': API_KEY, 'x-timestamp': ts, 'x-signature': sig,
               'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

push({ targetType: 'alias', alias: ['18616717926@qq.com'], title: '新消息', content: '您有一条通知' })
  .then(console.log)
```

---

## 接口列表

### `POST /openapi/push` — 发送推送通知

**请求体（JSON）**

```json
{
  "targetType": "alias",
  "alias": ["18616717926@qq.com"],
  "title": "自动抓拍",
  "content": "你的萌宠刚刚被自动抓拍了一张照片，快来看看吧！",
  "extras": {
    "type": "device",
    "device_mac": "ipet-esp32-Device-02"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `targetType` | `string` | ✅ | `alias` 指定用户 / `all` 全体广播 |
| `alias` | `string[]` | 条件必填 | 用户 alias 列表（**格式：`手机号@qq.com`**，例：`18616717926@qq.com`）。`targetType=alias` 时必填，支持数组或逗号分隔字符串，单次最多 **1000** 个 |
| `title` | `string` | ✅ | 通知标题 |
| `content` | `string` | ✅ | 通知正文 |
| `extras` | `object` | ❌ | 自定义附加数据（key/value 均为字符串），App 点击通知后可读取 |

**成功响应（200）**

```json
{
  "success": true,
  "msgId": "1234567890",
  "sendno": "0"
}
```

**错误响应**

| 状态码 | 原因 |
|--------|------|
| `401` | 缺少鉴权 Header |
| `403` | API Key 错误 / 时间戳过期 / 签名错误 |
| `400` | 参数缺失或格式错误 |
| `404` | alias 未在极光注册（用户未登录过 App） |
| `500` | 极光推送服务异常 |

---

> [!NOTE]
> - 推送平台：iOS + Android 双端，支持小米等厂商离线通道
> - 离线消息保留时长：**24 小时**
> - **alias 格式**：`手机号@qq.com`，App 登录后自动注册，未登录过的用户推送会返回 404
> - **设备跳转**：extras 传入 `type=device` + `device_mac=MAC地址`，App 点击通知后自动打开对应设备界面

### extras.type 跳转行为

| `type` 值 | 跳转目标 | 附加必传字段 |
|-----------|---------|----------|
| `device` | 打开对应设备控制界面 | `device_mac`（设备 MAC 地址） |
| `media` | 打开用户图库 | — |
| `consultation` | 打开宠小伊 AI 问诊页 | — |
| `message` | 打开消息中心 | — |
| 不传 / 其他 | 默认跳转首页 | — |

**设备跳转示例**

```json
{
  "type": "device",
  "device_mac": "ipet-esp32-Device-02"
}
```

---

## 接口二：事件上传（抓拍 & 招呼）

### `POST /openapi/capture/save`

设备完成自动抓拍或打招呼后，将媒体资源和 AI 分析结果上传到服务端。

通过 `eventType` 字段决定写入哪张表：

| `eventType` | 目标表 | 说明 |
|-------------|--------|------|
| `greeting` | `t_greeting_event` | 用户打招呼（招呼音 + 可选宠物响应视频） |
| `auto_capture` | `t_capture_event` | 定时 / 自动触发抓拍（默认） |
| `motion` | `t_capture_event` | 移动检测触发 |
| `scheduled` | `t_capture_event` | 计划任务触发 |

> [!NOTE]
> **打招呼流程**：用户在 App 发送招呼音 → 设备收到后播放给宠物 → 设备（可选）录制宠物反应视频上传。
> `greetUrl` = 用户的招呼音；`responseUrl` = 宠物反应视频（**如设备不录制可不传**）。

---

### 请求头

同推送接口，需携带 `x-api-key` / `x-timestamp` / `x-signature`。

---

### 请求体（公共字段）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `alias` | `string` | ✅ | 用户 alias（**格式：`手机号@qq.com`**，例：`18616717926@qq.com`） |
| `deviceId` | `string` | ✅ | 设备 MAC 地址 |
| `eventType` | `string` | ❌ | 事件类型（默认 `auto_capture`） |
| `coverUrl` | `string` | ❌ | 封面 URL（可选，视频不传时服务端自动生成截帧） |
| `aiResult` | `object` | ❌ | AI 情绪分析结果（JSON 对象） |

### 请求体（抓拍专用，`eventType ≠ greeting`）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `resourceUrl` | `string` | ❌ | 抓拍资源 URL（视频 / 音频 / 图片，OSS 直链） |

### 请求体（打招呼专用，`eventType = greeting`）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `resourceUrl` | `string` | ❌ | 招呼音频 URL（用户发给设备播放的音频） |
| `responseUrl` | `string` | ❌ | 宠物响应视频 URL（设备录制，**若不录制可不传**） |

---

### 请求示例

**自动抓拍**

```json
{
  "alias": "18616717926@qq.com",
  "deviceId": "ipet-esp32-Device-02",
  "eventType": "auto_capture",
  "resourceUrl": "https://oss.example.com/videos/abc123.mp4",
  "coverUrl": "https://oss.example.com/covers/abc123.jpg",
  "aiResult": {
    "emotion": "happy",
    "confidence": 0.92,
    "tags": ["wagging", "active"]
  }
}
```

> `coverUrl` 可不传，服务端会自动从 `resourceUrl` 视频生成截帧地址。

**打招呼（设备不录制响应）**

```json
{
  "alias": "18616717926@qq.com",
  "deviceId": "ipet-esp32-Device-02",
  "eventType": "greeting",
  "resourceUrl": "https://oss.example.com/audio/hello.mp3",
  "aiResult": {
    "emotion": "excited",
    "confidence": 0.88
  }
}
```

**打招呼（设备录制了宠物响应）**

```json
{
  "alias": "18616717926@qq.com",
  "deviceId": "ipet-esp32-Device-02",
  "eventType": "greeting",
  "resourceUrl": "https://oss.example.com/audio/hello.mp3",
  "responseUrl": "https://oss.example.com/videos/response.mp4",
  "aiResult": {
    "emotion": "excited",
    "confidence": 0.88,
    "tags": ["jumping", "bark"]
  }
}
```

---

### 响应

成功时仅返回：

```json
{ "success": true }
```


### 错误码

| 状态码 | 原因 |
|--------|------|
| `401` | 缺少鉴权 Header |
| `403` | API Key 错误 / 时间戳过期 / 签名错误 |
| `400` | 参数缺失或格式错误 |
| `404` | alias 对应用户不存在 |
| `500` | 服务器内部错误 |



---

## 接口三：声音列表查询

### `GET /openapi/sound/list`

设备端查询指定用户的声音列表。**用户自定义声音优先返回，不足时以预设声音补充。**

> 使用场景：设备在播放招呼音前，先调此接口获取可用声音列表，供本地播放或选择。

---

### 请求头

同推送接口，需携带 `x-api-key` / `x-timestamp` / `x-signature`。

---

### 查询参数（Query）

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `alias` | `string` | ✅ | 用户 alias（格式：`手机号@qq.com`） |
| `pet_type` | `string` | ✅ | 宠物类型，`cat` 或 `dog` |
| `emotion` | `string` | ❌ | 按情绪筛选（不传返回全部） |

**情绪类型参考值**：`happy` / `sad` / `excited` / `calm` / `angry` / `scared` / `neutral`（可在后台自行配置）

---

### 请求示例

```
GET /openapi/sound/list?alias=18616717926@qq.com&pet_type=cat&emotion=happy
```

---

### 响应字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `list` | `array` | 声音列表（用户自定义在前，预设在后） |
| `list[].id` | `number` | 声音 ID |
| `list[].emotion` | `string` | 对应情绪类型 |
| `list[].pet_type` | `string` | 宠物类型 (`cat`/`dog`) |
| `list[].name` | `string` | 声音名称 |
| `list[].url` | `string` | 声音 OSS 直链 |
| `list[].duration` | `number\|null` | 时长（秒），预设为 null |
| `list[].source` | `string` | `"user"` 用户自定义 / `"preset"` 系统预设 |

```json
{
  "list": [
    {
      "id": 3,
      "emotion": "happy",
      "name": "我的招呼音",
      "url": "https://oss.example.com/audio/my_greeting.mp3",
      "duration": 5,
      "source": "user"
    },
    {
      "id": 1,
      "emotion": "happy",
      "name": "系统默认-开心",
      "url": "https://oss.example.com/audio/preset_happy.mp3",
      "duration": null,
      "source": "preset"
    }
  ]
}
```

### 错误码

| 状态码 | 原因 |
|--------|------|
| `401` | 缺少鉴权 Header |
| `403` | API Key 错误 / 时间戳过期 / 签名错误 |
| `400` | `alias` 未传 |
| `404` | alias 对应用户不存在 |
| `500` | 服务器内部错误 |

> **说明**：若用户无自定义声音，只返回预设（`source: "preset"`）；有自定义则用户声音排前，预设追加在后。设备可用 `source` 字段区分显示样式。

---

## 接口四：AI 消费上报（积分扣减）

### `POST /openapi/ai/consumption`

AI 服务（图片情绪分析 / 语音情绪分析 / AI 问诊等）完成一次调用后，主动调用此接口上报消费类型与数量，由本后台按管理后台配置的 `t_points_consume_rule` 积分单价扣减用户积分（**周积分优先扣，不足部分扣永久积分**）。

> 与本文档前三个接口的区别：本接口鉴权方式相同（`x-api-key`/`x-timestamp`/`x-signature`），但用 **`phone`（手机号）** 而非 `alias`（`手机号@qq.com`）标识用户。

---

### 请求头

同推送接口，需携带 `x-api-key` / `x-timestamp` / `x-signature`。

---

### 请求体

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `phone` | `string` | ✅ | 用户手机号，反查 `t_user` |
| `consumeType` | `string` | ✅ | 消费类型标识，对应管理后台"积分规则"中配置的 `consume_type`（如 `image_analyze`、`voice_analyze`）。新增消费类型需先在管理后台 `/admin/points/rules` 中配置，否则返回 400 |
| `quantity` | `number` | ❌ | 消费数量。规则为"按次"（`per_call`）时忽略此字段，按 1 次计费；规则为"按数量"（`per_unit`）时按此字段 × 单价计算积分（例如 AI 问诊按 token 数/1000 上报） |
| `refId` | `string` | ❌ | AI 服务自己的记录 ID，写入积分流水的 `ref_id`，便于跨系统追溯 |

**请求示例**

```json
{
  "phone": "13800138000",
  "consumeType": "image_analyze",
  "refId": "ai-req-20260708-001"
}
```

---

### 响应

**积分充足（200）**

```json
{
  "success": true,
  "deducted": 5,
  "balance": { "weekly": 65, "permanent": 100, "total": 165 }
}
```

**积分不足（200，不阻塞 AI 服务，如实记账并告知余额）**

```json
{
  "success": false,
  "deducted": 0,
  "message": "积分不足，当前剩余 3 分，需要 5 分",
  "balance": { "weekly": 3, "permanent": 0 }
}
```

> `success: false` 时本次消费**未扣分**。是否因积分不足而拒绝继续提供 AI 服务，由 AI 服务自行决定策略，本接口只负责如实记账。

### 错误码

| 状态码 | 原因 |
|--------|------|
| `401` | 缺少鉴权 Header |
| `403` | API Key 错误 / 时间戳过期 / 签名错误 |
| `400` | `phone`/`consumeType` 为空，或该 `consumeType` 尚未在管理后台配置规则 |
| `404` | `phone` 对应用户不存在 |
| `500` | 服务器内部错误 |

---


## 接口五：广告补签回调

### `POST /openapi/checkin/ad-makeup`

广告服务在用户观看完成广告后调用此接口，直接为用户执行补签（**绕过会员每月配额检查**，即用户配额用尽后仍可通过观看广告补签）。

与会员配额补签（`/sdkapi/checkin/makeup`）的区别：此接口不扣减会员配额，允许无限次（由广告服务侧控制频次）。

---

### 请求头

同推送接口，需携带 `x-api-key` / `x-timestamp` / `x-signature`。

---

### 请求体

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `phone` | `string` | ✅ | 用户手机号，反查 `t_user` |
| `date` | `string` | ✅ | 补签日期，格式 YYYY-MM-DD，只能补签过去的日期（不能是今天及未来） |
| `refId` | `string` | ❌ | 广告任务 ID，用于追溯 |

**请求示例**

```json
{
  "phone": "13800138000",
  "date": "2026-07-05",
  "refId": "ad-task-20260708-001"
}
```

---

### 响应

**成功（200）**

```json
{ "success": true, "date": "2026-07-05", "streakCount": 5 }
```

`streakCount` 为补签后重新计算的连续签到天数。

**幂等性**：若该日期已签到（可能用户已用会员配额补签过，或广告服务重试），返回 `{ "success": true, "message": "该日期已签到" }`，不报错。

### 错误码

| 状态码 | 原因 |
|--------|------|
| `401` | 缺少鉴权 Header |
| `403` | API Key 错误 / 时间戳过期 / 签名错误 |
| `400` | `phone`/`date` 为空，或 `date` 格式无效，或只能补签过去的日期 |
| `404` | `phone` 对应用户不存在 |
| `500` | 服务器内部错误 |

---

## 附一：App 端接口（sdkapi）

以下接口面向 App 客户端，需 `Authorization: Bearer <ipet_token>`，且请求需携带 App 签名 Header（`x-timestamp` + `x-signature`，签名算法为 `md5(timestamp + APP_API_SECRET)`，与本文档 OpenAPI 签名机制不同，`APP_API_SECRET` 与 `apiSecret` 是两套不同的密钥）。

### 积分 `/sdkapi/points/*`

#### `GET /sdkapi/points/balance` — 查询积分余额

```json
{ "weekly": 65, "permanent": 100, "total": 165 }
```

#### `GET /sdkapi/points/list` — 查询积分流水（积分列表）

Query：`page`（默认1）、`limit`（默认20，最大50）

```json
{
  "list": [
    {
      "id": "123", "direction": 2, "points_type": 1, "amount": 5, "balance_after": 65,
      "reason": "图片情绪分析", "ref_type": "ai_consumption", "ref_id": "abc123",
      "created_at": "2026-07-08T10:00:00.000Z"
    }
  ],
  "page": 1, "limit": 20
}
```
`direction`: 1=获得 2=消耗　`points_type`: 1=周积分 2=永久积分

#### `GET /sdkapi/points/rules` — 查询积分消费规则（积分规则展示）

```json
{
  "list": [
    { "consume_type": "image_analyze", "name": "图片情绪分析", "unit_points": 5, "unit_basis": "per_call" },
    { "consume_type": "voice_analyze", "name": "语音情绪分析", "unit_points": 5, "unit_basis": "per_call" }
  ]
}
```

---

### 签到 `/sdkapi/checkin/*`

#### `POST /sdkapi/checkin/signin` — 纯签到

每日只能调用一次，写入签到记录并计算连续签到天数。

```json
{ "checkinDate": "2026-07-08", "streakCount": 3 }
```
错误：`400` 今日已签到。

#### `GET /sdkapi/checkin/status` — 查询签到状态与奖励档位

```json
{
  "today": "2026-07-08",
  "signedInToday": true,
  "currentStreak": 3,
  "rules": [
    { "id": "1", "ruleType": 1, "streakDays": 1, "pointsAmount": 2, "pointsType": 2, "name": "每日签到", "claimed": false, "claimable": true },
    { "id": "2", "ruleType": 2, "streakDays": 3, "pointsAmount": 10, "pointsType": 2, "name": "连续3天", "claimed": false, "claimable": true }
  ]
}
```
`ruleType`: 1=每日签到奖励 2=连续签到奖励

#### `POST /sdkapi/checkin/claim` — 领取签到奖励

请求体：`{ "ruleId": "2" }`

```json
{ "success": true, "pointsAmount": 10, "pointsType": 2, "balance": { "weekly": 65, "permanent": 110, "total": 175 } }
```
错误：`400` 今日未签到 / 连续天数不足 / 该奖励已领取；`404` 奖励规则不存在。

#### `GET /sdkapi/checkin/calendar` — 查询月签到日历

Query：`month`（可选，格式 YYYY-MM，默认当月）

返回当月每天的签到状态（已签到/可签到/未来日期/可补签/已错过），以及连续签到奖励按钮的可点击状态。

```json
{
  "month": "2026-07",
  "calendar": [
    { "date": "2026-07-01", "day": 1, "status": "signed", "streakCount": 1, "isMakeup": false },
    { "date": "2026-07-02", "day": 2, "status": "missed", "streakCount": null, "isMakeup": false },
    { "date": "2026-07-03", "day": 3, "status": "makeup_available", "streakCount": null, "isMakeup": false },
    { "date": "2026-07-08", "day": 8, "status": "signable", "streakCount": null, "isMakeup": false },
    { "date": "2026-07-09", "day": 9, "status": "future", "streakCount": null, "isMakeup": false }
  ],
  "currentStreak": 3,
  "signedInToday": true,
  "monthlyMakeupQuota": 3,
  "usedMakeupCount": 1,
  "remainingMakeupQuota": 2,
  "rewardButtons": [
    { "id": "1", "ruleType": 1, "streakDays": 1, "pointsAmount": 2, "pointsType": 2, "name": "每日签到", "claimed": false, "claimable": true },
    { "id": "2", "ruleType": 2, "streakDays": 3, "pointsAmount": 10, "pointsType": 2, "name": "连续3天", "claimed": false, "claimable": true }
  ]
}
```

`status` 枚举：
- `signed` — 已签到（含正常签到和补签）
- `signable` — 今日未签，可签到
- `future` — 未来日期，不可操作
- `makeup_available` — 可补签（3天内缺签 + 本月补签配额未用尽）
- `missed` — 已错过，不可补签

#### `POST /sdkapi/checkin/makeup` — 补签（会员配额）

使用会员每月补签配额（Free=1次/月，Pro=3次/月，ProMax=5次/月，后台可配额），配额用尽则返回 402，前端收到 402 后可引导用户观看广告。

请求体：`{ "date": "2026-07-05" }`

```json
{
  "success": true,
  "date": "2026-07-05",
  "streakCount": 5,
  "usedMakeupCount": 2,
  "remainingQuota": 1
}
```

错误：
- `400` — `date` 格式无效 / 只能补签过去 3 天内的日期 / 该日期已签到
- `402` — 本月补签配额已用尽（引导用户观看广告）

---

### 购买计划 `/sdkapi/plan/*`

#### `GET /sdkapi/plan/list` — 查询计划列表

```json
{
  "list": [
    { "id": "1", "plan_type": 0, "name": "Free", "price": 0, "duration_days": null, "weekly_points_grant": 70, "permanent_points_grant": 0, "monthly_makeup_quota": 1, "description": "..." },
    { "id": "2", "plan_type": 1, "name": "Pro", "price": 30, "duration_days": 30, "weekly_points_grant": 700, "permanent_points_grant": 100, "monthly_makeup_quota": 3, "description": "..." },
    { "id": "3", "plan_type": 2, "name": "ProMax", "price": 98, "duration_days": 30, "weekly_points_grant": 2000, "permanent_points_grant": 300, "monthly_makeup_quota": 5, "description": "..." }
  ]
}
```

#### `POST /sdkapi/plan/order` — 生成购买订单

请求体：`{ "planId": "2" }`

**注意：此接口仅生成占位订单，不对接真实支付网关，需管理后台人工确认支付后才会真正开通计划。**

```json
{ "orderId": "1001", "planId": "2", "amount": 30, "status": 0 }
```
`status`: 0=待支付 1=已支付 2=已取消

#### `GET /sdkapi/plan/current` — 查询当前订阅状态

返回当前用户的计划类型、到期时间，供前端判断是否 Pro / ProMax，以及在购买后实时刷新订阅状态。

```json
{
  "planId": "2",
  "planType": 1,
  "name": "Pro",
  "status": "active",
  "startAt": "2026-06-08T10:00:00.000Z",
  "expireAt": "2026-07-08T10:00:00.000Z"
}
```

`status` 枚举：`active` 有效订阅 / `expired` 已过期（自动降为 Free）

#### `GET /sdkapi/plan/order/:orderId` — 查询单笔订单状态

供前端下单后轮询，判断管理后台是否已人工确认支付。

```json
{
  "orderId": "1001",
  "planId": "2",
  "planName": "Pro",
  "amount": 30,
  "status": 0,
  "createdAt": "2026-07-08T10:00:00.000Z",
  "paidAt": null,
  "expireAt": null
}
```

`status`: 0=待支付（前端继续轮询） / 1=已支付（停止轮询，刷新订阅状态） / 2=已取消

#### `GET /sdkapi/orders` — 查询历史订单列表

Query：`page`（默认1）、`limit`（默认20，最大50）

返回当前用户的所有计划购买订单。

```json
{
  "list": [
    {
      "orderId": "1001",
      "planId": "2",
      "planName": "Pro",
      "amount": 30,
      "status": 1,
      "createdAt": "2026-07-08T10:00:00.000Z",
      "paidAt": "2026-07-08T10:05:00.000Z",
      "expireAt": "2026-08-08T10:05:00.000Z"
    }
  ],
  "page": 1,
  "limit": 20
}
```

---

## 附二：管理后台接口（api/admin）

需 `Authorization: Bearer <adminJwtToken>`。标注【超管】的写操作额外要求管理员角色为 `super_admin`。

### 购买计划管理

| 接口 | 说明 |
|---|---|
| `GET /api/admin/plans` | 查询三档计划配置（含 `monthly_makeup_quota` 字段） |
| `PUT /api/admin/plans/[id]` 【超管】 | 编辑计划：`name`/`price`/`duration_days`/`weekly_points_grant`/`permanent_points_grant`/`monthly_makeup_quota`/`description`/`status` |
| `GET /api/admin/plans/orders` | 查询购买订单列表，Query 可选 `status` |
| `PUT /api/admin/plans/orders/[id]/confirm` 【超管】 | 人工确认订单已支付并自动开通计划 |

### 积分规则 / 流水管理

| 接口 | 说明 |
|---|---|
| `GET /api/admin/points/rules` | 查询积分消费规则列表 |
| `POST /api/admin/points/rules` 【超管】 | 新增规则：`consume_type`/`name`/`unit_points`/`unit_basis`/`sort_order` |
| `PUT /api/admin/points/rules/[id]` 【超管】 | 编辑规则：`name`/`unit_points`/`unit_basis`/`sort_order`/`status` |
| `DELETE /api/admin/points/rules/[id]` 【超管】 | 删除规则 |
| `GET /api/admin/points/logs` | 查询积分流水，Query 可选 `keyword`/`page`/`limit` |

### 签到奖励管理

| 接口 | 说明 |
|---|---|
| `GET /api/admin/checkin/rules` | 查询签到奖励档位列表 |
| `POST /api/admin/checkin/rules` 【超管】 | 新增档位：`rule_type`(1每日/2连续)/`streak_days`/`points_amount`/`points_type`(1周积分/2永久积分)/`name`/`sort_order` |
| `PUT /api/admin/checkin/rules/[id]` 【超管】 | 编辑档位，参数同上另加 `status` |
| `DELETE /api/admin/checkin/rules/[id]` 【超管】 | 删除档位 |

### 用户积分手动调整

| 接口 | 说明 |
|---|---|
| `PUT /api/admin/users/[id]/points` 【超管】 | 客服手动调整用户积分：`pointsType`(1周/2永久)、`amount`(正=发放/负=扣减)、`reason` |

对应管理后台前端页面：`/admin/plans`、`/admin/plans/orders`、`/admin/points/rules`、`/admin/points/logs`、`/admin/checkin/rules`。

---

## 附三：数据库迁移（已有环境需手动执行）

积分/购买计划功能上线前，需对已有数据库的 `t_user` 表执行以下 SQL，将旧的 `vip_status`/`vip_expire_at`/`ai_daily_limit` 迁移为新字段（`sql/init.sql` 顶部已附带同样内容作为注释）：

```sql
ALTER TABLE t_user
  DROP INDEX idx_vip,
  ADD COLUMN plan_type TINYINT DEFAULT 0 COMMENT '0=Free 1=Pro 2=ProMax' AFTER status,
  CHANGE COLUMN vip_expire_at plan_expire_at DATETIME NULL COMMENT '当前计划到期时间，NULL=永久(Free)' AFTER plan_type,
  DROP COLUMN vip_status,
  DROP COLUMN ai_daily_limit,
  ADD COLUMN points_weekly INT DEFAULT 0 COMMENT '周积分(到期积分)，每周一按当前计划配额重置' AFTER plan_expire_at,
  ADD COLUMN points_permanent INT DEFAULT 0 COMMENT '永久积分，不过期' AFTER points_weekly,
  ADD COLUMN points_week_start DATE NULL COMMENT '当前周积分对应的周一日期，用于惰性重置判断' AFTER points_permanent,
  ADD INDEX idx_plan (plan_type);

DROP TABLE IF EXISTS t_ai_usage;

-- 补签功能上线时，给已有 t_plan 表追加 monthly_makeup_quota 列：
ALTER TABLE t_plan ADD COLUMN monthly_makeup_quota INT DEFAULT 1 COMMENT '会员权益：每月可补签次数' AFTER permanent_points_grant;
UPDATE t_plan SET monthly_makeup_quota=1 WHERE plan_type=0;
UPDATE t_plan SET monthly_makeup_quota=3 WHERE plan_type=1;
UPDATE t_plan SET monthly_makeup_quota=5 WHERE plan_type=2;

-- 补签功能上线时，给已有 t_checkin_log 表追加 is_makeup 列：
ALTER TABLE t_checkin_log ADD COLUMN is_makeup TINYINT DEFAULT 0 COMMENT '0=当日正常签到 1=补签' AFTER streak_count;
```

> 执行前请先备份 `t_user`、`t_plan`、`t_checkin_log` 表。执行后存量用户 `plan_type` 均为 0（Free）、积分余额为 0，可用"用户积分手动调整"接口按需补发初始积分。
