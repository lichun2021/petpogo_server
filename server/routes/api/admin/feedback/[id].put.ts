// PUT /api/admin/feedback/:id  —— 管理员更新反馈状态（已读/已处理）
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: '参数错误' })

  const body = await readBody(event)
  const status = Number(body?.status)

  if (![0, 1, 2].includes(status)) {
    throw createError({ statusCode: 400, message: '状态值无效（0未读/1已读/2已处理）' })
  }

  const db = useDb()
  await db.query('UPDATE t_feedback SET status = ? WHERE id = ?', [status, id])

  return { success: true }
})
