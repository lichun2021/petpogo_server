// POST /sdkapi/ai/voice-analyze
// 宠物音频情绪分析
//
// 请求体：
//   audioUrl  string   OSS 音频 URL（必填）
//   petId?    string   宠物ID（可选）
//
// 响应：分析结果
// 注：积分消耗由 AI 服务事后调用 POST /openapi/ai/consumption 上报，本接口不再管理积分

import axios from 'axios'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const { audioUrl, petId } = await readBody(event)
  if (!audioUrl) {
    throw createError({ statusCode: 400, message: 'audioUrl 不能为空' })
  }

  const config = useRuntimeConfig()
  const AI_URL = config.aiServiceUrl || 'http://49.234.39.11:8002'

  // ── 2. 调用 AI 音频分析（JSON URL 方式）──────────
  // POST /voice/analyze-url  Body: { "url": "https://..." }
  let aiResult: any
  try {
    const aiResp = await axios.post(
      `${AI_URL}/voice/analyze-url`,
      { url: audioUrl },
      { timeout: 120000 }  // 音频模型较重，等待 120s
    )
    aiResult = aiResp.data
  } catch (e: any) {
    const errMsg = e.response?.data?.detail ?? e.message ?? '未知错误'
    // 真实错误（含 AI 服务 detail）只进 pm2 日志，不透传给客户端
    console.error('[AI音频] 失败:', errMsg, 'code=', e.code, 'status=', e.response?.status)
    throw createError({
      statusCode: 502,
      message: '音频 AI 服务暂时不可用，请稍后重试',
    })
  }

  if (!aiResult?.success) {
    const reason = aiResult?.error ?? aiResult?.message ?? aiResult?.detail ?? 'AI 分析失败，请检查音频文件格式（支持 WAV / MP3）'
    return {
      success: false,
      reason,
    }
  }

  // ── 4. 保存结果到数据库 ──────────────────────────
  const db = useDb()
  const id = generateId()
  const primary     = aiResult.primary_emotion ?? {}
  const speciesInfo = { label: aiResult.species, confidence: aiResult.species_confidence }
  const top3        = aiResult.top3 ?? []

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
      aiResult.species            ?? null,
      aiResult.species_confidence ?? null,
      primary.label               ?? null,
      primary.label_zh            ?? null,
      primary.confidence          ?? null,
      JSON.stringify(top3),
      JSON.stringify(aiResult.all_predictions ?? {}),
      aiResult.advice             ?? null,
      Math.round(aiResult.processing_time_ms ?? 0),
      JSON.stringify(aiResult),
    ]
  )

  // ── 5. 返回结果 ──────────────────────────────────
  return {
    id:      String(id),
    species: speciesInfo,
    emotion: primary,
    top3,
    advice:  aiResult.advice ?? '',
    processingMs: Math.round(aiResult.processing_time_ms ?? 0),
  }
})
