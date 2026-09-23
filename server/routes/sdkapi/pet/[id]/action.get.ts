// App 轮询宠物当前硬件动作码 + 映射到的动画片段标识码（Redis优先 + DB兜底，映射在读时解析）
// 动画片段（clip）内嵌在当前加载的宠物形象 GLB 里，App 端按 clipCode 去模型内查找同名动画播放，不是独立文件。
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少宠物ID' })

  const db = useDb()
  const [[pet]]: any = await db.query(
    'SELECT id, device_id FROM t_pet WHERE id=? AND user_id=? AND deleted=0 LIMIT 1',
    [id, user.userId]
  )
  if (!pet) throw createError({ statusCode: 404, message: '宠物不存在' })
  if (!pet.device_id) return { code: null, reportedAt: null, clipCode: null }

  const deviceId = String(pet.device_id)
  await assertDeviceAccess(event,deviceId)
  const redis = useRedis()
  const cached = await redis.get(RedisKey.petAction(deviceId))

  let code: string | null = null
  let reportedAt: string | null = null

  if (cached) {
    const parsed = JSON.parse(cached)
    code = parsed.code
    reportedAt = parsed.reportedAt
  } else {
    // Redis 缓存缺失时，回退到统一事件日志里该设备最近一次硬件动作上报
    const [[row]]: any = await db.query(
      `SELECT h.code, e.occurred_at
         FROM t_pet_event e
         JOIN t_pet_hardware_action_type h ON h.id = e.ref_type_id
        WHERE e.source='hardware_action' AND e.device_id=?
        ORDER BY e.occurred_at DESC LIMIT 1`,
      [deviceId]
    )
    if (row) {
      code = row.code
      reportedAt = row.occurred_at
    }
  }

  if (!code) return { code: null, reportedAt: null, clipCode: null }

  // 状态时效性校验：超过 1 分钟没有新上报，视为过期（硬件可能已断连），不返回陈旧状态
  const reportedAtMs = reportedAt ? new Date(reportedAt).getTime() : 0
  if (!reportedAtMs || Date.now() - reportedAtMs > 60 * 1000) {
    return { code: null, reportedAt: null, clipCode: null }
  }

  const [[actionType]]: any = await db.query(
    `SELECT ga.code AS clip_code
       FROM t_pet_hardware_action_type h
       LEFT JOIN t_pet_glb_action ga ON ga.id = h.glb_action_id AND ga.deleted=0 AND ga.enabled=1
      WHERE h.code=? AND h.deleted=0 LIMIT 1`,
    [code]
  )

  return {
    code,
    reportedAt,
    clipCode: actionType?.clip_code || null,
  }
})
