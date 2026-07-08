// GET /api/admin/plans/orders — 查询计划购买订单列表
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const status = query.status !== undefined && query.status !== '' ? Number(query.status) : null

  const db = useDb()
  const conditions: string[] = []
  const params: any[] = []
  if (status !== null) { conditions.push('o.status = ?'); params.push(status) }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

  const [rows]: any = await db.query(
    `SELECT o.id, o.user_id, u.phone, u.nickname, o.plan_id, p.name AS plan_name,
            o.amount, o.status, o.created_at, o.paid_at
     FROM t_plan_order o
     LEFT JOIN t_user u ON u.id = o.user_id
     LEFT JOIN t_plan p ON p.id = o.plan_id
     ${where}
     ORDER BY o.created_at DESC
     LIMIT 200`,
    params
  )

  return { list: rows.map((r: any) => ({ ...r, id: String(r.id), user_id: String(r.user_id), plan_id: String(r.plan_id) })) }
})
