// 退出登录
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const redis = useRedis()
  await redis.del(RedisKey.session(user.userId))
  return { success: true }
})
