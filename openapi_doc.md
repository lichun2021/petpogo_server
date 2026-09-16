# PetPogo OpenAPI — 接口文档

**版本**: v1.3
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

## 接口六：设备事件回调

### `POST /openapi/device-event/callback`

PeerApi 在设备发生 **越界 / 离线 / 低电** 事件时，主动调用此接口上报。服务端落库后**自动触发极光推送**通知用户，App 端 `push_service.dart` 已就绪可识别对应 `type` 并跳转。

> 与接口四（AI 消费上报）一致，本接口用 **`phone`（手机号）** 或 **`alias`（`手机号@qq.com`）** 标识用户，二者至少传一个；`alias` 优先。

---

### 请求头

同推送接口，需携带 `x-api-key` / `x-timestamp` / `x-signature`。

---

### 请求体

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `phone` | `string` | 条件必填 | 用户手机号，反查 `t_user`。`alias` 未传时必填 |
| `alias` | `string` | 条件必填 | 用户 alias（格式：`手机号@qq.com`），优先于 `phone`。二选一 |
| `event_type` | `string` | ✅ | 事件类型：`breach`（越界）/ `offline`（离线）/ `low_battery`（低电） |
| `device_mac` | `string` | ✅ | 设备 MAC 地址（App 展示 + 推送 extras 跳转用） |
| `device_name` | `string` | ❌ | 设备名。不传则服务端查 `t_device` 兜底补全，再取不到则用 `device_mac` |
| `pet_name` | `string` | ❌ | 宠物名。不传则服务端查 `t_pet` 兜底补全，再取不到则为空 |
| `description` | `string` | ❌ | 事件描述文案。不传则服务端按 `event_type` 生成默认文案 |
| `extra` | `object` | ❌ | 类型特有字段，写入 `t_device_event.extra` JSON 列。如 `breach` 传 `{"distance": 50}`，`low_battery` 传 `{"battery_percent": 18}` |

---

### 默认文案（`description` 未传时）

| `event_type` | 生成文案 |
|--------------|---------|
| `breach` | `{pet_name}离开了安全围栏范围` |
| `offline` | `设备{device_name}已离线` |
| `low_battery` | `设备{device_name}电量不足（{extra.battery_percent}%）` |

---

### 触发推送

落库成功后，服务端**同步**调用极光推送（推送失败不影响落库和回调响应），推送参数：

| 项 | 值 |
|----|-----|
| 推送目标 | `alias = userId`（App 登录后已 setAlias 绑定） |
| `title` | `围栏警报` / `设备离线` / `电量提醒` |
| `content` | 同 `description` |
| `extras.type` | `breach` → `fence_alert`，`offline` → `device_offline`，`low_battery` → `low_battery` |
| `extras.device_mac` | 请求体的 `device_mac`，App 点击后跳设备详情页 |
| `extras.pet_name` | 宠物名（若有） |

> App 端 `push_service._handleNotificationTap` 已识别上述三种 `type`：带 `device_mac` 时跳 `AppRoutes.deviceDetail(deviceMac)`，无 `device_mac` 时跳 `AppRoutes.message`。

---

### 请求示例

**越界事件**

```json
{
  "phone": "13800138000",
  "event_type": "breach",
  "device_mac": "ipt-esp32-Device-02",
  "extra": { "distance": 50 }
}
```

**离线事件**

```json
{
  "alias": "13800138000@qq.com",
  "event_type": "offline",
  "device_mac": "ipt-esp32-Device-02",
  "device_name": "毛毛的项圈"
}
```

**低电事件**

```json
{
  "phone": "13800138000",
  "event_type": "low_battery",
  "device_mac": "ipt-esp32-Device-02",
  "device_name": "毛毛的项圈",
  "extra": { "battery_percent": 18 }
}
```

---

### 响应

**成功（200）**

```json
{
  "success": true,
  "id": "7234567890123456"
}
```

`id` 为 `t_device_event` 记录的 Snowflake ID（字符串），可用于后续追溯。

### 错误码

| 状态码 | 原因 |
|--------|------|
| `401` | 缺少鉴权 Header |
| `403` | API Key 错误 / 时间戳过期 / 签名错误 |
| `400` | `event_type` 无效 / `device_mac` 为空 / `phone` 与 `alias` 都未传 |
| `404` | `phone`（或 `alias`）对应用户不存在 |
| `500` | 服务器内部错误 |

> [!NOTE]
> - **推送失败不影响回调响应**：极光推送异常时只记服务端日志，接口仍返回 `success: true`，落库数据可被 App 通过 `/sdkapi/device-event/list` 查询到。
> - **冗余快照**：`device_name` / `pet_name` 落库时做快照，防止用户后续改名导致历史事件文案失真。
> - **幂等性**：本接口不做去重，PeerApi 若重复回调同一事件会产生多条记录，需调用方自行控制。
---

## 接口七：宠物硬件动作上报

### `POST /openapi/pet/action/report`

硬件（或其后台）检测到宠物当前物理状态变化时，调用此接口上报最新动作状态码（如躺卧/进食/坐/行走/站立）。服务端记录后，App 端通过 `/sdkapi/pet/{id}/action` 轮询获取该状态码及其映射的动作标识码（详见 `sdkapi_doc.md`）。

> 注意：本接口只上报**状态码**（一个字符串标识），从不携带、也从不解析动画文件。动画本身是内嵌在宠物形象 GLB 模型里的动画片段（clip），所有形象通用同一套命名；状态码到动作标识码（clip 名）的映射由管理后台配置，读取时动态解析，因此后台改映射会立即对下一次轮询生效，无需硬件重新上报。

---

### 请求头

同推送接口，需携带 `x-api-key` / `x-timestamp` / `x-signature`。

---

### 请求体

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `deviceId` | `string` | ✅ | 设备 ID（`t_device.id`） |
| `code` | `string` | ✅ | 动作状态码，必须是后台已配置且未删除的硬件动作码（预置 `lying`躺卧 / `eating`进食 / `sitting`坐 / `walking`行走 / `standing`站立，后台可在 `/admin/virtual-pet/actions` 增删） |

**请求示例**

```json
{
  "deviceId": "999000000000002",
  "code": "lying"
}
```

---

### 响应

**成功（200）**

```json
{ "success": true }
```

### 错误码

| 状态码 | 原因 |
|--------|------|
| `401` | 缺少鉴权 Header |
| `403` | API Key 错误 / 时间戳过期 / 签名错误 |
| `400` | `deviceId`/`code` 为空，或 `code` 不是当前已定义、未删除的硬件动作码 |
| `500` | 服务器内部错误 |

> [!NOTE]
> - **状态缓存**：最新状态码写入 Redis（`pet:action:{deviceId}`，6 小时 TTL），供 App 高频轮询走缓存；Redis 缺失时自动回退查询统一事件日志 `t_pet_event` 中该设备最近一次硬件动作记录。
> - **统一事件日志**：每次成功上报都会在 `t_pet_event` 追加一条记录（`source=hardware_action`），后台可在「宠物事件查询」页面统一查看，与互动触发事件一起展示。
> - **幂等性**：本接口不做去重，重复上报同一状态码只会覆盖最新缓存，不影响正确性。
---
