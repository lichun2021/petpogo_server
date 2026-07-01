// 管理工具：修复卡在 status=2 但实际有 video_url 的视频帖
// GET /api/admin/fix-video-status?dry=1  → 只看不改
// GET /api/admin/fix-video-status        → 实际修复
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)

  const { dry = '1' } = getQuery(event)
  const db = useDb()

  // 查询所有 status=2 的视频帖
  const [rows]: any = await db.query(
    `SELECT id, raw_video_key, video_url, cover_url, status
     FROM t_post WHERE media_type=2 AND deleted=0 ORDER BY created_at DESC LIMIT 50`
  )

  const config = useRuntimeConfig()
  const base   = config.public.ossCdnBaseUrl

  const toFix = rows.filter((r: any) => r.status === 2)
  const fixed: any[] = []

  for (const row of toFix) {
    // 如果 video_url 已有就直接用，否则从 raw_video_key 推断
    const videoUrl = row.video_url || (row.raw_video_key ? `${base}/${row.raw_video_key}` : null)
    if (!videoUrl) continue

    fixed.push({ id: String(row.id), videoUrl, coverUrl: row.cover_url })

    if (dry !== '1') {
      await db.query(
        `UPDATE t_post SET video_url=?, status=1 WHERE id=? AND deleted=0`,
        [videoUrl, row.id]
      )
      // 推入 Redis Feed
      const redis = useRedis()
      await redis.zadd(RedisKey.feedHot(), Date.now(), String(row.id))
      await redis.zremrangebyrank(RedisKey.feedHot(), 0, -1001)
    }
  }

  return {
    dry: dry === '1',
    totalVideoPosts: rows.length,
    stuckCount: toFix.length,
    willFix: fixed.length,
    records: rows.map((r: any) => ({
      id: String(r.id),
      status: r.status,
      hasVideoUrl: !!r.video_url,
      hasCoverUrl: !!r.cover_url,
      rawVideoKey: r.raw_video_key,
    })),
  }
})
