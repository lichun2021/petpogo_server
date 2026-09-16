# PetPogo sdkapi — App 端接口文档（电子宠物模块新增接口）

**版本**: v1.0
**Base URL**: `http://115.29.196.61:3000`

本文档只收录**本次电子宠物功能新增**的 `/sdkapi/**` 接口。其余已有的 App 接口（登录、帖子、积分等）不在此文档范围内。

---

## 鉴权机制

所有 `/sdkapi/` 接口均需在 HTTP Header 中携带以下字段：

| Header | 类型 | 说明 |
|--------|------|------|
| `x-timestamp` | `string` | 当前毫秒时间戳（UTC），**5 分钟内有效** |
| `x-signature` | `string` | 请求签名（见下方计算方式） |
| `x-nonce` | `string` | 随机串，≥8 位，用于防重放（同一 nonce 5 分钟内只能用一次） |
| `Authorization` | `string` | `Bearer <ipet_token>`，登录后获得的用户会话 Token（本文档所有接口均需登录） |

### 签名算法

```
signature = md5(timestamp + appApiSecret)
```

> [!IMPORTANT]
> `timestamp` 与服务器时差不得超过 **5 分钟**，否则返回 403。
> `appApiSecret` 由运维配置（对应环境变量 `APP_API_SECRET`），请勿在文档外泄露实际值。

### 签名示例（Node.js）

```js
const crypto = require('crypto')
const APP_API_SECRET = '<运维提供的密钥>'

function buildHeaders(token) {
  const ts    = Date.now().toString()
  const sig   = crypto.createHash('md5').update(`${ts}${APP_API_SECRET}`).digest('hex')
  const nonce = `${ts}${Math.random().toString(36).slice(2)}`
  return {
    'x-timestamp': ts,
    'x-signature': sig,
    'x-nonce': nonce,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}
```

---

## 概念说明

- **硬件动作（hardware action）**：硬件/算法侦测出的宠物当前物理状态，是一个状态码（如 `lying`躺卧、`eating`进食），本身**不含动画**。
- **GLB 动作标识（clip code）**：动作动画是内嵌在各宠物形象 GLB 模型文件里的动画片段（clip），所有形象通用同一套命名，因此后台只登记“动作标识码”，不是独立文件。硬件动作码和互动类型都通过“映射”引用某一个动作标识码来决定该播放哪个动画；映射由后台配置，App 侧拿到接口返回的 `clipCode` 后，在**当前已加载的宠物模型**里按同名查找并播放对应动画片段。
- **互动类型（interaction type）**：App 端触发的交互动作（喂食/逗猫/清洁等），后台可自定义增删，每种互动配置了对饱腹度/心情值/清洁度三项属性的增减效果，以及关联的 GLB 动画。

---

## 一、宠物档案（`/sdkapi/pet/**`）

### `POST /sdkapi/pet/create` — 创建宠物档案

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | ✅ | 宠物ID，由调用方指定（可与对方iPet硬件后台的宠物ID保持一致），须全局唯一，重复将返回 `400` |
| `name` | `string` | ✅ | 宠物名称 |
| `avatar` | `string` | ❌ | 头像 URL |
| `species` | `string` | ❌ | 物种，如 `cat`/`dog` |
| `breed` | `string` | ❌ | 品种 |
| `gender` | `number` | ❌ | 0未知 1男 2女，默认 0 |
| `birthday` | `string` | ❌ | 出生日期 `YYYY-MM-DD` |
| `weight` | `number` | ❌ | 体重(kg) |
| `bio` | `string` | ❌ | 简介 |
| `deviceId` | `string` | ❌ | 关联设备 ID |

**响应（200）**

```json
{ "id": "55135763958784", "name": "小白", "modelId": "1", "modelGlbUrl": "https://oss.example.com/cat.glb" }
```

> 形象由系统自动分配，不接受客户端指定：取当前启用且未删除、创建最早的一个形象。`modelId`/`modelGlbUrl` 为本次实际分配到的形象；若资源库当前没有任何启用中的形象，两者均为 `null`。

