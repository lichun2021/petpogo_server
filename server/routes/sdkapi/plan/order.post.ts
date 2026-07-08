// POST /sdkapi/plan/order
// 生成一条计划购买订单（占位，不对接第三方支付网关）
//
// 请求体：
//   planId  string  t_plan.id（必填）
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { planId } = await readBody(event)
  if (!planId) throw createError({ statusCode: 400, message: 'planId 不能为空' })

  const db = useDb()
  const [[plan]]: any = await db.query(
    `SELECT id, price FROM t_plan WHERE id = ? AND status = 1`,
    [planId]
  )
  if (!plan) throw createError({ statusCode: 404, message: '计划不存在' })

  const [result]: any = await db.query(
    `INSERT INTO t_plan_order (user_id, plan_id, amount, status) VALUES (?, ?, ?, 0)`,
    [user.userId, planId, plan.price]
  )

  return {
    orderId: String(result.insertId),
    planId: String(plan.id),
    amount: plan.price,
    status: 0,
  }
})
