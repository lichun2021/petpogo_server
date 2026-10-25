# 设备音视频客户端接入说明

更新日期：2026-10-25。根据提供的「设备音视频观看 App 接入文档」接入本服务的 Peer 中转。HTTP 入口已部署，构建版本为 `20261025143935-7d736b7f`；线上进程版本、公网健康检查、四个控制入口的方法校验、设备属性入口的登录校验和上游状态查询均已验证。真实设备画面、音频和对讲尚待客户端联调。

## 调用链路

```text
App → 本服务 /sdkapi/peer/pet/stream/** → PEER_BACKEND_URL/pet/stream/**
App ↔ start 响应的 info.wsAppUrl ↔ 上游音视频中转 ↔ 设备
```

HTTP 使用现有 PeerApiClient 的服务地址、应用签名、登录与刷新机制。WebSocket 直接使用 `info.wsAppUrl` 的完整地址，包括未来可能追加的鉴权参数；无需拼接 `/sdkapi/peer`，也不替换其 host、端口或协议。本服务没有新增 WebSocket 中转。日志隐藏 WS/WSS 地址的查询参数，实际 HTTP 响应中的地址保持完整。

## HTTP 接口

上游支持 GET 或 POST；本服务统一开放以下方法。四个控制接口的参数放在 JSON 或表单请求体中，状态查询放在 query 中。不要直接沿用原文示例的 POST + URL query 传参方式。

| 方法 | 本服务路径 | 参数 | 登录 |
|---|---|---|---|
| POST | `/sdkapi/peer/pet/stream/start` | `mac` 必填；其余见下表 | 需要 |
| POST | `/sdkapi/peer/pet/stream/stop` | `mac` 必填 | 需要 |
| POST | `/sdkapi/peer/pet/stream/video` | `mac`、`enable` 必填 | 需要 |
| POST | `/sdkapi/peer/pet/stream/audio` | `mac`、`enable` 必填 | 需要 |
| GET | `/sdkapi/peer/pet/stream/status` | query `mac` 必填 | 免登录，仍需应用签名 |

`mac` 为设备标识，例如 `ipet-bot-01`。控制接口由 Peer 使用用户 token 判断绑定和操作权限。

### 请求头

所有接口复用现有 SDKAPI 签名头，每次调用重新生成时间戳、签名和唯一 nonce：

```text
x-timestamp: 当前毫秒时间戳
x-signature: md5(timestamp + APP_API_SECRET)，小写十六进制
x-nonce: 每次请求唯一的随机串，至少 8 位
Authorization: Bearer <ipet_token>（四个控制接口必传）
Content-Type: application/json（POST JSON 请求）
```

后台将 `Authorization` 中的用户 token 转成上游的 `token` Header。客户端直接传 `token` Header 不会替代本服务的登录校验。状态查询沿用上游免登录约定，不向上游转发客户端凭证。

### 开始观看参数

| 参数 | 必填 | 上游默认值 | 中转约定 |
|---|---|---|---|
| `mac` | 是 | 无 | 非空设备标识 |
| `video` | 否 | `true` | JSON 布尔值或字符串 `"true"/"false"` |
| `audio` | 否 | `false` | 同上；接收音频或对讲时传 `true` |
| `fps` | 否 | `5` | 正整数或整数字符串，建议 5–15；建议范围不是本地硬限制 |
| `quality` | 否 | `20` | 非负整数或整数字符串；按上游约定数值越小画质越好、数据越大 |
| `serverHost` | 否 | 上游配置 | 非空字符串，一般省略 |
| `serverPort` | 否 | 上游配置 | 1–65535 的整数或整数字符串，一般省略 |

可选参数省略时由上游使用默认值，本服务不会补写。`serverHost/serverPort` 是上游推流参数，不改变 HTTP 请求的固定上游地址。按现有硬件文档，上游默认 host 为 `49.234.39.11`、端口为 `8006`；客户端通常无需指定。

音视频开关 `enable` 也接受 JSON `true/false` 或对应字符串，后台统一编码成表单 `true/false`。数字 `0/1`、`"on"`、数组和对象会返回 400。

### 请求与响应示例

`SDKAPI_BASE_URL` 是本服务地址；其余变量沿用现有客户端鉴权。以下示例中的签名变量须在每次调用前生成。

```bash
curl -s "${SDKAPI_BASE_URL}/sdkapi/peer/pet/stream/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-timestamp: $TIMESTAMP" \
  -H "x-signature: $SIGNATURE" \
  -H "x-nonce: $NONCE" \
  -H "Content-Type: application/json" \
  --data '{"mac":"ipet-bot-01","video":true,"audio":true,"fps":10,"quality":20}'
```

成功响应原样透传，例如：

