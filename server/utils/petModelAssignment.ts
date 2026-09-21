import { createError } from 'h3'
import type { Pool, PoolConnection } from 'mysql2/promise'

type Db = Pool | PoolConnection
export function parsePetJson(value: any): any { return typeof value === 'string' ? JSON.parse(value) : value }
export function normalizePetBreed(value: unknown): string { return typeof value === 'string' ? value.trim().toLowerCase() : '' }
export function normalizePetSpecies(value: unknown): string {
  const v = normalizePetBreed(value)
  return ['cat', '猫', '猫咪'].includes(v) ? 'cat' : ['dog', '狗', '狗狗'].includes(v) ? 'dog' : 'other'
}
export async function getPetModelConfig(db: Db, lock = false) {
  const [[row]]: any = await db.query('SELECT * FROM t_pet_model_assignment WHERE id=1' + (lock ? ' FOR UPDATE' : ''))
  if (!row) throw createError({ statusCode: 503, message: '请先初始化形象分配配置' })
  return { defaultModelId: row.default_model_id ? String(row.default_model_id) : '',
    defaultCatModelId: row.default_cat_model_id ? String(row.default_cat_model_id) : '',
    defaultDogModelId: row.default_dog_model_id ? String(row.default_dog_model_id) : '', rules: parsePetJson(row.rules), breedMappings: parsePetJson(row.breed_mappings), updatedAt: row.updated_at }
}
export function matchPetModel(config: any, models: any[], pet: any) {
  const breed = normalizePetBreed(pet.breed)
  let species = normalizePetSpecies(pet.species)
  if (species === 'other') species = config.breedMappings.find((m: any) => normalizePetBreed(m.breed) === breed)?.species || 'other'
  const available = new Map(models.filter(m => m.enabled && !m.deleted).map(m => [String(m.id), m]))
  const rules = [...config.rules].sort((a: any, b: any) => b.priority - a.priority || String(a.id).localeCompare(String(b.id)))
  const rule = rules.find((r: any) => r.enabled && available.has(r.modelId) &&
    (r.species === 'all' || r.species === species) &&
    (!r.breeds.length || r.breeds.some((b: string) => normalizePetBreed(b) === breed)) &&
    (r.gender === null || r.gender === Number(pet.gender ?? 0)))
  const fallbackId = species === 'cat' ? config.defaultCatModelId : species === 'dog' ? config.defaultDogModelId : config.defaultModelId
  const model = available.get(rule?.modelId || fallbackId)
  if (!model) throw createError({ statusCode: 503, message: `请在后台设置有效的${species === 'cat' ? '默认猫' : species === 'dog' ? '默认狗' : '未知类型保底'} GLB 形象` })
  return { model: { id: String(model.id), name: model.name, glb_url: model.glb_url, thumbnail_url: model.thumbnail_url },
    species, source: rule ? 'rule' : 'default', ruleName: rule?.name || null, ruleId: rule?.id || null }
}
export async function selectPetModel(db: Db, pet: any) {
  const config = await getPetModelConfig(db)
  const [models]: any = await db.query('SELECT * FROM t_pet_model WHERE deleted=0 AND enabled=1')
  return matchPetModel(config, models, pet)
}
export async function savePetModelSnapshot(db: Db, petId: string, assignment: any) {
  await db.query(`UPDATE t_pet SET model_id=?,model_snapshot=?,model_assignment_source=?,model_rule_name=?,model_assigned_at=NOW() WHERE id=?`,
    [assignment.model.id, JSON.stringify({ ...assignment.model, rule_id: assignment.ruleId || null }), assignment.source, assignment.ruleName, petId])
}

/** 新增前确认三类保底均有效，避免上游已创建后本地分配失败。 */
export async function assertPetModelDefaults(db: Db) {
  const config = await getPetModelConfig(db)
  const [models]: any = await db.query('SELECT id FROM t_pet_model WHERE deleted=0 AND enabled=1')
  const ids = new Set(models.map((m: any) => String(m.id)))
  for (const [id, label] of [[config.defaultCatModelId, '默认猫形象'], [config.defaultDogModelId, '默认狗形象'], [config.defaultModelId, '未知类型保底形象']]) {
    if (!ids.has(id)) throw createError({ statusCode: 503, message: `请先在后台设置${label}` })
  }
}
