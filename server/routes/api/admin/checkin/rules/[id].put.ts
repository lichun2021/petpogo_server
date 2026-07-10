// PUT /api/admin/checkin/rules/[id] — 编辑签到奖励档位
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const {
    rule_type,
    streak_days,
    points_amount,
    points_type_code = 'checkin',
    name,
    sort_order,
    status,
  } = await readBody(event)

  const db = useDb()
  const [[row]]: any = await db.query('SELECT id FROM t_checkin_rule WHERE id=? LIMIT 1', [id])
  if (!row) throw createError({ statusCode: 404, message: '档位不存在' })

  if (![1, 2].includes(rule_type)) throw createError({ statusCode: 400, message: 'rule_type 无效' })
  if (!points_type_code?.trim()) throw createError({ statusCode: 400, message: 'points_type_code 无效' })
  if (!points_amount || Number(points_amount) <= 0) throw createError({ statusCode: 400, message: 'points_amount 必须大于0' })
  if (!name?.trim()) throw createError({ statusCode: 400, message: '档位名称不能为空' })
  if (rule_type === 2 && (!streak_days || Number(streak_days) < 1)) {
    throw createError({ statusCode: 400, message: '连续签到奖励必须设置有效的 streak_days' })
  }

  const statusVal = status === 0 || status === 1 ? status : 1

  await db.query(
    `UPDATE t_checkin_rule
        SET rule_type=?, streak_days=?, points_amount=?, points_type_code=?, name=?, sort_order=?, status=?
      WHERE id=?`,
    [
      rule_type,
      rule_type === 1 ? 1 : Number(streak_days),
      Number(points_amount),
      points_type_code.trim(),
      name.trim(),
      Number(sort_order) || 0,
      statusVal,
      id,
    ]
  )

  return { success: true }
})
