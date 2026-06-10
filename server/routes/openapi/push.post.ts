// POST /openapi/push  —— 对外开放推送接口
// 第三方调用此接口，通过极光推送向 PetPogo 用户发送通知
//
// 请求体：
// {
//   "targetType": "alias" | "all",
//   "alias": ["1001", "1002"],   // targetType=alias 时必填，支持多个 userId
//   "title": "通知标题",
//   "content": "通知内容",
//   "extras": { "key": "value" } // 可选，App 点击通知后可读取
// }

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { targetType, alias, title, content, extras } = body ?? {}

  // 参数校验
  if (!title?.trim())   throw createError({ statusCode: 400, message: 'title 不能为空' })
  if (!content?.trim()) throw createError({ statusCode: 400, message: 'content 不能为空' })
  if (!['all', 'alias'].includes(targetType)) {
    throw createError({ statusCode: 400, message: 'targetType 只支持 all / alias' })
  }

  let audience: any
  if (targetType === 'all') {
    audience = { type: 'all' }
  } else {
    // alias 支持数组或逗号分隔字符串
    const aliasList: string[] = Array.isArray(alias)
      ? alias.map(String)
      : String(alias || '').split(/[,，\s]+/).filter(Boolean)

    if (!aliasList.length) {
      throw createError({ statusCode: 400, message: 'alias 不能为空' })
    }
    if (aliasList.length > 1000) {
      throw createError({ statusCode: 400, message: 'alias 单次最多 1000 个' })
    }
    audience = { type: 'alias', alias: aliasList }
  }

  // 解析 extras
  let parsedExtras: Record<string, string> = {}
  if (extras && typeof extras === 'object') {
    parsedExtras = extras
  } else if (typeof extras === 'string') {
    try { parsedExtras = JSON.parse(extras) } catch { /* 忽略 */ }
  }

  const result = await jpushSend({
    audience,
    title:   title.trim(),
    content: content.trim(),
    extras:  parsedExtras,
  })

  console.log(`[OpenAPI/Push] targetType=${targetType} title="${title}" msg_id=${result.msg_id}`)

  return {
    success: true,
    msgId:   result.msg_id,
    sendno:  result.sendno,
  }
})
