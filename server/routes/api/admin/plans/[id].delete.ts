// DELETE /api/admin/plans/[id] — 删除计划（plan_type=0 的 Free 计划不允许删除）
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const db = useDb()
  const [[row]]: any = await db.query('SELECT id, plan_type FROM t_plan WHERE id=? LIMIT 1', [id])
  if (!row) throw createError({ statusCode: 404, message: '计划不存在' })
  if (row.plan_type === 0) throw createError({ statusCode: 403, message: 'Free 基础计划不可删除' })

  await db.query('DELETE FROM t_plan WHERE id=?', [id])
  return { success: true }
})
