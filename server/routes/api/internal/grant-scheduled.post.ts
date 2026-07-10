// POST /api/internal/grant-scheduled
// 定时任务入口：由系统 cron 每天调用一次，批量发放到期的周期积分。
// 用户不在线也照常发放（写入 t_user_points_batch）。
//
// 鉴权：header x-task-key 需匹配 runtimeConfig.internalTaskKey
// crontab 示例（每天凌晨 3:00）：
//   0 3 * * * curl -sS -X POST -H "x-task-key: <INTERNAL_TASK_KEY>" http://127.0.0.1:3000/api/internal/grant-scheduled >> /data/petpogo-server/logs/grant.log 2>&1
//
// Body（可选）：
//   batchSize  number  单次扫描用户上限（默认 500，用户量大时可调大或多调几次）
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const key = getHeader(event, 'x-task-key')
  if (!key || key !== config.internalTaskKey) {
    throw createError({ statusCode: 403, message: 'Invalid task key' })
  }

  const body = await readBody(event).catch(() => ({} as any))
  const { batchSize } = body || {}
  const result = await grantScheduledPoints(Number(batchSize) || 500)

  console.log(`[内部定时任务] 周期积分发放完成: 扫描 ${result.scanned} 人, 发放 ${result.granted} 人`)
  return { success: true, ...result, at: new Date().toISOString() }
})
