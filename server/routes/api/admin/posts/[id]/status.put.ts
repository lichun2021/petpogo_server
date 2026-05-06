export default defineEventHandler(async (event) => {
  const postId = getRouterParam(event, 'id')
  const { status } = await readBody(event)
  const db = useDb()
  await db.query('UPDATE t_post SET status=? WHERE id=?', [status, postId])

  // 违规帖子从 Redis Feed 移除
  if (status === 3) {
    const redis = useRedis()
    await redis.zrem(RedisKey.feedHot(), String(postId))
  }
  return { success: true }
})
