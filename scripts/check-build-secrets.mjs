import { readdir, readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'

// 只报告字段名，不输出秘密本身。调用方用 --env-file 注入待检查的值。
const fields = ['MYSQL_PASS', 'REDIS_PASSWORD', 'JWT_SECRET', 'ADMIN_PASSWORD', 'ALI_SMS_KEY_SECRET', 'ALI_OSS_KEY_SECRET', 'TENCENT_IM_ADMIN_KEY', 'APP_API_SECRET', 'AI_API_SECRET', 'PEER_BACKEND_SECRET', 'OPENAPI_SECRET', 'INTERNAL_TASK_KEY', 'MPS_CALLBACK_TOKEN']
const values = fields.flatMap(field => [field, 'NUXT_' + field].map(name => [name, process.env[name]])).filter(([, value]) => value && value.length >= 8)
if (!values.length) throw new Error('没有可供核验的敏感环境变量，请使用 --env-file 指定环境文件')
const found = new Set()
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await scan(path)
    else if (/\.(?:[cm]?js|json|html)$/.test(entry.name)) {
      const content = await readFile(path, 'utf8')
      for (const [name, value] of values) {
        if (content.includes(value) || content.includes(JSON.stringify(value).slice(1, -1))) found.add(name)
      }
    }
  }
}
await scan(resolve('.output'))
if (found.size) {
  console.error('构建产物含敏感配置，字段：' + [...found].join(', '))
  process.exitCode = 1
} else console.info('构建产物敏感配置检查通过；已核验 ' + values.length + ' 个环境变量')
