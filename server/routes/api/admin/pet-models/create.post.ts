// POST /api/admin/pet-models — 新建形象（GLB模型）资源
export default defineEventHandler(async (event) => {
  const { name, glb_url, thumbnail_url } = await readBody(event)
  if (!name?.trim()) throw createError({ statusCode: 400, message: '名称不能为空' })
  if (!glb_url?.trim()) throw createError({ statusCode: 400, message: 'GLB 文件不能为空' })

  const db = useDb()
  const id = generateId()
  await db.query(
    'INSERT INTO t_pet_model (id, name, glb_url, thumbnail_url, enabled, created_at) VALUES (?, ?, ?, ?, 1, NOW())',
    [id, name.trim(), glb_url.trim(), thumbnail_url || null]
  )
  return { id: String(id), success: true }
})
