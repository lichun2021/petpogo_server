// POST /api/admin/sound/preset/create — 后台：新建预设声音
// Body: emotion / name / url / sortOrder / status

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { emotion, petType = 'cat', name, url, sortOrder = 0, status = 1 } = body ?? {}

  if (!emotion?.trim()) throw createError({ statusCode: 400, message: 'emotion 不能为空' })
  if (!petType?.trim()) throw createError({ statusCode: 400, message: 'petType 不能为空（cat/dog）' })
  if (!name?.trim())    throw createError({ statusCode: 400, message: 'name 不能为空' })
  if (!url?.trim())     throw createError({ statusCode: 400, message: 'url 不能为空' })

  const db = useDb()
  const [result]: any = await db.query(
    `INSERT INTO t_sound_preset (emotion, pet_type, name, url, sort_order, status) VALUES (?, ?, ?, ?, ?, ?)`,
    [String(emotion).trim(), String(petType).trim(), String(name).trim(), String(url).trim(), Number(sortOrder), Number(status)]
  )

  return { success: true, id: Number(result.insertId) }
})
