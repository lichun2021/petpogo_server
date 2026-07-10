// GET /sdkapi/plan/list
// 查询购买计划列表（Free / Pro / ProMax），供 App 购买页展示
export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT id, plan_type, name, price, duration_days, weekly_points_grant, permanent_points_grant,
            weekly_makeup_quota, description
     FROM t_plan WHERE status = 1 ORDER BY sort_order ASC`
  )

  return { list: rows.map((r: any) => ({ ...r, id: String(r.id) })) }
})
