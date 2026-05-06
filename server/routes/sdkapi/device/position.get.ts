// 获取设备最新位置（优先 Redis 缓存）
export default defineEventHandler(async (event) => {
  const { mac } = getQuery(event)
  if (!mac) throw createError({ statusCode: 400, message: '缺少mac参数' })

  const redis = useRedis()
  const cached = await redis.get(RedisKey.devicePosition(String(mac)))
  if (cached) return JSON.parse(cached)

  const db = useDb()
  const [[device]]: any = await db.query(
    'SELECT longitude, latitude, address, last_online_at as updateTime FROM t_device WHERE mac=? AND deleted=0',
    [String(mac)]
  )
  if (!device || !device.longitude) return null
  return device
})
