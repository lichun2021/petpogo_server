// DELETE /sdkapi/capture/:id — 软删除抓拍记录（status = 0）
// 只能删除自己的记录

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id   = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) throw createError({ statusCode: 400, message: 'id 无效' })

  const db = useDb()
  const [result]: any = await db.query(
    `UPDATE t_capture_event SET status = 0 WHERE id = ? AND user_id = ? AND status = 1`,
    [id, user.userId]
  )

  if (result.affectedRows === 0) throw createError({ statusCode: 404, message: '记录不存在或已删除' })
  return { success: true }
})
