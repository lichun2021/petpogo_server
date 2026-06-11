// POST /openapi/capture/save — 设备上传事件（OpenAPI 鉴权）
//
// 通过 eventType 决定写入哪张表：
//   greeting       → t_greeting_event（招呼音 + 宠物响应视频）
//   其他            → t_capture_event（auto_capture / motion / scheduled）
//
// 保存成功后异步发极光推送通知，extras 格式：
//   type       = "device"              ← App 端路由依据
//   device_mac = deviceId              ← App 打开对应设备回忆页面
//   event_type = auto_capture/greeting ← 区分事件类型
//   event_id   = insertId
//
// Body（公共字段）：
//   alias       string  用户 alias（手机号@qq.com，必填）
//   deviceId    string  设备 MAC（必填）
//   eventType   string  事件类型（默认 auto_capture）
//   resourceUrl string  主资源URL（抓拍时=视频/图片；打招呼时=招呼音频）
//   coverUrl    string  封面URL（视频不传则自动截帧）
//   aiResult    object  AI情绪分析结果（JSON）
//
// Body（打招呼专用）：
//   responseUrl string  宠物响应资源URL（设备录制，可不传）



export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const {
    alias, deviceId,
    eventType = 'auto_capture',
    resourceUrl, coverUrl, aiResult,
    responseUrl,
  } = body ?? {}

  if (!alias?.trim())    throw createError({ statusCode: 400, message: 'alias 不能为空（手机号@qq.com）' })
  if (!deviceId?.trim()) throw createError({ statusCode: 400, message: 'deviceId 不能为空' })

  const db = useDb()
  const phone = String(alias).split('@')[0].trim()
  const [[dbUser]]: any = await db.query(
    'SELECT id FROM t_user WHERE phone = ? AND deleted = 0 LIMIT 1', [phone]
  )
  if (!dbUser) throw createError({ statusCode: 404, message: '用户不存在（alias 无效）' })

  const deviceMac = String(deviceId).trim()
  const type      = String(eventType).trim() || 'auto_capture'

  // 封面自动截帧（视频未传封面时）
  const mainVideoUrl = type === 'greeting' ? (responseUrl || '') : (resourceUrl || '')
  let finalCover = coverUrl ? String(coverUrl).trim() : ''
  if (!finalCover && mainVideoUrl) {
    const url = String(mainVideoUrl)
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

  let insertId: number

  if (type === 'greeting') {
    // ── 打招呼事件 → t_greeting_event ──────────────────────────
    const [result]: any = await db.query(
      `INSERT INTO t_greeting_event (user_id, device_id, resource_url, response_url, cover_url, ai_result)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [dbUser.id, deviceMac,
       resourceUrl  ? String(resourceUrl).trim()  : null,
       responseUrl  ? String(responseUrl).trim()  : null,
       finalCover || null, aiJson]
    )
    insertId = Number(result.insertId)
  } else {
    // ── 自动抓拍事件 → t_capture_event ─────────────────────────
    const [result]: any = await db.query(
      `INSERT INTO t_capture_event (user_id, device_id, event_type, resource_url, cover_url, ai_result)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [dbUser.id, deviceMac, type,
       resourceUrl ? String(resourceUrl).trim() : null,
       finalCover || null, aiJson]
    )
    insertId = Number(result.insertId)
  }

  console.log(`[OpenAPI/Capture] alias=${alias} device=${deviceMac} event=${type} id=${insertId}`)

  // ── 异步极光推送（失败不影响主响应） ─────────────────────────
  // extras.type = "device" 是 App 端的路由信号
  // extras.device_mac     → App 打开对应设备的回忆页面
  // extras.event_type     → 区分抓拍 or 打招呼
  // extras.event_id       → 可直接定位该条记录
  const pushExtras: Record<string, string> = {
    type:       'device',         // App 端识别字段，固定值
    device_mac: deviceMac,        // 打开哪个设备的回忆页
    event_type: type,             // 事件类型
    event_id:   String(insertId), // 记录 ID
    ...(finalCover  ? { cover_url:    finalCover }                 : {}),
    ...(resourceUrl ? { resource_url: String(resourceUrl).trim() } : {}),
    ...(responseUrl ? { response_url: String(responseUrl).trim() } : {}),
  }

  const pushConfig: Record<string, { title: string; content: string }> = {
    auto_capture: { title: '📸 新抓拍',   content: '您的萌宠刚刚被抓拍到了，快来查看！' },
    motion:       { title: '🚨 移动侦测', content: '设备检测到移动，已自动抓拍记录。' },
    scheduled:    { title: '⏰ 定时抓拍', content: '定时抓拍已完成，查看最新照片。' },
    greeting:     { title: '🐾 打招呼啦', content: '您的萌宠已收到招呼，快来看看它的反应！' },
  }
  const { title, content } = pushConfig[type] ?? pushConfig.auto_capture

  jpushSend({
    audience: { type: 'alias', alias: [String(alias).trim()] },
    title,
    content,
    extras: pushExtras,
  }).catch(err => console.warn(`[Push] ${type} 通知失败:`, err?.message ?? err))

  return { success: true }
})
