// GET /api/admin/points/logs — 查询积分流水（可按用户手机号/昵称筛选）
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const keyword = (query.keyword as string) || ''
  const page   = Math.max(1, Number(query.page) || 1)
  const limit  = Math.min(50, Math.max(1, Number(query.limit) || 20))
  const offset = (page - 1) * limit

  const db = useDb()
  const conditions: string[] = []
  const params: any[] = []
  if (keyword.trim()) {
    conditions.push('(u.phone LIKE ? OR u.nickname LIKE ?)')
    params.push(`%${keyword.trim()}%`, `%${keyword.trim()}%`)
  }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

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
    page,
    limit,
  }
})
