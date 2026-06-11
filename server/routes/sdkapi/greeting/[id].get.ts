// GET /sdkapi/greeting/:id — 打招呼详情

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id   = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) throw createError({ statusCode: 400, message: 'id 无效' })

  const db = useDb()
  const [[row]]: any = await db.query(
    `SELECT g.id, g.user_id, g.device_id, g.greet_url, g.response_url,
            g.cover_url, g.ai_result, g.created_at
     FROM t_greeting_event g WHERE g.id = ? AND g.user_id = ? AND g.status = 1 LIMIT 1`,
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
