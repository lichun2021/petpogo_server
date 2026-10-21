# 宠物圈定时发布配置

本项目实现并持久化全局计划，与其他 `/openapi/**` 接口使用同一套鉴权。管理后台编辑同一份数据，不向模型服务器转发保存请求。模型服务器读取本接口后负责实际调度、生成和发布；本次改造不在后台进程内增加发布任务。

## 路径与权限

| 方法 | 路径 | 用途 | 鉴权 |
| --- | --- | --- | --- |
| GET | `/openapi/moment/schedule` | 查询当前生效配置 | 现有 OpenAPI 签名 |
| POST | `/openapi/moment/schedule` | 完整替换配置 | 现有 OpenAPI 签名 |
| GET | `/api/admin/moment/schedule` | 管理页面查询 | 管理员 JWT，超级管理员 |
| POST | `/api/admin/moment/schedule` | 管理页面保存 | 管理员 JWT，超级管理员 |

后台入口：**宠物与内容 → 宠物圈发布计划**（`/admin/pet-circle/schedule`）。可切换总开关、增加或移除两类每日时间点，保存前校验重复和非法时间；保存失败保留草稿。

OpenAPI 使用服务端现有的 `OPENAPI_KEY`、`OPENAPI_SECRET`，不新增另一套密钥。调用方若沿用 `IPET_AI_API_KEY`、`IPET_AI_API_SECRET` 环境变量名称，其值应与后台这两个现有配置一致。

| Header | 内容 |
| --- | --- |
| `X-API-Key` | 现有 OpenAPI Key |
| `X-Timestamp` | 当前毫秒时间戳，误差不超过 5 分钟 |
| `X-Signature` | `md5(API_KEY + X-Timestamp + API_SECRET)`，十六进制小写 |
| `Content-Type` | POST 必须为 `application/json` |

示例使用默认兼容的 v1 签名；若已开启 `OPENAPI_SIGNATURE_V2_REQUIRED`，继续使用项目已有的 v2 签名协议。密钥仅保留在服务端，浏览器管理页面使用管理员 JWT。

## 查询

```http
GET /openapi/moment/schedule
```

```json
{
  "code": 0,
  "info": {
    "enabled": true,
    "image_times": ["12:00"],
    "text_times": ["09:00", "15:00", "21:00"],
    "timezone": "Asia/Shanghai"
  },
  "tip": "响应成功"
}
```

首次保存前，读取 `MOMENT_SCHEDULER_ENABLED`、`MOMENT_IMAGE_TIMES`、`MOMENT_TEXT_TIMES`。默认启用，图片圈 `12:00`，文字圈 `09:00,15:00,21:00`。时间环境变量使用逗号分隔或 JSON 数组；空字符串表示空列表。总开关可使用 `true` / `false`。

首次保存后，以数据库配置为准，修改这些环境变量不会覆盖已保存的计划。接口每次查询数据库，返回 `Cache-Control: no-store`。数据库不可用时返回 503，不回退为可能过时的环境默认值。

## 保存

```http
POST /openapi/moment/schedule
Content-Type: application/json
```

```json
{
  "enabled": true,
  "image_times": ["18:00", "10:00"],
  "text_times": ["09:00", "21:00"]
}
```

成功返回：

```json
{
  "code": 0,
  "info": {
    "enabled": true,
    "image_times": ["10:00", "18:00"],
    "text_times": ["09:00", "21:00"],
    "timezone": "Asia/Shanghai"
  },
  "tip": "响应成功"
}
```

- 三个字段必须全部提供，只接受 `enabled`、`image_times`、`text_times`；不能回传 `timezone`。
- `enabled` 必须为 JSON 布尔值，字符串或数字无效。
- 两类时间列表必须为字符串数组，严格采用 `HH:MM`，范围 `00:00` 至 `23:59`。
- 同类型不能重复，不同类型允许在同一时间；保存和返回均按升序。
- 空列表关闭对应类型；`enabled: false` 暂停总计划，仍须提供两个时间列表以保留配置。
- 单行原子替换，写入成功后才返回成功；并发保存以最后一次成功写入为准。

## 数据库与部署

配置存储在本项目 `MYSQL_DB` 指定业务库的 **`t_moment_schedule_settings`**，固定 `id=1`。此项目默认业务库为 `petpogo`，不连接或修改模型服务器的 `llm` 库。

启动会检查并按需创建表；初始化失败不会虚报配置可用，接口会返回 503，后续请求会重试。初始化不会插入默认配置行，避免覆盖首次保存前的环境默认值。

若运行账号没有建表权限，请用数据库管理账号在业务库执行 [`sql/patch-moment-schedule-settings.sql`](../sql/patch-moment-schedule-settings.sql)。表已存在时，应用只需查询和写入权限；无需新增数据迁移编号，也不需要暂停现有发布任务来建此独立配置表。

数据库成功保存后无需重启服务。模型服务器必须改为读取本项目的查询接口，才能采用后台保存的计划；只部署后台不会自动改变模型服务器已有的独立配置。

## 调度执行约定

以下由消费配置的模型调度器落实，配置接口自身不执行发布：

- 每 30 秒读取最新计划，每只宠物处理前再次检查变更；已开始的生成或发送可继续完成。
- 适用于当天有行为记录的宠物。时间统一为北京时间，时间点后 5 分钟内可触发或补发；超出窗口不追补历史时间点。
- 按“宠物、北京时间日期、类型、升序列表下标”去重，下标从 0 开始。当天成功发送或因宠物不存在而跳过的序号，不因改时间而重试。
- 增加新的序号可在当天对应窗口发送，完整新计划从次日起执行。
- 总开关只影响定时任务，不阻止手动生成与手动触发。手动触发的 `slot_index` 对应当前升序列表。

## 错误

| HTTP 状态 | 原因 |
| --- | --- |
| 401 / 403 | 缺少签名、签名校验失败，或管理员权限不足 |
| 400 | 请求体不是有效 JSON |
| 408 / 413 | 请求体读取超时 / 超过 128 KiB |
| 415 | POST 未使用 `application/json` |
| 422 | 缺少或多余字段、类型错误、时间非法或重复；原配置不变 |
| 503 | 数据库或默认配置不可用，读写失败 |

业务处理错误返回 `{ "code": HTTP状态码, "info": null, "tip": "具体说明" }`；鉴权失败沿用现有 OpenAPI / 管理员鉴权错误响应。

保存数据库不可用示例：

```json
{
  "code": 503,
  "info": null,
  "tip": "数据库未就绪，无法保存宠物圈定时发布配置"
}
```
