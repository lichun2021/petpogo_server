// DELETE /sdkapi/sound/user/:id — App：删除我的声音（软删）

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id   = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'id 无效' })

  const db = useDb()
  const [result]: any = await db.query(
    'UPDATE t_sound_user SET status = 0 WHERE id = ? AND user_id = ?',
    [id, user.userId]
  )

  if (result.affectedRows === 0) throw createError({ statusCode: 404, message: '记录不存在' })
  return { success: true }
})