**错误码**：`400` 缺少 `id`/`name`，或 `id` 已存在。

> 新建宠物的饱腹度/心情值/清洁度默认初始化为 100。

---

### `GET /sdkapi/pet/list` — 我的宠物列表

无需参数，返回当前登录用户的全部未删除宠物。

**响应（200）**

```json
[
  { "id": "55135763958784", "name": "小白", "avatar": null, "species": "cat", "breed": "英短", "gender": 0, "birthday": null, "weight": null, "bio": null, "device_id": null }
]
```

---

### `GET /sdkapi/pet/{id}` — 宠物档案详情（新增）

仅能查看本人的宠物，否则 404。

**响应（200）**

```json
{
  "id": "55135763958784", "name": "小白", "avatar": null, "species": "cat", "breed": "英短",
  "gender": 0, "birthday": null, "weight": null, "bio": null, "device_id": null,
  "satiety": 70, "mood": 55, "cleanliness": 50, "background_id": null, "model_id": null
}
```

**错误码**：`404` 宠物不存在或不属于当前用户。

---

### `PUT /sdkapi/pet/{id}` — 更新宠物档案（新增）

`id` 走 URL 路径，不放在请求体里；宠物 ID 创建后不可修改。仅能更新本人的宠物。

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | ✅ | 宠物名称 |
| `avatar` | `string` | ❌ | 头像 URL |
| `species` | `string` | ❌ | 物种，如 `cat`/`dog` |
| `breed` | `string` | ❌ | 品种 |
| `gender` | `number` | ❌ | 0未知 1男 2女，默认 0 |
| `birthday` | `string` | ❌ | 出生日期 `YYYY-MM-DD` |
| `weight` | `number` | ❌ | 体重(kg) |
| `bio` | `string` | ❌ | 简介 |
| `deviceId` | `string` | ❌ | 关联设备 ID |
| `backgroundId` | `string` | ❌ | 背景资源 ID，取自 `GET /sdkapi/pet/resources` 的 `backgrounds[].id`；传空/不传表示不修改，需引用已启用且未删除的资源，否则 `400` |
| `modelId` | `string` | ❌ | 形象资源 ID，取自 `GET /sdkapi/pet/resources` 的 `models[].id`；传空/不传表示不修改，需引用已启用且未删除的资源，否则 `400` |

**响应（200）**

```json
{ "success": true }
```

**错误码**：`400` 名称为空，或 `backgroundId`/`modelId` 指向的资源不存在/已停用；`404` 宠物不存在或不属于当前用户。

---

### `DELETE /sdkapi/pet/{id}` — 删除宠物档案（软删除，新增）

仅能删除本人的宠物，删除后不再出现在列表/详情中。

**响应（200）**

```json
{ "success": true }
```

**错误码**：`404` 宠物不存在或不属于当前用户。

---

## 二、养成属性（饱腹度 / 心情值 / 清洁度，新增）

属性会随时间**惰性衰减**（读取或互动时才计算，不跑定时任务），衰减速率：饱腹度 2/小时、心情值 1.5/小时、清洁度 1/小时，下限 0。

### `GET /sdkapi/pet/{id}/status` — 查询宠物当前状态（基本信息 + 养成属性 + 背景/形象）

一次调用返回宠物基本信息、惰性衰减后的养成属性，以及当前配置的背景图与形象（GLB模型）资源，供 App 渲染宠物主页，无需再拼 `detail` + `resources`。

**响应（200，已配置背景和形象）**

```json
{
  "id": "55135763958784",
  "name": "小白",
  "avatar": null,
  "species": "cat",
  "breed": "英短",
  "gender": 0,
  "birthday": null,
  "weight": null,
  "bio": null,
  "satiety": 66,
  "mood": 52,
  "cleanliness": 48,
  "background": { "id": "1", "name": "草地", "image_url": "https://oss.example.com/grass.jpg" },
  "model": { "id": "1", "name": "橘猫形象", "glb_url": "https://oss.example.com/cat.glb", "thumbnail_url": "https://oss.example.com/cat_thumb.jpg" }
}
```

**响应（200，尚未配置背景/形象）**

