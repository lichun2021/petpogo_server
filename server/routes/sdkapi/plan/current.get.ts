// GET /sdkapi/plan/current
// 查询当前用户的订阅状态（判断是否 Pro / ProMax，及到期时间）
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = useDb()

  const [[row]]: any = await db.query(
    `SELECT plan_type, plan_expire_at FROM t_user WHERE id=? AND deleted=0`,
    [user.userId]
  )
  if (!row) throw createError({ statusCode: 404, message: '用户不存在' })

  const planType = row.plan_type ?? 0
  const expireAt: Date | null = row.plan_expire_at ? new Date(row.plan_expire_at) : null

  // plan_expire_at 已过期则视为自动降级为 Free（不做写库降级，仅在读取时体现）
  const expired = expireAt !== null && expireAt.getTime() < Date.now()
  const effectivePlanType = expired ? 0 : planType

  const plan = await getPlan(effectivePlanType)

  // 最近一笔已支付订单的支付时间，作为当前订阅的开始时间（仅供展示，非精确记账字段）
  let startAt: string | null = null
  if (!expired && plan) {
    const [[latestOrder]]: any = await db.query(
      `SELECT paid_at FROM t_plan_order
       WHERE user_id=? AND plan_id=? AND status=1
       ORDER BY paid_at DESC LIMIT 1`,
      [user.userId, plan.id]
    )
    if (latestOrder?.paid_at) startAt = new Date(latestOrder.paid_at).toISOString()
  }

  return {
    planId: plan ? String(plan.id) : null,
    planType: effectivePlanType,
    name: plan?.name ?? (effectivePlanType === 0 ? 'Free' : ''),
    status: expired ? 'expired' : 'active',
    startAt,
    expireAt: (!expired && expireAt) ? expireAt.toISOString() : null,
  }
})
