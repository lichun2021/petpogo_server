// 热门商品（Redis 缓存 1 小时）
export default defineEventHandler(async (event) => {
  const redis = useRedis()
  const cached = await redis.get(RedisKey.hotProducts())
  if (cached) return JSON.parse(cached)

  const db = useDb()
  const [products]: any = await db.query(
    `SELECT id, name, category, cover, price, original_price, sales_count, store_id
     FROM t_product WHERE status=1
     ORDER BY is_hot DESC, sales_count DESC LIMIT 20`
  )
  const result = products.map((p: any) => ({ ...p, id: String(p.id) }))
  await redis.setex(RedisKey.hotProducts(), 3600, JSON.stringify(result))
  return result
})
