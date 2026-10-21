import { settingsRevision } from '../../../utils/settingsRevision'
// GET /api/admin/settings
// 返回所有系统配置，按 group_name 分组
export default defineEventHandler(async (event) => {
  const db = useDb()

  const [rows]: any = await db.query(
    `SELECT id, \`key\`, \`value\`, label, description, type, group_name, sort_order
     FROM t_system_settings
     ORDER BY group_name, sort_order, id`
  )

  if (event.context.admin?.role !== 'super_admin') {
    for (const row of rows) if (row.type === 'secret') row.value = '[已隐藏]'
  }

  // 按 group_name 分组
  const groups: Record<string, any[]> = {}
  for (const row of rows) {
    if (!groups[row.group_name]) groups[row.group_name] = []
    groups[row.group_name].push(row)
  }

  return { groups, list: rows, revision: settingsRevision(rows) }
})
