// 删除宠物档案（软删除，仅本人）
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少宠物ID' })

  const db = useDb()
  const [[pet]]: any = await db.query(
    'SELECT id FROM t_pet WHERE id=? AND user_id=? AND deleted=0 LIMIT 1',
    [id, user.userId]
  )
  if (!pet) throw createError({ statusCode: 404, message: '宠物不存在' })

  await db.query('UPDATE t_pet SET deleted=1, updated_at=NOW() WHERE id=? AND user_id=?', [id, user.userId])
  return { success: true }
})
