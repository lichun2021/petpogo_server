// PUT /api/admin/points/rules/[id] — 编辑积分消费规则
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const {
    name,
    unit_points,
    unit_basis,
    sort_order,
    status,
  } = await readBody(event)

  const db = useDb()
  const [[row]]: any = await db.query('SELECT id FROM t_points_consume_rule WHERE id=? LIMIT 1', [id])
  if (!row) throw createError({ statusCode: 404, message: '规则不存在' })

  if (!name?.trim()) throw createError({ statusCode: 400, message: '规则名称不能为空' })
  if (!unit_points || Number(unit_points) <= 0) throw createError({ statusCode: 400, message: 'unit_points 必须大于0' })

  const validBasis = ['per_call', 'per_unit']
  if (unit_basis && !validBasis.includes(unit_basis)) throw createError({ statusCode: 400, message: 'unit_basis 无效' })

  const statusVal = status === 0 || status === 1 ? status : 1

  await db.query(
    `UPDATE t_points_consume_rule
        SET name=?, unit_points=?, unit_basis=?, sort_order=?, status=?
      WHERE id=?`,
    [name.trim(), Number(unit_points), unit_basis || 'per_call', Number(sort_order) || 0, statusVal, id]
  )

  return { success: true }
})
