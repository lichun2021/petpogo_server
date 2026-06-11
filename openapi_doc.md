# PetPogo OpenAPI — 推送接口文档

**版本**: v1.1
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
