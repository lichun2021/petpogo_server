import crypto from 'node:crypto'
import DysmsapiPkg from '@alicloud/dysmsapi20170525'
import OpenApiPkg from '@alicloud/openapi-client'

// 根据运行时 debug 日志确认的真实结构：
// - DysmsapiPkg.default = 客户端类（构造函数）
// - DysmsapiPkg.SendSmsRequest = 请求体类（直接在模块上）
// - OpenApiPkg.Config = Config 类（直接在模块上，不在 .default 里）
const DysmsapiClient = (DysmsapiPkg as any).default
const SendSmsRequest = (DysmsapiPkg as any).SendSmsRequest
const OpenApiConfig = (OpenApiPkg as any).Config

// 发送短信验证码 (阿里云 SMS)
export default defineEventHandler(async (event) => {
  const { phone, nationNum = '86', purpose = 'login' } = await readBody(event)

  if (!['login', 'password_reset'].includes(purpose)) throw createError({ statusCode: 400, message: '验证码用途无效' })
  // 规范化区号（去掉可能带的 +）
  const dialCode = String(nationNum).replace(/^\+/, '')
  const isChinese = dialCode === '86'

  // 校验本机号码部分
  if (isChinese) {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      throw createError({ statusCode: 400, message: '手机号格式错误（中国大陆需11位）' })
    }
  } else {
    if (!/^\d{7,16}$/.test(phone)) {
      throw createError({ statusCode: 400, message: '手机号格式错误（7-16位数字）' })
    }
  }

  // 规范化手机号（作为 Redis key / DB 唯一标识）
  // 中国大陆：直接用本机号；境外：+区号+号码
  const normalizedPhone = isChinese ? phone : `+${dialCode}${phone}`

  // ── 读取系统设置 ────────────────────────────────────
  const smsEnabled   = await getSettingBool('sms_enabled', true)
  const dailyLimit   = await getSettingNumber('sms_daily_limit', 5)
  const codeExpireSec = (await getSettingNumber('sms_code_expire_min', 10)) * 60



  const redis = useRedis()
  const lockKey = RedisKey.smsLock(normalizedPhone)

  // 防刷：60 秒内只能发 1 次
  if (await redis.exists(lockKey)) {
    const ttl = await redis.ttl(lockKey)
    throw createError({ statusCode: 429, message: `请 ${ttl} 秒后再试` })
  }

  // 每日发送上限校验（dailyLimit=0 表示不限）
  if (dailyLimit > 0) {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const dailyKey = `sms_count:${normalizedPhone}:${dateStr}`
    const todayCount = Number(await redis.get(dailyKey) || 0)
    if (todayCount >= dailyLimit) {
      throw createError({ statusCode: 429, message: `今日短信发送次数已达上限（${dailyLimit}次），请明天再试` })
    }
  }

  // 生成 6 位验证码
  const code = crypto.randomInt(100000, 1000000).toString()

  // 开发模式或网关关闭时跳过短信；验证码仅在开发响应中返回，不写日志。
  if (process.env.NODE_ENV !== 'production' || !smsEnabled) {
    await redis.setex((purpose === 'password_reset' ? RedisKey.smsPassword(normalizedPhone) : RedisKey.smsCode(normalizedPhone)), codeExpireSec, JSON.stringify({ code, attempts: 0 }))
    await redis.setex(lockKey, 60, '1')
    return { success: true, ...(process.env.NODE_ENV !== 'production' ? { dev_code: code } : {}) }
  }

  // 生产：调阿里云 SMS
  const config = useRuntimeConfig()
  // 阿里云格式：中国大陆直接用手机号，境外加 + 区号前缀
  const aliyunPhone = isChinese ? phone : `+${dialCode}${phone}`


  try {
    const cfg = new OpenApiConfig({
      accessKeyId: config.aliSmsKeyId,
      accessKeySecret: config.aliSmsKeySecret,
      endpoint: 'dysmsapi.aliyuncs.com',
    })
    const client = new DysmsapiClient(cfg)
    const req = new SendSmsRequest({
      phoneNumbers: aliyunPhone,
      signName: config.aliSmsSign,
      templateCode: config.aliSmsTplCode,
      templateParam: JSON.stringify({ code }),
    })

    console.log(`[SMS] 正在调用阿里云 API...`)
    const res = await client.sendSms(req)
    console.log(`[SMS] 阿里云返回: Code=${res.body.code}, Message=${res.body.message}, BizId=${res.body.bizId}`)

    if (res.body.code !== 'OK') {
      throw new Error(`[${res.body.code}] ${res.body.message}`)
    }
  } catch (e: any) {
    // 真实错误（含阿里云错误码）只进 pm2 日志，不透传给客户端
    console.error(`[SMS] 发送失败: ${e.message}`)
    throw createError({ statusCode: 500, message: '短信发送失败，请稍后重试' })
  }

  await redis.setex((purpose === 'password_reset' ? RedisKey.smsPassword(normalizedPhone) : RedisKey.smsCode(normalizedPhone)), codeExpireSec, JSON.stringify({ code, attempts: 0 }))
  await redis.setex(lockKey, 60, '1')

  // 每日计数 +1
  if (dailyLimit > 0) {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const dailyKey = `sms_count:${normalizedPhone}:${dateStr}`
    await redis.incr(dailyKey)
    await redis.expireat(dailyKey, Math.floor(new Date().setHours(23, 59, 59, 999) / 1000))
  }

  return { success: true }
})
