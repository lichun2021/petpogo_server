// POST /api/admin/plans — 新建计划
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)

  const {
    plan_type,
    name,
    price_monthly = 0,
    price_yearly = 0,
    duration_days,
    grant_period_days = 7,
    period_grant_amount,
    period_grant_type_code,
    weekly_makeup_quota,
    description,
  } = await readBody(event)

  if (!name?.trim()) throw createError({ statusCode: 400, message: '计划名称不能为空' })
  if (plan_type === undefined || plan_type === null) {
    throw createError({ statusCode: 400, message: 'plan_type 不能为空' })
  }

  const db = useDb()

  // 检查 plan_type 是否已存在
  const [[existing]]: any = await db.query('SELECT id FROM t_plan WHERE plan_type=? LIMIT 1', [Number(plan_type)])
  if (existing) throw createError({ statusCode: 409, message: `plan_type=${plan_type} 已存在` })

  await db.query(
    `INSERT INTO t_plan
       (plan_type, name, price_monthly, price_yearly, duration_days, grant_period_days, period_grant_amount, period_grant_type_code,
        weekly_makeup_quota, description, status, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1,
       (SELECT COALESCE(MAX(sort_order),0)+1 FROM t_plan tmp))`,
    [
      Number(plan_type),
      name.trim(),
      Number(price_monthly) || 0,
      Number(price_yearly) || 0,
      duration_days || null,
      Math.max(1, Number(grant_period_days) || 7),
      Number(period_grant_amount) || 0,
      period_grant_type_code || null,
      Number(weekly_makeup_quota) ?? 1,
      description ?? null,
    ]
  )

  return { success: true }
})
