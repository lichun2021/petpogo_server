// GET /sdkapi/media/list  —— 获取图库列表
//
// 查询模式：
//   - 不传 deviceId：返回当前用户自己的图库
//   - 传 deviceId（MAC 字符串）：直接用 device_id 字段过滤

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = getQuery(event)

  const page     = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20))
  const type     = query.type ? Number(query.type) : null
  const deviceMac = query.deviceId ? String(query.deviceId).trim() : null

  const db = useDb()

  const conditions: string[] = ['m.status = 1']
  const params: any[] = []

  if (deviceMac) {
    // 共享模式：device_id 即 MAC 字符串，直接过滤
    conditions.push('m.device_id = ?')
    params.push(deviceMac)
  } else {
    // 个人模式：只看自己的
    conditions.push('m.user_id = ?')
    params.push(user.userId)
  }

  if (type && [1, 2].includes(type)) {
    conditions.push('m.type = ?')
    params.push(type)
  }

  const where = conditions.join(' AND ')
  const offset = (page - 1) * pageSize

  const [[{ total }]]: any = await db.query(
    `SELECT COUNT(*) as total FROM t_media m WHERE ${where}`,
    params
  )

  const [rows]: any = await db.query(
    `SELECT m.id, m.type, m.url, m.thumb_url, m.file_size, m.duration,
            m.user_id, m.device_id, m.created_at,
            COALESCE(NULLIF(m.nickname,''), u.nickname, '用户') AS nickname
     FROM t_media m
     LEFT JOIN t_user u ON m.user_id = u.id
     WHERE ${where}
     ORDER BY m.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  return { total, page, pageSize, list: rows }
})
