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

function parseLog(value) {
  const match = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] (\{.*\})$/.exec(value)
  assert.ok(match, '时间必须独立在行首')
  const row = JSON.parse(match[2])
  assert.equal(row.time, undefined, 'JSON正文不再包含time')
  return {...row, time: match[1].replace(' ', 'T') + '+08:00'}
}
let modules, temp
before(async () => {
  temp = await mkdtemp(join(tmpdir(), 'security-audit-'))
  const output = join(temp, 'audit.cjs')
  Object.assign(globalThis, { defineNitroPlugin: plugin => plugin, defineEventHandler: h3.defineEventHandler, getHeader: h3.getHeader, getRequestIP: () => '127.0.0.1', createError: h3.createError })
  await build({ stdin: { contents: `export { default as refresh } from './server/routes/sdkapi/auth/refresh.post.ts'; export { default as logger } from './server/plugins/logger.ts'; export { default as signature } from './server/middleware/signature.ts'; export { default as rateLimit } from './server/middleware/rateLimit.ts'; export * from './server/integrations/ai/concurrency.ts'; export * from './server/integrations/shared/bounds.ts';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: output, logLevel: 'silent' })
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
  console.info = value => records.push(parseLog(value))
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

test('错误日志输出北京时间、明确会话原因及刷新失败阶段，不泄漏异常正文', () => {
  const hooks = {}; modules.logger({hooks:{hook:(name,fn)=>{hooks[name]=fn}}})
  const records=[],original=console.info
  console.info=value=>records.push(parseLog(value))
  try {
    const e=event('/sdkapi/points/balance');hooks.request(e)
    e.context.authStage='session_lookup';e.node.res.statusCode=401
    hooks.error(Object.assign(new Error('Token 已过期，请重新登录'),{statusCode:401}),{event:e})
    e.node.res.emit('finish')
    const row=records.at(-1)
    assert.match(row.time,/\+08:00$/)
    assert.ok(Math.abs(Date.parse(row.time)-Date.now())<2000)
    assert.equal(row.errorCode,'AUTH_SESSION_MISSING');assert.match(row.errorReason,/会话不存在/)
    assert.equal(row.authStage,'session_lookup');assert.equal(row.level,'warn')
    const refresh=event('/sdkapi/auth/refresh');hooks.request(refresh)
    refresh.context.authStage='peer_refresh';refresh.node.res.statusCode=404
    hooks.error(Object.assign(new Error('[iPet] private-token-password'),{statusCode:404}),{event:refresh})
    refresh.node.res.emit('finish')
    assert.equal(records.at(-1).errorCode,'AUTH_REFRESH_UPSTREAM_FAILED')
    const local=event('/sdkapi/auth/refresh');hooks.request(local)
    local.context.authStage='local_account_lookup';local.node.res.statusCode=404
    hooks.error(Object.assign(new Error('账号不存在'),{statusCode:404}),{event:local});local.node.res.emit('finish')
    assert.equal(records.at(-1).errorCode,'AUTH_REFRESH_ACCOUNT_NOT_FOUND')
    assert.doesNotMatch(JSON.stringify(records),/private-token-password/)
  } finally {console.info=original}
})


test('刷新按凭证用户ID定位，校验上游邮箱映射及调用期间的账号变更', async () => {
  const userId = '1237250046272094208'
  const phone = '13800138000'
  for (const scenario of ['success', 'no-rotation', 'missing-token', 'invalid-ttl', 'wrong-account', 'missing-account', 'revoked', 'disabled', 'deleted']) {
    const writes = [], deletes = [], queries = []
    const proof = { userId, credentialVersion: 3 }
    Object.assign(globalThis, {
      readBody: async () => ({ refreshToken: 'old-refresh' }),
      tokenSessionKey: value => 'hashed:' + value,
      RedisKey: { refreshProof: value => 'proof:' + value },
      phoneToAccount: value => value + '@qq.com',
      getPeerPublicUrl: () => 'https://example.invalid',
      useRedis: () => ({
        get: async () => JSON.stringify(proof),
        setex: async (...args) => { writes.push(args) },
        del: async key => { deletes.push(key) },
      }),
      useDb: () => ({ query: async (sql, args) => {
        queries.push({ sql, args })
        assert.deepEqual(args, [userId])
        assert.match(sql, /WHERE id=\?/)
        const afterRefresh = queries.length === 2
        if (afterRefresh && scenario === 'deleted') return [[]]
        return [[{ id: userId, phone, credential_version: afterRefresh && scenario === 'revoked' ? 4 : 3, status: afterRefresh && scenario === 'disabled' ? 2 : 1 }]]
      } }),
      peerRefreshToken: async () => ({ account: scenario === 'wrong-account' ? '13900139000@qq.com' : scenario === 'missing-account' ? undefined : phone + '@qq.com', ipet_token: scenario === 'missing-token' ? '' : 'new-token', refresh_token: scenario === 'no-rotation' ? undefined : 'new-refresh', expiration: scenario === 'invalid-ttl' ? -1 : 43200 }),
    })
    const e = event('/sdkapi/auth/refresh')
    if (scenario === 'success' || scenario === 'no-rotation') {
      const result = await modules.refresh(e)
      assert.equal(result.token, 'new-token')
      assert.equal(result.peer.refreshToken, scenario === 'no-rotation' ? 'old-refresh' : 'new-refresh')
      assert.deepEqual(JSON.parse(writes[0][2]), { userId, phone, credentialVersion: 3 })
      assert.equal(writes[0][0], 'hashed:new-token')
      if (scenario === 'no-rotation') {
        assert.equal(writes.length, 1)
        assert.deepEqual(deletes, [])
      } else {
        assert.equal(writes[1][0], 'proof:hashed:new-refresh')
        assert.deepEqual(deletes, ['proof:hashed:old-refresh'])
      }
      assert.equal(e.context.authDiagnostics.peerAccountMatches, true)
    } else {
      const status = scenario === 'deleted' ? 404 : ['revoked', 'disabled'].includes(scenario) ? 401 : 502
      await assert.rejects(modules.refresh(e), error => error.statusCode === status)
      assert.equal(writes.length, 0)
      assert.equal(deletes.length, 0)
    }
  }
})