```json
{
  "code": 0,
  "info": {
    "mac": "ipet-bot-01",
    "wsAppUrl": "ws://49.234.39.11:8006/ws/app/ipet-bot-01",
    "video": true,
    "audio": true,
    "shared": true
  },
  "tip": "响应成功"
}
```

`shared` 仅在加入已有推流时出现。此时请求可以打开所需音视频，但不会关闭其他人在用的媒体；`fps/quality` 沿用已有推流设置。不要假设响应中的 `video/audio` 必然等于本次请求。

其他控制请求示例（路径前均加本服务地址，带相同鉴权约定）：

```http
POST /sdkapi/peer/pet/stream/video
Content-Type: application/json

{"mac":"ipet-bot-01","enable":false}
```

```http
POST /sdkapi/peer/pet/stream/audio
Content-Type: application/json

{"mac":"ipet-bot-01","enable":true}
```

```http
POST /sdkapi/peer/pet/stream/stop
Content-Type: application/json

{"mac":"ipet-bot-01"}
```

这些接口成功返回 `{"code":0,"info":"success","tip":"响应成功"}`。状态查询成功响应例如：

```http
GET /sdkapi/peer/pet/stream/status?mac=ipet-bot-01
```

```json
{"code":0,"info":{"deviceConnected":true,"appViewerCount":2},"tip":"响应成功"}
```

上例中的 `deviceConnected` 和人数来自上游实际状态，中转不写本地数据库或缓存，HTTP 响应设置 `Cache-Control: no-store`。

## 客户端观看与退出顺序

1. 页面打开后调用 `start`；对讲需要 `audio: true`。
2. 检查 HTTP 状态及业务 `code`，成功后连接 `info.wsAppUrl`。设备可能需要几秒才出第一帧，期间显示等待画面。
3. 收到二进制帧后分别解码 JPEG、播放 PCM；对讲音频通过同一个 WebSocket 发送。
4. 退出时停止采集，取消播放订阅，先关闭自己的 WebSocket，再调用 `stop`。

多人观看时 `stop` 不会停止其他人的推流，关闭视频或音频的请求也可能被忽略。本地静音和隐藏画面在客户端处理。所有观看者断开 30 秒后上游自动停止设备推流；按原文约定，30 秒内重连可继续收流，超过该时间需重新调用 `start`。

WebSocket 建议每 15 秒发送协议 ping 保活。单个连接积压超过 512KB 时，上游丢弃该连接最旧的帧；发送卡住超过 5 秒时可能断开，客户端处理断线并重连。

## WebSocket 二进制协议

每条消息一帧，9 字节头部；头部数字使用大端字节序：

| 偏移 | 长度 | 含义 |
|---|---|---|
| 0 | 1 字节 | `type` |
| 1 | 4 字节 | `timestamp`，无符号毫秒数，从设备本次开始推流计算 |
| 5 | 4 字节 | `length`，payload 字节数 |
| 9 | `length` 字节 | payload |

| type | 方向 | payload |
|---|---|---|
| `0x01` | 接收 | 一帧完整 JPEG，按解码尺寸显示 |
| `0x02` | 接收 | 设备麦克风 PCM 音频 |
| `0x03` | 发送 | 对讲 PCM 音频 |

只处理二进制消息；消息不足 9 字节或 `length` 大于实际剩余字节时丢弃。PCM 为 16000Hz、单声道、16 位有符号小端；建议每帧 640 字节（20ms），按实时节奏发送。注意头部大端与音频样本小端的区别，音视频按到达顺序播放。

## 错误处理与联调范围

Peer HTTP 200 仍可能包含业务失败；业务码原样保留：`0` 成功、`1` 通用失败、`1010` 登录失效、`12003` 未绑定、`12021` 设备不存在。`1010` 复用现有 token 刷新流程，重试使用新的签名和 nonce。

中转自身返回 400（参数）、401（未登录或签名缺失）、403（签名错误或账号禁用）、405（方法错误）、502（上游不可达或响应异常）、504（超时）。HTTP 控制默认沿用 20 秒上游超时，不自动重试；超时不代表设备未执行，客户端不要无限重发控制指令。

上游文档说明当前 WebSocket 不校验身份；本服务的 HTTP 登录校验不会扩展到该直连连接。联调时需核对上游 WebSocket 的访问控制，后续鉴权参数追加到 `wsAppUrl` 时客户端应直接兼容。测试地址使用明文 HTTP/WS，客户端测试环境需按平台允许该地址；生产 HTTPS/WSS 由实际部署提供，不在中转中自动改写。

本地回归使用模拟 Peer 服务，覆盖五个 HTTP 入口、布尔值与表单编码、缺参/错误方法/鉴权拦截、免登录状态查询，以及完整 URL、共享状态和业务错误的响应保真。没有连接真实设备或实现客户端 JPEG/PCM 播放；真机出画面、对讲、多观看者、断线回收与 WebSocket 鉴权仍需部署后联调。
