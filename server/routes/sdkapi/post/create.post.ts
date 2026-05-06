// 发布帖子（支持图片/视频）
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { content, mediaType, mediaUrls, videoUrl, coverUrl, rawVideoKey, location, longitude, latitude, visibility } = await readBody(event)

  if (!content && !mediaUrls?.length && !videoUrl && !rawVideoKey) {
    throw createError({ statusCode: 400, message: '内容不能为空' })
  }

  const db = useDb()
  const redis = useRedis()
  const config = useRuntimeConfig()
  const id = generateId()

  // 无 MPS 时，视频上传后直接可用：用 rawVideoKey 拼出完整 CDN URL
  const resolvedVideoUrl = videoUrl
    || (rawVideoKey ? `${config.public.ossCdnBaseUrl}/${rawVideoKey}` : null)

  // 视频已有可用 URL 就直接发布（status=1），否则占位等待转码
  const status = (mediaType === 2 && rawVideoKey && !resolvedVideoUrl) ? 2 : 1

  await db.query(
    `INSERT INTO t_post(id,user_id,content,media_type,media_urls,video_url,cover_url,raw_video_key,location,longitude,latitude,visibility,status,created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
    [id, user.userId, content || '', mediaType || 0,
     mediaUrls ? JSON.stringify(mediaUrls) : null,
     resolvedVideoUrl, coverUrl || null, rawVideoKey || null,
     location || null, longitude || null, latitude || null,
     visibility ?? 1, status]
  )

  // 写入 Redis Feed（仅公开图文帖直接入 Feed，视频等转码完成后入）
  if (status === 1 && (visibility ?? 1) === 1) {
    await redis.zadd(RedisKey.feedHot(), Date.now(), String(id))
    await redis.zremrangebyrank(RedisKey.feedHot(), 0, -1001) // 只保留最新 1000
  }

  return { id: String(id), status }
})
