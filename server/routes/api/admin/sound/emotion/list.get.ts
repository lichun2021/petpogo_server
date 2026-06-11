// GET /api/admin/sound/emotion/list?petType=cat|dog
export default defineEventHandler(async (event) => {
  const query   = getQuery(event)
  const petType = query.petType ? String(query.petType).trim() : null
  const db = useDb()
  const conditions = petType ? ['pet_type = ?'] : []
  const params = petType ? [petType] : []
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const [rows]: any = await db.query(
    `SELECT id, pet_type, value, label, emoji, color, active_bg, text_color, sort_order, url, status
     FROM t_sound_emotion ${where} ORDER BY pet_type, sort_order ASC, id ASC`,
    params
  )
  return { list: rows }
})
