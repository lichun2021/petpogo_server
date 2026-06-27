// POST /sdkapi/share/create — 创建业务分享码
// body: { type, targetId, title?, description?, imageUrl?, payload?, expireDays? }

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event) || {}

  const type = normalizeShareType(body.type)
  const targetId = String(body.targetId ?? body.target_id ?? '').trim()
  if (!targetId) throw createError({ statusCode: 400, message: '缺少分享对象ID' })

  const expireDays = Math.min(90, Math.max(1, Number(body.expireDays || body.expire_days || 30)))
  const db = useDb()
  await ensureShareLinkTable(db)

  // device/location 类型：设备在 iPet 服务器，不在本地 MySQL
  // 如果 App 已传入 payload（含 deviceName/mac），直接用，不查库
  const clientPayload = body.payload && typeof body.payload === 'object' ? body.payload : null
  const isDeviceType = type === 'device' || type === 'location'

  let summary: Awaited<ReturnType<typeof loadShareTargetSummary>>
  if (isDeviceType && clientPayload?.deviceName) {
    const deviceName = String(clientPayload.deviceName).trim() || '智能设备'
    summary = {
      targetId: String(clientPayload.deviceId || targetId),
      title: body.title || `邀请你共同管理「${deviceName}」`,
      description: body.description || '打开链接，将设备添加到你的账户，即可一起查看和控制。',
      imageUrl: String(body.imageUrl || ''),
      publicPayload: clientPayload,
    }
  } else {
    summary = await loadShareTargetSummary(db, type, targetId, user.userId)
  }

  const code = await generateShareCode(db)
  const title = String(body.title || summary.title).trim().slice(0, 120)
  const description = String(body.description || summary.description).trim().slice(0, 300)
  const imageUrl = String(body.imageUrl || body.image_url || summary.imageUrl || '').trim().slice(0, 500)
  const payload = JSON.stringify(summary.publicPayload || {})

  await db.query(
    `INSERT INTO t_share_link
       (code, user_id, share_type, target_id, title, description, image_url, payload, expire_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
    [code, user.userId, type, summary.targetId, title, description, imageUrl, payload, expireDays],
  )

  return {
    code,
    type,
    title,
    description,
    imageUrl,
    shareUrl: sharePageUrl(code, { type, title, description, imageUrl }),
    deepLink: shareDeepLink(type, code),
    expireDays,
  }
})

