// DELETE /api/admin/pet-glb-actions/[id] — 软删除 GLB 动作资源
// 即使被互动类型/硬件动作码引用也允许删除（按 spec：引用方在解析时得到"未映射"结果，而非报错）
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const db = await useDb().getConnection()
  try {
    await db.beginTransaction()
    await db.query('UPDATE t_pet_glb_action SET deleted=1, updated_at=NOW() WHERE id=?', [id])
    await db.query('UPDATE t_pet_interaction_type SET glb_action_id=NULL, updated_at=NOW() WHERE glb_action_id=?', [id])
    await db.query('UPDATE t_pet_hardware_action_type SET glb_action_id=NULL, updated_at=NOW() WHERE glb_action_id=?', [id])
    await db.commit()
  } catch (error) {
    await db.rollback()
    throw error
  } finally { db.release() }
  return { success: true }
})
