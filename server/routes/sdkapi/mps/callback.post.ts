// 阿里云 MPS 视频转码回调
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  console.log('[MPS Callback]', JSON.stringify(body))

  // MPS 回调格式：body.Output.OutputObject / body.State
  const state       = body.State          || body.state
  const outputKey   = body.Output?.OutputObject || body.output?.outputObject
  const coverKey    = body.Output?.SnapshotObject || body.output?.snapshotObject
  const inputKey    = body.Input?.Object  || body.input?.object

  if (!inputKey) return { success: true }

  const db = useDb()
  const config = useRuntimeConfig()
  const base = config.public.ossCdnBaseUrl

  if (state === 'success' || state === 'TranscodeSuccess') {
    await db.query(
      `UPDATE t_post SET
         video_url = ?,
         cover_url = ?,
         status    = 1
       WHERE raw_video_key = ? AND deleted = 0`,
      [
        outputKey ? `${base}/${outputKey}` : null,
        coverKey  ? `${base}/${coverKey}`  : null,
        inputKey,
      ]
    )
    console.log(`[MPS] 转码成功: ${inputKey}`)
  } else if (state === 'fail' || state === 'TranscodeFail') {
    await db.query(
      'UPDATE t_post SET status=3 WHERE raw_video_key=? AND deleted=0',
      [inputKey]
    )
    console.error(`[MPS] 转码失败: ${inputKey}`)
  }

  return { success: true }
})
