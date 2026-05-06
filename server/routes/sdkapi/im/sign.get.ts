// IM UserSig 刷新接口（App 端 IM 登录失效时调用）
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const redis = useRedis()

  const userSig = genUserSig(user.userId)
  await redis.setex(RedisKey.imUserSig(user.userId), 86400 * 6, userSig)

  return {
    sdkAppId: 1600139420,
    userId:   user.userId,
    userSig,
  }
})
