// GET /api/admin/feedback  —— 管理员查看用户反馈列表
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20))
  const type = query.type ? Number(query.type) : null    // 1建议 2投诉 3好评
  const status = query.status !== undefined ? Number(query.status) : null  // 0未读 1已读 2已处理
  const keyword = query.keyword ? String(query.keyword).trim() : ''

  const db = useDb()

  const conditions: string[] = ['f.id > 0']
  const params: any[] = []

  if (type !== null && [1, 2, 3].includes(type)) {
    conditions.push('f.type = ?')
    params.push(type)
  }
  if (status !== null && [0, 1, 2].includes(status)) {
    conditions.push('f.status = ?')
    params.push(status)
  }
  if (keyword) {
    conditions.push('(f.content LIKE ? OR f.title LIKE ? OR u.nickname LIKE ?)')
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
  }

  const where = conditions.join(' AND ')
  const offset = (page - 1) * pageSize

  const [[{ total }]]: any = await db.query(
    `SELECT COUNT(*) as total
     FROM t_feedback f
     JOIN t_user u ON f.user_id = u.id
     WHERE ${where}`,
    params
  )

  const [rows]: any = await db.query(
    `SELECT f.id, f.type, f.title, f.content, f.status, f.created_at,
            f.user_id,
            COALESCE(NULLIF(f.nickname,''), u.nickname) AS nickname,
            u.avatar, u.phone
     FROM t_feedback f
     JOIN t_user u ON f.user_id = u.id
     WHERE ${where}
     ORDER BY f.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  // 统计各类型未读数
  const [unreadStats]: any = await db.query(
    `SELECT type, COUNT(*) as cnt FROM t_feedback WHERE status = 0 GROUP BY type`
  )
  const unread = { total: 0, suggestion: 0, complaint: 0, praise: 0 }
  for (const s of unreadStats) {
    unread.total += Number(s.cnt)
    if (s.type === 1) unread.suggestion = Number(s.cnt)
    if (s.type === 2) unread.complaint = Number(s.cnt)
    if (s.type === 3) unread.praise = Number(s.cnt)
  }

  return {
    total,
    page,
    pageSize,
    list: rows,
    unread,
  }
})
