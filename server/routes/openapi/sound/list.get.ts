// GET /openapi/sound/list — 设备端查声音列表（OpenAPI 鉴权）
//
// 设备通过 alias 查对应用户的声音列表（用户自定义在前，预设补后）
//
// 查询参数:
//   alias     string  用户 alias（手机号@qq.com，必填）
//   pet_type  string  宠物类型 cat/dog（必填，默认 cat）
//   emotion   string  按情绪类型筛选（可选）

export default defineEventHandler(async (event) => {
  const query    = getQuery(event)
  const alias    = query.alias    ? String(query.alias).trim()    : ''
  const petType  = query.pet_type ? String(query.pet_type).trim() : 'cat'
  const emotion  = query.emotion  ? String(query.emotion).trim()  : null

  if (!alias) throw createError({ statusCode: 400, message: 'alias 不能为空（手机号@qq.com）' })

  const db = useDb()

  // 通过 alias 反查 user_id
  const phone = alias.split('@')[0].trim()
  const [[dbUser]]: any = await db.query(
    'SELECT id FROM t_user WHERE phone = ? AND deleted = 0 LIMIT 1', [phone]
  )
  if (!dbUser) throw createError({ statusCode: 404, message: '用户不存在（alias 无效）' })

  // ── 用户自定义声音 ────────────────────────────────────────────
  const userConditions = ['user_id = ?', 'pet_type = ?', 'status = 1']
  const userParams: any[] = [dbUser.id, petType]
  if (emotion) { userConditions.push('emotion = ?'); userParams.push(emotion) }

  const [userRows]: any = await db.query(
    `SELECT id, emotion, pet_type, name, url, duration FROM t_sound_user
     WHERE ${userConditions.join(' AND ')} ORDER BY created_at DESC`,
    userParams
  )

  // ── 预设声音（从 t_sound_emotion 读取，每种情绪一条，URL 不为空） ──
  const presetConditions = ['pet_type = ?', 'status = 1', 'url IS NOT NULL']
  const presetParams: any[] = [petType]
  if (emotion) { presetConditions.push('value = ?'); presetParams.push(emotion) }

  const [presetRows]: any = await db.query(
    `SELECT id, value AS emotion, pet_type, label AS name, url, NULL AS duration
     FROM t_sound_emotion
     WHERE ${presetConditions.join(' AND ')} ORDER BY sort_order ASC`,
    presetParams
  )

  const userList   = (userRows   as any[]).map(r => ({ ...r, source: 'user' }))
  const presetList = (presetRows as any[]).map(r => ({ ...r, source: 'preset' }))

  // 用户有自定义 → 用户在前 + 预设补后；否则只返回预设
  const list = userList.length > 0
    ? [...userList, ...presetList]
    : presetList

  return { list }
})
