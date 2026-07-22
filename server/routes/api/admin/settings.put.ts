// PUT /api/admin/settings
// Body: { key: string, value: string }  — 单条更新
// 或    { batch: Array<{ key, value }> } — 批量更新
// 或    { create: { key, value, label, description, type, group_name, sort_order } } — 新增配置项（client 分组动态配置用）
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)

  const db = useDb()
  const body = await readBody(event)

  // 新增配置项
  if (body.create) {
    const { key, value = '', label, description = '', type = 'text', group_name = 'client', sort_order = 0 } = body.create
    if (!key) throw createError({ statusCode: 400, message: 'key 不能为空' })
    if (!label) throw createError({ statusCode: 400, message: 'label 不能为空' })

    const [[existing]]: any = await db.query('SELECT id FROM t_system_settings WHERE `key`=? LIMIT 1', [key])
    if (existing) throw createError({ statusCode: 409, message: `配置键 ${key} 已存在` })

    const [result]: any = await db.query(
      `INSERT INTO t_system_settings (\`key\`, \`value\`, label, description, type, group_name, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [key, String(value), label, description, type, group_name, Number(sort_order) || 0]
    )
    await invalidateSettingsCache()
    return { ok: true, id: Number(result.insertId) }
  }

  if (body.batch && Array.isArray(body.batch)) {
    // 批量更新
    for (const item of body.batch) {
      if (!item.key) continue
      await db.query(
        `UPDATE t_system_settings SET \`value\` = ?, updated_at = NOW() WHERE \`key\` = ?`,
        [String(item.value ?? ''), item.key]
      )
    }
    // 清除缓存，下次业务读取时从 DB 刷新
    await invalidateSettingsCache()
    return { ok: true, updated: body.batch.length }
  }

  // 单条更新
  const { key, value } = body
  if (!key) throw createError({ statusCode: 400, message: 'key is required' })

  const [result]: any = await db.query(
    `UPDATE t_system_settings SET \`value\` = ?, updated_at = NOW() WHERE \`key\` = ?`,
    [String(value ?? ''), key]
  )

  if (result.affectedRows === 0) {
    throw createError({ statusCode: 404, message: `Setting key "${key}" not found` })
  }

  // 清除缓存
  await invalidateSettingsCache()
  return { ok: true }
})
