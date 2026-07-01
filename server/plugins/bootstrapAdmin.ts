// 服务启动时若 t_admin 为空，用 ADMIN_USERNAME/ADMIN_PASSWORD 环境变量
// 自动创建初始超级管理员，此后登录完全走数据库校验。
export default defineNitroPlugin(async () => {
  try {
    const db = useDb()
    const [[{ cnt }]]: any = await db.query('SELECT COUNT(*) as cnt FROM t_admin WHERE deleted=0')

    if (Number(cnt) > 0) return

    const config = useRuntimeConfig()
    const id = generateId()

    await db.query(
      'INSERT INTO t_admin (id, username, password, nickname, role) VALUES (?, ?, ?, ?, ?)',
      [String(id), config.adminUsername, hashPassword(config.adminPassword), '超级管理员', 'super_admin']
    )

    console.log(`[bootstrapAdmin] 已创建初始超级管理员: ${config.adminUsername}`)
  } catch (e) {
    console.error('[bootstrapAdmin] 初始化管理员失败', e)
  }
})
