import crypto from 'node:crypto'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { oldPassword, newPassword } = await readBody(event)

  if (!oldPassword || !newPassword) {
    throw createError({ statusCode: 400, message: '旧密码和新密码不能为空' })
  }
  if (newPassword.length < 6) {
    throw createError({ statusCode: 400, message: '新密码不能少于6位' })
  }

  const db = useDb()
  const [rows]: any = await db.query(
    'SELECT password FROM t_user WHERE id=? AND deleted=0 LIMIT 1',
    [user.userId]
  )
  const currentUser = rows[0]
  if (!currentUser) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }

  // 校验旧密码
  const oldPasswordHash = crypto.createHash('md5').update(oldPassword).digest('hex')
  if (currentUser.password && currentUser.password !== oldPasswordHash) {
    throw createError({ statusCode: 400, message: '旧密码错误' })
  }

  // 更新本后台密码（对方后台密码固定为 12345678，无需同步）
  const newPasswordHash = crypto.createHash('md5').update(newPassword).digest('hex')
  await db.query('UPDATE t_user SET password=? WHERE id=?', [newPasswordHash, user.userId])

  return { success: true }
})
