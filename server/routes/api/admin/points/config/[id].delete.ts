// DELETE /api/admin/points/config/[id] — 删除积分类型
// 注意：内置类型（permanent/checkin/plan_*）被计划与签到逻辑引用，删除前请确认无引用。
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const db = useDb()
  await db.query('DELETE FROM t_points_config WHERE id=?', [id])
  return { success: true }
})
