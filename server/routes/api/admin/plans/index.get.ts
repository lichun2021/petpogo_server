// GET /api/admin/plans — 查询购买计划列表（Free / Pro / ProMax）
export default defineEventHandler(async (event) => {
  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT id, plan_type, name, price_monthly, price_yearly, duration_days, grant_period_days, period_grant_amount, period_grant_type_code,
            weekly_makeup_quota, description, status, sort_order
     FROM t_plan ORDER BY sort_order ASC`
  )
  return { list: rows }
})
