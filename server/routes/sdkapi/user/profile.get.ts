// 获取当前用户信息（含 AI 配额）
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

  // 查询今日 AI 配额
  const quota = await getAiUsageInfo(user.userId)

  return {
    ...row,
    id: String(row.id),
    isVip,
    vipExpireAt: row.vip_expire_at ? new Date(row.vip_expire_at).toISOString() : null,
    // 隐藏原始数据库字段
    vip_status:    undefined,
    vip_expire_at: undefined,
    // AI 配额信息
    aiQuota: {
      used:      quota.used,       // 今日已用次数
      limit:     quota.limit,      // 总额度（-1=VIP无限）
      remaining: quota.remaining,  // 剩余次数（-1=VIP无限）
      isUnlimited: quota.limit === -1,
    },
  }
})
