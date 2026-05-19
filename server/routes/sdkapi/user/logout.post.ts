// 退出登录
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const redis = useRedis()
  // Token 以 tokenSessionKey 存储（非 session:{userId}）
  const token = (getHeader(event, 'Authorization') || '').replace('Bearer ', '').trim()
  if (token) await redis.del(tokenSessionKey(token))
  return { success: true }
})
