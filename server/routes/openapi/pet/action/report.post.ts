// POST /openapi/pet/action/report
// 硬件（或其后台）上报宠物当前动作状态码，走 /openapi/** 签名中间件（openapi-auth.ts）
//
// 请求体：
//   deviceId   string  设备ID（t_device.id）
//   code       string  硬件动作码（对应 t_pet_hardware_action_type.code，如 lying/eating/sitting/walking/standing）
//
// 流程：校验状态码合法且未删除 → 写 Redis 最新状态 → 写入统一宠物事件日志 t_pet_event
export default defineEventHandler(async (event) => {
  const { deviceId, code } = await readBody(event)
  if (!deviceId) throw createError({ statusCode: 400, message: 'deviceId 不能为空' })
  if (!code) throw createError({ statusCode: 400, message: 'code 不能为空' })

  const db = useDb()
  const [[actionType]]: any = await db.query(
    'SELECT id FROM t_pet_hardware_action_type WHERE code=? AND deleted=0 LIMIT 1',
    [String(code)]
  )
  if (!actionType) {
    throw createError({ statusCode: 400, message: `未知或已停用的动作码: ${code}` })
  }

  const now = new Date()

  // 反查关联宠物（同一设备下的宠物，取一条，可能为空）
  const [[pet]]: any = await db.query(
    'SELECT id FROM t_pet WHERE device_id=? AND deleted=0 ORDER BY created_at DESC LIMIT 1',
    [deviceId]
  )

  // Redis 优先缓存最新状态码（沿用 device:position 的模式）
  const redis = useRedis()
  await redis.set(
    RedisKey.petAction(String(deviceId)),
    JSON.stringify({ code: String(code), reportedAt: now.toISOString() }),
    'EX', 6 * 3600 // 6小时TTL
  )

  // 落入统一宠物事件日志
  const eventId = generateId()
  await db.query(
    `INSERT INTO t_pet_event (id, source, pet_id, device_id, ref_type_id, occurred_at, created_at)
     VALUES (?, 'hardware_action', ?, ?, ?, NOW(), NOW())`,
    [eventId, pet ? pet.id : null, deviceId, actionType.id]
  )

  return { success: true }
})
