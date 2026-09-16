// POST /api/admin/pet-glb-actions — 新建 GLB 动作标识（对应模型内置动画片段名，不上传文件）
export default defineEventHandler(async (event) => {
  const { code, name } = await readBody(event)
  if (!code?.trim()) throw createError({ statusCode: 400, message: '标识码不能为空' })
  if (!name?.trim()) throw createError({ statusCode: 400, message: '名称不能为空' })

  const db = useDb()
  const [[dup]]: any = await db.query('SELECT id FROM t_pet_glb_action WHERE code=? AND deleted=0 LIMIT 1', [code.trim()])
  if (dup) throw createError({ statusCode: 400, message: '标识码已存在' })

  const id = generateId()
  await db.query(
    'INSERT INTO t_pet_glb_action (id, code, name, enabled, created_at) VALUES (?, ?, ?, 1, NOW())',
    [id, code.trim(), name.trim()]
  )
  return { id: String(id), success: true }
})
