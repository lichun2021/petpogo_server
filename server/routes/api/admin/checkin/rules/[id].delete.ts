// DELETE /api/admin/checkin/rules/[id] — 删除签到奖励档位
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const db = useDb()
  await db.query('DELETE FROM t_checkin_rule WHERE id=?', [id])
  return { success: true }
})
