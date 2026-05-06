// DELETE /api/admin/comments/[id]  删除评论（软删除）
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const db = useDb()

  // 软删除评论，同时减少帖子 comment_count
  const [[comment]]: any = await db.query(
    'SELECT post_id, deleted FROM t_post_comment WHERE id = ?', [id]
  )
  if (!comment) throw createError({ statusCode: 404, message: '评论不存在' })
  if (comment.deleted) return { success: true }  // 已删除

  await db.query('UPDATE t_post_comment SET deleted=1 WHERE id=?', [id])
  await db.query(
    'UPDATE t_post SET comment_count = GREATEST(0, comment_count - 1) WHERE id = ?',
    [comment.post_id]
  )

  return { success: true }
})
