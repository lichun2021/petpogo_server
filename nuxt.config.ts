import { applyLegacyRuntimeEnv } from './scripts/runtime-env.mjs'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

// 在构建时固化标识，服务器重启不会重新生成，也不依赖服务器上的 Git 仓库。
function buildGitValue(args: string[]): string {
  try {
    return execFileSync('git', args, { cwd: import.meta.dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return 'unknown'
  }
}
const buildTime = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ')
const buildInfo = {
  version: JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version,
  buildId: buildTime.replace(/[- :]/g, '') + '-' + randomUUID().slice(0, 8),
  gitCommit: buildGitValue(['rev-parse', '--short=12', 'HEAD']),
  sourceState: (() => { const status = buildGitValue(['status', '--porcelain']); return status === 'unknown' ? 'unknown' : status ? 'dirty' : 'clean' })(),
  builtAt: buildTime,
}
console.info(`[${buildTime}] 构建版本 ${JSON.stringify(buildInfo)}`)

export default defineNuxtConfig({
  compatibilityDate: '2026-04-30',
  telemetry: false,
  hooks: {
    'nitro:config'(config) {
      // 兼容旧 .env 的本地开发；生产值只由启动包装器注入。
      if (config.dev) applyLegacyRuntimeEnv()
    },
  },

  app: {
    head: {
      title: '宠联芯管理后台',
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/admin-favicon.svg' }],
    },
  },

  colorMode: {
    preference: 'light',
    fallback: 'light',
    classSuffix: '',
  },

  modules: [
    '@nuxt/ui',
    '@vueuse/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  // Nuxt 4 默认使用 app/ 目录
  future: {
    compatibilityVersion: 4,
  },

  // @nuxt/fonts：只用本地字体提供方，避免启动时联网拉 Google Fonts 超时
  // （生产环境服务器无法访问 fonts.google.com，默认会卡 10s 超时再 fallback）
  fonts: {
    provider: 'local',
  },

  routeRules: {
    '/': { redirect: '/admin/login' },
    '/api/**': { cors: true },
    '/sdkapi/**': { cors: true },
    '/openapi/**': { cors: true },
  },

  vite: {
    optimizeDeps: {
      include: ['@vue/devtools-core', '@vue/devtools-kit'],
    },
    server: {
      watch: {
        usePolling: true,
        interval: 1000,
      },
    },
  },

  nitro: {
    preset: 'node-server',
    replace: { __PETPOGO_BUILD__: JSON.stringify(buildInfo) },
    esbuild: {
      options: {
        target: 'es2022',
      },
    },
  },

  runtimeConfig: {
    mysqlHost: '127.0.0.1',
    mysqlPort: '3306',
    mysqlUser: 'root',
    mysqlPass: '',
    mysqlDb: 'petpogo',
    redisHost: '127.0.0.1',
    redisPort: '6379',
    redisPassword: '',
    jwtSecret: '',
    adminUsername: 'admin',
    adminPassword: '',
    aliSmsKeyId: '',
    aliSmsKeySecret: '',
    aliSmsSign: '',
    aliSmsTplCode: '',
    aliOssKeyId: '',
    aliOssKeySecret: '',
    aliOssBucket: 'pet-20260430',
    aliOssRawBucket: 'pet-20260430',
    aliOssRegion: 'oss-cn-shanghai',
    tencentImSdkAppId: '1600139420',
    tencentImAdminKey: '',
    uclPositionUrl: '',
    uclMapMarkName: 'position',
    appApiSecret: '',
    aiServiceUrl: 'https://ai.jxpetai.com',
    aiApiKey: '',
    aiApiSecret: '',
    aiMediaAllowedHosts: '',
    aiProxyTimeoutMs: '120000',
    aiProxyRecordingTimeoutMs: '300000',
    aiProxyStreamTimeoutMs: '300000',
    aiProxyStreamIdleTimeoutMs: '60000',
    siteBaseUrl: 'https://www.jxpetai.com',
    // 对方后台（iPet 宠物/硬件管理系统）
    peerBackendUrl: '',
    peerBackendTimeoutMs: '20000',
    peerBackendPublicUrl: 'https://peer.jxpetai.com',
    peerBackendMerchantId: '1',
    peerBackendSecret: '',
    momentSchedulerEnabled: true,
    momentImageTimes: '12:00',
    momentTextTimes: '09:00,15:00,21:00',
    openapiReportDeviceLimit: 60,
    openapiReportIpLimit: 1200,
    openapiKey: '',
    openapiSecret: '',
    // 内部定时任务密钥（cron 调 /api/internal/** 时带在 header）
    internalTaskKey: '',
    // MNS/MPS 回调鉴权 token：MNS 控制台订阅 URL 带 ?token=<同值>，handler 校验一致性。
    // 默认空字符串 → 未配置时拒绝所有回调（强制运维配置，避免裸奔）。
    mpsCallbackToken: '',
    // 签名 nonce 防重放过渡开关：默认 true 强制校验；App 端未升级时设 'false' 只告警不拦
    signatureV2Required: false,
    openapiSignatureV2Required: false,
    signatureNonceRequired: true,
    public: {
      ossCdnBaseUrl: 'https://pet-20260430.oss-cn-shanghai.aliyuncs.com',
      tencentImSdkAppId: '1600139420',
    },
  },
})
