// POST /sdkapi/post/feed/friends — 好友动态流（分页，按时间倒序，可按分类筛选）
//
// 为什么用 POST 而非 GET：好友 id 列表（最多 100 个）放 body 传，GET 的 URL 放不下。
// 发现流保持 GET /sdkapi/post/feed 不动，好友流单独用 POST。
//
// Body:
//   friendIds string[]  好友 user_id 数组（含调用者自己），最多 100 个，空数组合法
//   page      int        页码，默认 1
//   size      int        每页条数，默认 20，上限 50
//   tag       string?    分类筛选 cat/dog/other，其余或不传=全部
//
// 响应结构与 GET /sdkapi/post/feed 完全一致，前端可复用同一套解析。

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const body = (await readBody(event)) || {}

  const page = Math.max(1, Number(body.page) || 1)
  const size = Math.min(50, Math.max(1, Number(body.size) || 20))
  const offset = (page - 1) * size

  // 好友 id：转字符串、去空、只留纯数字、去重、上限 100
  const rawIds = Array.isArray(body.friendIds) ? body.friendIds : []
  const friendIds = Array.from(new Set(
    rawIds.map((v: any) => String(v ?? '').trim()).filter((v: string) => /^\d+$/.test(v))
  )).slice(0, 100)

  // 好友列表为空 → 直接返回空流，不查库
  if (friendIds.length === 0) {
    return { list: [], page, size }
  }

  // 可选分类筛选：tag 只认 cat/dog/other，其余忽略（返回全部）
  const rawTag = String(body.tag ?? '').trim().toLowerCase()
  const filterTag = (rawTag === 'cat' || rawTag === 'dog' || rawTag === 'other') ? rawTag : null

  const db = useDb()
  const redis = useRedis()

  const placeholders = friendIds.map(() => '?').join(',')
  const conditions = [`p.user_id IN (${placeholders})`, 'p.deleted=0', 'p.status=1', 'p.visibility=1']
  const params: any[] = [...friendIds]
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
    [...params, size, offset]
  )

  // 从 Redis 取实时点赞/浏览计数（与 GET feed 一致）
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

  return { list: result, page, size }
})
