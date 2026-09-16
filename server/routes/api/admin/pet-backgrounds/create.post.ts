// POST /api/admin/pet-backgrounds — 新建背景资源
export default defineEventHandler(async (event) => {
  const { name, image_url } = await readBody(event)
  if (!name?.trim()) throw createError({ statusCode: 400, message: '名称不能为空' })
  if (!image_url?.trim()) throw createError({ statusCode: 400, message: '背景图不能为空' })

  const db = useDb()
  const id = generateId()
  await db.query(
    'INSERT INTO t_pet_background (id, name, image_url, enabled, created_at) VALUES (?, ?, ?, 1, NOW())',
    [id, name.trim(), image_url.trim()]
  )
  return { id: String(id), success: true }
})
