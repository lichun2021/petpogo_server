// DELETE /api/admin/admins/:id —— 超级管理员软删除管理员账号
export default defineEventHandler(async (event) => {
  const admin = requireSuperAdmin(event)

  const id = String(getRouterParam(event, 'id') || '')
  if (!id) throw createError({ statusCode: 400, message: '参数错误' })

  if (id === admin.adminId) {
    throw createError({ statusCode: 400, message: '不能删除自己的账号' })
  }

  const db = useDb()

  const [[target]]: any = await db.query('SELECT role FROM t_admin WHERE id=? AND deleted=0', [id])
  if (!target) {
    throw createError({ statusCode: 404, message: '管理员不存在' })
  }

  if (target.role === 'super_admin') {
    const [[{ cnt }]]: any = await db.query(
      "SELECT COUNT(*) as cnt FROM t_admin WHERE role='super_admin' AND status=1 AND deleted=0 AND id<>?",
      [id]
    )
    if (Number(cnt) === 0) {
      throw createError({ statusCode: 400, message: '至少保留一个可用的超级管理员' })
    }
  }

  await db.query('UPDATE t_admin SET deleted=1 WHERE id=?', [id])

  return { success: true }
})
