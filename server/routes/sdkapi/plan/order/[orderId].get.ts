// GET /sdkapi/plan/order/[orderId]
// 查询单笔订单支付状态（供前端下单后轮询，判断是否已由管理后台人工确认支付）
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const orderId = getRouterParam(event, 'orderId')
  if (!orderId) throw createError({ statusCode: 400, message: 'orderId 不能为空' })

  const db = useDb()
  const [[row]]: any = await db.query(
    `SELECT o.id, o.plan_id, p.name AS plan_name, p.duration_days,
            o.amount, o.status, o.created_at, o.paid_at
     FROM t_plan_order o
     LEFT JOIN t_plan p ON p.id = o.plan_id
     WHERE o.id = ? AND o.user_id = ?
     LIMIT 1`,
    [orderId, user.userId]
  )
  if (!row) throw createError({ statusCode: 404, message: '订单不存在' })

  let expireAt: string | null = null
  if (row.status === 1 && row.paid_at && row.duration_days) {
    const d = new Date(row.paid_at)
    d.setDate(d.getDate() + Number(row.duration_days))
    expireAt = d.toISOString()
  }

  return {
    orderId: String(row.id),
    planId: String(row.plan_id),
    planName: row.plan_name,
    amount: row.amount,
    status: row.status,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : null,
    expireAt,
  }
})
