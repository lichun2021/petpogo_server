// PUT /api/admin/plans/[id] — 编辑计划额度（价格/周期/周积分额度/永久积分额度/每周补签配额）
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const {
    name,
    price_monthly,
    price_yearly,
    duration_days,
    grant_period_days,
    period_grant_amount,
    period_grant_type_code,
    weekly_makeup_quota,
    description,
    status,
  } = await readBody(event)

  const db = useDb()

  const [[row]]: any = await db.query('SELECT id FROM t_plan WHERE id=? LIMIT 1', [id])
  if (!row) throw createError({ statusCode: 404, message: '计划不存在' })

  if (!name?.trim()) throw createError({ statusCode: 400, message: '计划名称不能为空' })

  const statusVal = status === 0 || status === 1 ? status : 1

  await db.query(
    `UPDATE t_plan
        SET name=?, price_monthly=?, price_yearly=?, duration_days=?, grant_period_days=?, period_grant_amount=?, period_grant_type_code=?,
            weekly_makeup_quota=?, description=?, status=?
      WHERE id=?`,
    [
      name.trim(),
      Number(price_monthly) || 0,
      Number(price_yearly) || 0,
      duration_days === null || duration_days === undefined || duration_days === '' ? null : Number(duration_days),
      Math.max(1, Number(grant_period_days) || 7),
      Number(period_grant_amount) || 0,
      period_grant_type_code || null,
      Number(weekly_makeup_quota) ?? 1,
      description ?? null,
      statusVal,
      id,
    ]
  )

  return { success: true }
})
