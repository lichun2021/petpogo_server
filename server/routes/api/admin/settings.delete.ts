// DELETE /api/admin/settings
// 删除配置项（仅允许删除 client 分组的客户端配置，避免误删 sms/oss/general 等核心配置）
// Query: key=配置键
export default defineEventHandler(async (event) => {
  requireSuperAdmin(event)

  const query = getQuery(event)
  const key = String(query.key || '')
  if (!key) throw createError({ statusCode: 400, message: 'key 不能为空' })

  const db = useDb()
  const [[row]]: any = await db.query(
    'SELECT id, group_name FROM t_system_settings WHERE `key`=? LIMIT 1',
    [key]
  )
  if (!row) throw createError({ statusCode: 404, message: `配置键 ${key} 不存在` })
  if (row.group_name !== 'client') {
    throw createError({ statusCode: 400, message: '仅允许删除「客户端配置」分组的配置项' })
  }

  await db.query('DELETE FROM t_system_settings WHERE id=?', [row.id])
  await invalidateSettingsCache()
  return { ok: true }
})
