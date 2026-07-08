// DELETE /api/admin/points/rules/[id] — 删除积分消费规则
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const db = useDb()
  await db.query('DELETE FROM t_points_consume_rule WHERE id=?', [id])
  return { success: true }
})
