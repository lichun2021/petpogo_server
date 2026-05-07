// POST /sdkapi/ai/image-analyze
// 宠物图片情绪分析（猫 / 狗）
//
// 请求体：
//   imageUrl  string   OSS 图片 URL（必填）
//   petId?    string   宠物ID（可选）
//
// 响应：分析结果 + 剩余配额

import axios from 'axios'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  // ── 1. 检查配额 ─────────────────────────────────
  console.log('[AI图片] Step1: 检查配额, userId=', user.userId)
  const quotaBefore = await checkAiQuota(user.userId)
  console.log('[AI图片] Step1 完成: quota=', JSON.stringify(quotaBefore))
  if (!quotaBefore.allowed) {
    throw createError({
      statusCode: 429,
      message: `今日 AI 使用次数已达上限（${quotaBefore.limit} 次），升级 VIP 享无限次数`,
      data: { used: quotaBefore.used, limit: quotaBefore.limit, remaining: 0 },
    })
  }

  const { imageUrl, petId } = await readBody(event)
  console.log('[AI图片] Step2: 收到 imageUrl=', imageUrl, 'petId=', petId)
  if (!imageUrl) {
    throw createError({ statusCode: 400, message: 'imageUrl 不能为空' })
  }

  const config = useRuntimeConfig()
  const AI_URL = config.aiServiceUrl || 'http://49.234.39.11:8002'
  console.log('[AI图片] Step3: 准备调用AI, url=', `${AI_URL}/image/analyze-url`)

  // ── 2. 调用 AI 图片分析（JSON URL 方式）──────────
  // POST /image/analyze-url  Body: { "url": "https://..." }
  let aiResult: any
  try {
    console.log('[AI图片] Step3: 发起 axios 请求...')
    const aiResp = await axios.post(
      `${AI_URL}/image/analyze-url`,
      { url: imageUrl },
      { timeout: 60000 }
    )
    console.log('[AI图片] Step3 完成: status=', aiResp.status, 'success=', aiResp.data?.success)
    aiResult = aiResp.data
  } catch (e: any) {
    const errMsg = e.response?.data?.detail ?? e.message ?? '未知错误'
    console.error('[AI图片] Step3 失败:', errMsg, 'code=', e.code, 'status=', e.response?.status)
    throw createError({
      statusCode: 502,
      message: `图片 AI 服务异常: ${errMsg}`,
    })
  }

  console.log('[AI图片] Step4: AI结果 success=', aiResult?.success)
  if (!aiResult?.success) {
    // 把 AI 返回的具体原因 + 当前配额信息一起返回给前端
    const reason = aiResult?.error ?? aiResult?.message ?? aiResult?.detail ?? 'AI 分析失败，请检查图片文件'
    console.warn('[AI图片] AI拒绝分析:', reason)
    const quotaInfo = await getAiUsageInfo(user.userId)
    throw createError({
      statusCode: 422,
      message: reason,
      data: {
        aiRaw: aiResult,
        _quota: {
          used:      quotaInfo.used,
          limit:     quotaInfo.limit,
          remaining: quotaInfo.remaining,
        },
      },
    })
  }

  // ── 3. 成功后扣减配额 ────────────────────────────
  console.log('[AI图片] Step5: 扣减配额')
  const quotaAfter = await incrAiUsage(user.userId)
  console.log('[AI图片] Step5 完成: remaining=', quotaAfter.remaining)

  // ── 4. 保存结果到数据库 ──────────────────────────
  // 字段映射：AI返回 primary_emotion / top3_emotions / all_emotions
  const db = useDb()
  const id = generateId()
  const primary = aiResult.primary_emotion ?? {}
  const top3    = aiResult.top3_emotions   ?? []
  const allEmo  = aiResult.all_emotions    ?? {}

  await db.query(
    `INSERT INTO t_pet_image_analysis
      (id, user_id, pet_id, image_url,
       emotion, emotion_zh, emotion_conf,
       top3, all_predictions, advice,
       ensemble_size, processing_ms, raw_result)
     VALUES (?,?,?,?, ?,?,?, ?,?,?, ?,?,?)`,
    [
      id,
      user.userId,
      petId || null,
      imageUrl,
      primary.label       ?? null,
      primary.label_zh    ?? null,
      primary.confidence  ?? null,
      JSON.stringify(top3),
      JSON.stringify(allEmo),
      aiResult.advice     ?? null,
      aiResult.emotion_model_count ?? null,
      Math.round(aiResult.processing_time_ms ?? 0),
      JSON.stringify(aiResult),
    ]
  )

  // ── 5. 返回结果 ──────────────────────────────────
  return {
    id:           String(id),
    species:      aiResult.species    ?? '',
    species_zh:   aiResult.species_zh ?? '',
    breed:        aiResult.breed      ?? null,
    emotion:      primary,
    top3:         top3,
    advice:       aiResult.advice     ?? '',
    modelCount:   aiResult.emotion_model_count ?? 0,
    processingMs: Math.round(aiResult.processing_time_ms ?? 0),
    _quota: {
      used:      quotaAfter.used,
      limit:     quotaAfter.limit,
      remaining: quotaAfter.remaining,
    },
  }
})
