// GET /api/admin/users?page=1&size=20&search=xxx&status=1
export default defineEventHandler(async (event) => {
  const { page = 1, size = 20, search = '', status = '' } = getQuery(event)
  const db     = useDb()
  const offset = (Number(page) - 1) * Number(size)

  const conditions: string[] = ['deleted = 0']
  const params: any[]        = []

  if (search) {
    conditions.push('(phone LIKE ? OR nickname LIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }
  if (status) {
    conditions.push('status = ?')
    params.push(Number(status))
  }

  const where = conditions.join(' AND ')

  const [[{ total }]]: any = await db.query(
    `SELECT COUNT(*) AS total FROM t_user WHERE ${where}`, params
  )
  const [list]: any = await db.query(
    `SELECT id, phone, nickname, avatar, gender, status, created_at
     FROM t_user WHERE ${where}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(size), offset]
  )

  return {
    list: list.map((u: any) => ({ ...u, id: String(u.id) })),
    total: Number(total),
    page:  Number(page),
    size:  Number(size),
  }
})
