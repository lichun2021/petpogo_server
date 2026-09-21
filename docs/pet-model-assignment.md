# 宠物 GLB 自动分配

## 上线顺序

1. 备份数据库，在已有数据库执行 `sql/pet-model-assignment.sql` 一次，再发布应用。此脚本新增四个宠物字段和一个配置表，为已有形象生成快照，不重新匹配老宠物。
2. 升级脚本会将最早的有效启用形象登记为默认形象，延续旧逻辑。若没有有效形象，需要先在「电子宠物环境」上传 GLB，再到「宠物形象分配」设置默认形象。全新数据库的 `sql/init.sql` 已包含新表和字段。
3. 在「宠物形象分配」配置默认形象、品种类型对照及规则。保存后使用匹配预览验证。
4. 通过 `/sdkapi/peer/pet/info/add` 新增宠物，随后查询 `/sdkapi/pet/:id/status` 获取分配后的 `model`。上游响应结构保持不变。直接绕过本服务调用对方接口的新增操作无法触发本地分配。

没有默认形象时，本服务会在调用上游新增接口前返回 503，避免因为配置缺失发生上游成功但本地无法分配的情况。

## 规则约定

- 固定条件：类型（不限、猫、狗）、品种（不限或多个精确名称）、性别（不限、公、母）。条件全部满足才命中。
- 优先级整数越大越先匹配，相同优先级按规则 ID 的字符串顺序稳定排序。每条规则只对应一个 GLB，无随机分配。
- 品种忽略首尾空格与英文大小写，别名分别登记。缺少明确类型时使用后台品种对照；不根据未知数字类型或照片猜测。
- 未知性别不会命中限定公母的规则。未知类型可命中不限类型规则；否则使用默认形象。
- 停用规则、停用或删除的模型不参与匹配，继续尝试后续规则，最终使用默认形象。
- 默认形象不可停用、删除。必须先选择另一有效形象并保存。配置和资源变更使用同一配置行锁，防止并发操作破坏保底。
- 最多 200 条规则、1000 条品种对照；优先级范围 -100000 至 100000。

## 宠物形象固定与更换

宠物保存来源模型 ID、形象名称、GLB 地址、缩略图、规则 ID/名称、分配方式及分配时间。文件共用 OSS 地址，数据库保存快照。现有上传接口使用唯一文件路径；更新资源必须上传新文件，保留旧 OSS 文件，不能覆盖或清理仍被宠物快照引用的文件。

规则和默认配置更改仅影响新宠物；重复同步和普通档案编辑保留已有形象。后台宠物档案编辑支持「保留当前形象」「按本次保存的资料重新匹配」「手动指定形象」，与档案更新在同一事务提交。未传或传空 `modelId` 的 App 档案更新保留已有形象；明确传入有效 `modelId` 时保存手动形象快照。

App 状态接口保持 `model: { id, name, glb_url, thumbnail_url }` 的原有字段，快照中另有 `rule_id`。新增顶层 `model_assignment_source`、`model_rule_name`、`model_assigned_at`。来源值为 `rule`、`default`、`manual`，历史迁移为 `legacy`。没有旧形象的历史宠物不自动重配，可以通过后台重新匹配补齐。

## 后台接口

- `GET /api/admin/pet-model-assignment`：读取保存的配置。
- `PUT /api/admin/pet-model-assignment`：整体保存 `{ defaultModelId, rules, breedMappings }`。
- `POST /api/admin/pet-model-assignment/preview`：提交 `{ species, breed, gender }`，使用已保存配置返回模型、识别类型、来源、命中规则。
- `PUT /api/admin/pets/:id`：原有档案字段增加 `assignmentMode`（默认 `keep`，可选 `rematch` / `manual`）及手动模式的 `modelId`。

全部后台接口沿用管理员认证。所有模型和规则 ID 都是字符串。

## 本地验证

`npm run build`

`node --test tests/pet-model-assignment.test.mjs tests/pet-model-assignment-api.test.mjs tests/peer-local-sync.test.mjs tests/admin-pet-resources.test.mjs tests/peer-proxy.test.mjs`

测试使用模拟数据库和本地模拟上游，不连接真实 MySQL、Redis、设备或对方后台。直接执行 TypeScript 的规则测试使用 Node 24。
