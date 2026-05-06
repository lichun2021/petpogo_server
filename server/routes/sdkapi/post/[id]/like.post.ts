// 点赞 / 取消点赞帖子
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const postId = getRouterParam(event, 'id')!
  const db = useDb()
  const redis = useRedis()

  const [[exist]]: any = await db.query(
    'SELECT id FROM t_like WHERE user_id=? AND target_id=? AND target_type=1',
    [user.userId, postId]
  )

  if (exist) {
    // 取消点赞
    await db.query('DELETE FROM t_like WHERE user_id=? AND target_id=? AND target_type=1', [user.userId, postId])
    await redis.decr(RedisKey.postLikes(postId))
    await db.query('UPDATE t_post SET like_count=GREATEST(like_count-1,0) WHERE id=?', [postId])
    return { liked: false }
  } else {
    // 点赞
    const id = generateId()
    await db.query('INSERT INTO t_like(id,user_id,target_id,target_type,created_at) VALUES(?,?,?,1,NOW())', [id, user.userId, postId])
    await redis.incr(RedisKey.postLikes(postId))
    await db.query('UPDATE t_post SET like_count=like_count+1 WHERE id=?', [postId])

    // 通知帖子作者（异步，不阻塞）
    db.query('SELECT user_id FROM t_post WHERE id=?', [postId]).then(([[post]]: any) => {
      if (post && String(post.user_id) !== user.userId) {
        imSendMsg({
          toUserId: String(post.user_id),
          msgType: 'TIMCustomElem',
          content: { type: IM_MSG_TYPE.POST_LIKE, postId, fromUserId: user.userId },
        }).catch(() => {})
      }
    })
    return { liked: true }
  }
})
