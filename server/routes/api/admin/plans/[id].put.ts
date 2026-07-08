// PUT /api/admin/plans/[id] — 编辑计划额度（价格/周期/周积分额度/永久积分额度）
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const {
    name,
    price,
    duration_days,
    weekly_points_grant,
    permanent_points_grant,
    monthly_makeup_quota,
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
        SET name=?, price=?, duration_days=?, weekly_points_grant=?, permanent_points_grant=?,
            monthly_makeup_quota=?, description=?, status=?
      WHERE id=?`,
    [
      name.trim(),
      Number(price) || 0,
      duration_days === null || duration_days === undefined || duration_days === '' ? null : Number(duration_days),
      Number(weekly_points_grant) || 0,
      Number(permanent_points_grant) || 0,
      Number(monthly_makeup_quota) ?? 1,
      description ?? null,
      statusVal,
      id,
    ]
  )

  return { success: true }
})
