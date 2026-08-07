// POST /sdkapi/device-event/read-all
// 标记当前用户全部未读事件为已读
// Body: {}（按 userId 鉴权）
// 返回: { "success": true, "count": 5 }

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const db = useDb()
  const [result]: any = await db.query(
    'UPDATE t_device_event SET is_read = 1 WHERE user_id = ? AND is_read = 0',
    [user.userId]
  )

  return { success: true, count: result.affectedRows || 0 }
})
