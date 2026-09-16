## Why

宠物档案目前只有“创建 + 列表”两个接口，App 端无法编辑或删除宠物，后台完全没有宠物管理页面，运营看不到、改不了任何宠物数据。同时产品要上线一套“电子宠物”养成玩法：宠物需要饱腹度/心情值/清洁度等状态，需要可配置的背景、3D 形象（GLB）、互动动作（喂食/逗猫/清洁等）。这些资源目前完全没有存储、管理和分发的通道，需要一次性补齐宠物档案的增删改查，并搭建电子宠物的资源配置与状态系统。

需要特别区分几个容易混淆的概念：**硬件动作**是硬件/算法侦测出的宠物当前物理状态，本质是一个状态码，预置躺卧/进食/坐/行走/站立 5 条作为初始数据，但后台可增删改查——硬件后续支持新的动作类型时，运营需要能自行新增对应状态码，不是写死不可扩展的集合。**GLB 动作**是可播放的动画资源文件，是后台可独立增删改查的一个资源库。**互动类型**（喂食/逗猫/清洁等）同样是后台可自定义增删改查的一类资源，预置 3 条初始数据但不限制数量、可以新增其他互动类型。硬件动作状态码和互动类型都需要引用（映射到）某个 GLB 动作资源才能在 App 上播放对应动画，互动类型还额外配置对饱腹度/心情值/清洁度三项属性各自的增减效果。

## What Changes

- 补齐 `/sdkapi/pet/**` 缺失的更新、删除、详情接口（软删除，`deleted` 字段），并新增对应的后台 `/api/admin/pets/**` 增删改查接口与 `app/pages/admin/pets/index.vue` 管理页。
- 新增宠物养成状态：`t_pet` 增加饱腹度（satiety）、心情值（mood）、清洁度（cleanliness）字段，数值随时间衰减、随互动变化，App 端可查询当前状态。
- 新增 **GLB 动作资源库**：后台可独立增删改查一批 GLB 动画资源（名称 + GLB 文件地址 + 预览图/说明），走现有 OSS 直传签名模式（新增 GLB MIME 支持）。这是唯一存放动画文件的地方，互动类型和硬件动作状态码都通过引用它来决定播放哪个动画。
- 新增互动类型资源管理：喂食/逗猫/清洁等互动类型（含名称、图标、引用的 GLB 动作资源、对饱腹度/心情值/清洁度三项属性各自的增减效果），后台可增删改查，预置 3 条初始数据但不限制数量；App 通过互动接口触发对应效果并拿到映射的 GLB 地址播放动画。
- 新增背景与形象（GLB）资源管理：后台可上传/管理背景图与可选形象 GLB 模型列表，走现有 OSS 直传签名模式。
- 新增硬件动作状态码管理与上报：硬件动作状态码是硬件/算法判断出的宠物当前物理状态，不是动画本身；后台可增删改查状态码（预置躺卧/进食/坐/行走/站立 5 条，硬件支持新动作时可继续新增），并可编辑每个状态码的显示名称/图标/启用状态，以及编辑该状态码**映射到哪一个 GLB 动作资源**（下拉选择，可改可留空）。对方硬件/后台通过 `openapi` 签名通道上报当前状态码，Redis 缓存最新状态（沿用 `device:position` 的 Redis 优先 + DB 兜底模式），App 通过 `sdkapi` 轮询获取当前状态码,再按映射关系查到对应 GLB 播放动画；硬件上报一个后台尚未定义的状态码时按未知/无效处理。
- 新增 App 端资源清单接口：一次性返回当前可用的背景列表、形象列表、GLB 动作资源列表、互动类型列表（含各自引用的 GLB 地址），供 App 渲染可选项。
- 新增**宠物事件统一记录**：互动触发（喂食/逗猫/清洁等）和硬件状态码上报都算作"宠物事件"，统一写入一张独立的事件表（而不是各自散落记录），后台提供一个独立的事件查询页面（按宠物/设备/事件来源类型/时间筛选），类似现有的设备事件查询页。
- 新增两个后台管理页面：环境编辑（背景 + 形象 GLB + GLB 动作资源库 + 互动类型四个子模块，均为增删改查列表）与宠物硬件动作管理（状态码的增删改查、元数据编辑与到 GLB 动作资源的映射）；宠物事件查询单独成页，覆盖互动和硬件上报两类事件来源。

