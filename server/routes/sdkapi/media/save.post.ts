// POST /sdkapi/media/save  —— App 直传 OSS 成功后保存图库记录

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const body = await readBody(event)

  const { type, url, ossKey, fileSize, duration, deviceId } = body ?? {}

  if (![1, 2].includes(Number(type))) {
    throw createError({ statusCode: 400, message: '类型无效（1图片/2视频）' })
  }
  if (!url || !ossKey) {
    throw createError({ statusCode: 400, message: 'url 和 ossKey 不能为空' })
  }

  const db = useDb()

  // device_id 直接存 MAC 字符串（VARCHAR），不关联 t_device
  const deviceMac: string | null = deviceId ? String(deviceId).trim() : null

  // 快照昵称
  const [[dbUser]]: any = await db.query(
    'SELECT nickname FROM t_user WHERE id = ? AND deleted = 0 LIMIT 1',
    [user.userId]
  )
  const nickname = dbUser?.nickname || ''

  // 缩略图
  let thumbUrl = ''
  if (Number(type) === 2) {
    thumbUrl = `${url}?x-oss-process=video/snapshot,t_1000,f_jpg,w_480,ar_auto`
  } else {
    thumbUrl = url.includes('?')
      ? `${url}&x-oss-process=image/resize,w_480`
      : `${url}?x-oss-process=image/resize,w_480`
  }

  const [result]: any = await db.query(
    `INSERT INTO t_media (user_id, device_id, nickname, type, url, thumb_url, oss_key, file_size, duration)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.userId,
      deviceMac,          // MAC 字符串直接存 device_id
      nickname,
      Number(type),
      String(url),
      thumbUrl,
      String(ossKey),
      Number(fileSize) || 0,
      duration != null ? Number(duration) : null,
    ]
  )

  return { success: true, id: Number(result.insertId), thumbUrl }
})
