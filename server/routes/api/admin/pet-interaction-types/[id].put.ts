import { resolveGlbActionId } from '../../../../utils/petResourceReference.ts'

// PUT /api/admin/pet-interaction-types/[id] — 编辑互动类型（显示信息/GLB映射/属性效果）
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const {
    name,
    icon_url,
    glb_action_id,
    satiety_delta = 0,
    mood_delta = 0,
    cleanliness_delta = 0,
    enabled,
  } = await readBody(event)

  if (!name?.trim()) throw createError({ statusCode: 400, message: '名称不能为空' })

  const db = useDb()
  const [[row]]: any = await db.query('SELECT id FROM t_pet_interaction_type WHERE id=? AND deleted=0 LIMIT 1', [id])
  if (!row) throw createError({ statusCode: 404, message: '互动类型不存在' })

  const glbActionId = await resolveGlbActionId(glb_action_id)

  await db.query(
    `UPDATE t_pet_interaction_type
        SET name=?, icon_url=?, glb_action_id=?, satiety_delta=?, mood_delta=?, cleanliness_delta=?, enabled=?, updated_at=NOW()
      WHERE id=?`,
    [name.trim(), icon_url || null, glbActionId, Number(satiety_delta) || 0, Number(mood_delta) || 0, Number(cleanliness_delta) || 0, enabled === 0 ? 0 : 1, id]
  )
  return { success: true }
})
