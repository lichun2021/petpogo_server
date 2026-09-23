export default defineNuxtConfig({
  compatibilityDate: '2026-04-30',
  telemetry: false,

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
    esbuild: {
      options: {
        target: 'es2022',
      },
    },
  },

  runtimeConfig: {
    mysqlHost: process.env.MYSQL_HOST || '127.0.0.1',
    mysqlPort: process.env.MYSQL_PORT || '3306',
    mysqlUser: process.env.MYSQL_USER || 'root',
    mysqlPass: process.env.MYSQL_PASS || '',
    mysqlDb: process.env.MYSQL_DB || 'petpogo',
    redisHost: process.env.REDIS_HOST || '127.0.0.1',
    redisPort: process.env.REDIS_PORT || '6379',
    redisPassword: process.env.REDIS_PASSWORD || '',
    jwtSecret: process.env.JWT_SECRET || '',
    adminUsername: process.env.ADMIN_USERNAME || 'admin',
    adminPassword: process.env.ADMIN_PASSWORD || '',
    aliSmsKeyId: process.env.ALI_SMS_KEY_ID || '',
    aliSmsKeySecret: process.env.ALI_SMS_KEY_SECRET || '',
    aliSmsSign: process.env.ALI_SMS_SIGN || '',
    aliSmsTplCode: process.env.ALI_SMS_TPL_CODE || '',
    aliOssKeyId: process.env.ALI_OSS_KEY_ID || '',
    aliOssKeySecret: process.env.ALI_OSS_KEY_SECRET || '',
    aliOssBucket: process.env.ALI_OSS_BUCKET || 'pet-20260430',
    aliOssRawBucket: process.env.ALI_OSS_RAW_BUCKET || 'pet-20260430',
    aliOssRegion: process.env.ALI_OSS_REGION || 'oss-cn-shanghai',
    tencentImSdkAppId: process.env.TENCENT_IM_SDK_APP_ID || '1600139420',
    tencentImAdminKey: process.env.TENCENT_IM_ADMIN_KEY || '',
    uclPositionUrl: process.env.UCL_POSITION_URL || '',
    uclMapMarkName: process.env.UCL_MAP_MARK_NAME || 'position',
    appApiSecret: process.env.APP_API_SECRET || '',
    aiServiceUrl: process.env.AI_SERVICE_URL || 'https://ai.jxpetai.com',
    aiApiKey: process.env.AI_API_KEY || '',
    aiApiSecret: process.env.AI_API_SECRET || '',
    aiMediaAllowedHosts: process.env.AI_MEDIA_ALLOWED_HOSTS || '',
    aiProxyTimeoutMs: process.env.AI_PROXY_TIMEOUT_MS || '120000',
    aiProxyRecordingTimeoutMs: process.env.AI_PROXY_RECORDING_TIMEOUT_MS || '300000',
    aiProxyStreamTimeoutMs: process.env.AI_PROXY_STREAM_TIMEOUT_MS || '300000',
    aiProxyStreamIdleTimeoutMs: process.env.AI_PROXY_STREAM_IDLE_TIMEOUT_MS || '60000',
    siteBaseUrl: process.env.SITE_BASE_URL || 'https://www.jxpetai.com',
    // 对方后台（iPet 宠物/硬件管理系统）
    peerBackendUrl: process.env.PEER_BACKEND_URL || '',
    peerBackendTimeoutMs: process.env.PEER_BACKEND_TIMEOUT_MS || '20000',
    peerBackendPublicUrl: process.env.PEER_BACKEND_PUBLIC_URL || process.env.PEER_BACKEND_URL || 'https://peer.jxpetai.com',
    peerBackendMerchantId: process.env.PEER_BACKEND_MERCHANT_ID || '1',
    peerBackendSecret: process.env.PEER_BACKEND_SECRET || '',
    openapiKey: process.env.OPENAPI_KEY || '',
    openapiSecret: process.env.OPENAPI_SECRET || '',
    // 内部定时任务密钥（cron 调 /api/internal/** 时带在 header）
    internalTaskKey: process.env.INTERNAL_TASK_KEY || '',
    // MNS/MPS 回调鉴权 token：MNS 控制台订阅 URL 带 ?token=<同值>，handler 校验一致性。
    // 默认空字符串 → 未配置时拒绝所有回调（强制运维配置，避免裸奔）。
    mpsCallbackToken: process.env.MPS_CALLBACK_TOKEN || '',
    // 签名 nonce 防重放过渡开关：默认 true 强制校验；App 端未升级时设 'false' 只告警不拦
    signatureV2Required: process.env.SIGNATURE_V2_REQUIRED === 'true',
    openapiSignatureV2Required: process.env.OPENAPI_SIGNATURE_V2_REQUIRED === 'true',
    signatureNonceRequired: process.env.SIGNATURE_NONCE_REQUIRED !== 'false',
    public: {
      ossCdnBaseUrl: process.env.OSS_CDN_BASE_URL || 'https://pet-20260430.oss-cn-shanghai.aliyuncs.com',
      tencentImSdkAppId: '1600139420',
    },
  },
})
