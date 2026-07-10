// GET /api/admin/points/logs — 查询积分流水（可按 userId 或手机号/昵称筛选）
export default defineEventHandler(async (event) => {
  const query     = getQuery(event)
  const keyword   = (query.keyword   as string) || ''
  const userId    = (query.userId    as string) || ''
  const direction = (query.direction as string) || ''
  const page   = Math.max(1, Number(query.page)  || 1)
  const limit  = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const offset = (page - 1) * limit

  const db = useDb()
  const conditions: string[] = []
  const params: any[] = []

  if (userId.trim()) {
    conditions.push('l.user_id = ?')
    params.push(userId.trim())
  } else if (keyword.trim()) {
    conditions.push('(u.phone LIKE ? OR u.nickname LIKE ?)')
    params.push(`%${keyword.trim()}%`, `%${keyword.trim()}%`)
  }
  if (direction === '1' || direction === '2') {
    conditions.push('l.direction = ?')
    params.push(Number(direction))
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

  const [[{ total }]]: any = await db.query(
    `SELECT COUNT(*) AS total FROM t_points_log l LEFT JOIN t_user u ON u.id = l.user_id ${where}`,
    params
  )

  const [rows]: any = await db.query(
    `SELECT l.id, l.user_id, u.phone, u.nickname, l.direction, l.points_type, l.amount,
            l.balance_after, l.reason, l.ref_type, l.ref_id, l.created_at
     FROM t_points_log l
     LEFT JOIN t_user u ON u.id = l.user_id
     ${where}
     ORDER BY l.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )

  return {
    list: rows.map((r: any) => ({ ...r, id: String(r.id), user_id: String(r.user_id) })),
    total: Number(total),
    page,
    limit,
  }
})
