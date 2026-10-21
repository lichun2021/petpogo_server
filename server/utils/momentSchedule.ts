import { createError } from 'h3'
import type { Pool } from 'mysql2/promise'

import type { MomentSchedule, MomentScheduleInput } from '../../shared/types/momentSchedule'

export interface MomentScheduleDefaults {
  momentSchedulerEnabled?: unknown
  momentImageTimes?: unknown
  momentTextTimes?: unknown
}
type ScheduleDb = Pick<Pool, 'query'>
const fields = ['enabled', 'image_times', 'text_times']
const tableReady = new WeakMap<object, Promise<void>>()

export const MOMENT_SCHEDULE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS t_moment_schedule_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  enabled TINYINT NOT NULL,
  image_times JSON NOT NULL,
  text_times JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_moment_schedule_singleton CHECK (id=1),
  CONSTRAINT chk_moment_schedule_enabled CHECK (enabled IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='宠物圈全局定时发送计划'`

/** 严格校验完整替换请求，不容忍缺失字段、字符串布尔值或隐式去重。 */
export function validateMomentSchedule(input: unknown): MomentScheduleInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw createError({ statusCode: 422, message: '配置必须是JSON对象' })
  }
  const value = input as Record<string, unknown>
  if (Object.keys(value).length !== fields.length || fields.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !fields.includes(key))) {
    throw createError({ statusCode: 422, message: '必须且只能提供 enabled、image_times、text_times 三个字段' })
  }
  if (typeof value.enabled !== 'boolean') throw createError({ statusCode: 422, message: 'enabled 必须为JSON布尔值' })
  const times = (list: unknown, label: string): string[] => {
    if (!Array.isArray(list) || list.length > 1440 || list.some(time => typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
      throw createError({ statusCode: 422, message: `${label}必须为HH:MM时间列表，范围00:00至23:59` })
    }
    if (new Set(list).size !== list.length) throw createError({ statusCode: 422, message: `${label}不能包含重复时间点` })
    return [...list].sort()
  }
  return { enabled: value.enabled, image_times: times(value.image_times, '图片圈时间'), text_times: times(value.text_times, '文字圈时间') }
}

/** 建表失败清除Promise，数据库恢复后允许下一次请求重试；不会写入默认配置行。 */
export async function ensureMomentScheduleTable(db: ScheduleDb): Promise<void> {
  let ready = tableReady.get(db)
  if (!ready) {
    ready = db.query('SELECT 1 FROM t_moment_schedule_settings LIMIT 0').catch(error => {
      // 已由DBA建表的账号只需读写权限；仅缺表时才尝试DDL。
      if (error.code !== 'ER_NO_SUCH_TABLE') throw error
      return db.query(MOMENT_SCHEDULE_TABLE_SQL)
    }).then(() => undefined).catch(() => {
      tableReady.delete(db)
      throw createError({ statusCode: 503, message: '数据库未就绪，无法初始化宠物圈定时发布配置' })
    })
    tableReady.set(db, ready)
  }
  await ready
}

function defaultSchedule(config: MomentScheduleDefaults): MomentScheduleInput {
  const parseTimes = (value: unknown, fallback: string) => {
    if (Array.isArray(value)) return value
    const text = value === undefined ? fallback : String(value).trim()
    return text.startsWith('[') ? JSON.parse(text) : text ? text.split(',').map(time => time.trim()) : []
  }
  const enabled = config.momentSchedulerEnabled ?? true
  const on = new Set<unknown>([true, 'true', '1', 1]), off = new Set<unknown>([false, 'false', '0', 0])
  if (!on.has(enabled) && !off.has(enabled)) throw new Error('invalid default switch')
  return validateMomentSchedule({
    enabled: on.has(enabled),
    image_times: parseTimes(config.momentImageTimes, '12:00'),
    text_times: parseTimes(config.momentTextTimes, '09:00,15:00,21:00'),
  })
}

export async function getMomentSchedule(db: ScheduleDb, defaults: MomentScheduleDefaults): Promise<MomentSchedule> {
  try {
    await ensureMomentScheduleTable(db)
    const [[row]]: any = await db.query('SELECT enabled,image_times,text_times FROM t_moment_schedule_settings WHERE id=1')
    let schedule: MomentScheduleInput
    if (row) {
      if (![0, 1].includes(Number(row.enabled))) throw new Error('invalid saved switch')
      schedule = validateMomentSchedule({ enabled: Number(row.enabled) === 1,
        image_times: typeof row.image_times === 'string' ? JSON.parse(row.image_times) : row.image_times,
        text_times: typeof row.text_times === 'string' ? JSON.parse(row.text_times) : row.text_times })
    } else schedule = defaultSchedule(defaults)
    return { ...schedule, timezone: 'Asia/Shanghai' }
  } catch {
    throw createError({ statusCode: 503, message: '数据库或默认配置未就绪，无法读取宠物圈定时发布配置' })
  }
}

export async function saveMomentSchedule(db: ScheduleDb, input: unknown): Promise<MomentSchedule> {
  const schedule = validateMomentSchedule(input)
  try {
    await ensureMomentScheduleTable(db)
    // 单行原子替换；只有数据库写入成功才返回，不维护可能与数据库分叉的进程内缓存。
    await db.query(`INSERT INTO t_moment_schedule_settings(id,enabled,image_times,text_times)
      VALUES(1,?,?,?) ON DUPLICATE KEY UPDATE enabled=VALUES(enabled),image_times=VALUES(image_times),text_times=VALUES(text_times)`,
    [schedule.enabled ? 1 : 0, JSON.stringify(schedule.image_times), JSON.stringify(schedule.text_times)])
    return { ...schedule, timezone: 'Asia/Shanghai' }
  } catch {
    throw createError({ statusCode: 503, message: '数据库未就绪，无法保存宠物圈定时发布配置' })
  }
}