## Capabilities

### New Capabilities
- `pet-profile`: 宠物档案的 App 端增删改查（`/sdkapi/pet/**`）与后台增删改查（`/api/admin/pets/**` + 管理页），软删除、按用户/设备关联。
- `pet-vital-stats`: 宠物饱腹度/心情值/清洁度状态的存储、随时间衰减、以及被互动效果修改的规则，App 端可查询当前状态。
- `pet-resource-library`: 后台管理背景图、形象 GLB、**GLB 动作资源库**（可独立增删改查的动画资源，被互动类型和硬件动作状态码引用）、**互动类型**（喂食/逗猫/清洁等,含引用的 GLB 动作资源与三项属性增减值）四类均可增删改查的资源，提供 OSS 上传签名（含 GLB MIME）与相应接口、对应管理页面，并提供 App 端一次性资源清单接口。
- `pet-hardware-action`: 硬件动作**状态码**（躺卧/进食/坐/行走/站立等，预置 5 条初始数据但可继续增删改查，仅是状态标识，不含动画）的后台管理与到 GLB 动作资源的映射编辑、硬件通过 `openapi` 上报当前状态码、App 通过 `sdkapi` 轮询获取当前状态码。
- `pet-event-log`: 统一记录互动触发（喂食/逗猫/清洁等）和硬件状态码上报两类"宠物事件"，独立事件表存储，后台提供独立查询页面（按宠物/设备/事件来源类型/时间筛选、分页）。

### Modified Capabilities
(无——`t_pet` 相关既有行为此前未建档为 spec，本次以新能力形式建档，不修改其他已有能力的需求。)

## Impact

- 数据库：`sql/init.sql` 新增/修改表 —— `t_pet` 增列（饱腹度/心情值/清洁度/形象/背景引用/更新时间），新增 `t_pet_background`、`t_pet_model`、`t_pet_glb_action`（GLB 动作资源库）、`t_pet_interaction_type`（预置 3 条种子行，可增删改查，引用 `t_pet_glb_action`，含三项属性增减值）、`t_pet_hardware_action_type`（预置 5 条种子行，可增删改查，引用 `t_pet_glb_action`）、`t_pet_event`（统一事件表，覆盖互动触发与硬件状态码上报两类来源）。
- API：新增/修改 `server/routes/sdkapi/pet/**`（更新/删除/详情/状态/互动/动作轮询/资源清单）、`server/routes/api/admin/pets/**`、`server/routes/api/admin/pet-backgrounds/**`、`server/routes/api/admin/pet-models/**`、`server/routes/api/admin/pet-glb-actions/**`、`server/routes/api/admin/pet-interaction-types/**`（完整增删改查）、`server/routes/api/admin/pet-hardware-actions/**`（完整增删改查）、`server/routes/api/admin/pet-events.get.ts`（统一事件查询）、`server/routes/openapi/pet/action/report.post.ts`。
- 前端：新增 `app/pages/admin/pets/index.vue`、`app/pages/admin/virtual-pet/scenes.vue`、`app/pages/admin/virtual-pet/actions.vue`、`app/pages/admin/virtual-pet/events.vue`。
- 基础设施：Redis 新增 `RedisKey` 项（当前宠物动作缓存）；OSS 上传签名逻辑新增 GLB（`model/gltf-binary`，`.glb`）MIME 支持。
- 无破坏性变更；现有 `/sdkapi/pet/create`、`/sdkapi/pet/list`、`/sdkapi/pet/fence/**` 行为保持兼容。
