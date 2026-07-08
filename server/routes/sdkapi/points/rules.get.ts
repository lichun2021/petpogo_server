// GET /sdkapi/points/rules
// 查询积分消费规则（各类 AI 行为消耗多少积分），供 App 展示
export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT consume_type, name, unit_points, unit_basis
     FROM t_points_consume_rule
     WHERE status = 1
     ORDER BY sort_order ASC`
  )

  return { list: rows }
})
