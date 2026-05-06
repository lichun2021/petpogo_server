// 帖子信息流（分页，按时间倒序）
export default defineEventHandler(async (event) => {
  const { page = 1, size = 20 } = getQuery(event)
  const db = useDb()
  const redis = useRedis()
  const offset = (Number(page) - 1) * Number(size)

  const [posts]: any = await db.query(
    `SELECT p.id, p.content, p.media_type, p.media_urls, p.video_url, p.cover_url,
            p.duration, p.location, p.like_count, p.comment_count, p.view_count, p.created_at,
            u.id as user_id, u.nickname, u.avatar as user_avatar
     FROM t_post p JOIN t_user u ON p.user_id=u.id
     WHERE p.deleted=0 AND p.status=1 AND p.visibility=1
     ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [Number(size), offset]
  )

  // 从 Redis 取实时点赞/浏览计数
  const result = await Promise.all(posts.map(async (p: any) => {
    const [likes, views] = await Promise.all([
      redis.get(RedisKey.postLikes(String(p.id))),
      redis.get(RedisKey.postViews(String(p.id))),
    ])
    return {
      ...p,
      id:         String(p.id),
      user_id:    String(p.user_id),
      media_urls: p.media_urls ? JSON.parse(p.media_urls) : [],
      like_count: likes  ? Number(likes)  : p.like_count,
      view_count: views  ? Number(views)  : p.view_count,
    }
  }))

  return { list: result, page: Number(page), size: Number(size) }
})
