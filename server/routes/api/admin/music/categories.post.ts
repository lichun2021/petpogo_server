export default defineEventHandler(async (event) => {
  const { name, icon_url = '', sort_order = 0 } = await readBody(event)

  if (!name?.trim()) throw createError({ statusCode: 400, message: '分类名称不能为空' })

  const db = useDb()
  const [exists]: any = await db.query(
    'SELECT id FROM t_music_category WHERE name=? LIMIT 1', [name.trim()]
  )
  if (exists[0]) throw createError({ statusCode: 400, message: '分类名称已存在' })

  const [result]: any = await db.query(
    'INSERT INTO t_music_category (name, icon_url, sort_order) VALUES (?, ?, ?)',
    [name.trim(), icon_url, Number(sort_order)]
  )
  return { id: result.insertId, success: true }
})
