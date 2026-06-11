// GET /sdkapi/greeting/list — 打招呼记录列表（用户 token 鉴权）
// 查询参数: deviceId / page / pageSize

export default defineEventHandler(async (event) => {
  const user  = await requireAuth(event)
  const query = getQuery(event)

  const page      = Math.max(1, Number(query.page) || 1)
  const pageSize  = Math.min(50, Math.max(1, Number(query.pageSize) || 20))
  const deviceMac = query.deviceId ? String(query.deviceId).trim() : null

  const db = useDb()
  const conditions: string[] = ['g.status = 1', 'g.user_id = ?']
  const params: any[] = [user.userId]

  if (deviceMac) { conditions.push('g.device_id = ?'); params.push(deviceMac) }

  const where  = conditions.join(' AND ')
  const offset = (page - 1) * pageSize

  const [[{ total }]]: any = await db.query(
    `SELECT COUNT(*) AS total FROM t_greeting_event g WHERE ${where}`, params
  )
  const [rows]: any = await db.query(
    `SELECT g.id, g.device_id, g.resource_url, g.response_url, g.cover_url, g.ai_result, g.created_at
     FROM t_greeting_event g WHERE ${where} ORDER BY g.created_at DESC LIMIT ? OFFSET ?`,
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
