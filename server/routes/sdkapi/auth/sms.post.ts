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
  const { phone } = await readBody(event)

  if (!/^1[3-9]\d{9}$/.test(phone)) {
    throw createError({ statusCode: 400, message: '手机号格式错误' })
  }

  const redis = useRedis()
  const lockKey = RedisKey.smsLock(phone)

  // 防刷：60 秒内只能发 1 次
  if (await redis.exists(lockKey)) {
    const ttl = await redis.ttl(lockKey)
    throw createError({ statusCode: 429, message: `请 ${ttl} 秒后再试` })
  }

  // 生成 6 位验证码
  const code = Math.floor(100000 + Math.random() * 900000).toString()

  // 开发模式：跳过真实短信，直接打印
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[开发模式] 手机号 ${phone} 验证码: ${code}`)
    await redis.setex(RedisKey.smsCode(phone), 300, JSON.stringify({ code, attempts: 0 }))
    await redis.setex(lockKey, 60, '1')
    return { success: true, dev_code: code }
  }

  // 生产：调阿里云 SMS
  const config = useRuntimeConfig()
  console.log(`[SMS] 开始发送 - phone: ${phone}, keyId: ${config.aliSmsKeyId?.substring(0, 8)}***, sign: ${config.aliSmsSign}, tpl: ${config.aliSmsTplCode}`)


  try {
    const cfg = new OpenApiConfig({
      accessKeyId: config.aliSmsKeyId,
      accessKeySecret: config.aliSmsKeySecret,
      endpoint: 'dysmsapi.aliyuncs.com',
    })
    const client = new DysmsapiClient(cfg)
    const req = new SendSmsRequest({
      phoneNumbers: phone,
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
    console.error(`[SMS] 发送失败: ${e.message}`)
    throw createError({ statusCode: 500, message: `短信发送失败: ${e.message}` })
  }

  await redis.setex(RedisKey.smsCode(phone), 300, JSON.stringify({ code, attempts: 0 }))
  await redis.setex(lockKey, 60, '1')

  console.log(`[SMS] 发送成功 - phone: ${phone}, code: ${code}`)
  return { success: true }
})
