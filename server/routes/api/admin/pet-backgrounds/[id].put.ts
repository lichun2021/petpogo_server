// PUT /api/admin/pet-backgrounds/[id] — 编辑背景资源
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const { name, image_url, enabled } = await readBody(event)
  if (!name?.trim()) throw createError({ statusCode: 400, message: '名称不能为空' })
  if (!image_url?.trim()) throw createError({ statusCode: 400, message: '背景图不能为空' })

  const db = useDb()
  const [[row]]: any = await db.query('SELECT id FROM t_pet_background WHERE id=? AND deleted=0 LIMIT 1', [id])
  if (!row) throw createError({ statusCode: 404, message: '背景资源不存在' })

  await db.query(
    'UPDATE t_pet_background SET name=?, image_url=?, enabled=?, updated_at=NOW() WHERE id=?',
    [name.trim(), image_url.trim(), enabled === 0 ? 0 : 1, id]
  )
  return { success: true }
})
