// 获取当前用户信息
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = useDb()
  const [[row]]: any = await db.query(
    'SELECT id, phone, nickname, avatar, gender, birthday, bio, vip_status, vip_expire_at, created_at FROM t_user WHERE id=? AND deleted=0',
    [user.userId]
  )
  if (!row) throw createError({ statusCode: 404, message: '用户不存在' })

  const isVip = row.vip_status === 1 &&
    (row.vip_expire_at === null || new Date(row.vip_expire_at) > new Date())

  return {
    ...row,
    id: String(row.id),
    isVip,
    vipExpireAt: row.vip_expire_at ? new Date(row.vip_expire_at).toISOString() : null,
    // 隐藏原始数据库字段，只暴露计算后的字段
    vip_status: undefined,
    vip_expire_at: undefined,
  }
})
