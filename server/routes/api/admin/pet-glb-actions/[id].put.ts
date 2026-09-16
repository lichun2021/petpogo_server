// PUT /api/admin/pet-glb-actions/[id] — 编辑 GLB 动作标识（标识码创建后不可改，只能改显示名/启用状态）
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const { name, enabled } = await readBody(event)
  if (!name?.trim()) throw createError({ statusCode: 400, message: '名称不能为空' })

  const db = useDb()
  const [[row]]: any = await db.query('SELECT id FROM t_pet_glb_action WHERE id=? AND deleted=0 LIMIT 1', [id])
  if (!row) throw createError({ statusCode: 404, message: 'GLB 动作标识不存在' })

  await db.query(
    'UPDATE t_pet_glb_action SET name=?, enabled=?, updated_at=NOW() WHERE id=?',
    [name.trim(), enabled === 0 ? 0 : 1, id]
  )
  return { success: true }
})
