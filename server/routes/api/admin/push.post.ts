// POST /api/admin/push — 管理后台推送接口（需管理员鉴权）

export default defineEventHandler(async (event) => {


  const body = await readBody(event)
  const { targetType, alias, title, content, extras } = body ?? {}

  if (!title?.trim()) throw createError({ statusCode: 400, message: '标题不能为空' })
  if (!content?.trim()) throw createError({ statusCode: 400, message: '内容不能为空' })

  // 构造 audience
  let audience: any
  if (targetType === 'all') {
    audience = { type: 'all' }
  } else if (targetType === 'alias' && alias) {
    // alias 支持逗号分隔多个用户 ID
    const aliases = String(alias).split(/[,，\s]+/).filter(Boolean)
    if (!aliases.length) throw createError({ statusCode: 400, message: '请输入至少一个用户 ID' })
    audience = { type: 'alias', alias: aliases }
  } else {
    throw createError({ statusCode: 400, message: 'targetType 无效，可选 all / alias' })
  }

  // 解析 extras（JSON 字符串 → 对象）
  let parsedExtras: Record<string, string> = {}
  if (extras) {
    try { parsedExtras = JSON.parse(extras) } catch { /* 忽略非法 JSON */ }
  }

  const result = await jpushSend({ audience, title, content, extras: parsedExtras })

  return {
    success: true,
    msgId: result.msg_id,
    sendno: result.sendno,
  }
})
