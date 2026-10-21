import { existsSync } from 'node:fs'
import { applyLegacyRuntimeEnv } from './runtime-env.mjs'

process.env.NODE_ENV ||= 'production'
applyLegacyRuntimeEnv()
// 同时支持仓库 npm start 与部署包 server/scripts/start.mjs。
const deployedEntry = new URL('../index.mjs', import.meta.url)
await import(existsSync(deployedEntry) ? deployedEntry.href : new URL('../.output/server/index.mjs', import.meta.url).href)
