import { formatRequestLog } from '../utils/requestLog'

// 此常量由 Nuxt/Nitro 在构建时替换，记录的是部署产物而非运行时环境变量。
declare const __PETPOGO_BUILD__: {
  version: string
  buildId: string
  gitCommit: string
  sourceState: string
  builtAt: string
}

export default defineNitroPlugin(() => {
  console.info(formatRequestLog({
    event: 'server.start',
    message: '宠联芯服务启动',
    ...__PETPOGO_BUILD__,
    pid: process.pid,
  }))
})
