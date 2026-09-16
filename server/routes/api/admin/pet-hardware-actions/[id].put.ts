// PUT /api/admin/pet-hardware-actions/[id] — 编辑硬件动作码（显示信息 + GLB映射，标识码创建后不可改）
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const { name, icon_url, glb_action_id, enabled } = await readBody(event)
  if (!name?.trim()) throw createError({ statusCode: 400, message: '名称不能为空' })

  const db = useDb()
  const [[row]]: any = await db.query('SELECT id FROM t_pet_hardware_action_type WHERE id=? AND deleted=0 LIMIT 1', [id])
  if (!row) throw createError({ statusCode: 404, message: '硬件动作码不存在' })

  if (glb_action_id) {
    const [[ga]]: any = await db.query('SELECT id FROM t_pet_glb_action WHERE id=? AND deleted=0 LIMIT 1', [glb_action_id])
    if (!ga) throw createError({ statusCode: 400, message: '引用的 GLB 动作资源不存在' })
  }

  await db.query(
    'UPDATE t_pet_hardware_action_type SET name=?, icon_url=?, glb_action_id=?, enabled=?, updated_at=NOW() WHERE id=?',
    [name.trim(), icon_url || null, glb_action_id || null, enabled === 0 ? 0 : 1, id]
  )
  return { success: true }
})
