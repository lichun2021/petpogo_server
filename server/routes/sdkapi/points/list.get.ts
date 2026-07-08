// GET /sdkapi/points/list
// 查询当前用户积分流水（分页）
//
// Query 参数：
//   page?   number  页码（默认1）
//   limit?  number  每页条数（默认20，最大50）

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = getQuery(event)

  const page   = Math.max(1, Number(query.page) || 1)
  const limit  = Math.min(50, Math.max(1, Number(query.limit) || 20))
  const offset = (page - 1) * limit

  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT id, direction, points_type, amount, balance_after, reason, ref_type, ref_id, created_at
     FROM t_points_log
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [user.userId, limit, offset]
  )

  return {
    list: rows.map((r: any) => ({ ...r, id: String(r.id) })),
    page,
    limit,
  }
})
