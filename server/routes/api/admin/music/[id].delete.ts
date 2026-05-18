// DELETE /api/admin/music/[id] — 删除音乐
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'ID 无效' })

  const db = useDb()
  await db.query('DELETE FROM t_music WHERE id=?', [id])
  return { success: true }
})
