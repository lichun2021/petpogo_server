import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { EventEmitter } from 'node:events'
import crypto from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import * as h3 from 'h3'

let modules, temp
before(async () => {
  temp = await mkdtemp(join(tmpdir(), 'security-audit-'))
  const output = join(temp, 'audit.cjs')
  Object.assign(globalThis, { defineNitroPlugin: plugin => plugin, defineEventHandler: h3.defineEventHandler, getHeader: h3.getHeader, getRequestIP: () => '127.0.0.1', createError: h3.createError })
  await build({ stdin: { contents: `export { default as logger } from './server/plugins/logger.ts'; export { default as signature } from './server/middleware/signature.ts'; export { default as rateLimit } from './server/middleware/rateLimit.ts'; export * from './server/integrations/ai/concurrency.ts'; export * from './server/integrations/shared/bounds.ts';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: output, logLevel: 'silent' })
  modules = (await import(pathToFileURL(output))).default
})
after(async () => rm(temp, { recursive: true, force: true }))

function event(path, headers = {}) {
  const req = new EventEmitter(); req.url = path; req.method = 'POST'; req.headers = headers
  const res = new EventEmitter(); res.statusCode = 200; res.setHeader = () => {}; res.getHeader = () => undefined
  return h3.createEvent(req, res)
}

test('摘要日志不读取正文，不输出凭证；正常结束/取消只记录一次结束', () => {
  const hooks = {}; modules.logger({ hooks: { hook: (name, fn) => { hooks[name] = fn } } })
  const records = [], original = console.info
  console.info = value => records.push(JSON.parse(value))
  try {
    const e = event('/sdkapi/auth/login?token=secret-query')
    e.node.req.body = { password: 'secret-password', code: '123456' }
    hooks.request(e)
    e.node.res.writableFinished = true
    e.node.res.emit('finish'); e.node.res.emit('close')
    assert.deepEqual(records.map(r => r.event), ['request.start', 'request.end'])
    assert.doesNotMatch(JSON.stringify(records), /secret-query|secret-password|123456/)
    const stream = event('/sdkapi/ai-proxy/messages/stream')
    hooks.request(stream); stream.context.proxyOutcome = 'timeout'; stream.context.proxyBytes = 8
    stream.node.res.emit('close')
    assert.equal(records.at(-1).outcome, 'timeout'); assert.equal(records.at(-1).streamBytes, 8)
    const error = Object.assign(new Error('SQL password=secret'), { statusCode: 500 })
    hooks.error(error, { event: stream })
    assert.doesNotMatch(error.message, /SQL|secret/)
  } finally { console.info = original }
})

test('nonce 原子附带有效期、覆盖超前时钟；错误签名不记录密钥', async () => {
  const secret = 'must-not-log-secret'
  const ts = String(Date.now() + 240000)
  const sig = crypto.createHash('md5').update(ts + secret).digest('hex')
  const writes = [], logs = [], original = console.warn
  console.warn = (...args) => logs.push(args)
  Object.assign(globalThis, { useRuntimeConfig: () => ({ appApiSecret: secret, signatureNonceRequired: true }), RedisKey: { nonce: n => 'nonce:' + n }, useRedis: () => ({ set: async (...args) => { writes.push(args); return writes.length === 1 ? 'OK' : null } }) })
  try {
    const headers = { 'x-timestamp': ts, 'x-signature': sig, 'x-nonce': 'nonce-unique' }
    await modules.signature(event('/sdkapi/peer/user/device/list', headers))
    assert.equal(writes[0][2], 'EX'); assert.ok(writes[0][3] > 500); assert.equal(writes[0][4], 'NX')
    await assert.rejects(modules.signature(event('/sdkapi/peer/user/device/list', headers)), e => e.statusCode === 403)
    await assert.rejects(modules.signature(event('/sdkapi/peer/user/device/list', { ...headers, 'x-signature': '0'.repeat(32) })), e => e.statusCode === 403)
    assert.doesNotMatch(JSON.stringify(logs), /must-not-log-secret/)
  } finally { console.warn = original }
})

test('普通与严格限流分别计数；Redis 计数与过期为单次原子操作', async () => {
  const counts = new Map(), keys = []
  Object.assign(globalThis, { RedisKey: { rateLimit: (surface, ip) => surface + ':' + ip }, useRedis: () => ({ eval: async (script, n, key) => { assert.match(script, /EXPIRE/); assert.equal(n, 1); keys.push(key); const count = (counts.get(key) || 0) + 1; counts.set(key, count); return count }, ttl: async () => 50 }) })
  for (let i = 0; i < 25; i++) await modules.rateLimit(event('/sdkapi/pet/list'))
  for (let i = 0; i < 20; i++) await modules.rateLimit(event('/sdkapi/ai-proxy/health-data/overview'))
  await assert.rejects(modules.rateLimit(event('/sdkapi/ai-proxy/health-data/overview')), e => e.statusCode === 429)
  assert.equal(new Set(keys).size, 2)
})

test('并发上限拒绝额外流，释放幂等且不影响其他用户', () => {
  const a = modules.acquireAiSlot('a', true), b = modules.acquireAiSlot('a', true)
  assert.throws(() => modules.acquireAiSlot('a', true), e => e.statusCode === 429)
  const other = modules.acquireAiSlot('b', true)
  a(); a(); const next = modules.acquireAiSlot('a', true)
  next(); b(); other()
})

test('chunked 请求超限时即停止累计，未等 end；合法正文供 h3 解析复用', async () => {
  const e = event('/sdkapi/peer/pet/info/add', { 'transfer-encoding': 'chunked' })
  let paused = false
  e.node.req.pause = () => { paused = true }; e.node.req.destroy = () => {}
  const reading = modules.readProxyBody(e)
  e.node.req.emit('data', Buffer.alloc(100000)); e.node.req.emit('data', Buffer.alloc(50000))
  await assert.rejects(reading, err => err.statusCode === 413)
  assert.equal(paused, true)
  const ok = event('/sdkapi/peer/pet/info/add', { 'content-type': 'application/json' })
  ok.node.req.pause = () => {}; ok.node.req.destroy = () => {}
  const pending = modules.readProxyBody(ok)
  ok.node.req.emit('data', Buffer.from('{"petName":"dog"}')); ok.node.req.emit('end')
  await pending
  assert.equal((await h3.readBody(ok)).petName, 'dog')
})
