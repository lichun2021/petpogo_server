// PUT /api/admin/points/config/[id] — 编辑积分类型
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const { name, expire_days, sort_order, status } = await readBody(event)

  const db = useDb()
  const [[row]]: any = await db.query('SELECT id FROM t_points_config WHERE id=? LIMIT 1', [id])
  if (!row) throw createError({ statusCode: 404, message: '积分类型不存在' })

  if (!name?.trim()) throw createError({ statusCode: 400, message: '名称不能为空' })

  const statusVal = status === 0 || status === 1 ? status : 1

  await db.query(
    `UPDATE t_points_config SET name=?, expire_days=?, sort_order=?, status=? WHERE id=?`,
    [name.trim(), Math.max(0, Number(expire_days) || 0), Number(sort_order) || 0, statusVal, id]
  )

  return { success: true }
})
