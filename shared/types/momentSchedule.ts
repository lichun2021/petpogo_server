export interface MomentScheduleInput {
  enabled: boolean
  image_times: string[]
  text_times: string[]
}
export interface MomentSchedule extends MomentScheduleInput { timezone: 'Asia/Shanghai' }
export interface MomentScheduleResponse { code: 0; info: MomentSchedule; tip: string }
