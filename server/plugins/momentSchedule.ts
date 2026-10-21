import { ensureMomentScheduleTable } from '../utils/momentSchedule'
import { formatRequestLog } from '../utils/requestLog'

export default defineNitroPlugin(async () => {
  try {
    await ensureMomentScheduleTable(useDb())
  } catch {
    // 启动可继续，读写接口持续返回503；数据库恢复后请求会重新尝试初始化。
    console.error(formatRequestLog({ event: 'moment.schedule.init_failed', errorCode: 'MOMENT_SCHEDULE_UNAVAILABLE', reason: '宠物圈计划表初始化失败，请检查数据库或执行建表SQL' }))
  }
})
