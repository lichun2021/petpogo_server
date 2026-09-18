# SDKAPI Peer 中转接口

本项目已提供 37 个客户端 Peer 接口的中转入口，部署后使用。迁移只改变 HTTP 请求入口，Peer 仍保存和管理其设备、宠物、围栏和分享数据。

## 链路与代码职责

`App → /sdkapi/peer/** → PEER_BACKEND_URL + 原始路径`

- `server/routes/sdkapi/peer/[...path].ts`：薄路由入口。
- `server/integrations/peer/endpoints.ts`：37 个固定路径、方法、上游编码和参数白名单；新增接口在此集中维护。
- `server/integrations/peer/handler.ts`：本地登录检查、参数校验、响应转交，不直接调用上游或读写本地宠物数据。
- `server/utils/peerBackend.ts`：唯一 Peer HTTP 出口 `peerRequest()`，同时供原有注册、登录、刷新、资料同步使用；原有方法仍保持业务解包及注册幂等处理。

所有实际请求都使用 `PEER_BACKEND_URL`。`PEER_BACKEND_PUBLIC_URL` 与登录响应的 `peer.gatewayUrl` 保持原用途，未将其自动改成中转地址。客户端需要主动切换 PeerApiClient 和独立的国家地区请求入口。

## 配置

- `PEER_BACKEND_URL`：固定可信上游地址；可带固定路径前缀，不能含 query、fragment 或用户名密码。客户端不能指定或覆盖它。
- `PEER_BACKEND_TIMEOUT_MS`：单次上游请求总超时（含读取响应），默认 20000 毫秒。客户端等待时间应大于该值。
- 不自动重试，不自动刷新 token，不跟随上游重定向。超时不代表设备指令未执行，客户端不能对写操作无条件重试。

## 客户端鉴权

所有 37 个接口均沿用 `/sdkapi/**` 签名中间件：

```text
x-timestamp: 当前毫秒时间戳
x-signature: md5(timestamp + APP_API_SECRET)，小写十六进制
x-nonce: 每次请求唯一的随机串，至少 8 位（默认强制）
Authorization: Bearer <ipet_token>
```

国家列表、默认国家两条接口免登录，因此不需要 Authorization，但仍需应用签名和 nonce。其余 35 条先经 `requireAuth()` 校验 Redis session、本地账号和封禁状态，再把同一个 ipet_token 作为 `token` Header 发送到 Peer。不会采用客户端自行提供的 `token` Header，也不透传 Cookie 等任意请求头。

本项目不会用本地 `t_pet/t_device` 的 ID 或所有者关系替代 Peer 资源关系。设备归属、分享和操作权限继续由 Peer 根据用户 token 校验，与原客户端直连链路一致。上线前仍需真实账号验证共享用户与无权限用户行为；本地会话有效不等于有权操作任意设备。

## 参数与响应

- 方法与原 Peer 接口一致。GET 使用 query；POST 支持 JSON 或 `application/x-www-form-urlencoded`，中转按清单转换成上游要求的编码。
- 参数白名单以 `endpoints.ts` 为准。未知参数、嵌套对象、数组会被拒绝；可选 null 被忽略。国家列表可发送空 body 或 `{}`。
- ID 推荐全部传字符串，特别是超出 `Number.MAX_SAFE_INTEGER` 的 ID；JSON 中不安全的数值会返回 400，不能先经过 JS Number 再转字符串。
- 宠物详情、位置、围栏列表／添加要求至少一个 `mac/deviceId`；删除宠物至少一个 `petId/deviceId`；发起宠物分享至少一个 `petId/deviceId/mac`；拒绝分享至少一个 `shareId/order`。
- 默认值：位置 `lang=zh`；两种发起分享 `type=3`；分享分页 `pageNo=1,pageSize=20`；播放音量 `volume=15`，范围 0–21。
- shadow 的 `data` 必须是 JSON 对象编码后的字符串；中转不展开或重写其中的设备命令。
- 上游统一使用 `Accept: */*`，兼容已发现的 406 问题。
- 中转保留上游 HTTP 状态和完整 JSON 文本，包括 `code/tip/info/list/pageTurn`、裸国家对象和长数字 ID，不重新序列化。
- HTTP 200 并不代表业务成功：客户端仍需处理 Peer 的 `code/tip`，例如 token 过期时的 `code=1010`。沿用 `/sdkapi/auth/refresh` 刷新后重试的既有登录流程。
- 中转自身校验错误使用现有 H3 错误格式：400 参数错误、401 未登录、403 本地账号被禁用、404 未开放路径、405 错误方法、415 不支持的请求类型、502 上游不可达／重定向／非 JSON 响应、504 超时。上游已返回的合法 JSON 错误则按其状态和内容返回。
- 响应禁止缓存；不透传上游 Set-Cookie 等头部。日志只记录中转路径和状态，不记录请求／响应正文中的分享或设备凭证。

