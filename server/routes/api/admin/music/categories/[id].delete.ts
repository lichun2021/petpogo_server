// DELETE /api/admin/music/categories/[id]
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: '分类ID无效' })

  const db = useDb()

  // 检查分类下是否还有音乐
  const [musicRows]: any = await db.query(
    'SELECT COUNT(*) AS cnt FROM t_music WHERE category_id=?', [id]
  )
  if (musicRows[0].cnt > 0) {
    throw createError({ statusCode: 400, message: '请先删除该分类下的所有音乐' })
  }

  await db.query('DELETE FROM t_music_category WHERE id=?', [id])
  return { success: true }
})
