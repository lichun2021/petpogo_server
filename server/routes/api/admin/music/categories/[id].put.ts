// PUT /api/admin/music/categories/[id] — 编辑分类
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: '分类ID无效' })

  const { name, icon_url = '', sort_order = 0 } = await readBody(event)
  if (!name?.trim()) throw createError({ statusCode: 400, message: '分类名称不能为空' })

  const db = useDb()

  // 校验分类存在
  const [[cat]]: any = await db.query(
    'SELECT id FROM t_music_category WHERE id=? LIMIT 1', [id]
  )
  if (!cat) throw createError({ statusCode: 404, message: '分类不存在' })

  // 检查重名(排除自己)
  const [dup]: any = await db.query(
    'SELECT id FROM t_music_category WHERE name=? AND id<>? LIMIT 1',
    [name.trim(), id]
  )
  if (dup[0]) throw createError({ statusCode: 400, message: '分类名称已存在' })

  await db.query(
    'UPDATE t_music_category SET name=?, icon_url=?, sort_order=? WHERE id=?',
    [name.trim(), icon_url, Number(sort_order) || 0, id]
  )

  return { success: true }
})
