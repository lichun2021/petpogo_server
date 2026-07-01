// POST /api/admin/admins —— 超级管理员创建新管理员账号
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)

  const body = await readBody(event)
  const username = String(body?.username || '').trim()
  const password = String(body?.password || '')
  const nickname = body?.nickname ? String(body.nickname).trim() : username
  const role = body?.role === 'super_admin' ? 'super_admin' : 'admin'

  if (!username || !password) {
    throw createError({ statusCode: 400, message: '账号和密码不能为空' })
  }
  if (password.length < 6) {
    throw createError({ statusCode: 400, message: '密码长度至少6位' })
  }

  const db = useDb()
  const id = generateId()

  try {
    await db.query(
      'INSERT INTO t_admin (id, username, password, nickname, role) VALUES (?, ?, ?, ?, ?)',
      [String(id), username, hashPassword(password), nickname, role]
    )
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') {
      throw createError({ statusCode: 409, message: '该账号已存在' })
    }
    throw e
  }

  return { id: String(id), username, nickname, role }
})
