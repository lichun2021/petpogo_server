// DELETE /api/admin/pet-models/[id] — 软删除形象资源
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const db = useDb()
  await db.query('UPDATE t_pet_model SET deleted=1, updated_at=NOW() WHERE id=?', [id])
  return { success: true }
})
