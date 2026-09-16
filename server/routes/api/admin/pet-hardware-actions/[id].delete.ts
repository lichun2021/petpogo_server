// DELETE /api/admin/pet-hardware-actions/[id] — 软删除硬件动作码
// 删除后，硬件用该状态码上报会被拒绝为未知状态码（见 openapi/pet/action/report.post.ts）
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const db = useDb()
  await db.query('UPDATE t_pet_hardware_action_type SET deleted=1, updated_at=NOW() WHERE id=?', [id])
  return { success: true }
})
