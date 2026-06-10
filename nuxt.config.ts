export default defineNuxtConfig({
  compatibilityDate: '2026-04-30',
  telemetry: false,

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

  routeRules: {
    '/': { redirect: '/admin/login' },
    '/api/**':     { cors: true },
    '/sdkapi/**':  { cors: true },
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
    jwtSecret: process.env.JWT_SECRET || 'petpogo_jwt_secret_change_in_prod',
    adminUsername: process.env.ADMIN_USERNAME || 'admin',
    adminPassword: process.env.ADMIN_PASSWORD || 'PetPogo@Admin2026',
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
    tencentImAdminKey: process.env.TENCENT_IM_ADMIN_KEY || 'f10fd3888e0c707830bf398bd51ffa6be657aeff601905c0f5230e0f82907775',
    uclPositionUrl: process.env.UCL_POSITION_URL || '',
    uclMapMarkName: process.env.UCL_MAP_MARK_NAME || 'position',
    appApiSecret: process.env.APP_API_SECRET || '1q21ee182efd1gf1g@#$',
    aiServiceUrl: process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000',
    // 对方后台（iPet 宠物/硬件管理系统）
    peerBackendUrl: process.env.PEER_BACKEND_URL || '',
    peerBackendPublicUrl: process.env.PEER_BACKEND_PUBLIC_URL || process.env.PEER_BACKEND_URL || 'http://49.234.39.11:8006',
    peerBackendMerchantId: process.env.PEER_BACKEND_MERCHANT_ID || '1',
    peerBackendSecret: process.env.PEER_BACKEND_SECRET || '',
    openapiKey:    process.env.OPENAPI_KEY    || 'ce96786dcc394fddeb521d0e',
    openapiSecret: process.env.OPENAPI_SECRET || 'bec1adf7ad77c6e38d3a7599926d9b4203b3ff34f797c2cf',
    public: {
      ossCdnBaseUrl: process.env.OSS_CDN_BASE_URL || 'https://pet-20260430.oss-cn-shanghai.aliyuncs.com',
      tencentImSdkAppId: '1600139420',
    },
  },
})
