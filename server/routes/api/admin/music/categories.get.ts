// GET /api/admin/music/categories
export default defineEventHandler(async (event) => {
  const db = useDb()
  const [rows]: any = await db.query(
    'SELECT id, name, icon_url, sort_order, created_at FROM t_music_category ORDER BY sort_order ASC, id ASC'
  )
  return { list: rows }
})
