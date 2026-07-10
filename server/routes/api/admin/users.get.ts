export default defineEventHandler(async (event) => {
  const { page = 1, size = 20, search = '', status = '' } = getQuery(event)
  const db = useDb()
  const offset = (Number(page) - 1) * Number(size)

  let where = 'WHERE deleted=0'
  const params: any[] = []
  if (search) { where += ' AND (phone LIKE ? OR nickname LIKE ?)'; params.push(`%${search}%`, `%${search}%`) }
  if (status)  { where += ' AND status=?'; params.push(Number(status)) }

  const [[{ total }]]: any = await db.query(`SELECT COUNT(*) as total FROM t_user ${where}`, params)
  const [list]: any = await db.query(
    `SELECT id, phone, nickname, avatar, status, plan_type,
            points_weekly, points_permanent, created_at
     FROM t_user ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(size), offset]
  )

  return {
    list: list.map((u: any) => ({
      ...u,
      id: String(u.id),
      points_weekly:    u.points_weekly    ?? 0,
      points_permanent: u.points_permanent ?? 0,
      points_total:     (u.points_weekly ?? 0) + (u.points_permanent ?? 0),
    })),
    total: Number(total),
  }
})
