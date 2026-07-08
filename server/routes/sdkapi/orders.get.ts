// GET /sdkapi/orders
// 查询当前用户的历史订单（计划购买订单）
//
// Query 参数：
//   page?   number  页码（默认1）
//   limit?  number  每页条数（默认20，最大50）
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = getQuery(event)

  const page   = Math.max(1, Number(query.page) || 1)
  const limit  = Math.min(50, Math.max(1, Number(query.limit) || 20))
  const offset = (page - 1) * limit

  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT o.id, o.plan_id, p.name AS plan_name, p.duration_days,
            o.amount, o.status, o.created_at, o.paid_at
     FROM t_plan_order o
     LEFT JOIN t_plan p ON p.id = o.plan_id
     WHERE o.user_id = ?
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?`,
    [user.userId, limit, offset]
  )

  const list = rows.map((r: any) => {
    let expireAt: string | null = null
    if (r.status === 1 && r.paid_at && r.duration_days) {
      const d = new Date(r.paid_at)
      d.setDate(d.getDate() + Number(r.duration_days))
      expireAt = d.toISOString()
    }
    return {
      orderId: String(r.id),
      planId: String(r.plan_id),
      planName: r.plan_name,
      amount: r.amount,
      status: r.status,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
      paidAt: r.paid_at ? new Date(r.paid_at).toISOString() : null,
      expireAt,
    }
  })

  return { list, page, limit }
})
