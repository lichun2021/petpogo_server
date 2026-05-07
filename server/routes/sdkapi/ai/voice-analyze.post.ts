// POST /sdkapi/ai/voice-analyze
// 宠物音频情绪分析
//
// 请求体：
//   audioUrl  string   OSS 音频文件 URL（必填）
//   petId?    string   宠物ID（可选，便于历史记录关联）
//
// 响应：分析结果 + 剩余配额

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  // ── 1. 检查配额 ─────────────────────────────────
  const quotaBefore = await checkAiQuota(user.userId)
  if (!quotaBefore.allowed) {
    throw createError({
      statusCode: 429,
      message: `今日 AI 使用次数已达上限（${quotaBefore.limit} 次），升级 VIP 享无限次数`,
      data: { used: quotaBefore.used, limit: quotaBefore.limit, remaining: 0 },
    })
  }

  const { audioUrl, petId } = await readBody(event)
  if (!audioUrl) {
    throw createError({ statusCode: 400, message: 'audioUrl 不能为空' })
  }

  const config = useRuntimeConfig()
  const AI_URL = config.aiServiceUrl || 'http://49.234.39.11:8002'

  // ── 2. 调用 AI 音频分析接口 ──────────────────────
  let aiResult: any
  try {
    // /voice/analyze 支持传 url 参数（form-data）
    const form = new FormData()
    form.append('url', audioUrl)

    aiResult = await $fetch(`${AI_URL}/voice/analyze`, {
      method: 'POST',
      body: form,
    })
  } catch (e: any) {
    throw createError({
      statusCode: 502,
      message: `音频 AI 服务异常: ${e.message ?? '未知错误'}`,
    })
  }

  if (!aiResult?.success) {
    throw createError({
      statusCode: 422,
      message: aiResult?.error ?? 'AI 分析失败，请检查音频文件',
    })
  }

  // ── 3. 成功后扣减配额 ────────────────────────────
  const quotaAfter = await incrAiUsage(user.userId)

  // ── 4. 保存结果到数据库 ──────────────────────────
  const db = useDb()
  const id = generateId()

  const primary = aiResult.primary_emotion ?? {}
  const speciesInfo = aiResult.species ?? {}

  await db.query(
    `INSERT INTO t_pet_voice_analysis
      (id, user_id, pet_id, audio_url,
       species, species_conf,
       emotion, emotion_zh, emotion_conf,
       top3, all_predictions, advice, processing_ms, raw_result)
     VALUES (?,?,?,?, ?,?, ?,?,?, ?,?,?,?,?)`,
    [
      id,
      user.userId,
      petId || null,
      audioUrl,
      speciesInfo.label   ?? null,
      speciesInfo.confidence ?? null,
      primary.label       ?? null,
      primary.label_zh    ?? null,
      primary.confidence  ?? null,
      JSON.stringify(aiResult.top3 ?? []),
      JSON.stringify(aiResult.all_predictions ?? {}),
      aiResult.advice     ?? null,
      Math.round(aiResult.processing_time_ms ?? 0),
      JSON.stringify(aiResult),
    ]
  )

  // ── 5. 返回结果 ──────────────────────────────────
  return {
    id:        String(id),
    species:   speciesInfo,
    emotion:   primary,
    top3:      aiResult.top3      ?? [],
    advice:    aiResult.advice    ?? '',
    processingMs: Math.round(aiResult.processing_time_ms ?? 0),
    _quota: {
      used:      quotaAfter.used,
      limit:     quotaAfter.limit,
      remaining: quotaAfter.remaining,
    },
  }
})
