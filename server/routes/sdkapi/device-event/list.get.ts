// GET /sdkapi/device-event/list
// App 系统通知列表页：拉取当前用户的历史设备事件（越界/离线/低电）
//
// 走 signature 中间件 + requireAuth
// Query 参数：
//   type      String?  类型过滤（breach/offline/low_battery）
//   page      int      页码（默认1）
//   page_size int      每页条数（默认20，最大50）

// 合法事件类型（用于过滤校验）
const VALID_TYPES = new Set(['breach', 'offline', 'low_battery'])

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const query = getQuery(event)

  const page     = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(query.page_size) || 20))
  const offset   = (page - 1) * pageSize
  const type     = query.type ? String(query.type).trim() : null

  // 类型过滤校验
  if (type && !VALID_TYPES.has(type)) {
    throw createError({ statusCode: 400, message: 'type 无效，仅支持 breach/offline/low_battery' })
  }

  const db = useDb()
  const conditions: string[] = ['user_id = ?']
  const params: any[] = [user.userId]
  if (type) { conditions.push('event_type = ?'); params.push(type) }

  const where = conditions.join(' AND ')

  // 总数
  const [[{ total }]]: any = await db.query(
    `SELECT COUNT(*) AS total FROM t_device_event WHERE ${where}`,
    params
  )

  // 列表
  const [rows]: any = await db.query(
    `SELECT id, event_type, pet_name, device_mac, device_name, description, extra, is_read, created_at
     FROM t_device_event
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  const list = rows.map((r: any) => {
    // extra 是 JSON 字符串或对象（mysql2 可能自动解析 JSON 列）
    let extra: any = null
    if (r.extra) {
      try { extra = typeof r.extra === 'string' ? JSON.parse(r.extra) : r.extra } catch {}
    }
    return {
      id:     String(r.id),
      type:   r.event_type,
      pet_name: r.pet_name || '',
      device_mac: r.device_mac,
      device_name: r.device_name || '',
      // device_product_key：从 extra JSON 取，PeerApi 传了才有，否则 null
      device_product_key: extra?.product_key ?? null,
      desc:   r.description || '',
      // created_at 字符串 → 毫秒时间戳
      time:   new Date(r.created_at).getTime(),
      read:   Number(r.is_read) === 1,
    }
  })

  return { list, total: Number(total), page }
})
