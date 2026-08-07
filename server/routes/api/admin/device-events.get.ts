// GET /api/admin/device-events
// 后台查询设备事件（越界/离线/低电），支持按时间、用户、类型、已读状态筛选
// 走 admin-auth JWT 中间件
//
// Query 参数：
//   userId      String?  按 userId 精确筛
//   keyword     String?  按手机号/昵称模糊筛
//   event_type  String?  按类型筛（breach/offline/low_battery）
//   is_read     String?  按已读状态筛（"0"/"1"）
//   start_time  String?  开始时间（YYYY-MM-DD 或 ISO）
//   end_time    String?  结束时间
//   page        int      默认1
//   limit       int      默认20，最大100

const VALID_TYPES = new Set(['breach', 'offline', 'low_battery'])

export default defineEventHandler(async (event) => {
  const query     = getQuery(event)
  const userId    = (query.userId    as string) || ''
  const keyword   = (query.keyword   as string) || ''
  const eventType = (query.event_type as string) || ''
  const isRead    = (query.is_read   as string) || ''
  const startTime = (query.start_time as string) || ''
  const endTime   = (query.end_time  as string) || ''
  const page   = Math.max(1, Number(query.page)  || 1)
  const limit  = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const offset = (page - 1) * limit

  const db = useDb()
  const conditions: string[] = []
  const params: any[] = []

  if (userId.trim()) {
    conditions.push('e.user_id = ?')
    params.push(userId.trim())
  } else if (keyword.trim()) {
    conditions.push('(u.phone LIKE ? OR u.nickname LIKE ?)')
    params.push(`%${keyword.trim()}%`, `%${keyword.trim()}%`)
  }
  if (eventType && VALID_TYPES.has(eventType)) {
    conditions.push('e.event_type = ?')
    params.push(eventType)
  }
  if (isRead === '0' || isRead === '1') {
    conditions.push('e.is_read = ?')
    params.push(Number(isRead))
  }
  if (startTime) {
    conditions.push('e.created_at >= ?')
    params.push(startTime)
  }
  if (endTime) {
    conditions.push('e.created_at <= ?')
    params.push(endTime)
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

  const [[{ total }]]: any = await db.query(
    `SELECT COUNT(*) AS total FROM t_device_event e LEFT JOIN t_user u ON u.id = e.user_id ${where}`,
    params
  )

  const [rows]: any = await db.query(
    `SELECT e.id, e.user_id, u.phone, u.nickname,
            e.event_type, e.device_mac, e.device_name, e.pet_name,
            e.description, e.extra, e.is_read, e.created_at
     FROM t_device_event e
     LEFT JOIN t_user u ON u.id = e.user_id
     ${where}
     ORDER BY e.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )

  return {
    list: rows.map((r: any) => ({
      ...r,
      id:      String(r.id),
      user_id: String(r.user_id),
      is_read: Number(r.is_read) === 1,
    })),
    total: Number(total),
    page,
    limit,
  }
})
