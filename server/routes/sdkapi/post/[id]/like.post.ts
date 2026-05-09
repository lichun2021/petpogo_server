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
    await db.query('INSERT INTO t_like(user_id,target_id,target_type,created_at) VALUES(?,?,1,NOW())', [user.userId, postId])
    await redis.incr(RedisKey.postLikes(postId))
    await db.query('UPDATE t_post SET like_count=like_count+1 WHERE id=?', [postId])

    // 通知帖子作者（异步，不阻塞）
    // 同时查帖子作者 + 点赞者昵称，把 fromName 带入通知，前端能直接展示 "XXX 点赞了你的帖子"
    Promise.all([
      db.query('SELECT user_id FROM t_post WHERE id=?', [postId]),
      db.query('SELECT nickname FROM t_user WHERE id=?', [user.userId]),
    ]).then(([[[post]], [[liker]]]: any) => {
      if (post && String(post.user_id) !== user.userId) {
        const fromName = liker?.nickname || '有人'
        imSendMsg({
          toUserId:  String(post.user_id),
          fromUserId: user.userId,               // 以点赞者身份发送，避免会话显示 administrator
          msgType:  'TIMCustomElem',
          content:  {
            type:       IM_MSG_TYPE.POST_LIKE,
            postId,
            fromUserId: user.userId,
            fromName,                            // ← 新增：点赞者昵称，前端直接用
          },
        }).catch(() => {})
      }
    }).catch(() => {})
    return { liked: true }
  }
})
