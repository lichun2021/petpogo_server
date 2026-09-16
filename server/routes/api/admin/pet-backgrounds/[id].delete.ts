// DELETE /api/admin/pet-backgrounds/[id] — 软删除背景资源
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const db = useDb()
  await db.query('UPDATE t_pet_background SET deleted=1, updated_at=NOW() WHERE id=?', [id])
  return { success: true }
})
