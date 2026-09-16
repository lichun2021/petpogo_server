// PUT /api/admin/pet-models/[id] — 编辑形象（GLB模型）资源
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const { name, glb_url, thumbnail_url, enabled } = await readBody(event)
  if (!name?.trim()) throw createError({ statusCode: 400, message: '名称不能为空' })
  if (!glb_url?.trim()) throw createError({ statusCode: 400, message: 'GLB 文件不能为空' })

  const db = useDb()
  const [[row]]: any = await db.query('SELECT id FROM t_pet_model WHERE id=? AND deleted=0 LIMIT 1', [id])
  if (!row) throw createError({ statusCode: 404, message: '形象资源不存在' })

  await db.query(
    'UPDATE t_pet_model SET name=?, glb_url=?, thumbnail_url=?, enabled=?, updated_at=NOW() WHERE id=?',
    [name.trim(), glb_url.trim(), thumbnail_url || null, enabled === 0 ? 0 : 1, id]
  )
  return { success: true }
})
