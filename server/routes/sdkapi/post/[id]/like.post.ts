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

    // 取消点赞也通知（显示"取消了点赞"）
    Promise.all([
      db.query('SELECT user_id, content FROM t_post WHERE id=?', [postId]),
      db.query('SELECT nickname FROM t_user WHERE id=?', [user.userId]),
    ]).then(([[[post]], [[liker]]]: any) => {
      if (post && String(post.user_id) !== user.userId) {
        const fromName    = liker?.nickname || '有人'
        const postContent = String(post.content || '').slice(0, 20)
        imSendMsg({
          toUserId: String(post.user_id),
          msgType:  'TIMCustomElem',
          content:  {
            type:        IM_MSG_TYPE.POST_LIKE,
            action:      'unlike',           // 区分点赞/取消
            postId,
            fromUserId:  user.userId,
            fromName,
            postContent,                     // 帖子内容摘要（最多20字）
          },
        }).catch(() => {})
      }
    }).catch(() => {})
    return { liked: false }
  } else {
    // 点赞
    await db.query('INSERT INTO t_like(user_id,target_id,target_type,created_at) VALUES(?,?,1,NOW())', [user.userId, postId])
    await redis.incr(RedisKey.postLikes(postId))
    await db.query('UPDATE t_post SET like_count=like_count+1 WHERE id=?', [postId])

    // 通知帖子作者：带帖子内容摘要 + 点赞者昵称，从 administrator 系统账号发送（不混入私聊）
    Promise.all([
      db.query('SELECT user_id, content FROM t_post WHERE id=?', [postId]),
      db.query('SELECT nickname FROM t_user WHERE id=?', [user.userId]),
    ]).then(([[[post]], [[liker]]]: any) => {
      if (post && String(post.user_id) !== user.userId) {
        const fromName    = liker?.nickname || '有人'
        const postContent = String(post.content || '').slice(0, 20)
        imSendMsg({
          toUserId: String(post.user_id),
          // 不传 fromUserId → 默认从 administrator 发送（系统通知，不进私聊列表）
          msgType:  'TIMCustomElem',
          content:  {
            type:        IM_MSG_TYPE.POST_LIKE,
            action:      'like',
            postId,
            fromUserId:  user.userId,
            fromName,
            postContent,                     // 帖子内容摘要（最多20字）
          },
        }).catch(() => {})
      }
    }).catch(() => {})
    return { liked: true }
  }
})
