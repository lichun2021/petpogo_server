// DELETE /sdkapi/media/:id  —— 用户删除自己的图库文件（软删除）

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!id) throw createError({ statusCode: 400, message: '参数错误' })

  const db = useDb()

  // 只允许删除自己的文件
  const [[media]]: any = await db.query(
    'SELECT id FROM t_media WHERE id = ? AND user_id = ? AND status = 1 LIMIT 1',
    [id, user.userId]
  )
  if (!media) throw createError({ statusCode: 404, message: '文件不存在或无权限' })

  await db.query('UPDATE t_media SET status = 2 WHERE id = ?', [id])

  return { success: true }
})
