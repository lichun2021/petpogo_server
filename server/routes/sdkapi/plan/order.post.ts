// POST /sdkapi/plan/order
// 生成一条计划购买订单（占位，不对接第三方支付网关，由管理后台人工确认支付）
//
// 请求体：
//   planId  string  t_plan.id（必填）
//   period  string  购买档位：monthly=月费 / yearly=年费（必填）
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { planId, period } = await readBody(event)
  if (!planId) throw createError({ statusCode: 400, message: 'planId 不能为空' })
  if (!['monthly', 'yearly'].includes(period)) {
    throw createError({ statusCode: 400, message: 'period 无效，需为 monthly 或 yearly' })
  }

  const db = useDb()
  const [[plan]]: any = await db.query(
    `SELECT id, name, price_monthly, price_yearly FROM t_plan WHERE id = ? AND status = 1`,
    [planId]
  )
  if (!plan) throw createError({ statusCode: 404, message: '计划不存在' })

  const amount = period === 'yearly' ? Number(plan.price_yearly) : Number(plan.price_monthly)

  const [result]: any = await db.query(
    `INSERT INTO t_plan_order (user_id, plan_id, period, amount, status) VALUES (?, ?, ?, ?, 0)`,
    [user.userId, planId, period, amount]
  )

  return {
    orderId: String(result.insertId),
    planId: String(plan.id),
    planName: plan.name,
    period,
    amount,
    status: 0,
  }
})
