// POST /sdkapi/ai/use-once
// App 调用大模型成功后，调用此接口扣减一次配额
// 返回：已用次数、总额度、剩余次数（VIP 用户均为 -1 表示无限）

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  // 检查是否还有额度
  const before = await checkAiQuota(user.userId)
  if (!before.allowed) {
    throw createError({
      statusCode: 429,
      message: `今日 AI 次数已用完（${before.limit} 次），升级 VIP 享无限次数`,
      data: { used: before.used, limit: before.limit, remaining: 0 },
    })
  }

  // 扣一次
  const after = await incrAiUsage(user.userId)

  return {
    used:      after.used,       // 今日已用次数
    limit:     after.limit,      // 总额度（-1=无限）
    remaining: after.remaining,  // 剩余次数（-1=无限）
  }
})
