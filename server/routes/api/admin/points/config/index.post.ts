// POST /api/admin/points/config — 新增积分类型
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)

  const { type_code, name, expire_days = 0, sort_order = 0 } = await readBody(event)

  if (!type_code?.trim()) throw createError({ statusCode: 400, message: 'type_code 不能为空' })
  if (!name?.trim()) throw createError({ statusCode: 400, message: '名称不能为空' })

  const db = useDb()
  const [[existing]]: any = await db.query('SELECT id FROM t_points_config WHERE type_code=? LIMIT 1', [type_code.trim()])
  if (existing) throw createError({ statusCode: 409, message: `type_code=${type_code} 已存在` })

  const [result]: any = await db.query(
    `INSERT INTO t_points_config (type_code, name, expire_days, sort_order)
     VALUES (?, ?, ?, ?)`,
    [type_code.trim(), name.trim(), Math.max(0, Number(expire_days) || 0), Number(sort_order) || 0]
  )
  return { id: Number(result.insertId), success: true }
})
