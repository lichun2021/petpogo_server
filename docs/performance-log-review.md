# 中转性能与请求日志检查

日期：2026-09-18。范围：Peer/AI 中转、本地模拟上游、请求日志；安全审计按用户要求暂停，本文不是安全审计通过报告。改动尚未提交或部署。

## 本地性能结果

- 4 个并发客户端、40 次健康概览请求：40 次成功，总耗时约 36ms，P50 约 4ms，P95 约 5ms。
- 这是本机模拟 AI/Peer/数据库/Redis 的功能性能样本，包含日志生成但不包含生产磁盘日志成本，不代表线上延迟、吞吐或容量上限。
- SSE 实测在上游完整答案生成前收到首段；中文跨包、客户端取消和空闲超时通过。
- 完整回归 26 项通过，`npm run build` 通过。
- 未进行生产压测、真实模型推理、真实 Redis/MySQL 并发、CPU/内存容量或公网弱网测试。

## 性能检查与处理

| 项目 | 检查结果／处理 |
|---|---|
| 流式转发 | Node pipeline 处理背压，不聚合完整回答；客户端关闭后取消上游 |
| 权限查询取消 | AbortSignal 传递至 Peer 权限请求，避免用户退出后继续无效等待 |
| 请求读取 | 在收包过程中限制 128 KiB，读取超时 10 秒；不先读完再判断 |
| 普通上游响应 | 按块限制解压后 4 MiB；SSE 按流转发，不套用整个响应大小限制 |
| 并发 | 当前 PM2 单实例：AI 总并发 32，同用户 8，同用户 SSE 2，超限不排队而返回 429 |
| 限流桶 | 普通与严格接口分别计数，避免普通轮询占掉 AI 严格档额度 |
| 序列化 | 日志不读请求正文、不序列化完整响应；Peer 业务码复用已有解析结果 |
| 会话历史查询 | 每次问诊仍需取历史中的 pet_id 后校验权限；历史增长会放大网络/解析开销，4 MiB 以上会拒绝 |

建议下一步先观察 permissionMs 与 upstreamHeaderMs。若长会话权限阶段明显变慢，应让 AI 提供只返回 session_id/pet_id 的轻量接口，再替换当前历史查询；不宜为省请求直接跳过权限或长期缓存授权。

## 请求日志

原问题：请求日志有多行框线和正文；响应日志依赖 beforeResponse，无法准确覆盖已经直接写入响应的中转、SSE 中断；error 钩子把第二个 context 参数当作 event，异常信息可能漏记。

现在统一为两条单行 JSON：

- `request.start`：时间、requestId、method、path。
- `request.end`：同一 requestId、HTTP status、durationMs、outcome，按场景附加分段指标。
- 响应头返回 `X-Request-Id`，便于客户端与服务端关联。
- 以 finish/close 为依据完成记录；两种事件都触发时去重。
- 不记录 query、请求/响应正文、问诊内容、素材 URL 或 token，不逐块打印 SSE。

指标含义：

| 字段 | 含义 |
|---|---|
| permissionMs | AI 资源权限阶段耗时，不含最开始的本地登录检查 |
| upstreamMs | Peer 主请求从发送到普通正文读取完成的耗时 |
| upstreamHeaderMs | AI 主请求至上游响应头到达的耗时，不含后续生成/传输时间 |
| firstByteMs | SSE 从本地收到请求到收到上游第一段正文的耗时，不等于第一个回答文字的时间 |
| streamBytes | 已通过中转 Transform 的字节数，不表示客户端已全部收到 |
| upstreamStatus / businessCode | 上游 HTTP 状态及数字业务码；不记录业务 tip 文本 |
| sseDone | 是否观察到 `event: done` |
| errorType / errorCode | 错误类型和格式受限的机器错误码；不记录原始异常正文 |

outcome 区分 `complete`、`http_error`、`business_error`、`rejected`、`client_closed`、`timeout`、`upstream_error`、`upstream_event_error`、`incomplete_stream`。
其中 SSE 结束事件仅观察 event 行，不解析或记录 data，也不会改变转发字节。

边界：进程强杀/机器宕机无法保证结束日志落盘；现有业务模块自己的 console 日志未做全项目收敛。没有检查线上 PM2 日志轮转、磁盘容量、Nginx 缓冲或实际运行负载，因此不能宣称生产日志链路已全部验收。

## 验证命令

```sh
node --test tests/ai-proxy.test.mjs tests/peer-proxy.test.mjs tests/security-audit.test.mjs
npm run build
```

第三个测试文件包含暂停前已加入的回归用例和日志/限流/并发用例；继续运行仅用于确保当前工作区不回归，不表示恢复或完成安全审计。
