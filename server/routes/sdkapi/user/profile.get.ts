// 获取当前用户信息（含计划信息与积分余额）
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = useDb()
  const [[row]]: any = await db.query(
    'SELECT id, phone, nickname, avatar, gender, birthday, bio, plan_type, plan_expire_at, created_at FROM t_user WHERE id=? AND deleted=0',
    [user.userId]
  )
  if (!row) throw createError({ statusCode: 404, message: '用户不存在' })

  const points = await getPointsBalance(user.userId)

  return {
    ...row,
    id: String(row.id),
    planType: row.plan_type,
    planExpireAt: row.plan_expire_at ? new Date(row.plan_expire_at).toISOString() : null,
    // 隐藏原始数据库字段
    plan_type:      undefined,
    plan_expire_at: undefined,
    points,
  }
})
