// 获取帖子评论列表
export default defineEventHandler(async (event) => {
  const postId = getRouterParam(event, 'id')!
  const { page = 1, size = 20 } = getQuery(event)
  const db = useDb()
  const offset = (Number(page) - 1) * Number(size)

  const [comments]: any = await db.query(
    `SELECT c.id, c.content, c.like_count, c.parent_id, c.reply_to_id, c.created_at,
            u.id as user_id, u.nickname, u.avatar
     FROM t_post_comment c JOIN t_user u ON c.user_id=u.id
     WHERE c.post_id=? AND c.parent_id=0 AND c.deleted=0
     ORDER BY c.created_at ASC LIMIT ? OFFSET ?`,
    [postId, Number(size), offset]
  )
  return comments.map((c: any) => ({ ...c, id: String(c.id), user_id: String(c.user_id) }))
})
