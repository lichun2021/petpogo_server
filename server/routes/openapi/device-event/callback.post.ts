// POST /openapi/device-event/callback
// PeerApi 设备事件回调：越界 / 离线 / 低电
//
// 走 /openapi/** 签名中间件（openapi-auth.ts：x-api-key + x-timestamp + x-signature）
// 流程：校验 → 反查 user_id → 兜底补全 device_name/pet_name → 生成文案 → 落库 → 触发极光推送
//
// 请求体：
//   phone        string   用户手机号（或 alias="xxx@qq.com"，二选一）
//   alias        string?  同上，优先于 phone
//   event_type   string   breach / offline / low_battery
//   device_mac   string   设备 MAC
//   device_name  string?  设备名（不传则查 t_device 兜底）
//   pet_name     string?  宠物名（不传则查 t_pet 兜底）
//   description  string?  事件描述（不传则按类型生成默认文案）
//   extra       object?  类型特有字段（distance / battery_percent / product_key 等）

// 合法事件类型
const VALID_TYPES = new Set(['breach', 'offline', 'low_battery'])

// 推送标题（按事件类型）
const PUSH_TITLE: Record<string, string> = {
  breach:       '围栏警报',
  offline:       '设备离线',
  low_battery:  '电量提醒',
}

// App 端 push_service 已识别的 extras.type
const PUSH_TYPE: Record<string, string> = {
  breach:       'fence_alert',    // App 端约定为 fence_alert
  offline:       'device_offline',
  low_battery:  'low_battery',
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const {
    phone, alias, event_type: eventType,
    device_mac: deviceMac, device_name: deviceName, pet_name: petName,
    description, extra,
  } = body ?? {}

  // ── 1. 参数校验 ──────────────────────────────────────────
  if (!eventType || !VALID_TYPES.has(eventType)) {
    throw createError({ statusCode: 400, message: `event_type 无效，仅支持 breach/offline/low_battery` })
  }
  if (!deviceMac) {
    throw createError({ statusCode: 400, message: 'device_mac 不能为空' })
  }
  // phone 或 alias 至少一个
  const aliasRaw = alias ? String(alias).trim() : (phone ? String(phone).trim() : '')
  if (!aliasRaw) {
    throw createError({ statusCode: 400, message: 'phone 或 alias 不能为空' })
  }

  // ── 2. 反查 user_id（alias 自动补 @qq.com，兼容 PeerApi 只传手机号）──
  const normalizedAlias = aliasRaw.includes('@') ? aliasRaw : `${aliasRaw}@qq.com`
  const db = useDb()
  const [[dbUser]]: any = await db.query(
    'SELECT id FROM t_user WHERE phone = ? AND deleted = 0 LIMIT 1',
    [normalizedAlias]
  )
  if (!dbUser) {
    throw createError({ statusCode: 404, message: `用户不存在（alias=${normalizedAlias}）` })
  }
  const userId = String(dbUser.id)

  // ── 3. 兜底补全 device_name / pet_name ───────────────────
  let finalDeviceName = deviceName || null
  let finalPetName = petName || null

  if (!finalDeviceName) {
    const [[dbDevice]]: any = await db.query(
      'SELECT name FROM t_device WHERE mac = ? AND deleted = 0 LIMIT 1',
      [deviceMac]
    )
    finalDeviceName = dbDevice?.name || deviceMac
  }
  if (!finalPetName) {
    const [[dbPet]]: any = await db.query(
      `SELECT name FROM t_pet WHERE user_id = ? AND deleted = 0
       ORDER BY (device_id IS NOT NULL) DESC, created_at DESC LIMIT 1`,
      [userId]
    )
    finalPetName = dbPet?.name || ''
  }

  // ── 4. 生成默认文案（description 未传时）──────────────────
  let finalDesc = description ? String(description).trim() : ''
  if (!finalDesc) {
    const battery = extra?.battery_percent ?? extra?.battery
    if (eventType === 'breach') {
      finalDesc = `${finalPetName || '宠物'}离开了安全围栏范围`
    } else if (eventType === 'offline') {
      finalDesc = `设备${finalDeviceName}已离线`
    } else if (eventType === 'low_battery') {
      finalDesc = `设备${finalDeviceName}电量不足${battery != null ? `（${battery}%）` : ''}`
    }
  }

  // ── 5. 落库 ──────────────────────────────────────────────
  const id = generateId()
  await db.query(
    `INSERT INTO t_device_event
      (id, user_id, event_type, device_mac, device_name, pet_id, pet_name, description, extra, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 0, NOW())`,
    [
      id, userId, eventType, deviceMac, finalDeviceName,
      finalPetName, finalDesc,
      extra ? JSON.stringify(extra) : null,
    ]
  )
  console.log(`[DeviceEvent] 落库 id=${id} userId=${userId} type=${eventType} mac=${deviceMac}`)

  // ── 6. 同步触发极光推送（失败不影响落库）─────────────────
  try {
    await jpushToDevice(
      userId,
      deviceMac,
      PUSH_TITLE[eventType] || '设备通知',
      finalDesc,
      {
        type: PUSH_TYPE[eventType] || eventType,
        device_mac: deviceMac,
        ...(finalPetName ? { pet_name: finalPetName } : {}),
      },
    )
  } catch (e: any) {
    // 推送失败只记日志，不阻塞回调响应（落库已成功）
    console.error(`[DeviceEvent] 推送失败 id=${id} userId=${userId}: ${e.message}`)
  }

  return { success: true, id: String(id) }
})
