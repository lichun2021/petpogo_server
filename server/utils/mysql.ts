import mysql from 'mysql2/promise'

let _pool: mysql.Pool | null = null

export function useDb(): mysql.Pool {
  if (!_pool) {
    const config = useRuntimeConfig()
    _pool = mysql.createPool({
      host:            config.mysqlHost,
      port:            Number(config.mysqlPort),
      user:            config.mysqlUser,
      password:        config.mysqlPass,
      database:        config.mysqlDb,
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit:      0,
      timezone:        '+08:00',
      charset:         'utf8mb4',
      // ⚠️ 关键：防止 Snowflake BIGINT(18位) 超过 JS Number.MAX_SAFE_INTEGER 导致精度丢失
      // mysql2 默认把 BIGINT 转成 JS Number，18位数字会被截断（如 326909547488743423 → 326909547488743400）
      // 开启后所有 BIGINT 字段以字符串形式返回，ID 查询/比对完全准确
      supportBigNumbers: true,
      bigNumberStrings:  true,
    })
  }
  return _pool
}
