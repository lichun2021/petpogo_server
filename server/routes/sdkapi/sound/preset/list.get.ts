// GET /sdkapi/sound/preset/list — App：获取声音列表
//
// 逻辑：用户自己上传的声音优先显示；若用户无自定义声音，则退回预设声音。
// 始终返回合并列表，source 字段区分来源。
//
// 查询参数:
//   pet_type  string  宠物类型 cat/dog（必填，默认 cat）
//   emotion   string  按情绪类型筛选（不传则返回全部）
//   page      number  页码（默认 1）
//   pageSize  number  每页条数（默认 20，最大 50）

export default defineEventHandler(async (event) => {
  const user     = await requireAuth(event)
  const query    = getQuery(event)
  const petType  = query.pet_type ? String(query.pet_type).trim() : 'cat'
  const emotion  = query.emotion  ? String(query.emotion).trim()  : null
  const page     = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20))
  const offset   = (page - 1) * pageSize

  const db = useDb()

  // ── 1. 查用户自己的声音（按 pet_type 过滤） ───────────────────
  const userConditions = ['user_id = ?', 'pet_type = ?', 'status = 1']
  const userParams: any[] = [user.userId, petType]
  if (emotion) { userConditions.push('emotion = ?'); userParams.push(emotion) }

  const [userRows]: any = await db.query(
    `SELECT id, emotion, pet_type, name, url, duration, created_at
     FROM t_sound_user
     WHERE ${userConditions.join(' AND ')}
     ORDER BY created_at DESC`,
    userParams
  )

  // ── 2. 查预设声音（按 pet_type 过滤） ────────────────────────
  const presetConditions = ['pet_type = ?', 'status = 1']
  const presetParams: any[] = [petType]
  if (emotion) { presetConditions.push('emotion = ?'); presetParams.push(emotion) }

  const [presetRows]: any = await db.query(
    `SELECT id, emotion, pet_type, name, url, NULL AS duration, created_at
     FROM t_sound_preset
     WHERE ${presetConditions.join(' AND ')}
     ORDER BY emotion, sort_order ASC`,
    presetParams
  )

  // ── 3. 合并：用户声音在前，预设补后 ───────────────────────────
  const userList   = (userRows   as any[]).map(r => ({ ...r, source: 'user' }))
  const presetList = (presetRows as any[]).map(r => ({ ...r, source: 'preset' }))

  const merged = userList.length > 0
    ? [...userList, ...presetList]
    : presetList

  // 分页（合并后再分页）
  const total = merged.length
  const list  = merged.slice(offset, offset + pageSize)

  return { total, page, pageSize, list }
})
