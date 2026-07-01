// 登录失败次数限流：同一 key（账号/手机号）连续失败达到上限后锁定一段时间。
const MAX_ATTEMPTS = 5
const LOCK_WINDOW = 15 * 60 // 秒

export async function assertNotLocked(key: string) {
  const redis = useRedis()
  const attempts = Number(await redis.get(key) || 0)
  if (attempts >= MAX_ATTEMPTS) {
    const ttl = await redis.ttl(key)
    const minutes = Math.max(1, Math.ceil(ttl / 60))
    throw createError({ statusCode: 429, message: `登录失败次数过多，请 ${minutes} 分钟后重试` })
  }
}

export async function recordLoginFailure(key: string) {
  const redis = useRedis()
  const attempts = await redis.incr(key)
  if (attempts === 1) {
    await redis.expire(key, LOCK_WINDOW)
  }
}

export async function clearLoginFailures(key: string) {
  await useRedis().del(key)
}
