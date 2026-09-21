// DELETE /api/admin/pet-models/[id] — 软删除形象资源
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const db = await useDb().getConnection()
  try {
    await db.beginTransaction()
    const config = await getPetModelConfig(db, true)
    if ([config.defaultModelId, config.defaultCatModelId, config.defaultDogModelId].includes(id)) throw createError({ statusCode: 400, message: '请先更换默认形象，再停用或删除此资源' })
    await db.query('UPDATE t_pet_model SET deleted=1, updated_at=NOW() WHERE id=?', [id])
    await db.commit()
    return { success: true }
  } catch (e) { await db.rollback(); throw e } finally { db.release() }
})
