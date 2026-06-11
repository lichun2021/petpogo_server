// GET /sdkapi/capture/list — 自动抓拍列表（用户 token 鉴权）
// 查询参数: deviceId / eventType / page / pageSize

export default defineEventHandler(async (event) => {
  const user  = await requireAuth(event)
  const query = getQuery(event)

  const page      = Math.max(1, Number(query.page) || 1)
  const pageSize  = Math.min(50, Math.max(1, Number(query.pageSize) || 20))
  const deviceMac = query.deviceId  ? String(query.deviceId).trim()  : null
  const eventType = query.eventType ? String(query.eventType).trim() : null

  const db = useDb()
  const conditions: string[] = ['e.status = 1', 'e.user_id = ?']
  const params: any[] = [user.userId]

  if (deviceMac) { conditions.push('e.device_id = ?'); params.push(deviceMac) }
  if (eventType) { conditions.push('e.event_type = ?'); params.push(eventType) }

  const where  = conditions.join(' AND ')
  const offset = (page - 1) * pageSize

  const [[{ total }]]: any = await db.query(
    `SELECT COUNT(*) AS total FROM t_capture_event e WHERE ${where}`, params
  )
  const [rows]: any = await db.query(
    `SELECT e.id, e.device_id, e.event_type, e.resource_url, e.cover_url, e.ai_result, e.created_at
     FROM t_capture_event e WHERE ${where} ORDER BY e.created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  const list = rows.map((r: any) => ({
    ...r,
    ai_result: typeof r.ai_result === 'string'
      ? (() => { try { return JSON.parse(r.ai_result) } catch { return null } })()
      : (r.ai_result ?? null),
  }))

  return { total: Number(total), page, pageSize, list }
})
