export default defineEventHandler(async event => {
  const body = await readBody(event)
  const fail = () => { throw createError({ statusCode: 400, message: '配置格式无效，请检查名称、条件、优先级和形象' }) }
  const validId = (v: any) => typeof v === 'string' && /^[1-9]\d{0,18}$/.test(v) && BigInt(v) <= 9223372036854775807n
  if (!body || !validId(body.defaultModelId) || !validId(body.defaultCatModelId) || !validId(body.defaultDogModelId) || !Array.isArray(body.rules) || body.rules.length > 200 || !Array.isArray(body.breedMappings) || body.breedMappings.length > 1000) fail()
  const ids = new Set<string>()
  const rules = body.rules.map((r: any) => {
    if (!r || typeof r.name !== 'string' || !r.name.trim() || r.name.length > 100 || !['all','cat','dog'].includes(r.species) ||
      ![null,1,2].includes(r.gender) || !Number.isInteger(r.priority) || Math.abs(r.priority) > 100000 || ![0,1].includes(r.enabled) ||
      !validId(r.modelId) || !Array.isArray(r.breeds) || r.breeds.length > 100 || r.breeds.some((b: any) => typeof b !== 'string' || !b.trim() || b.length > 100)) fail()
    const id = r.id || String(generateId())
    if (!validId(id) || ids.has(id)) fail()
    ids.add(id)
    return { id, name: r.name.trim(), species: r.species, breeds: [...new Set(r.breeds.map(normalizePetBreed))], gender: r.gender, priority: r.priority, enabled: r.enabled, modelId: r.modelId }
  })
  const breeds = new Set<string>()
  const breedMappings = body.breedMappings.map((m: any) => {
    if (!m || typeof m.breed !== 'string' || !m.breed.trim() || m.breed.length > 100 || !['cat','dog'].includes(m.species)) fail()
    const breed = normalizePetBreed(m.breed)
    if (breeds.has(breed)) fail()
    breeds.add(breed)
    return { breed, species: m.species }
  })
  const db = await useDb().getConnection()
  try {
    await db.beginTransaction()
    const current = await getPetModelConfig(db, true)
    if (!Number.isSafeInteger(body.revision) || body.revision !== current.revision) throw createError({statusCode:409,message:'配置已变化，请刷新后再保存'})
    const references = [...new Set([body.defaultModelId,body.defaultCatModelId,body.defaultDogModelId,...rules.filter((r:any)=>r.enabled).map((r:any)=>r.modelId)])]
    const [models]: any = await db.query(`SELECT id,enabled,deleted FROM t_pet_model WHERE id IN (${references.map(()=>'?').join(',')}) FOR UPDATE`, references)
    const valid = (id: string) => models.some((m: any) => String(m.id) === id && m.enabled && !m.deleted)
    if (![body.defaultModelId, body.defaultCatModelId, body.defaultDogModelId].every(valid) || rules.some((r: any) => r.enabled && !valid(r.modelId))) throw createError({ statusCode: 400, message: '默认形象和启用规则必须选择有效的启用形象' })
    await db.query('UPDATE t_pet_model_assignment SET revision=revision+1,default_model_id=?,default_cat_model_id=?,default_dog_model_id=?,rules=?,breed_mappings=? WHERE id=1', [body.defaultModelId, body.defaultCatModelId, body.defaultDogModelId, JSON.stringify(rules), JSON.stringify(breedMappings)])
    await db.commit()
    return { success: true }
  } catch (e) { await db.rollback(); throw e } finally { db.release() }
})
