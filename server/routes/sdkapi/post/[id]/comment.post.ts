// 发表评论
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const postId = getRouterParam(event, 'id')!
  const { content, parentId, replyToId } = await readBody(event)
  if (!content?.trim()) throw createError({ statusCode: 400, message: '评论内容不能为空' })

  const db = useDb()
  const redis = useRedis()

  const [result]: any = await db.query(
    'INSERT INTO t_post_comment(post_id,user_id,parent_id,reply_to_id,content,created_at) VALUES(?,?,?,?,?,NOW())',
    [postId, user.userId, parentId || 0, replyToId || null, content]
  )
  const id = result.insertId
  await redis.incr(RedisKey.postComments(postId))
  await db.query('UPDATE t_post SET comment_count=comment_count+1 WHERE id=?', [postId])

  // 通知帖主：带帖子内容摘要 + 评论者昵称，从 administrator 系统账号发送（不混入私聊）
  Promise.all([
    db.query('SELECT user_id, content AS postContent FROM t_post WHERE id=?', [postId]),
    db.query('SELECT nickname FROM t_user WHERE id=?', [user.userId]),
  ]).then(([[[post]], [[commenter]]]: any) => {
    if (post && String(post.user_id) !== user.userId) {
      const fromName    = commenter?.nickname || '有人'
      const postContent = String(post.postContent || '').slice(0, 20)
      imSendMsg({
        toUserId: String(post.user_id),
        // 不传 fromUserId → 默认从 administrator 发送（系统通知，不进私聊列表）
        msgType:  'TIMCustomElem',
        content:  {
          type:        IM_MSG_TYPE.POST_COMMENT,
          postId,
          commentId:   String(id),
          fromUserId:  user.userId,
          fromName,
          postContent,          // 帖子内容摘要（最多20字）
          commentText: content, // 评论内容（完整，供前端展示）
        },
      }).catch(() => {})
    }
  }).catch(() => {})

  return { id: String(id), content }
})
