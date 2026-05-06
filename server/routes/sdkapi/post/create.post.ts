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

  // 无 MPS 时，视频上传后直接可用：用 rawVideoKey 拼出完整 CDN URL
  const resolvedVideoUrl = videoUrl
    || (rawVideoKey ? `${config.public.ossCdnBaseUrl}/${rawVideoKey}` : null)

  // status=0: 视频转码中（MPS 处理）
  // status=2: 待审核（所有新帖子默认，含 MPS 完成后的视频）
  const isProcessing = mediaType === 2 && rawVideoKey && !resolvedVideoUrl
  const status = isProcessing ? 0 : 2

  const [result]: any = await db.query(
    `INSERT INTO t_post(user_id,content,media_type,media_urls,video_url,cover_url,raw_video_key,location,longitude,latitude,visibility,status,created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
    [user.userId, content || '', mediaType || 0,
     mediaUrls ? JSON.stringify(mediaUrls) : null,
     resolvedVideoUrl, coverUrl || null, rawVideoKey || null,
     location || null, longitude || null, latitude || null,
     visibility ?? 1, status]
  )
  const id = result.insertId

  // 审核通过（status=1）后由管理员操作推入 Feed，新帖子不直接入 Feed

  return { id: String(id), status }  // id 现在是小整数，无精度问题
})
