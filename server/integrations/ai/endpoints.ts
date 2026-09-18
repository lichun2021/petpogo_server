// 只开放当前 App 使用的 20 条接口，设备上报和管理员调度不包含在内。
export interface AiEndpoint {
  path: string
  fields: string[]
  required: string[]
  access: 'pet' | 'session' | 'device' | 'account'
  multipart?: boolean
  stream?: boolean
  recordingStop?: boolean
}
const endpoint = (path: string, required: string, optional: string, access: AiEndpoint['access']): AiEndpoint => ({
  path, fields: `${required} ${optional}`.split(' ').filter(Boolean), required: required.split(' ').filter(Boolean), access,
})
const settingFields = 'device_no effective_start_time effective_end_time repeat_weekdays daily_analysis_count'
export const aiEndpoints: readonly AiEndpoint[] = [
  endpoint('/session/new', 'pet_id', '', 'pet'),
  endpoint('/session/delete', 'session_id', '', 'session'),
  endpoint('/messages', 'session_id text', '', 'session'),
  { ...endpoint('/messages/stream', 'session_id text', '', 'session'), stream: true },
  endpoint('/report', 'session_id', '', 'session'),
  endpoint('/session/by-pet', 'pet_id', '', 'pet'),
  endpoint('/session/messages', 'session_id', '', 'session'),
  endpoint('/health-data/overview', 'pet_id', 'date', 'pet'),
  endpoint('/health-data/health-report', 'pet_id', 'date', 'pet'),
  endpoint('/health-data/behavior-analysis', 'pet_id', 'date period', 'pet'),
  endpoint('/health-data/exercise-data', 'pet_id', 'date period', 'pet'),
  { ...endpoint('/voice/analyze', 'url', 'account pet_id', 'account'), multipart: true },
  { ...endpoint('/image/analyze', 'url', 'account pet_id', 'account'), multipart: true },
  endpoint('/video/stream/auto-analysis/settings/save', settingFields, 'account enabled', 'device'),
  endpoint('/video/stream/auto-analysis/settings/disable', 'device_no enabled', 'account', 'device'),
  // 保留上游 404 等结果，接口修复由 AI 服务负责。
  endpoint('/video/stream/auto-analysis/tasks', 'device_no', 'account', 'device'),
  endpoint('/voice/stream/auto-analysis/settings/save', settingFields, 'account enabled', 'device'),
  endpoint('/voice/stream/auto-analysis/settings/disable', 'device_no enabled', 'account', 'device'),
  endpoint('/video/recording/start', 'device_no', 'account', 'device'),
  { ...endpoint('/video/recording/stop', 'device_no', 'account', 'device'), recordingStop: true },
]
