// GET /api/admin/pets — 后台查询宠物档案列表，支持按用户ID/关键字筛选
export default defineEventHandler(async (event) => {
  const query   = getQuery(event)
  const userId  = (query.userId  as string) || ''
  const keyword = (query.keyword as string) || ''
  const page    = Math.max(1, Number(query.page)  || 1)
  const limit   = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const offset  = (page - 1) * limit

  const db = useDb()
  const conditions: string[] = ['p.deleted=0']
  const params: any[] = []

  if (userId.trim()) {
    conditions.push('p.user_id = ?')
    params.push(userId.trim())
  }
  if (keyword.trim()) {
    conditions.push('(p.name LIKE ? OR u.phone LIKE ? OR u.nickname LIKE ?)')
    params.push(`%${keyword.trim()}%`, `%${keyword.trim()}%`, `%${keyword.trim()}%`)
  }

  const where = 'WHERE ' + conditions.join(' AND ')

  const [[{ total }]]: any = await db.query(
    `SELECT COUNT(*) AS total FROM t_pet p LEFT JOIN t_user u ON u.id = p.user_id ${where}`,
    params
  )

  const [rows]: any = await db.query(
    `SELECT p.id, p.user_id, u.phone, u.nickname, p.name, p.avatar, p.species, p.breed,
            p.gender, p.birthday, p.weight, p.bio, p.device_id,
            p.satiety, p.mood, p.cleanliness, p.background_id, p.model_id, p.created_at
     FROM t_pet p
     LEFT JOIN t_user u ON u.id = p.user_id
     ${where}
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )

  return {
    list: rows.map((r: any) => ({
      ...r,
      id: String(r.id),
      user_id: String(r.user_id),
      device_id: r.device_id ? String(r.device_id) : null,
      background_id: r.background_id ? String(r.background_id) : null,
      model_id: r.model_id ? String(r.model_id) : null,
    })),
    total: Number(total),
    page,
    limit,
  }
})
