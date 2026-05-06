// PUT /api/admin/posts/[id]/status
export default defineEventHandler(async (event) => {
  const id     = getRouterParam(event, 'id')
  const { status } = await readBody(event)
  if (![1, 2, 3].includes(Number(status))) {
    throw createError({ statusCode: 400, message: '无效状态值' })
  }
  const db = useDb()
  await db.query('UPDATE t_post SET status=? WHERE id=? AND deleted=0', [status, id])

  // 若通过则推入 Redis Feed，若违规则从 Feed 移除
  const redis = useRedis()
  if (Number(status) === 1) {
    const [[post]]: any = await db.query(
      'SELECT id, visibility FROM t_post WHERE id=? AND deleted=0 LIMIT 1', [id]
    )
    if (post?.visibility === 1) {
      await redis.zadd(RedisKey.feedHot(), Date.now(), String(post.id))
      await redis.zremrangebyrank(RedisKey.feedHot(), 0, -1001)
    }
  } else if (Number(status) === 3) {
    await redis.zrem(RedisKey.feedHot(), String(id))
  }

  return { success: true }
})
