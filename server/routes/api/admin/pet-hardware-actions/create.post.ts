import { resolveGlbActionId } from '../../../../utils/petResourceReference.ts'

// POST /api/admin/pet-hardware-actions — 新建硬件动作码（预置5类不限量，硬件支持新动作时可继续新增）
export default defineEventHandler(async (event) => {
  const { code, name, icon_url, glb_action_id } = await readBody(event)
  if (!code?.trim()) throw createError({ statusCode: 400, message: '标识码不能为空' })
  if (!name?.trim()) throw createError({ statusCode: 400, message: '名称不能为空' })

  const db = useDb()

  const glbActionId = await resolveGlbActionId(glb_action_id)

  const [[dup]]: any = await db.query('SELECT id FROM t_pet_hardware_action_type WHERE code=? AND deleted=0 LIMIT 1', [code.trim()])
  if (dup) throw createError({ statusCode: 400, message: '标识码已存在' })

  const id = generateId()
  await db.query(
    'INSERT INTO t_pet_hardware_action_type (id, code, name, icon_url, glb_action_id, enabled, created_at) VALUES (?, ?, ?, ?, ?, 1, NOW())',
    [id, code.trim(), name.trim(), icon_url || null, glbActionId]
  )
  return { id: String(id), success: true }
})
