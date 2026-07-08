// GET /api/admin/points/rules — 查询积分消费规则列表
export default defineEventHandler(async (event) => {
  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT id, consume_type, name, unit_points, unit_basis, status, sort_order
     FROM t_points_consume_rule ORDER BY sort_order ASC, id ASC`
  )
  return { list: rows }
})
