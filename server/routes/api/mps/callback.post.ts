// 阿里云 MPS 工作流回调（走 /api 不需要签名验证）
// 回调 URL 配置为：http://115.29.196.61:3000/api/mps/callback
import crypto from 'node:crypto'

// ── 查询 MPS 截图/转码 Job 输出路径 ────────────────────────
async function queryMpsJobOutput(
  config: any,
  action: 'QuerySnapshotJobList' | 'QueryJobList',
  jobId: string,
): Promise<string | null> {
  const keyId     = config.aliOssKeyId
  const keySecret = config.aliOssKeySecret
  const region    = (config.aliOssRegion as string).replace('oss-', '') // oss-cn-shanghai → cn-shanghai

  const jobParam = action === 'QuerySnapshotJobList' ? 'SnapshotJobIds' : 'JobIds'
  const params: Record<string, string> = {
    Action:           action,
    Format:           'JSON',
    Version:          '2014-06-18',
    AccessKeyId:      keyId,
    SignatureMethod:  'HMAC-SHA1',
    SignatureVersion: '1.0',
    SignatureNonce:   crypto.randomBytes(8).toString('hex'),
    Timestamp:        new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    [jobParam]:       jobId,
  }

  const sortedQuery = Object.keys(params).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&')
  const stringToSign = `GET&${encodeURIComponent('/')}&${encodeURIComponent(sortedQuery)}`
  const signature = crypto
    .createHmac('sha1', `${keySecret}&`)
    .update(stringToSign)
    .digest('base64')

  const url = `https://mts.${region}.aliyuncs.com/?${sortedQuery}&Signature=${encodeURIComponent(signature)}`

  try {
    const res  = await fetch(url)
    const data = await res.json() as any

    if (action === 'QuerySnapshotJobList') {
      // 截图 job：输出 key 在 SnapshotConfig.OutputFile.Object
      return data?.SnapshotJobList?.SnapshotJob?.[0]?.SnapshotConfig?.OutputFile?.Object ?? null
    } else {
      // 转码 job：输出 key 在 Output.OutputObject
      return data?.JobList?.Job?.[0]?.Output?.OutputObject ?? null
    }
  } catch (e) {
    console.error(`[MPS] 查询 ${action} 失败:`, e)
    return null
  }
}

// ── 主回调处理 ─────────────────────────────────────────────
export default defineEventHandler(async (event) => {
  const raw = await readBody(event)
  console.log('[MPS Raw]', JSON.stringify(raw))

  // 1. 解包 MNS Message 字段（JSON 字符串）
  let msg: any = {}
  try {
    msg = typeof raw.Message === 'string' ? JSON.parse(raw.Message) : (raw.Message ?? raw)
  } catch {
    console.error('[MPS] Message 解析失败')
    return { success: true }
  }

  const exec = msg.MediaWorkflowExecution
  if (!exec) {
    console.log('[MPS] 非工作流回调，忽略', msg.Type)
    return { success: true }
  }

  const execState = exec.State   // Running / Completed / Failed
  const inputKey  = exec.Input?.InputFile?.Object
  if (!inputKey) return { success: true }

  // 只处理最终状态
  if (execState === 'Running') {
    console.log(`[MPS] 进行中，忽略: ${inputKey}`)
    return { success: true }
  }

  const activities: any[] = exec.ActivityList || []
  const transcodeAct = activities.find((a: any) => a.Type === 'Transcode' && a.State === 'Success')
  const snapshotAct  = activities.find((a: any) =>
    (a.Type === 'Snapshot' || a.Type === 'Cover') && a.State === 'Success')

  console.log('[MPS 解析]', {
    execState, inputKey,
    transcodeJobId: transcodeAct?.JobId,
    snapshotJobId:  snapshotAct?.JobId,
  })

  const db     = useDb()
  const config = useRuntimeConfig()
  const base   = config.public.ossCdnBaseUrl

  if (execState === 'Completed') {
    // 并行查询转码 & 截图的实际输出 key
    const [outputKey, coverKey] = await Promise.all([
      transcodeAct?.JobId
        ? queryMpsJobOutput(config, 'QueryJobList', transcodeAct.JobId)
        : Promise.resolve(null),
      snapshotAct?.JobId
        ? queryMpsJobOutput(config, 'QuerySnapshotJobList', snapshotAct.JobId)
        : Promise.resolve(null),
    ])

    const videoUrl = outputKey ? `${base}/${outputKey}` : `${base}/${inputKey}`
    const coverUrl = coverKey  ? `${base}/${coverKey}`  : null

    console.log('[MPS] 输出路径:', { outputKey, coverKey, videoUrl, coverUrl })

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
