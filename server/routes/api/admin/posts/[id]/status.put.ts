export default defineEventHandler(async (event) => {
  const postId = getRouterParam(event, 'id')
  const { status, reject_reason } = await readBody(event)
  const db = useDb()

  if (reject_reason) {
    await db.query('UPDATE t_post SET status=?, reject_reason=? WHERE id=?', [status, reject_reason, postId])
  } else {
    await db.query('UPDATE t_post SET status=? WHERE id=?', [status, postId])
  }

  const redis = useRedis()
  if (status === 1) {
    // 审核通过 → 推入 Feed
    await redis.zadd(RedisKey.feedHot(), Date.now(), String(postId))
  } else if (status === 3) {
    // 违规 → 移除 Feed
    await redis.zrem(RedisKey.feedHot(), String(postId))
  }

  return { success: true }
})
