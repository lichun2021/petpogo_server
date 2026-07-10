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
    `SELECT u.id, u.phone, u.nickname, u.avatar, u.status, u.plan_type, u.created_at,
            COALESCE(SUM(CASE WHEN b.expire_at IS NULL THEN b.remaining ELSE 0 END), 0) AS points_permanent,
            COALESCE(SUM(CASE WHEN b.expire_at IS NOT NULL AND b.expire_at > NOW() THEN b.remaining ELSE 0 END), 0) AS points_expiring
     FROM t_user u
     LEFT JOIN t_user_points_batch b ON b.user_id = u.id AND b.remaining > 0
     ${where}
     GROUP BY u.id
     ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(size), offset]
  )

  return {
    list: list.map((u: any) => {
      const permanent = Number(u.points_permanent) || 0
      const expiring = Number(u.points_expiring) || 0
      return {
        ...u,
        id: String(u.id),
        points_permanent: permanent,
        points_expiring: expiring,
        points_total: permanent + expiring,
      }
    }),
    total: Number(total),
  }
})
