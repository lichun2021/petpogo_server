// PUT /api/admin/admins/:id —— 超级管理员更新管理员账号信息
export default defineEventHandler(async (event) => {
  const admin = requireSuperAdmin(event)

  const id = String(getRouterParam(event, 'id') || '')
  if (!id) throw createError({ statusCode: 400, message: '参数错误' })

  const body = await readBody(event)
  const isSelf = id === admin.adminId

  if (isSelf && (body?.role !== undefined || body?.status !== undefined)) {
    throw createError({ statusCode: 400, message: '不能修改自己的角色或状态，请联系其他超级管理员' })
  }

  const sets: string[] = []
  const params: any[] = []

  if (body?.nickname !== undefined) {
    sets.push('nickname=?')
    params.push(String(body.nickname).trim())
  }
  if (body?.role !== undefined) {
    if (!['super_admin', 'admin'].includes(body.role)) {
      throw createError({ statusCode: 400, message: '角色值无效' })
    }
    sets.push('role=?')
    params.push(body.role)
  }
  if (body?.status !== undefined) {
    if (![1, 2].includes(Number(body.status))) {
      throw createError({ statusCode: 400, message: '状态值无效（1正常/2禁用）' })
    }
    sets.push('status=?')
    params.push(Number(body.status))
  }
  if (body?.password) {
    if (String(body.password).length < 6) {
      throw createError({ statusCode: 400, message: '密码长度至少6位' })
    }
    sets.push('password=?')
    params.push(hashPassword(String(body.password)))
  }

  if (!sets.length) {
    throw createError({ statusCode: 400, message: '没有需要更新的字段' })
  }

  const db = useDb()

  // 禁用/降级前确保系统内还剩至少一个超级管理员
  if (body?.role === 'admin' || Number(body?.status) === 2) {
    const [[target]]: any = await db.query('SELECT role FROM t_admin WHERE id=? AND deleted=0', [id])
    if (target?.role === 'super_admin') {
      const [[{ cnt }]]: any = await db.query(
        "SELECT COUNT(*) as cnt FROM t_admin WHERE role='super_admin' AND status=1 AND deleted=0 AND id<>?",
        [id]
      )
      if (Number(cnt) === 0) {
        throw createError({ statusCode: 400, message: '至少保留一个可用的超级管理员' })
      }
    }
  }

  params.push(id)
  await db.query(`UPDATE t_admin SET ${sets.join(', ')} WHERE id=?`, params)

  return { success: true }
})
