import { createError, defineEventHandler, getHeader, readBody, setHeader, setResponseStatus, type H3Event } from 'h3'
import { requireSuperAdmin } from '../../utils/adminAuth'
import { getMomentSchedule, saveMomentSchedule } from '../../utils/momentSchedule'
import { readProxyBody } from '../shared/bounds'

async function handleSchedule(event: H3Event) {
  setHeader(event, 'Cache-Control', 'no-store')
  try {
    let info
    if (event.method === 'GET') {
      info = await getMomentSchedule(useDb(), useRuntimeConfig())
    } else if (event.method === 'POST') {
      const contentType = (getHeader(event, 'content-type') || '').split(';')[0].trim().toLowerCase()
      if (contentType !== 'application/json') throw createError({ statusCode: 415, message: '请使用 application/json 请求体' })
      await readProxyBody(event)
      const input = await readBody(event)
      info = await saveMomentSchedule(useDb(), input)
    } else throw createError({ statusCode: 405, message: '仅支持GET和POST' })
    return { code: 0, info, tip: '响应成功' }
  } catch (error: any) {
    const status = [400, 405, 408, 413, 415, 422, 503].includes(error.statusCode) ? error.statusCode : 503
    const tip = status === 503 ? (event.method === 'POST' ? '数据库未就绪，无法保存宠物圈定时发布配置' : '数据库或默认配置未就绪，无法读取宠物圈定时发布配置')
      : status === 400 ? '请求体不是有效JSON' : error.message
    event.context.requestErrorCode = status === 503 ? 'MOMENT_SCHEDULE_UNAVAILABLE' : 'MOMENT_SCHEDULE_INVALID_REQUEST'
    event.context.requestErrorReason = tip
    setResponseStatus(event, status)
    return { code: status, info: null, tip }
  }
}

export const openapiMomentScheduleHandler = defineEventHandler(handleSchedule)
export const adminMomentScheduleHandler = defineEventHandler(async event => {
  requireSuperAdmin(event)
  return handleSchedule(event)
})
