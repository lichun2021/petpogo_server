// POST /api/admin/music — 上传新音乐
export default defineEventHandler(async (event) => {
  const {
    category_id,
    pet_type   = 'all',   // all | cat | dog
    name,
    icon_url,
    music_url,
    duration   = 0,
    sort_order = 0,
  } = await readBody(event)

  // 必填校验
  if (!category_id)       throw createError({ statusCode: 400, message: '请选择分类' })
  if (!name?.trim())      throw createError({ statusCode: 400, message: '音乐名称不能为空' })
  if (!icon_url?.trim())  throw createError({ statusCode: 400, message: '封面图不能为空' })
  if (!music_url?.trim()) throw createError({ statusCode: 400, message: '音频文件不能为空' })

  const validTypes = ['all', 'cat', 'dog']
  if (!validTypes.includes(pet_type)) throw createError({ statusCode: 400, message: '宠物类型无效' })

  const db = useDb()

  const [catRows]: any = await db.query(
    'SELECT id FROM t_music_category WHERE id=? LIMIT 1', [category_id]
  )
  if (!catRows[0]) throw createError({ statusCode: 400, message: '分类不存在' })

  const [result]: any = await db.query(
    `INSERT INTO t_music (category_id, pet_type, name, icon_url, music_url, duration, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [category_id, pet_type, name.trim(), icon_url.trim(), music_url.trim(), Number(duration), Number(sort_order)]
  )
  return { id: Number(result.insertId), success: true }
})
