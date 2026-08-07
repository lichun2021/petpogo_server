// POST /sdkapi/device-event/read
// 标记单条设备事件已读
// Body: { "event_id": "xxx" }
// 返回: { "success": true }
//
// ★ user_id 防越权：只能标记自己的事件

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { event_id: eventId } = await readBody(event)

  if (!eventId) {
    throw createError({ statusCode: 400, message: 'event_id 不能为空' })
  }

  const db = useDb()
  const [result]: any = await db.query(
    'UPDATE t_device_event SET is_read = 1 WHERE id = ? AND user_id = ?',
    [String(eventId), user.userId]
  )

  if (result.affectedRows === 0) {
    throw createError({ statusCode: 404, message: '事件不存在或已读' })
  }

  return { success: true }
})
