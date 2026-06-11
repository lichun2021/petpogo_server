// GET /api/admin/sound/preset/list — 后台：预设声音列表
// 查询参数: emotion / status / page / pageSize

export default defineEventHandler(async (event) => {
  const query    = getQuery(event)
  const emotion  = query.emotion  ? String(query.emotion).trim()  : null
  const petType   = query.petType  ? String(query.petType).trim()  : null
  const status    = query.status   !== undefined ? Number(query.status) : null
  const page     = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20))
  const offset   = (page - 1) * pageSize

  const db = useDb()
  const conditions: string[] = []
  const params: any[] = []

  if (emotion) { conditions.push('emotion = ?'); params.push(emotion) }
  if (petType)  { conditions.push('pet_type = ?'); params.push(petType) }
  if (status !== null) { conditions.push('status = ?'); params.push(status) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const [[{ total }]]: any = await db.query(
    `SELECT COUNT(*) AS total FROM t_sound_preset ${where}`, params
  )
  const [rows]: any = await db.query(
    `SELECT id, emotion, pet_type, name, url, sort_order, status, created_at, updated_at
     FROM t_sound_preset ${where} ORDER BY pet_type, emotion, sort_order ASC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  return { total: Number(total), page, pageSize, list: rows }
})
