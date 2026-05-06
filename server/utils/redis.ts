import Redis from 'ioredis'

let _redis: Redis | null = null

export function useRedis(): Redis {
  if (!_redis) {
    const config = useRuntimeConfig()
    _redis = new Redis({
      host: config.redisHost || '127.0.0.1',
      port: Number(config.redisPort) || 6379,
      password: config.redisPassword || undefined,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    })
    _redis.on('error', (err) => console.error('Redis error:', err))
  }
  return _redis
}

export const RedisKey = {
  smsCode:        (phone: string)            => `sms:code:${phone}`,
  smsLock:        (phone: string)            => `sms:lock:${phone}`,
  session:        (userId: string)           => `session:${userId}`,
  deviceMac:      (mac: string)              => `device:mac:${mac}`,
  deviceId:       (id: string)               => `device:id:${id}`,
  devicePosition: (mac: string)              => `device:position:${mac}`,
  deviceLastPos:  (mac: string)              => `device:last_position:${mac}`,
  // 兼容旧系统的 Redis Key 格式
  deviceProps:    (mid: string, mac: string) => `granwinDeviceProperties:merchantId:${mid}:mac:${mac}`,
  postLikes:      (postId: string)           => `post:likes:${postId}`,
  postViews:      (postId: string)           => `post:views:${postId}`,
  postComments:   (postId: string)           => `post:comments:${postId}`,
  feedHot:        ()                         => `feed:hot`,
  hotProducts:    ()                         => `hot:products`,
  hotStores:      ()                         => `hot:stores`,
  nearbyStores:   (city: string, cat: string)=> `stores:city:${city}:${cat}`,
  imUserSig:      (userId: string)           => `im:usersig:${userId}`,
  lock:           (key: string)              => `lock:${key}`,
}
