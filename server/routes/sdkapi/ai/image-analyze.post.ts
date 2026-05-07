// POST /sdkapi/ai/image-analyze
// 宠物图片情绪分析
//
// 请求体：
//   imageUrl  string   OSS 图片 URL（必填）
//   petId?    string   宠物ID（可选）
//
// 响应：分析结果 + 剩余配额

import axios from 'axios'
import FormData from 'form-data'

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

  const { imageUrl, petId } = await readBody(event)
  if (!imageUrl) {
    throw createError({ statusCode: 400, message: 'imageUrl 不能为空' })
  }

  const config = useRuntimeConfig()
  const AI_URL = config.aiServiceUrl || 'http://49.234.39.11:8002'

  // ── 2. 从 OSS 下载图片 Buffer ────────────────────
  let imageBuffer: Buffer
  let contentType = 'image/jpeg'
  try {
    const resp = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
    })
    imageBuffer = Buffer.from(resp.data)
    contentType = (resp.headers['content-type'] as string) || 'image/jpeg'
  } catch (e: any) {
    throw createError({
      statusCode: 502,
      message: `图片下载失败: ${e.message ?? '请检查 OSS URL 是否有效'}`,
    })
  }

  // ── 3. 构建 multipart/form-data 发给 AI 服务 ─────
  // 从 URL 中提取文件名
  const fileName = imageUrl.split('/').pop()?.split('?')[0] || 'image.jpg'

  let aiResult: any
  try {
    const form = new FormData()
    form.append('file', imageBuffer, {
      filename: fileName,
      contentType,
    })

    const aiResp = await axios.post(`${AI_URL}/dog-image/analyze`, form, {
      headers: form.getHeaders(),
      timeout: 60000,  // AI 分析最多等 60s
    })
    aiResult = aiResp.data
  } catch (e: any) {
    const errMsg = e.response?.data?.detail ?? e.message ?? '未知错误'
    throw createError({
      statusCode: 502,
      message: `图片 AI 服务异常: ${errMsg}`,
    })
  }

  if (!aiResult?.success) {
    throw createError({
      statusCode: 422,
      message: aiResult?.error ?? 'AI 分析失败，请检查图片文件',
    })
  }

  // ── 4. 成功后扣减配额 ────────────────────────────
  const quotaAfter = await incrAiUsage(user.userId)

  // ── 5. 保存结果到数据库 ──────────────────────────
  const db = useDb()
  const id = generateId()
  const primary = aiResult.primary_emotion ?? {}

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
      primary.label        ?? null,
      primary.label_zh     ?? null,
      primary.confidence   ?? null,
      JSON.stringify(aiResult.top3            ?? []),
      JSON.stringify(aiResult.all_predictions ?? {}),
      aiResult.advice      ?? null,
      aiResult.ensemble_size ?? null,
      Math.round(aiResult.processing_time_ms  ?? 0),
      JSON.stringify(aiResult),
    ]
  )

  // ── 6. 返回结果 ──────────────────────────────────
  return {
    id:          String(id),
    emotion:     primary,
    top3:        aiResult.top3    ?? [],
    advice:      aiResult.advice  ?? '',
    ensembleSize: aiResult.ensemble_size ?? 0,
    processingMs: Math.round(aiResult.processing_time_ms ?? 0),
    _quota: {
      used:      quotaAfter.used,
      limit:     quotaAfter.limit,
      remaining: quotaAfter.remaining,
    },
  }
})