```json
{ "id": "55135763958784", "name": "小白", "...": "...", "background": null, "model": null }
```

> `background`/`model` 为 `null` 表示宠物还没设置对应资源，或设置的资源已被停用/删除；可调用 `GET /sdkapi/pet/resources` 拿可选项供用户选择，再通过 `PUT /sdkapi/pet/{id}` 传 `backgroundId`/`modelId` 更新。

**错误码**：`404` 宠物不存在或不属于当前用户。

---

### `POST /sdkapi/pet/{id}/interact` — 执行互动

先按经过时间衰减，再叠加该互动类型配置的属性增减效果，落库并返回新属性值 + 对应动作标识码。

**请求体**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `interactionCode` | `string` | ✅ | 互动类型标识码，对应后台配置的 `t_pet_interaction_type.code`（预置 `feed`喂食 / `play`逗猫 / `clean`清洁，后台可增删） |

**请求示例**

```json
{ "interactionCode": "feed" }
```

**响应（200）**

```json
{ "satiety": 70, "mood": 55, "cleanliness": 50, "clipCode": "feed" }
```

> `clipCode` 为该互动类型当前映射的动作标识码，App 端按此名去**当前加载的宠物形象模型**里查找同名动画片段播放；若后台未配置映射则为 `null`。

**错误码**：

| 状态码 | 原因 |
|--------|------|
| `400` | `interactionCode` 为空，或该互动类型不存在/已停用 |
| `404` | 宠物不存在或不属于当前用户 |

---

## 三、宠物资源清单（新增）

### `GET /sdkapi/pet/resources` — 一次性获取可用资源

供 App 渲染背景/形象选择项、互动按钮及其动画。只返回当前**已启用且未删除**的资源。

**响应（200）**

```json
{
  "backgrounds": [
    { "id": "1", "name": "草地", "image_url": "https://oss.example.com/grass.jpg" }
  ],
  "models": [
    { "id": "1", "name": "橘猫形象", "glb_url": "https://oss.example.com/cat.glb", "thumbnail_url": "https://oss.example.com/cat_thumb.jpg" }
  ],
  "glbActions": [
    { "id": "1", "code": "lying", "name": "躺卧动画" }
  ],
  "interactionTypes": [
    { "id": "1", "code": "feed", "name": "喂食", "icon_url": "", "satiety_delta": 20, "mood_delta": 5, "cleanliness_delta": 0, "clipCode": "feed" }
  ]
}
```

> `glbActions` 只是动作标识码列表（对应模型内置动画片段名），不含文件；`interactionTypes[].clipCode` 是该互动当前映射的动作标识码，App 端按此名去当前加载的形象模型里查找同名动画片段播放。

---

## 四、硬件动作轮询（新增）

### `GET /sdkapi/pet/{id}/action` — 获取宠物当前硬件动作 + 动作标识码

轮询该宠物关联设备最近上报的动作状态码，以及该状态码当前映射的动作标识码（映射在服务端读取时动态解析，后台改映射立即生效，无需硬件重新上报）。App 端拿到 `clipCode` 后，在**当前已加载的宠物形象模型**里按同名查找并播放对应动画片段。硬件如何上报状态码见 `openapi_doc.md` 「接口七：宠物硬件动作上报」。

**响应（200，有上报记录）**

```json
{ "code": "lying", "reportedAt": "2026-09-16T04:35:15.911Z", "clipCode": "lying" }
```

**响应（200，状态码未映射动画）**

```json
{ "code": "lying", "reportedAt": "2026-09-16T04:35:15.911Z", "clipCode": null }
```

**响应（200，设备从未上报过 / 宠物未关联设备）**

```json
{ "code": null, "reportedAt": null, "clipCode": null }
```

**错误码**：`404` 宠物不存在或不属于当前用户。

> [!NOTE]
> - 优先读取 Redis 缓存（TTL 6 小时），缓存缺失时自动回退查询统一事件日志 `t_pet_event` 中该设备最近一次硬件动作记录。
> - 建议轮询间隔与动画播放需求匹配（如 2-5 秒），无需过于频繁。
