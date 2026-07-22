// GET /sdkapi/config/client
// 获取客户端运行时配置（从 t_system_settings 中 group_name='client' 的配置项）
//
// 用途：把客户端需要的敏感/可变参数（如第三方 key、开关、域名、版本号等）放后台管理，
// App 启动时拉取，运行时生效，无需发版即可修改。
//
// 只返回 client 分组的配置，不暴露其他分组（sms/oss 等服务端敏感配置）。
// type=secret 的配置项返回值会被脱敏为 ***（如需明文，用 type=text），避免被逆向抓包泄露。
export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const db = useDb()
  const [rows]: any = await db.query(
    `SELECT \`key\`, \`value\`, \`type\`
     FROM t_system_settings
     WHERE group_name = 'client' AND status = 1
     ORDER BY sort_order, id`,
  )

  const config: Record<string, any> = {}
  for (const row of rows) {
    // secret 类型脱敏：客户端通常不需要明文展示，仅做存在性判断时用占位
    if (row.type === 'secret') {
      config[row.key] = row.value ? '***' : ''
    } else if (row.type === 'boolean') {
      config[row.key] = row.value === '1'
    } else if (row.type === 'number') {
      const n = Number(row.value)
      config[row.key] = isNaN(n) ? 0 : n
    } else {
      config[row.key] = row.value ?? ''
    }
  }

  return { config }
})
