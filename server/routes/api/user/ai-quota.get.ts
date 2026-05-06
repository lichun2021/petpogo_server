// GET /api/user/ai-quota
// 查询当前用户今日 AI 使用量
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const info = await getAiUsageInfo(user.userId)

  return {
    vip: info.limit === -1,
    used: info.used,
    limit: info.limit,        // -1 = 无限制
    remaining: info.remaining, // -1 = 无限制
    allowed: info.allowed,
  }
})
