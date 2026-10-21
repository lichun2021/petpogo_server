import { settingsRevision } from '../../../utils/settingsRevision'
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
    // 全量校验后一次提交；新后台带revision防止覆盖其他管理员的修改。
    if (body.batch.length > 500) throw createError({ statusCode: 400, message: '一次最多更新500项配置' })
    const keys = new Set<string>()
    for (const item of body.batch) {
      if (!item || typeof item.key !== 'string' || !item.key || keys.has(item.key) ||
          !['string', 'number', 'boolean'].includes(typeof item.value)) {
        throw createError({ statusCode: 400, message: '配置项格式无效或存在重复键' })
      }
      keys.add(item.key)
    }
    const result = await withTransaction(async connection => {
      const [rows]: any = await connection.query('SELECT `key`,`value`,type FROM t_system_settings ORDER BY `key` FOR UPDATE')
      if (body.revision !== undefined && body.revision !== settingsRevision(rows)) {
        throw createError({ statusCode: 409, message: '配置已被其他管理员更新，请比对后再保存', data: { code: 'SETTINGS_CONFLICT' } })
      }
      for (const item of body.batch) {
        const row = rows.find((row: any) => row.key === item.key)
        if (!row) throw createError({ statusCode: 404, message: '配置项不存在，请重新加载' })
        const value = String(item.value)
        if ((row.type === 'boolean' && !['0', '1'].includes(value)) ||
            (row.type === 'number' && (!value.trim() || !Number.isFinite(Number(value))))) {
          throw createError({ statusCode: 400, message: '配置值不符合字段类型' })
        }
      }
      for (const item of body.batch) {
        await connection.query('UPDATE t_system_settings SET `value`=?,updated_at=NOW() WHERE `key`=?', [String(item.value), item.key])
      }
      const next = rows.map((row: any) => ({ ...row, value: body.batch.find((item: any) => item.key === row.key)?.value ?? row.value }))
      return { ok: true, updated: body.batch.length, revision: settingsRevision(next) }
    })
    await invalidateSettingsCache()
    return result
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
