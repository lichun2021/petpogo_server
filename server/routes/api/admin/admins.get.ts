// GET /api/admin/admins —— 超级管理员查看管理员账号列表
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)

  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20))
  const keyword = query.keyword ? String(query.keyword).trim() : ''

  const db = useDb()

  const conditions: string[] = ['deleted=0']
  const params: any[] = []

  if (keyword) {
    conditions.push('(username LIKE ? OR nickname LIKE ?)')
    params.push(`%${keyword}%`, `%${keyword}%`)
  }

  const where = conditions.join(' AND ')
  const offset = (page - 1) * pageSize

  const [[{ total }]]: any = await db.query(
    `SELECT COUNT(*) as total FROM t_admin WHERE ${where}`,
    params
  )

  const [rows]: any = await db.query(
    `SELECT id, username, nickname, role, status, last_login_at, created_at
     FROM t_admin
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  return {
    total,
    page,
    pageSize,
    list: rows.map((r: any) => ({ ...r, id: String(r.id) })),
  }
})
