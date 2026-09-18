import { resolveGlbActionId } from '../../../../utils/petResourceReference.ts'

// POST /api/admin/pet-interaction-types — 新建互动类型（预置3条不限量，可自定义新增）
export default defineEventHandler(async (event) => {
  const {
    code,
    name,
    icon_url,
    glb_action_id,
    satiety_delta = 0,
    mood_delta = 0,
    cleanliness_delta = 0,
  } = await readBody(event)

  if (!code?.trim()) throw createError({ statusCode: 400, message: '标识码不能为空' })
  if (!name?.trim()) throw createError({ statusCode: 400, message: '名称不能为空' })

  const db = useDb()

  const glbActionId = await resolveGlbActionId(glb_action_id)

  const [[dup]]: any = await db.query('SELECT id FROM t_pet_interaction_type WHERE code=? AND deleted=0 LIMIT 1', [code.trim()])
  if (dup) throw createError({ statusCode: 400, message: '标识码已存在' })

  const id = generateId()
  await db.query(
    `INSERT INTO t_pet_interaction_type
       (id, code, name, icon_url, glb_action_id, satiety_delta, mood_delta, cleanliness_delta, enabled, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
    [id, code.trim(), name.trim(), icon_url || null, glbActionId, Number(satiety_delta) || 0, Number(mood_delta) || 0, Number(cleanliness_delta) || 0]
  )
  return { id: String(id), success: true }
})
