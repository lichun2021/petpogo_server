// POST /api/admin/points/rules — 新增积分消费规则（AI消费类型 -> 积分单价）
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)

  const {
    consume_type,
    name,
    unit_points,
    unit_basis = 'per_call',
    sort_order = 0,
  } = await readBody(event)

  if (!consume_type?.trim()) throw createError({ statusCode: 400, message: 'consume_type 不能为空' })
  if (!name?.trim())         throw createError({ statusCode: 400, message: '规则名称不能为空' })
  if (!unit_points || Number(unit_points) <= 0) throw createError({ statusCode: 400, message: 'unit_points 必须大于0' })

  const validBasis = ['per_call', 'per_unit']
  if (!validBasis.includes(unit_basis)) throw createError({ statusCode: 400, message: 'unit_basis 无效' })

  const db = useDb()
  const [[existing]]: any = await db.query(
    'SELECT id FROM t_points_consume_rule WHERE consume_type=? LIMIT 1', [consume_type.trim()]
  )
  if (existing) throw createError({ statusCode: 400, message: '该消费类型已存在' })

  const [result]: any = await db.query(
    `INSERT INTO t_points_consume_rule (consume_type, name, unit_points, unit_basis, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    [consume_type.trim(), name.trim(), Number(unit_points), unit_basis, Number(sort_order) || 0]
  )
  return { id: Number(result.insertId), success: true }
})
