/**
 * 系统设置工具 — useSettings
 * ─────────────────────────────────────────────────────────
 * 从 t_system_settings 表读取配置，带 Redis 缓存（TTL 60 秒）。
 * 业务代码通过 getSetting / getSettingBool / getSettingNumber 取值。
 *
 * 缓存 Key: system_settings_cache (Hash)
 * ─────────────────────────────────────────────────────────
 */

const CACHE_KEY = 'system_settings_cache'
const CACHE_TTL = 60  // 秒，保存全局配置，60s 内无需重复查 DB

/**
 * 获取所有系统设置（键值 Map）
 * 优先从 Redis 缓存读，缓存失效则查库并回写缓存
 */
export async function getAllSettings(): Promise<Record<string, string>> {
  const redis = useRedis()

  // 尝试读缓存
  const cached = await redis.hgetall(CACHE_KEY)
  if (cached && Object.keys(cached).length > 0) {
    return cached
  }

  // 缓存未命中，查数据库
  const db = useDb()
  const [rows]: any = await db.query(
    'SELECT `key`, `value` FROM t_system_settings'
  )

  const map: Record<string, string> = {}
  for (const row of rows) {
    map[row.key] = row.value
  }

  // 写入 Redis Hash，设置 TTL
  if (Object.keys(map).length > 0) {
    await redis.hset(CACHE_KEY, map)
    await redis.expire(CACHE_KEY, CACHE_TTL)
  }

  return map
}

/**
 * 获取单个设置值（字符串）
 * @param key  配置键
 * @param defaultVal  未找到时的默认值
 */
export async function getSetting(key: string, defaultVal = ''): Promise<string> {
  const all = await getAllSettings()
  return all[key] ?? defaultVal
}

/**
 * 获取布尔型设置（'1' = true, 其他 = false）
 */
export async function getSettingBool(key: string, defaultVal = true): Promise<boolean> {
  const all = await getAllSettings()
  if (!(key in all)) return defaultVal
  return all[key] === '1'
}

/**
 * 获取数字型设置
 */
export async function getSettingNumber(key: string, defaultVal = 0): Promise<number> {
  const all = await getAllSettings()
  if (!(key in all)) return defaultVal
  const n = Number(all[key])
  return isNaN(n) ? defaultVal : n
}

/**
 * 使设置缓存失效（修改配置后调用）
 */
export async function invalidateSettingsCache(): Promise<void> {
  const redis = useRedis()
  await redis.del(CACHE_KEY)
}
