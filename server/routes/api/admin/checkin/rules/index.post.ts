// POST /api/admin/checkin/rules — 新增签到奖励档位
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)

  const {
    rule_type,
    streak_days = 1,
    points_amount,
    points_type_code = 'checkin',
    name,
    sort_order = 0,
  } = await readBody(event)

  if (![1, 2].includes(rule_type)) throw createError({ statusCode: 400, message: 'rule_type 无效' })
  if (!points_type_code?.trim()) throw createError({ statusCode: 400, message: 'points_type_code 无效' })
  if (!points_amount || Number(points_amount) <= 0) throw createError({ statusCode: 400, message: 'points_amount 必须大于0' })
  if (!name?.trim()) throw createError({ statusCode: 400, message: '档位名称不能为空' })
  if (rule_type === 2 && (!streak_days || Number(streak_days) < 1)) {
    throw createError({ statusCode: 400, message: '连续签到奖励必须设置有效的 streak_days' })
  }

  const db = useDb()
  const [result]: any = await db.query(
    `INSERT INTO t_checkin_rule (rule_type, streak_days, points_amount, points_type_code, name, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [rule_type, rule_type === 1 ? 1 : Number(streak_days), Number(points_amount), points_type_code.trim(), name.trim(), Number(sort_order) || 0]
  )
  return { id: Number(result.insertId), success: true }
})
