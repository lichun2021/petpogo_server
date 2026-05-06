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

  // 通知帖主（异步）
  db.query('SELECT user_id FROM t_post WHERE id=?', [postId]).then(([[post]]: any) => {
    if (post && String(post.user_id) !== user.userId) {
      imSendMsg({
        toUserId: String(post.user_id),
        msgType: 'TIMCustomElem',
        content: { type: IM_MSG_TYPE.POST_COMMENT, postId, commentId: String(id), fromUserId: user.userId },
      }).catch(() => {})
    }
  })

  return { id: String(id), content }
})
