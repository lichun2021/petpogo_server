import crypto from 'node:crypto'

// GET /api/admin/captcha —— 生成图形滑块验证码（背景图 + 拼图块）
const CAPTCHA_TTL = 120 // 秒，挑战有效期

export default defineEventHandler(async (event) => {
  const token = crypto.randomUUID()

  // 生成图形验证码（背景图 + 拼图块 + 目标位置）
  const { generateSlideCaptcha } = await import('../../utils/slideCaptcha')
  const { backgroundBase64, puzzleBase64, offsetX } = await generateSlideCaptcha()

  const redis = useRedis()
  await redis.setex(RedisKey.adminCaptcha(token), CAPTCHA_TTL, String(offsetX))

  return {
    token,
    backgroundImage: backgroundBase64, // 带缺口的背景图（base64）
    puzzleImage: puzzleBase64,         // 拼图块图片（base64）
    puzzleWidth: 50,                   // 拼图块宽度
    trackWidth: 300,                   // 滑轨宽度（前端显示用）
  }
})
