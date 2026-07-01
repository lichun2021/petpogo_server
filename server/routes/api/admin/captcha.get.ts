import crypto from 'node:crypto'

// GET /api/admin/captcha —— 生成登录滑块验证挑战（无需登录）
const TRACK_WIDTH = 280
const THUMB_WIDTH = 40
const MARGIN = 10
const CAPTCHA_TTL = 120 // 秒，挑战有效期

export default defineEventHandler(async (event) => {
  const token = crypto.randomUUID()
  const maxTarget = TRACK_WIDTH - THUMB_WIDTH - MARGIN
  const target = MARGIN + Math.floor(Math.random() * (maxTarget - MARGIN))

  const redis = useRedis()
  await redis.setex(RedisKey.adminCaptcha(token), CAPTCHA_TTL, String(target))

  return { token, target, trackWidth: TRACK_WIDTH, thumbWidth: THUMB_WIDTH }
})
