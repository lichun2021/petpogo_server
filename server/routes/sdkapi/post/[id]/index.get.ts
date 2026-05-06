// GET /sdkapi/post/:id — 帖子详情（全屏查看器 / 分享链接必需）
export default defineEventHandler(async (event) => {
  // 详情页允许未登录访问（公开帖），登录用户额外返回 is_liked
  let userId: string | null = null
  try {
    const user = await requireAuth(event)
    userId = user.userId
  } catch {
    // 未登录继续，不报错
  }

  const postId = getRouterParam(event, 'id')!
  const db = useDb()
  const redis = useRedis()

  // 查帖子主体（JOIN 作者信息）
  const [[post]]: any = await db.query(
    `SELECT p.id, p.content, p.media_type, p.media_urls,
            p.video_url, p.cover_url, p.duration,
            p.location, p.longitude, p.latitude,
            p.like_count, p.comment_count, p.view_count,
            p.visibility, p.status, p.created_at,
            u.id as user_id, u.nickname, u.avatar as user_avatar
     FROM t_post p JOIN t_user u ON p.user_id = u.id
     WHERE p.id = ? AND p.deleted = 0`,
    [postId]
  )

  if (!post) throw createError({ statusCode: 404, message: '帖子不存在' })
  if (post.visibility !== 1 && String(post.user_id) !== userId) {
    throw createError({ statusCode: 403, message: '无权查看此帖子' })
  }

  // 从 Redis 取实时计数
  const [likes, views, comments] = await Promise.all([
    redis.get(RedisKey.postLikes(postId)),
    redis.get(RedisKey.postViews(postId)),
    redis.get(RedisKey.postComments(postId)),
  ])

  // 浏览量 +1（Redis 异步，不阻塞响应）
  redis.incr(RedisKey.postViews(postId)).catch(() => {})

  // 查当前用户是否已点赞
  let isLiked = false
  if (userId) {
    const [[likeRow]]: any = await db.query(
      'SELECT id FROM t_like WHERE user_id=? AND target_id=? AND target_type=1 LIMIT 1',
      [userId, postId]
    )
    isLiked = !!likeRow
  }

  return {
    ...post,
    id:            String(post.id),
    user_id:       String(post.user_id),
    media_urls:    post.media_urls ? JSON.parse(post.media_urls) : [],
    like_count:    likes    ? Number(likes)    : post.like_count,
    view_count:    views    ? Number(views)    : post.view_count,
    comment_count: comments ? Number(comments) : post.comment_count,
    is_liked:      isLiked,
  }
})
