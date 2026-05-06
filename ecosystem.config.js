module.exports = {
  apps: [
    {
      name: 'petpogo-server',
      script: './server/index.mjs',

      // ── 运行环境 ──────────────────────────────
      instances: 1,          // 单实例（如需多核 CPU 负载均衡改为 'max'）
      exec_mode: 'fork',     // 单实例用 fork，多实例改 'cluster'

      // ── 环境变量 ──────────────────────────────
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        NITRO_PORT: 3000,
        NITRO_HOST: '0.0.0.0',
      },

      // ── 日志 ──────────────────────────────────
      out_file: '/data/logs/petpogo-out.log',
      error_file: '/data/logs/petpogo-err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',

      // ── 崩溃自动重启 ──────────────────────────
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,

      // ── 内存超限自动重启（512MB）──────────────
      max_memory_restart: '512M',

      // ── 优雅退出 ──────────────────────────────
      kill_timeout: 5000,
      wait_ready: false,
    },
  ],
}
