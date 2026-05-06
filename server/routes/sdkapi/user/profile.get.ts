// 获取当前用户信息
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = useDb()
  const [[row]]: any = await db.query(
    'SELECT id, phone, nickname, avatar, gender, birthday, bio, created_at FROM t_user WHERE id=? AND deleted=0',
    [user.userId]
  )
  if (!row) throw createError({ statusCode: 404, message: '用户不存在' })
  return { ...row, id: String(row.id) }
})