示例（其余签名头按上文生成）：

```http
POST /sdkapi/peer/user/device/detail
Content-Type: application/json
Authorization: Bearer <ipet_token>

{"mac":"设备 MAC"}
```

## 接口清单

所有地址在下表原路径前添加 `/sdkapi/peer`。例如 `/pet/info/list` 对应 `/sdkapi/peer/pet/info/list`。

| 方法 | 原路径 | 用途 | 上游编码 |
|---|---|---|---|
| POST | `/user/device/list` | 设备列表 | 表单 |
| POST | `/user/device/detail` | 设备详情 | 表单 |
| GET | `/user/device/online/state` | 在线状态 | Query |
| POST | `/user/device/update` | 设备改名 | 表单 |
| POST | `/user/device/unbind` | 解绑设备 | 表单 |
| POST | `/user/device/qr/token` | 配网凭证 | 表单 |
| POST | `/device/product/list` | 设备产品列表 | 表单 |
| POST | `/user/device/member/query` | 设备成员 | 表单 |
| POST | `/user/device/member/remove` | 移除设备成员 | 表单 |
| POST | `/device/share/push/add` | 创建设备分享 | 表单 |
| POST | `/user/device/accept` | 接受设备分享 | 表单 |
| POST | `/user/device/bind` | 绑定设备 | 表单 |
| POST | `/user/device/mcuota/get` | OTA 信息 | 表单 |
| POST | `/device/shadow/update` | 影子及电机控制 | 表单 |
| POST | `/pet/agora/getToken` | 获取音视频通话凭证 | 表单 |
| POST | `/pet/info/list` | 我的宠物 | 表单 |
| POST | `/pet/info/get` | 宠物详情 | 表单 |
| POST | `/pet/info/add` | 添加宠物 | 表单 |
| POST | `/pet/info/update` | 修改宠物 | 表单 |
| POST | `/pet/info/del` | 删除宠物 | 表单 |
| POST | `/pet/position` | 宠物位置 | 表单 |
| POST | `/pet/fence/list` | 围栏列表 | 表单 |
| POST | `/pet/fence/add` | 添加围栏 | 表单 |
| POST | `/pet/fence/update` | 更新围栏 | 表单 |
| POST | `/pet/fence/del` | 删除围栏 | 表单 |
| POST | `/pet/share/add` | 发起宠物分享 | 表单 |
| POST | `/pet/share/accept` | 接受宠物分享 | 表单 |
| POST | `/pet/share/refuse` | 拒绝宠物分享 | 表单 |
| GET | `/pet/share/mylist` | 我发出的分享 | Query |
| GET | `/pet/share/withme` | 分享给我 | Query |
| POST | `/pet/share/del` | 取消宠物分享 | 表单 |
| POST | `/pet/share/members` | 宠物成员列表 | 表单 |
| POST | `/pet/share/member/remove` | 移除宠物成员 | 表单 |
| POST | `/pet/sound/play` | 设备播放音频 | JSON |
| POST | `/pet/sound/stop` | 设备停止播放 | JSON |
| POST | `/world/country/list` | 国家列表 | 空 body |
| GET | `/world/country/default` | 默认国家 | Query |


## 耦合边界与验证情况

- 不新增数据库表、不修改本地宠物/设备接口，不把 Peer 宠物 ID 自动映射成本地 ID。
- 客户端现有 Peer 增改删成功后同步本地宠物的流程继续保留，中转不再额外同步，避免重复写入。
- 音视频媒体仍走 Agora，AWS IoT 链路保持原实现；这里只中转清单内 HTTP 请求。
- `/pet/share/member/remove` 已提供中转路由，但上游路径尚未真实确认。设备分享 email 要求、分享成功码等差异保持上游原始结果，需继续联调。
- 未修改旧刷新接口对 `account` 直接按手机号查询的行为；若 Peer 返回 `手机号@qq.com`，可能导致刷新无法找到用户。上线联调需确认返回格式。
- 验证：`npm run build`；`node --test tests/peer-proxy.test.mjs`。集成测试使用本地 HTTP 模拟上游和模拟 session/数据库，覆盖真实请求编码、签名与登录拦截、响应保真、超时及不重试，也检查原有账号封装。
- 本地验证不等同于 37 条接口已通过真实 Peer 联调；尚未部署或操作真实设备。
