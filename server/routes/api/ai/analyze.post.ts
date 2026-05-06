// POST /api/ai/analyze
// 调用 AI 大模型分析（带每日限流）
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  // ── 检查并消耗配额 ──────────────────────────
  const quota = await checkAndIncrAiUsage(user.userId)
  if (!quota.allowed) {
    throw createError({
      statusCode: 429,
      message: `今日 AI 使用次数已达上限（${quota.limit} 次），升级 VIP 享无限次数`,
      data: { used: quota.used, limit: quota.limit, remaining: 0 },
    })
  }

  const body = await readBody(event)
  const config = useRuntimeConfig()

  // ── 转发到 AI 服务 ──────────────────────────
  // 替换为你的 AI 模型服务地址
  const AI_SERVICE_URL = config.aiServiceUrl || 'http://localhost:8000'

  try {
    const result = await $fetch(`${AI_SERVICE_URL}/image/analyze`, {
      method: 'POST',
      body,
    })

    return {
      ...result as object,
      _quota: {
        used: quota.used,
        limit: quota.limit,
        remaining: quota.remaining,
      },
    }
  } catch (e: any) {
    // AI 调用失败时退还配额（回滚 +1）
    const db = useDb()
    const today = new Date().toISOString().slice(0, 10)
    await db.query(
      `UPDATE t_ai_usage SET used_count = GREATEST(0, used_count - 1)
       WHERE user_id = ? AND use_date = ?`,
      [user.userId, today]
    )
    throw createError({ statusCode: 502, message: `AI 服务异常: ${e.message}` })
  }
})
