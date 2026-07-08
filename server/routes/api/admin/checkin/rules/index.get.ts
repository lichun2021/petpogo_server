// GET /api/admin/checkin/rules — 查询签到奖励档位列表
export default defineEventHandler(async (event) => {
  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT id, rule_type, streak_days, points_amount, points_type, name, status, sort_order
     FROM t_checkin_rule ORDER BY rule_type ASC, sort_order ASC`
  )
  return { list: rows }
})
