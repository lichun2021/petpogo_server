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
