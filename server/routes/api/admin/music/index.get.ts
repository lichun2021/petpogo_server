// GET /api/admin/music — 查询音乐列表（可按分类/宠物类型筛选）
export default defineEventHandler(async (event) => {
  const query      = getQuery(event)
  const categoryId = query.categoryId ? Number(query.categoryId) : null
  const petType    = (query.petType as string) || ''

  const db = useDb()
  const conditions: string[] = []
  const params: any[] = []

  if (categoryId) { conditions.push('m.category_id = ?'); params.push(categoryId) }
  if (petType)    { conditions.push('m.pet_type = ?');    params.push(petType) }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

  const sql = `
    SELECT m.id, m.category_id, c.name AS category_name, m.pet_type,
           m.name, m.icon_url, m.music_url, m.duration, m.sort_order, m.status, m.created_at
    FROM t_music m
    LEFT JOIN t_music_category c ON c.id = m.category_id
    ${where}
    ORDER BY m.category_id ASC, m.sort_order ASC, m.id ASC
  `
  const [rows]: any = await db.query(sql, params)
  return { list: rows }
})
