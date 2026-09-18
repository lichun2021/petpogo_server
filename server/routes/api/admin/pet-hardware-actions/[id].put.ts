import { resolveGlbActionId } from '../../../../utils/petResourceReference.ts'

// PUT /api/admin/pet-hardware-actions/[id] — 编辑硬件动作码（显示信息 + GLB映射，标识码创建后不可改）
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const { name, icon_url, glb_action_id, enabled } = await readBody(event)
  if (!name?.trim()) throw createError({ statusCode: 400, message: '名称不能为空' })

  const db = useDb()
  const [[row]]: any = await db.query('SELECT id FROM t_pet_hardware_action_type WHERE id=? AND deleted=0 LIMIT 1', [id])
  if (!row) throw createError({ statusCode: 404, message: '硬件动作码不存在' })

  const glbActionId = await resolveGlbActionId(glb_action_id)

  await db.query(
    'UPDATE t_pet_hardware_action_type SET name=?, icon_url=?, glb_action_id=?, enabled=?, updated_at=NOW() WHERE id=?',
    [name.trim(), icon_url || null, glbActionId, enabled === 0 ? 0 : 1, id]
  )
  return { success: true }
})
