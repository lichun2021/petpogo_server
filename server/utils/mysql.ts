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
    })
  }
  return _pool
}
