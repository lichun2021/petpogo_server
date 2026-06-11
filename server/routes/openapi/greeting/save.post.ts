// POST /openapi/greeting/save — 设备上传打招呼事件（OpenAPI 鉴权）
//
// 流程：用户App发招呼音 → 设备播放 → 录制宠物响应 → 上传此接口 → AI情绪分析
//
// Body:
//   alias       string  用户 alias（手机号@qq.com，必填）
//   deviceId    string  设备 MAC（必填）
//   greetUrl    string  招呼音频URL（用户发送的音频）
//   responseUrl string  宠物响应资源URL（设备录制的视频/音频）
//   coverUrl    string  响应视频封面URL（视频不传则自动截帧）
//   aiResult    object  AI情绪分析结果（JSON）

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { alias, deviceId, greetUrl, responseUrl, coverUrl, aiResult } = body ?? {}

  if (!alias?.trim())    throw createError({ statusCode: 400, message: 'alias 不能为空（手机号@qq.com）' })
  if (!deviceId?.trim()) throw createError({ statusCode: 400, message: 'deviceId 不能为空' })

  const db = useDb()
  const phone = String(alias).split('@')[0].trim()
  const [[dbUser]]: any = await db.query(
    'SELECT id FROM t_user WHERE phone = ? AND deleted = 0 LIMIT 1', [phone]
  )
  if (!dbUser) throw createError({ statusCode: 404, message: '用户不存在（alias 无效）' })

  const deviceMac = String(deviceId).trim()

  // 响应视频封面自动截帧
  let finalCover = coverUrl ? String(coverUrl).trim() : ''
  if (!finalCover && responseUrl) {
    const url = String(responseUrl)
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
    `INSERT INTO t_greeting_event (user_id, device_id, greet_url, response_url, cover_url, ai_result)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [dbUser.id, deviceMac,
     greetUrl    ? String(greetUrl).trim()    : null,
     responseUrl ? String(responseUrl).trim() : null,
     finalCover || null, aiJson]
  )

  console.log(`[Greeting] alias=${alias} device=${deviceMac} id=${result.insertId}`)
  return { success: true, id: Number(result.insertId), coverUrl: finalCover || null }
})
