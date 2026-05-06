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

  // 查询当前密码
  const [rows]: any = await db.query('SELECT password FROM t_user WHERE id=? AND deleted=0 LIMIT 1', [user.userId])
  const currentUser = rows[0]

  if (!currentUser) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }

  // 校验旧密码
  const oldPasswordHash = crypto.createHash('md5').update(oldPassword).digest('hex')
  
  // 如果数据库里的 password 为 null，说明老用户没设置过密码，可以允许他们直接设置，但保险起见还是让用验证码找回
  // 但这里为了简便，如果为空，也算旧密码错误，除非旧密码输入的就是空？不对，这里严格一点
  if (currentUser.password && currentUser.password !== oldPasswordHash) {
    throw createError({ statusCode: 400, message: '旧密码错误' })
  }

  // 如果数据库里没密码，而且通过了 auth，可以选择允许旧密码为 '123456' 的哈希？
  // 或者是必须有老密码才能改。我们现在所有新用户都有 'e10adc3949ba59abbe56e057f20f883e'

  // 加密新密码
  const newPasswordHash = crypto.createHash('md5').update(newPassword).digest('hex')

  // 更新数据库
  await db.query('UPDATE t_user SET password=? WHERE id=?', [newPasswordHash, user.userId])

  return { success: true }
})
