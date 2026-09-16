// DELETE /api/admin/pets/[id] — 后台软删除任意宠物档案
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const db = useDb()
  const [[pet]]: any = await db.query('SELECT id FROM t_pet WHERE id=? AND deleted=0 LIMIT 1', [id])
  if (!pet) throw createError({ statusCode: 404, message: '宠物不存在' })

  await db.query('UPDATE t_pet SET deleted=1, updated_at=NOW() WHERE id=?', [id])
  return { success: true }
})
