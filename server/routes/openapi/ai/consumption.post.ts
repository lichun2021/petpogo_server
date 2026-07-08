// POST /openapi/ai/consumption — AI 服务上报消费事件（OpenAPI 鉴权）
//
// AI 服务（图片分析/语音分析/AI问诊等）在完成一次调用后，主动调用此接口
// 上报消费类型与数量，由本后台按 t_points_consume_rule 配置的单价扣减用户积分。
//
// Body：
//   phone        string  用户手机号（必填，反查 t_user）
//   consumeType  string  消费类型标识，对应 t_points_consume_rule.consume_type（必填）
//   quantity     number  消费数量，per_call 类型可不传/传1；per_unit 类型为实际数量（如 token数/1000）
//   refId        string  可选，AI 服务自己的记录ID，写入积分流水 ref_id 便于追溯

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { phone, consumeType, quantity, refId } = body ?? {}

  if (!phone?.trim())       throw createError({ statusCode: 400, message: 'phone 不能为空' })
  if (!consumeType?.trim()) throw createError({ statusCode: 400, message: 'consumeType 不能为空' })

  const db = useDb()

  const [[user]]: any = await db.query(
    'SELECT id FROM t_user WHERE phone = ? AND deleted = 0 LIMIT 1',
    [String(phone).trim()]
  )
  if (!user) throw createError({ statusCode: 404, message: '用户不存在（phone 无效）' })

  const [[rule]]: any = await db.query(
    'SELECT * FROM t_points_consume_rule WHERE consume_type = ? AND status = 1 LIMIT 1',
    [String(consumeType).trim()]
  )
  if (!rule) throw createError({ statusCode: 400, message: `消费规则未配置: ${consumeType}` })

  const qty = rule.unit_basis === 'per_unit' ? Math.max(1, Number(quantity) || 1) : 1
  const cost = rule.unit_points * qty

  console.log(`[OpenAPI/AI消费] userId=${user.id} phone=${phone} consumeType=${consumeType} qty=${qty} cost=${cost}`)

  try {
    const balance = await spendPoints(String(user.id), cost, rule.name, 'ai_consumption', refId ? String(refId) : undefined)
    return { success: true, deducted: cost, balance }
  } catch (e: any) {
    if (e?.statusCode === 402) {
      // 积分不足：如实记录余额不够，不阻塞 AI 服务，由其自行决定策略
      return { success: false, deducted: 0, message: e.message, balance: e.data ?? null }
    }
    throw e
  }
})
