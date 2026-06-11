// DELETE /api/admin/sound/emotion/:id
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'id 无效' })
  const db = useDb()
  const [result]: any = await db.query('DELETE FROM t_sound_emotion WHERE id = ?', [id])
  if (result.affectedRows === 0) throw createError({ statusCode: 404, message: '记录不存在' })
  return { success: true }
})
