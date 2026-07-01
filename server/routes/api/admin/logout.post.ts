// POST /api/admin/logout —— 清除当前管理员的会话，token 立即失效
export default defineEventHandler(async (event) => {
  const admin = event.context.admin as { adminId: string } | undefined
  if (!admin) return { success: true }

  const redis = useRedis()
  await redis.del(RedisKey.adminSession(admin.adminId))

  return { success: true }
})
