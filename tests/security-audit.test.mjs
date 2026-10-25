import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { EventEmitter } from 'node:events'
import crypto from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { ref, effectScope, onScopeDispose } from 'vue'
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
  await build({ stdin: { contents: `export * from './server/utils/peerIdentity.ts'; export * from './server/utils/settingsRevision.ts'; export * from './app/composables/useAdminList.ts'; export * from './app/composables/useTabStore.ts'; export { default as deviceCallback } from './server/routes/openapi/device-event/callback.post.ts'; export { default as settingsPut } from './server/routes/api/admin/settings.put.ts'; export * from './server/utils/payloadLog.ts'; export { default as refresh } from './server/routes/sdkapi/auth/refresh.post.ts'; export { default as logger } from './server/plugins/logger.ts'; export { default as signature } from './server/middleware/signature.ts'; export { default as openapiAuth } from './server/middleware/openapi-auth.ts'; export { default as rateLimit } from './server/middleware/rateLimit.ts'; export * from './server/integrations/ai/concurrency.ts'; export * from './server/integrations/shared/bounds.ts'; export * from './server/utils/momentSchedule.ts'; export * from './server/integrations/moment/scheduleHandler.ts'; export { default as sms } from './server/routes/sdkapi/auth/sms.post.ts';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: output, logLevel: 'silent', plugins: [{ name: 'sms-provider-fixture', setup(builder) {
    builder.onResolve({ filter: /^@alicloud\/(dysmsapi20170525|openapi-client)$/ }, args => ({ path: args.path, namespace: 'sms-fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'sms-fixture' }, args => ({ loader: 'js', contents: args.path.includes('dysmsapi')
      ? `export default { default: class { sendSms(req) { return globalThis.sendSmsFixture(req) } }, SendSmsRequest: class { constructor(values) { Object.assign(this, values) } } }`
      : `export default { Config: class { constructor(values) { Object.assign(this, values) } } }` }))
  } }] })
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
    const passwordLogin=event('/sdkapi/auth/login-pwd');hooks.request(passwordLogin);passwordLogin.node.res.statusCode=404
    hooks.error(Object.assign(new Error('该手机号尚未注册，请切换为「验证码登录」完成注册'),{statusCode:404}),{event:passwordLogin});passwordLogin.node.res.emit('finish')
    assert.equal(records.at(-1).errorCode,'AUTH_LOGIN_ACCOUNT_NOT_FOUND')
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


test('详细正文日志保留长ID及完整列表，脱敏嵌套凭证和签名地址', () => {
  process.env.LOG_REDACT_TOKENS = 'true'
  // 单独测试结构化输入及上游长ID解析。
  const full = modules.redactLogPayload({ list: Array.from({ length: 1500 }, (_, id) => ({ id, name: '设备' })), refreshToken: 'hidden-token', nested: JSON.stringify({ password: 'hidden-password' }), url: 'https://example.com/image?signature=hidden-signature', wsAppUrl: 'ws://example.com/ws/app/device?token=hidden-ws-token', secureWsUrl: 'wss://example.com/ws/app/device?ticket=hidden-ticket#hidden-fragment' })
  assert.equal(full.list.length, 1500)
  assert.equal(full.list[1499].name, '设备')
  assert.doesNotMatch(JSON.stringify(full), /hidden-/)
  assert.equal(full.url, 'https://example.com/image')
  assert.equal(full.wsAppUrl, 'ws://example.com/ws/app/device')
  assert.equal(full.secureWsUrl, 'wss://example.com/ws/app/device')
  const upstream = modules.peerResponseLogPayload('{"code":0,"info":{"id":1237250046272094208,"ipet_token":"hidden-token","proof":{"secretKey":"hidden-key"}}}')
  assert.equal(upstream.info.id, '1237250046272094208')
  assert.equal(upstream.code, 0)
  assert.doesNotMatch(JSON.stringify(upstream), /hidden-/)
  assert.doesNotMatch(JSON.stringify(modules.peerResponseLogPayload('not-json hidden-token')), /hidden-token/)
  delete process.env.LOG_REDACT_TOKENS
  assert.equal(modules.redactLogPayload({ token: 'visible-ticket', password: 'secret' }).token, 'visible-ticket')
  assert.equal(modules.redactLogPayload({ token: 'visible-ticket', password: 'secret' }).password, '[REDACTED]')
})


test('代理请求仅记录请求和返回两条日志，返回含最终正文', () => {
  const hooks = {}; modules.logger({ hooks: { hook: (name, fn) => { hooks[name] = fn } } })
  const records = [], original = console.info
  console.info = value => records.push(parseLog(value))
  try {
    const e = event('/sdkapi/peer/user/device/qr/token')
    hooks.request(e)
    e.context.logPeerRequest({})
    e.context.peerResponseBody = { code: 0, info: { token: 'test-ticket', expireIn: 600 } }
    e.node.res.writableFinished = true
    e.node.res.emit('finish'); e.node.res.emit('close')
    assert.deepEqual(records.map(row => row.event), ['request.start', 'request.end'])
    assert.equal(records[0].requestId, records[1].requestId)
    assert.deepEqual(records[0].body, {})
    assert.equal(records[1].body.info.token, 'test-ticket')
  } finally { console.info = original }
})


test('设备告警兼容手机号和Peer账号，拒绝其他邮箱，不把邮箱查询手机号列', async () => {
  for (const alias of ['13800138000', ' 13800138000@qq.com ']) {
    const queries = [], pushes = []
    Object.assign(globalThis, {
      readBody: async () => ({ alias, event_type: 'offline', device_mac: 'AA', device_name: '项圈', pet_name: '毛毛' }),
      useDb: () => ({ query: async (sql, args) => { queries.push({ sql, args }); return sql.startsWith('SELECT id FROM t_user') ? [[{ id: '1237250046272094208' }]] : [{}] } }),
      generateId: () => '1237250046272094209',
      jpushToDevice: async (...args) => { pushes.push(args) },
    })
    assert.equal((await modules.deviceCallback(event('/openapi/device-event/callback'))).success, true)
    assert.deepEqual(queries[0].args, ['13800138000'])
    assert.equal(pushes[0][0], '1237250046272094208')
  }
  assert.equal(modules.peerAccountToPhone('13800138000@evil.example'), null)
  assert.equal(modules.peerAccountToPhone({ phone: '13800138000' }), null)
})

test('硬件上报按设备隔离额度，429包含阈值和剩余时间', async () => {
  const counts = new Map()
  Object.assign(globalThis, {
    useRuntimeConfig: () => ({ openapiReportIpLimit: 100, openapiReportDeviceLimit: 2 }),
    RedisKey: { rateLimit: (scope, subject) => scope + ':' + subject },
    useRedis: () => ({ eval: async (script, n, key) => { const count = (counts.get(key) || 0) + 1; counts.set(key, count); return count }, ttl: async () => 42 }),
  })
  function report(id) {
    const e = event('/openapi/pet/action/report', { 'content-type': 'application/json' })
    e.context.openapiAuthenticated = true
    e.node.req.rawBody = Buffer.from(JSON.stringify({ deviceId: id, code: 'walking' }))
    return e
  }
  await modules.rateLimit(report('1')); await modules.rateLimit(report('1'))
  await modules.rateLimit(report('2')); await modules.rateLimit(report('2'))
  const rejected = report('1')
  await assert.rejects(modules.rateLimit(rejected), error => error.statusCode === 429 && error.data.retryAfterSeconds === 42 && error.data.count === 3)
  assert.equal(rejected.context.requestErrorCode, 'RATE_LIMIT_EXCEEDED')
  assert.equal(rejected.context.rateLimit.limit, 2)
})

test('配置批量保存冲突或非法值时不写入；写入失败回滚', async () => {
  const original = [{ key: 'a', value: '1', type: 'number' }, { key: 'b', value: '1', type: 'boolean' }]
  for (const scenario of ['ok', 'conflict', 'invalid', 'sql-failure']) {
    let state = structuredClone(original), invalidations = 0, writes = 0
    const revision = modules.settingsRevision(original)
    Object.assign(globalThis, {
      requireSuperAdmin: () => {}, useDb: () => ({}),
      readBody: async () => ({ revision: scenario === 'conflict' ? 'old' : revision, batch: [{ key: 'a', value: '2' }, { key: 'b', value: scenario === 'invalid' ? 'yes' : '0' }] }),
      invalidateSettingsCache: async () => { invalidations++ },
      withTransaction: async work => {
        const working = structuredClone(state)
        const result = await work({ query: async (sql, args) => {
          if (sql.startsWith('SELECT')) return [working]
          writes++
          if (scenario === 'sql-failure' && writes === 2) throw new Error('simulated database failure')
          working.find(row => row.key === args[1]).value = args[0]
          return [{}]
        } })
        state = working
        return result
      },
    })
    if (scenario === 'ok') {
      const result = await modules.settingsPut(event('/api/admin/settings'))
      assert.equal(result.updated, 2); assert.equal(state[0].value, '2'); assert.equal(state[1].value, '0'); assert.equal(invalidations, 1)
    } else {
      await assert.rejects(modules.settingsPut(event('/api/admin/settings')))
      assert.deepEqual(state, original); assert.equal(invalidations, 0)
      if (scenario !== 'sql-failure') assert.equal(writes, 0)
    }
  }
})

test('列表只使用最后一次请求，刷新失败保留上次成功数据', async () => {
  Object.assign(globalThis, { ref, onScopeDispose })
  const pending = [], scope = effectScope()
  const state = scope.run(() => modules.useAdminList(signal => new Promise((resolve, reject) => pending.push({ signal, resolve, reject }))))
  const first = state.load(), second = state.load()
  assert.equal(pending[0].signal.aborted, true)
  pending[1].resolve({ list: [{ id: 'new' }], total: '1' }); await second
  assert.equal(state.total.value, 1)
  pending[0].resolve({ list: [{ id: 'old' }], total: 1 }); await first
  assert.equal(state.list.value[0].id, 'new')
  const failed = state.load(); pending[2].reject({ statusCode: 500 }); await failed
  assert.equal(state.list.value[0].id, 'new'); assert.ok(state.error.value)
  scope.stop()
})


test('关闭标签尊重未保存修改，确认后更新缓存代次并清理列表缓存', () => {
  const state = new Map(), navigations = [], cleared = []
  let confirmed = false
  Object.assign(globalThis, {
    useState: (key, initial) => { if (!state.has(key)) state.set(key, ref(initial?.())); return state.get(key) },
    useRouter: () => ({ push: path => navigations.push(path) }),
    clearNuxtState: key => cleared.push(key),
    window: { confirm: () => confirmed },
  })
  const tabs = modules.useTabStore()
  tabs.openTab('/admin/settings')
  state.get('admin-dirty-forms').value['/admin/settings'] = true
  tabs.closeTab('/admin/settings')
  assert.equal(tabs.activeTab.value, '/admin/settings')
  assert.equal(tabs.tabs.value.length, 2)
  confirmed = true
  tabs.closeTab('/admin/settings')
  assert.equal(tabs.activeTab.value, '/admin')
  assert.equal(tabs.generations.value['/admin/settings'], 1)
  tabs.openTab('/admin/posts'); tabs.closeAll()
  assert.equal(tabs.tabs.value.length, 1)
  assert.ok(cleared.includes('admin-posts-cache'))
})

function scheduleDatabase() {
  const state = { row: undefined, table: false, unavailable: false, failWrite: false, calls: [] }
  const db = { query: async (sql, args) => {
    state.calls.push({ sql, args })
    if (state.unavailable) throw new Error('private database credentials')
    if (sql.startsWith('SELECT 1')) {
      if (!state.table) throw Object.assign(new Error('missing table'), { code: 'ER_NO_SUCH_TABLE' })
      return [[], []]
    }
    if (sql.startsWith('CREATE TABLE')) { state.table = true; return [{}, []] }
    if (sql.startsWith('SELECT enabled')) return [state.row ? [structuredClone(state.row)] : [], []]
    assert.match(sql, /^INSERT INTO t_moment_schedule_settings/)
    if (state.failWrite) throw new Error('private database credentials')
    state.row = { enabled: args[0], image_times: args[1], text_times: args[2] }
    return [{ affectedRows: 1 }, []]
  } }
  return { state, db }
}
const sampleSchedule = () => ({ enabled: true, image_times: ['18:00', '10:00'], text_times: ['21:00', '09:00'] })

test('宠物圈完整替换严格校验字段、布尔值、时间与重复项；不同类型可同一时间', () => {
  const value = sampleSchedule(), validated = modules.validateMomentSchedule(value)
  assert.deepEqual(validated.image_times, ['10:00', '18:00'])
  assert.deepEqual(value.image_times, ['18:00', '10:00'], '校验不能修改调用方数据')
  assert.deepEqual(modules.validateMomentSchedule({ enabled: false, image_times: [], text_times: [] }), { enabled: false, image_times: [], text_times: [] })
  modules.validateMomentSchedule({ enabled: true, image_times: ['00:00', '23:59'], text_times: ['00:00'] })
  const invalid = [null, [], {}, { ...value, timezone: 'Asia/Shanghai' }, { ...value, enabled: 'true' },
    { enabled: true, image_times: [] }, { ...value, image_times: '12:00' }, { ...value, text_times: [null] },
    { ...value, image_times: ['09:00', '09:00'] }, { ...value, text_times: ['09:00', '09:00'] },
    ...['24:00', '9:00', '12:60', '12:00:00', ' 12:00', '12:00\n'].map(time => ({ ...value, image_times: [time] }))]
  for (const input of invalid) assert.throws(() => modules.validateMomentSchedule(input), error => error.statusCode === 422)
})

test('宠物圈首次保存前用环境默认值，保存后数据库覆盖环境、重建服务对象仍可读取', async () => {
  const { state, db } = scheduleDatabase()
  assert.deepEqual(await modules.getMomentSchedule(db, {}), { enabled: true, image_times: ['12:00'], text_times: ['09:00', '15:00', '21:00'], timezone: 'Asia/Shanghai' })
  assert.equal(state.row, undefined, '初始化不能抢先插入默认配置行')
  const defaults = { momentSchedulerEnabled: 'false', momentImageTimes: '', momentTextTimes: '["20:00","08:00"]' }
  assert.deepEqual((await modules.getMomentSchedule(db, defaults)).text_times, ['08:00', '20:00'])
  assert.equal((await modules.getMomentSchedule(db, defaults)).enabled, false)
  assert.equal((await modules.getMomentSchedule(db, defaults)).image_times.length, 0)
  const saved = await modules.saveMomentSchedule(db, sampleSchedule())
  assert.deepEqual(await modules.getMomentSchedule(db, defaults), saved)
  const restarted = { query: db.query }
  assert.deepEqual(await modules.getMomentSchedule(restarted, { momentSchedulerEnabled: 'invalid default ignored' }), saved)
  const createCount = state.calls.filter(call => call.sql.startsWith('CREATE TABLE')).length
  assert.equal(createCount, 1, '已建表后的新进程只需SELECT权限，不再执行DDL')
})

test('宠物圈数据库失败返回503且不修改计划，初始化失败可重试，非法请求不落库', async () => {
  const { state, db } = scheduleDatabase()
  state.unavailable = true
  await assert.rejects(modules.getMomentSchedule(db, {}), error => error.statusCode === 503 && !error.message.includes('private'))
  state.unavailable = false
  const original = await modules.saveMomentSchedule(db, sampleSchedule())
  state.failWrite = true
  await assert.rejects(modules.saveMomentSchedule(db, { enabled: false, image_times: [], text_times: [] }), error => error.statusCode === 503)
  assert.deepEqual(await modules.getMomentSchedule(db, {}), original)
  const callCount = state.calls.length
  await assert.rejects(modules.saveMomentSchedule(db, { enabled: false }), error => error.statusCode === 422)
  assert.equal(state.calls.length, callCount)
  state.unavailable = true
  await assert.rejects(modules.getMomentSchedule(db, {}), error => error.statusCode === 503, '已缓存表状态后读取失败仍须503')
  const unsaved = scheduleDatabase()
  await assert.rejects(modules.getMomentSchedule(unsaved.db, { momentImageTimes: '25:00' }), error => error.statusCode === 503)
})

test('宠物圈OpenAPI沿用签名，管理端拒绝普通账号；响应格式和状态码符合协议', async () => {
  const { state, db } = scheduleDatabase(), config = { openapiKey: 'test-key', openapiSecret: 'test-secret' }
  Object.assign(globalThis, { useRuntimeConfig: () => config, useDb: () => db })
  await assert.rejects(modules.openapiAuth(event('/openapi/moment/schedule')), error => error.statusCode === 401)
  assert.equal(state.calls.length, 0)
  const timestamp = String(Date.now()), signature = crypto.createHash('md5').update(config.openapiKey + timestamp + config.openapiSecret).digest('hex')
  const headers = { 'x-api-key': config.openapiKey, 'x-timestamp': timestamp, 'x-signature': signature, 'content-type': 'application/json' }
  await assert.rejects(modules.openapiAuth(event('/openapi/moment/schedule', { ...headers, 'x-signature': 'invalid' })), error => error.statusCode === 403)
  const get = event('/openapi/moment/schedule', headers); get.node.req.method = 'GET'
  await modules.openapiAuth(get)
  const response = await modules.openapiMomentScheduleHandler(get)
  assert.equal(response.code, 0); assert.equal(response.tip, '响应成功'); assert.equal(response.info.timezone, 'Asia/Shanghai')
  function post(input, contentType = 'application/json') {
    const e = event('/openapi/moment/schedule', { ...headers, 'content-type': contentType })
    e.node.req.rawBody = Buffer.from(typeof input === 'string' ? input : JSON.stringify(input)); return e
  }
  const put = post(sampleSchedule()); await modules.openapiAuth(put)
  const saved = await modules.openapiMomentScheduleHandler(put)
  assert.deepEqual(saved.info.image_times, ['10:00', '18:00']); assert.equal(put.node.res.statusCode, 200)
  for (const [e, status] of [[post({ ...sampleSchedule(), timezone: 'Asia/Shanghai' }), 422], [post('{broken'), 400], [post(sampleSchedule(), 'text/plain'), 415], [post('x'.repeat(128 * 1024 + 1)), 413]]) {
    const result = await modules.openapiMomentScheduleHandler(e)
    assert.equal(e.node.res.statusCode, status); assert.equal(result.code, status); assert.equal(result.info, null)
  }
  const anonymous = event('/api/admin/moment/schedule'); anonymous.node.req.method = 'GET'
  await assert.rejects(modules.adminMomentScheduleHandler(anonymous), error => error.statusCode === 403)
  anonymous.context.admin = { role: 'admin' }
  await assert.rejects(modules.adminMomentScheduleHandler(anonymous), error => error.statusCode === 403)
  anonymous.context.admin = { role: 'super_admin' }
  assert.deepEqual((await modules.adminMomentScheduleHandler(anonymous)).info, saved.info)
  state.failWrite = true
  const failed = post({ enabled: false, image_times: [], text_times: [] })
  assert.deepEqual(await modules.openapiMomentScheduleHandler(failed), { code: 503, info: null, tip: '数据库未就绪，无法保存宠物圈定时发布配置' })
  assert.equal(failed.node.res.statusCode, 503); assert.equal(failed.context.requestErrorCode, 'MOMENT_SCHEDULE_UNAVAILABLE')
})

test('短信在真实发送、开发和停用网关时输出生效验证码，发送失败不输出可用码', async () => {
  const previous = process.env.NODE_ENV, originalInfo = console.info, originalLog = console.log, originalError = console.error
  try {
    for (const scenario of ['aliyun', 'development', 'disabled', 'failure']) {
      process.env.NODE_ENV = scenario === 'development' ? 'development' : 'production'
      const records = [], writes = []; let sentCode, sends = 0
      console.info = value => records.push(parseLog(value)); console.log = () => {}; console.error = () => {}
      Object.assign(globalThis, {
        readBody: async () => ({ phone: '13800138000', purpose: 'login' }),
        getSettingBool: async () => scenario !== 'disabled',
        getSettingNumber: async (key, fallback) => key === 'sms_daily_limit' ? 0 : fallback,
        useRuntimeConfig: () => ({}),
        RedisKey: { smsLock: p => 'lock:' + p, smsCode: p => 'code:' + p },
        useRedis: () => ({ exists: async () => 0, setex: async (...args) => { writes.push(args) } }),
        sendSmsFixture: async request => {
          sends++; sentCode = JSON.parse(request.templateParam).code
          if (scenario === 'failure') throw new Error('provider failure')
          return { body: { code: 'OK', message: 'OK', bizId: 'test-biz-id' } }
        },
      })
      const e = event('/sdkapi/auth/sms'); e.context.reqId = 'sms-test-request'
      if (scenario === 'failure') {
        await assert.rejects(modules.sms(e), error => error.statusCode === 500)
        assert.equal(records.length, 0); assert.equal(writes.length, 0)
        continue
      }
      const response = await modules.sms(e)
      assert.equal(response.success, true); assert.equal(records.length, 1)
      const record = records[0], storedCode = JSON.parse(writes[0][2]).code
      assert.equal(record.event, 'sms.code.ready'); assert.equal(record.requestId, 'sms-test-request')
      assert.equal(record.phone, '13800138000'); assert.equal(record.code, storedCode); assert.match(record.code, /^\d{6}$/)
      assert.equal(record.expiresInSeconds, 600); assert.equal(record.channel, scenario)
      assert.equal(sends, scenario === 'aliyun' ? 1 : 0)
      if (scenario === 'aliyun') assert.equal(sentCode, record.code)
      assert.equal(response.dev_code, scenario === 'development' ? storedCode : undefined)
    }
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous
    console.info = originalInfo; console.log = originalLog; console.error = originalError
  }
})
