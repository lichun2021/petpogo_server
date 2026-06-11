// POST /openapi/capture/save — 设备上传自动抓拍事件（OpenAPI 鉴权）
//
// Body:
//   alias       string  用户 alias（手机号@qq.com，必填）
//   deviceId    string  设备 MAC（必填）
//   eventType   string  事件类型（默认 auto_capture，可选 motion/scheduled）
//   resourceUrl string  资源URL（视频/音频/图片）
//   coverUrl    string  封面URL（视频不传则自动截帧）
//   aiResult    object  AI情绪分析结果（JSON）

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { alias, deviceId, eventType = 'auto_capture', resourceUrl, coverUrl, aiResult } = body ?? {}

  if (!alias?.trim()) throw createError({ statusCode: 400, message: 'alias 不能为空（手机号@qq.com）' })
  if (!deviceId?.trim()) throw createError({ statusCode: 400, message: 'deviceId 不能为空' })

  const db = useDb()
  const phone = String(alias).split('@')[0].trim()
  const [[dbUser]]: any = await db.query(
    'SELECT id FROM t_user WHERE phone = ? AND deleted = 0 LIMIT 1', [phone]
  )
  if (!dbUser) throw createError({ statusCode: 404, message: '用户不存在（alias 无效）' })

  const deviceMac = String(deviceId).trim()

  // 封面：视频未传则自动截帧
  let finalCover = coverUrl ? String(coverUrl).trim() : ''
  if (!finalCover && resourceUrl) {
    const url = String(resourceUrl)
    if (/\.(mp4|mov|avi|flv|m4v)(\?|$)/i.test(url)) {
      finalCover = url.includes('?')
        ? `${url}&x-oss-process=video/snapshot,t_1000,f_jpg,w_480,ar_auto`
        : `${url}?x-oss-process=video/snapshot,t_1000,f_jpg,w_480,ar_auto`
    }
  }

  let aiJson: string | null = null
  if (aiResult != null) {
    try { aiJson = typeof aiResult === 'string' ? aiResult : JSON.stringify(aiResult) } catch {}
  }

  const [result]: any = await db.query(
    `INSERT INTO t_capture_event (user_id, device_id, event_type, resource_url, cover_url, ai_result)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [dbUser.id, deviceMac, String(eventType).trim() || 'auto_capture',
     resourceUrl ? String(resourceUrl).trim() : null, finalCover || null, aiJson]
  )

  console.log(`[Capture] alias=${alias} device=${deviceMac} event=${eventType} id=${result.insertId}`)
  return { success: true, id: Number(result.insertId), coverUrl: finalCover || null }
})
