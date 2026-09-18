# AI 接口中转对接

当前项目提供 20 个 POST 接口：`/sdkapi/ai-proxy` + AI 原路径。
例如 `/messages/stream` 改为 `/sdkapi/ai-proxy/messages/stream`。

## 单一服务与职责

所有 AI 请求统一由 `server/utils/aiBackend.ts` 发出，仅使用 `AI_SERVICE_URL`。
接口清单、参数校验、资源权限和响应转发分别位于 `server/integrations/ai/`。
路由入口为 `server/routes/sdkapi/ai-proxy/[...path].ts`，只开放清单内路径。

按用户要求移除了未使用的 `/sdkapi/ai/image-analyze`、`/sdkapi/ai/voice-analyze`、`/sdkapi/ai/history`。
不保留旧接口的返回字段转换或分析结果落库流程；上游计费回调 `/openapi/ai/consumption` 继续保留。
本次不删除历史数据库记录或表。

## 客户端切换

- base URL 使用业务后台，例如 `https://api.jxpetai.com`，原路径加 `/sdkapi/ai-proxy`。
- 全部接口使用现有 SDKAPI 的 `Authorization: Bearer <ipet_token>`、`x-timestamp`、`x-signature=md5(timestamp + APP_API_SECRET)`、`x-nonce`。
- 客户端不再为这些请求发送 AI 应用签名；后台使用 `AI_API_KEY`、`AI_API_SECRET` 重新签名。
- 方法、业务字段和响应模型基本保持原样：JSON envelope、情绪分析裸对象、SSE 分别按原方式解析，不统一包进新的 data 字段。
- account 可省略，由后台填写登录手机号；如传入必须等于当前登录手机号。
- pet_id、session_id、device_no 必须为字符串；ID 不能先转 JS Number。
- 图片、语音分析仍支持当前 multipart 文本字段 `url/account/pet_id`，也支持 JSON 转 multipart。不支持直接上传文件，继续使用 OSS 上传后提交 URL 的流程。
- 请求体限制 128 KiB；参数白名单中未声明的字段会拒绝。

## 资源访问

- `requireAuth()` 校验本地会话与封禁状态。
- pet_id 使用当前用户 token 查询 Peer 宠物列表；共享宠物使用 `/pet/share/members` 返回的 owner/members.account 校验当前 Peer 邮箱账号。共享邀请本身不作为授权依据。
- device_no 是设备 MAC，通过当前用户的 Peer 设备列表确认访问权限。
- session_id 先经 AI `/session/messages` 获取 pet_id，再执行上述宠物权限检查，因此兼容迁移前创建的会话。无法确认归属或已失效时返回 403，不发送问诊/删除/报告请求。
- Peer 权限查询失败时不会放行；共享成员响应缺失 account 等可校验字段时也不放行，需要上游契约联调。
- 中转只做访问校验和转发，不复制 Peer/AI 数据，不建立第二套会话与计费逻辑。

## 实时 SSE

问诊 `/messages/stream` 直接转发上游原始字节流，保留 start/delta/done/error，不等待完整回答，不伪造逐字输出。Node pipeline 处理背压和 UTF-8 分片，客户端取消连接会中止 AI 请求。

响应头包含 `Content-Type: text/event-stream`、`Cache-Control: no-store, no-transform` 和 `X-Accel-Buffering: no`。普通请求和 SSE 都不自动重试。

- 默认流总预算 300 秒，包含请求期间的权限检查。
- 等待上游响应及流空闲预算 60 秒，每次收到数据或心跳字节后刷新空闲计时。
- 流建立前超时返回 HTTP 504；流开始后断线或超时直接终止连接，不在 SSE 尾部插入 JSON，也不伪造 done。
- 客户端继续使用原来的 postStream 和事件解析；中断时不能把未收到 done 的内容认定为完整回答。

部署时还需确认 Nginx/网关没有忽略 X-Accel-Buffering，并给此路径足够的读取时间。例如在现有转发 location 中对该前缀配置：

```nginx
proxy_buffering off;
proxy_cache off;
gzip off;
proxy_read_timeout 320s;
```

以上是部署配置说明，本次未修改线上 Nginx 或发布服务。

## 服务端配置

| 环境变量 | 用途／默认值 |
|---|---|
| AI_SERVICE_URL | 唯一 AI 上游地址，复用项目原配置 |
| AI_API_KEY | AI 应用 key，仅服务端持有 |
| AI_API_SECRET | AI 应用 secret，仅服务端持有 |
| AI_PROXY_TIMEOUT_MS | 普通请求 120000 |
| AI_PROXY_RECORDING_TIMEOUT_MS | 停止录制 300000，客户端需保持 310 秒或更长预算 |
| AI_PROXY_STREAM_TIMEOUT_MS | SSE 总预算 300000 |
| AI_PROXY_STREAM_IDLE_TIMEOUT_MS | SSE 响应/空闲预算 60000 |

本地 `.env` 已补齐客户端现有 AI 凭证，未将凭证写入本文或源码；部署环境也必须提供这两个变量。没有新增第二套 AI 服务 URL。

## 接口清单

下表全部使用 POST，实际路径前加 `/sdkapi/ai-proxy`。

| 原路径 | 用途 | 编码 |
|---|---|---|
| `/session/new` | 创建会话 | application/json |
| `/messages/stream` | 流式消息 | application/json |
| `/messages` | 同步消息 | application/json |
| `/report` | 生成问诊报告 | application/json |
| `/session/delete` | 删除会话 | application/json |
| `/session/by-pet` | 会话列表 | application/json |
| `/session/messages` | 会话历史 | application/json |
| `/video/stream/auto-analysis/settings/save` | 保存视频设置 | application/json |
| `/video/stream/auto-analysis/settings/disable` | 切换视频设置 | application/json |
| `/video/stream/auto-analysis/tasks` | 查询视频任务 | application/json |
| `/voice/stream/auto-analysis/settings/save` | 保存语音设置 | application/json |
| `/voice/stream/auto-analysis/settings/disable` | 切换语音设置 | application/json |
| `/video/recording/start` | 开始录制 | application/json |
| `/video/recording/stop` | 停止录制 | application/json |
| `/health-data/overview` | 单日概览 | application/json |
| `/health-data/health-report` | 健康报告 | application/json |
| `/health-data/behavior-analysis` | 行为分析 | application/json |
| `/health-data/exercise-data` | 运动统计 | application/json |
| `/voice/analyze` | 声音分析 | multipart/form-data |
| `/image/analyze` | 图片分析 | multipart/form-data |


## 响应与待上游修复项

- 普通接口保持上游 HTTP 状态、JSON 正文和长 ID，不解包或重新序列化。上游签名 HTTP 401/403 转为中转 502，避免被客户端误当成自身登录过期。
- 传输失败、重定向、无效 JSON 返回 502；超时返回 504；本地未登录 401、资源无权限 403、参数错误 400、未知路由 404、错误方法 405、编码不支持 415。
- `/video/stream/auto-analysis/tasks` 照常中转，上游目前的 404 原样返回，不伪装成空任务列表。由上游修复。
- 图片/语音的可选 pet_id 会保留传递，是否产生分析记录关联仍由上游实现决定。
- 问诊、媒体地址、凭证和流正文不写入中转日志。

## 验证

```sh
node --test tests/ai-proxy.test.mjs
npm run build
```

测试使用本地 HTTP 模拟 AI/Peer 和模拟用户数据，覆盖权限、签名、multipart、完整 JSON、实时首帧、中文跨包、取消、空闲超时、录制长预算和上游 404。未进行真实推理、录制、扣费或设备控制；上线仍需真实资源和权限联调。
