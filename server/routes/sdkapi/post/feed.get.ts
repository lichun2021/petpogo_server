// 帖子信息流（分页，按时间倒序，可按分类 cat/dog 筛选）
export default defineEventHandler(async (event) => {
  const { page = 1, size = 20, category, tag } = getQuery(event)
  const db = useDb()
  const redis = useRedis()
  const offset = (Number(page) - 1) * Number(size)

  // 可选分类筛选：category（兼容 tag），只认 cat/dog，其余忽略（返回全部）
  const rawTag = String(category ?? tag ?? '').trim().toLowerCase()
  const filterTag = (rawTag === 'cat' || rawTag === 'dog' || rawTag === 'other') ? rawTag : null

  const conditions = ['p.deleted=0', 'p.status=1', 'p.visibility=1']
  const params: any[] = []
  if (filterTag) { conditions.push('p.tag=?'); params.push(filterTag) }
  const where = conditions.join(' AND ')

  const [posts]: any = await db.query(
    `SELECT p.id, p.content, p.media_type, p.media_urls, p.video_url, p.cover_url,
            p.duration, p.location, p.tag, p.like_count, p.comment_count, p.view_count, p.created_at,
            p.user_id,
            COALESCE(u.nickname, '宠友') AS nickname,
            u.avatar AS user_avatar
     FROM t_post p LEFT JOIN t_user u ON p.user_id=u.id
     WHERE ${where}
     ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(size), offset]
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
      media_urls: Array.isArray(p.media_urls)
        ? p.media_urls
        : (typeof p.media_urls === 'string' ? JSON.parse(p.media_urls) : []),
      like_count: likes  ? Number(likes)  : p.like_count,
      view_count: views  ? Number(views)  : p.view_count,
    }
  }))

  return { list: result, page: Number(page), size: Number(size) }
})
