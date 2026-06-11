// GET /sdkapi/capture/:id — 抓拍详情

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id   = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) throw createError({ statusCode: 400, message: 'id 无效' })

  const db = useDb()
  const [[row]]: any = await db.query(
    `SELECT e.id, e.user_id, e.device_id, e.event_type, e.resource_url,
            e.cover_url, e.ai_result, e.created_at
     FROM t_capture_event e WHERE e.id = ? AND e.user_id = ? AND e.status = 1 LIMIT 1`,
    [id, user.userId]
  )
  if (!row) throw createError({ statusCode: 404, message: '记录不存在' })

  return {
    ...row,
    ai_result: typeof row.ai_result === 'string'
      ? (() => { try { return JSON.parse(row.ai_result) } catch { return null } })()
      : (row.ai_result ?? null),
  }
})
