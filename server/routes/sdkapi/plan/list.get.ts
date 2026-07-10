// GET /sdkapi/plan/list
// 查询购买计划列表（Free / Pro / ProMax），供 App 购买页展示
export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT id, plan_type, name, price_monthly, price_yearly, duration_days, grant_period_days, period_grant_amount, period_grant_type_code,
            weekly_makeup_quota, description
     FROM t_plan WHERE status = 1 ORDER BY sort_order ASC`
  )

  return { list: rows.map((r: any) => ({ ...r, id: String(r.id) })) }
})
