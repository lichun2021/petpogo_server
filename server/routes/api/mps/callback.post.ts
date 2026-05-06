// 阿里云 MPS 工作流回调（走 /api 不需要签名验证）
// 回调 URL 配置为：http://115.29.196.61:3000/api/mps/callback
//
// 阿里云 MNS 实际推送格式：
// {
//   "TopicOwner": "...",
//   "Message": "{\"MediaWorkflowExecution\":{...}}",  ← JSON 字符串
//   "MessageId": "...",
//   ...
// }
export default defineEventHandler(async (event) => {
  const raw = await readBody(event)
  console.log('[MPS Raw]', JSON.stringify(raw))

  // ── 1. 解包 MNS Message 字段（JSON 字符串）─────────────
  let msg: any = {}
  try {
    msg = typeof raw.Message === 'string' ? JSON.parse(raw.Message) : (raw.Message ?? raw)
  } catch {
    console.error('[MPS] Message 解析失败', raw.Message)
    return { success: true }
  }

  // ── 2. 提取 MediaWorkflowExecution ─────────────────────
  const exec = msg.MediaWorkflowExecution
  if (!exec) {
    console.log('[MPS] 非工作流回调，忽略', msg.Type)
    return { success: true }
  }

  const execState  = exec.State  // Completed / Failed
  const inputKey   = exec.Input?.InputFile?.Object   // 原始视频 key

  if (!inputKey) {
    console.warn('[MPS] 无法解析 inputKey', JSON.stringify(exec.Input))
    return { success: true }
  }

  const activities: any[] = exec.ActivityList || []

  // 找转码活动（Type=Transcode, State=Success）
  const transcodeAct = activities.find((a: any) => a.Type === 'Transcode' && a.State === 'Success')
  // 找封面活动（Type=Cover 或 Snapshot, State=Success）
  const coverAct     = activities.find((a: any) =>
    (a.Type === 'Cover' || a.Type === 'Snapshot') && a.State === 'Success')

  // 尝试从 JobResult 中拿输出 key（工作流通知中通常有）
  const outputKey = transcodeAct?.JobResult?.TranscodeJob?.Output?.OutputObject
  const coverKey  = coverAct?.JobResult?.CoverJob?.CoverOutputFile?.Object
                 || coverAct?.JobResult?.SnapshotJob?.SnapshotConfig?.OutputFile?.Object
                 || coverAct?.JobResult?.CoverOutputFile?.Object

  console.log('[MPS 解析]', {
    execState, inputKey,
    transcodeType: transcodeAct?.Name,
    outputKey,
    coverType: coverAct?.Name,
    coverKey,
  })

  const db     = useDb()
  const config = useRuntimeConfig()
  const base   = config.public.ossCdnBaseUrl

  if (execState === 'Completed') {
    // video_url：优先用转码输出，回退到原始视频（已可播放）
    const videoUrl = outputKey ? `${base}/${outputKey}` : `${base}/${inputKey}`
    const coverUrl = coverKey  ? `${base}/${coverKey}`  : null

    await db.query(
      `UPDATE t_post SET video_url=?, cover_url=?, status=1
       WHERE raw_video_key=? AND deleted=0`,
      [videoUrl, coverUrl, inputKey]
    )

    // 推入 Redis Feed（仅公开帖）
    const redis = useRedis()
    const [[post]]: any = await db.query(
      'SELECT id, visibility FROM t_post WHERE raw_video_key=? AND deleted=0 LIMIT 1',
      [inputKey]
    )
    if (post?.visibility === 1) {
      await redis.zadd(RedisKey.feedHot(), Date.now(), String(post.id))
      await redis.zremrangebyrank(RedisKey.feedHot(), 0, -1001)
    }

    console.log(`[MPS] ✅ 完成: ${inputKey} → video=${videoUrl} cover=${coverUrl}`)
  } else if (execState === 'Failed') {
    await db.query(
      'UPDATE t_post SET status=3 WHERE raw_video_key=? AND deleted=0',
      [inputKey]
    )
    console.error(`[MPS] ❌ 失败: ${inputKey}`)
  }

  return { success: true }
})
