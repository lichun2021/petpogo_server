// PUT /api/admin/plans/orders/[id]/confirm — 人工确认订单已支付，开通对应计划
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const db = useDb()
  const [[order]]: any = await db.query('SELECT user_id, plan_id, period, status FROM t_plan_order WHERE id=? LIMIT 1', [id])
  if (!order) throw createError({ statusCode: 404, message: '订单不存在' })
  if (order.status !== 0) throw createError({ statusCode: 400, message: '订单状态不允许确认' })

  await db.query(
    `UPDATE t_plan_order SET status=1, paid_at=NOW() WHERE id=?`,
    [id]
  )

  const period = (order.period === 'yearly' ? 'yearly' : 'monthly') as 'monthly' | 'yearly'
  await applyPlan(String(order.user_id), String(order.plan_id), '购买计划(管理员确认)', period)

  return { success: true }
})
