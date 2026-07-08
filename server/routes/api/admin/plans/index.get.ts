// GET /api/admin/plans — 查询购买计划列表（Free / Pro / ProMax）
export default defineEventHandler(async (event) => {
  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT id, plan_type, name, price, duration_days, weekly_points_grant, permanent_points_grant,
            monthly_makeup_quota, description, status, sort_order
     FROM t_plan ORDER BY sort_order ASC`
  )
  return { list: rows }
})
