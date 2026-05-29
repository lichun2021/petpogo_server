// PUT /api/admin/settings
// Body: { key: string, value: string }  — 单条更新
// 或    { batch: Array<{ key, value }> } — 批量更新
export default defineEventHandler(async (event) => {
  const db = useDb()
  const body = await readBody(event)

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
