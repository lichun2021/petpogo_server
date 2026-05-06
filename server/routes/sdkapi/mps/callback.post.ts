// 阿里云 MPS 视频转码回调
// 支持三种格式：
//   A) 工作流回调 (MediaWorkflowExecution)
//   B) 单任务回调 (JobId + State + Output)
//   C) MNS 消息体 (Message.content base64)
export default defineEventHandler(async (event) => {
  const raw = await readBody(event)
  console.log('[MPS Raw Callback]', JSON.stringify(raw))

  // ── C: MNS 消息体解包（base64 content）────────────────
  let body = raw
  if (raw?.Message?.content) {
    try {
      body = JSON.parse(Buffer.from(raw.Message.content, 'base64').toString('utf-8'))
    } catch { /* 解析失败则用原始 body */ }
  }

  // ── D: EventBridge / Data 包裹格式 ────────────────────
  // 格式: { "Data": "{...}" } 或 { "Data": { ... } }
  if (body?.Data !== undefined) {
    try {
      body = typeof body.Data === 'string' ? JSON.parse(body.Data) : body.Data
    } catch { /* 解析失败则用原始 body */ }
  }

  const db     = useDb()
  const config = useRuntimeConfig()
  const base   = config.public.ossCdnBaseUrl

  // ── A: 工作流回调格式 ──────────────────────────────────
  if (body?.MediaWorkflowExecution) {
    const exec       = body.MediaWorkflowExecution
    const execState  = exec.State  // Finished / Failed
    const activities: any[] = exec.ActivityList || []

    const transcodeAct = activities.find((a: any) => a.Type === 'Transcode' && a.State === 'Success')
    const snapshotAct  = activities.find((a: any) =>
      (a.Type === 'Snapshot' || a.Type === 'Cover') && a.State === 'Success')

    const inputKey  = exec.Input?.Object
    const outputKey = transcodeAct?.JobResult?.TranscodeJob?.Output?.OutputObject
    const coverKey  = snapshotAct?.JobResult?.SnapshotJob?.SnapshotConfig?.OutputFile?.Object
                   || snapshotAct?.JobResult?.CoverJob?.Output?.OutputFile?.Object

    console.log('[MPS 工作流]', { execState, inputKey, outputKey, coverKey })
    if (!inputKey) return { success: true }

    if (execState === 'Finished') {
      await _onSuccess(db, config, inputKey, outputKey, coverKey)
    } else if (execState === 'Failed') {
      await db.query('UPDATE t_post SET status=3 WHERE raw_video_key=? AND deleted=0', [inputKey])
      console.error(`[MPS] ❌ 工作流转码失败: ${inputKey}`)
    }
    return { success: true }
  }

  // ── B: 单任务回调格式 ──────────────────────────────────
  const state     = body.State     || body.state
  const outputKey = body.Output?.OutputObject   || body.output?.outputObject
  const coverKey  = body.Output?.SnapshotObject || body.output?.snapshotObject
  const inputKey  = body.Input?.Object          || body.input?.object

  console.log('[MPS 单任务]', { state, inputKey, outputKey, coverKey })
  if (!inputKey) return { success: true }

  if (state === 'TranscodeSuccess' || state === 'success') {
    await _onSuccess(db, config, inputKey, outputKey, coverKey)
  } else if (state === 'TranscodeFail' || state === 'fail') {
    await db.query('UPDATE t_post SET status=3 WHERE raw_video_key=? AND deleted=0', [inputKey])
    console.error(`[MPS] ❌ 单任务转码失败: ${inputKey}`)
  }

  return { success: true }
})

// ── 转码成功：写库 + 推 Feed ──────────────────────────────
async function _onSuccess(
  db: any, config: any,
  inputKey: string, outputKey?: string, coverKey?: string
) {
  const base = config.public.ossCdnBaseUrl
  const videoUrl = outputKey ? `${base}/${outputKey}` : `${base}/${inputKey}`
  const coverUrl = coverKey  ? `${base}/${coverKey}`  : null

  await db.query(
    `UPDATE t_post SET video_url=?, cover_url=?, status=1 WHERE raw_video_key=? AND deleted=0`,
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

  console.log(`[MPS] ✅ 转码完成: ${inputKey} → video=${videoUrl} cover=${coverUrl}`)
}
