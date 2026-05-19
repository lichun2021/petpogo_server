// PUT /api/admin/music/[id] — 编辑音乐
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const {
    category_id,
    pet_type,
    name,
    icon_url,
    music_url,
    duration,
    sort_order,
    status,
  } = await readBody(event)

  const db = useDb()

  // 校验音乐存在
  const [[row]]: any = await db.query(
    'SELECT id FROM t_music WHERE id=? LIMIT 1', [id]
  )
  if (!row) throw createError({ statusCode: 404, message: '音乐不存在' })

  // 必填校验
  if (!category_id)       throw createError({ statusCode: 400, message: '请选择分类' })
  if (!name?.trim())      throw createError({ statusCode: 400, message: '音乐名称不能为空' })
  if (!icon_url?.trim())  throw createError({ statusCode: 400, message: '封面图不能为空' })
  if (!music_url?.trim()) throw createError({ statusCode: 400, message: '音频文件不能为空' })

  const validTypes = ['all', 'cat', 'dog']
  if (pet_type && !validTypes.includes(pet_type)) {
    throw createError({ statusCode: 400, message: '宠物类型无效' })
  }

  // 校验分类存在
  const [[cat]]: any = await db.query(
    'SELECT id FROM t_music_category WHERE id=? LIMIT 1', [category_id]
  )
  if (!cat) throw createError({ statusCode: 400, message: '分类不存在' })

  const statusVal = status === 0 || status === 1 ? status : 1

  await db.query(
    `UPDATE t_music
        SET category_id=?, pet_type=?, name=?, icon_url=?, music_url=?,
            duration=?, sort_order=?, status=?
      WHERE id=?`,
    [
      category_id,
      pet_type || 'all',
      name.trim(),
      icon_url.trim(),
      music_url.trim(),
      Number(duration) || 0,
      Number(sort_order) || 0,
      statusVal,
      id,
    ]
  )

  return { success: true }
})
