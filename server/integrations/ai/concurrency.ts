import { createError } from 'h3'

// PM2 当前单实例：无排队占用，避免大量长连接同时压住 AI 与内存。
let total = 0
const users = new Map<string, { count: number; streams: number }>()
export function acquireAiSlot(userId: string, stream: boolean) {
  const user = users.get(userId) ?? { count: 0, streams: 0 }
  if (total >= 32 || user.count >= 8 || (stream && user.streams >= 2)) {
    throw createError({ statusCode: 429, message: 'AI 请求过多，请等待当前请求完成' })
  }
  total++; user.count++; if (stream) user.streams++
  users.set(userId, user)
  let released = false
  return () => {
    if (released) return
    released = true
    total--; user.count--; if (stream) user.streams--
    if (!user.count) users.delete(userId)
  }
}
