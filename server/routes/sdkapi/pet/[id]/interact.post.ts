// 对宠物执行一次互动（喂食/逗猫/清洁等），应用衰减后再叠加互动效果，返回新属性 + 对应动画片段标识码
// body: { interactionCode: string }  —— 对应 t_pet_interaction_type.code
// 动画片段（clip）内嵌在当前加载的宠物形象 GLB 里，App 端按 clipCode 去模型里查找同名动画播放，
// 不是独立文件，所以这里不返回也不存在 glbUrl。
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: '缺少宠物ID' })

  const { interactionCode } = await readBody(event)
  if (!interactionCode) throw createError({ statusCode: 400, message: '缺少 interactionCode' })

  const db = useDb()

  const [[pet]]: any = await db.query(
    'SELECT id, satiety, mood, cleanliness, stats_updated_at FROM t_pet WHERE id=? AND user_id=? AND deleted=0 LIMIT 1',
    [id, user.userId]
  )
  if (!pet) throw createError({ statusCode: 404, message: '宠物不存在' })

  const [[interactionType]]: any = await db.query(
    `SELECT it.id, it.satiety_delta, it.mood_delta, it.cleanliness_delta, it.glb_action_id, ga.code AS clip_code
       FROM t_pet_interaction_type it
       LEFT JOIN t_pet_glb_action ga ON ga.id = it.glb_action_id AND ga.deleted = 0 AND ga.enabled = 1
      WHERE it.code=? AND it.deleted=0 AND it.enabled=1 LIMIT 1`,
    [interactionCode]
  )
  if (!interactionType) throw createError({ statusCode: 400, message: '互动类型不存在或已停用' })

  const decayed = computeDecayedStats(
    { satiety: pet.satiety, mood: pet.mood, cleanliness: pet.cleanliness },
    pet.stats_updated_at
  )
  const newStats = applyInteractionEffect(decayed, interactionType)

  await db.query(
    'UPDATE t_pet SET satiety=?, mood=?, cleanliness=?, stats_updated_at=NOW(), updated_at=NOW() WHERE id=?',
    [newStats.satiety, newStats.mood, newStats.cleanliness, id]
  )

  // 记录到统一宠物事件日志
  const eventId = generateId()
  await db.query(
    `INSERT INTO t_pet_event (id, source, pet_id, device_id, ref_type_id, occurred_at, created_at)
     VALUES (?, 'interaction', ?, NULL, ?, NOW(), NOW())`,
    [eventId, id, interactionType.id]
  )

  return {
    ...newStats,
    clipCode: interactionType.clip_code || null,
  }
})
