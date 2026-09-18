// 本地 HTTP 集成验证，不连接真实 Peer、MySQL、Redis 或设备。
import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import crypto from 'node:crypto'
import { build } from 'esbuild'
import * as h3 from 'h3'

let api, upstream, base, modules, temp
let requests = [], responseBody = '{"code":0,"info":{}}', responseStatus = 200, delay = 0
let banned = false
let accountResponses = {}
let sessionWrites = []
let syncConnection
const nonces = new Set()
const config = { peerBackendUrl: '', peerBackendTimeoutMs: 20000, peerBackendMerchantId: 1, appApiSecret: 'local-test-secret', signatureNonceRequired: true }
const listen = server => new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)))
const close = server => new Promise(resolve => { if (!server) return resolve(); server.closeAllConnections(); server.close(resolve) })

before(async () => {
  temp = await mkdtemp(join(tmpdir(), 'petpogo-peer-test-'))
  const output = join(temp, 'peer.cjs')
  await build({ stdin: { contents: `export * from './server/integrations/peer/handler.ts'; export * from './server/integrations/peer/endpoints.ts'; export * from './server/utils/peerBackend.ts'; export { default as signature } from './server/middleware/signature.ts'; export { default as loginPwd } from './server/routes/sdkapi/auth/login-pwd.post.ts';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: output, logLevel: 'silent' })
  Object.assign(globalThis, {
    useRuntimeConfig: () => config,
    readBody: h3.readBody, getHeader: h3.getHeader, createError: h3.createError, defineEventHandler: h3.defineEventHandler,
    RedisKey: { nonce: n => `nonce:${n}`, userLoginFail: p => `login:${p}`, imUserSig: id => `im:${id}` },
    assertNotLocked: async () => {}, clearLoginFailures: async () => {},
    genUserSig: () => 'mock-im-sig', getPointsBalance: async () => ({ balance: 0 }),
    useRedis: () => ({
      get: async key => key === `peer_token:${crypto.createHash('sha256').update('valid-token').digest('hex')}` ? JSON.stringify({ userId: '123', phone: '13800138000' }) : null,
      set: async key => { if (nonces.has(key)) return null; nonces.add(key); return 'OK' },
      expire: async () => 1,
      setex: async (...args) => { sessionWrites.push(args) },
    }),
    useDb: () => ({ query: async () => [[{ id: '123', phone: '13800138000', password: null, status: banned ? 2 : 1 }]], getConnection: async () => { if (!syncConnection) throw new Error('local database unavailable'); return syncConnection } }),
  })
  modules = (await import(pathToFileURL(output))).default
  for (const key of ['peerEnsureRegistered', 'peerLogin', 'tokenSessionKey', 'getPeerPublicUrl']) globalThis[key] = modules[key]
  upstream = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    requests.push({ url: req.url, method: req.method, headers: req.headers, body })
    const override = accountResponses[req.url]
    const status = responseStatus, text = override?.body ?? responseBody, wait = override?.delay ?? delay
    if (wait) await new Promise(resolve => setTimeout(resolve, wait))
    res.writeHead(status, { 'Content-Type': 'application/json', Location: `${config.peerBackendUrl}/should-not-follow` })
    res.end(text)
  })
  config.peerBackendUrl = await listen(upstream)
  api = createServer(h3.toNodeListener(h3.createApp().use(h3.defineEventHandler(event => { event.context.reqId = 'test-login-request' })).use(modules.signature).use('/sdkapi/auth/login-pwd', modules.loginPwd).use(modules.peerProxyHandler)))
  base = await listen(api)
})
after(async () => { await close(api); await close(upstream); await rm(temp, { recursive: true, force: true }) })

function call(path, { method = 'POST', body, token = 'valid-token', headers = {}, signed = true } = {}) {
  const ts = String(Date.now())
  const signedHeaders = signed ? { 'x-timestamp': ts, 'x-signature': crypto.createHash('md5').update(ts + config.appApiSecret).digest('hex'), 'x-nonce': crypto.randomUUID() } : {}
  return fetch(`${base}/sdkapi/peer${path}`, { method, signal: AbortSignal.timeout(3000), headers: { ...signedHeaders, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) })
}
function reset() { syncConnection = undefined; requests = []; accountResponses = {}; sessionWrites = []; responseBody = '{"code":0,"info":{}}'; responseStatus = 200; delay = 0; banned = false; config.peerBackendTimeoutMs = 20000 }

test('37 条清单无重复；未知接口/错误方法/缺签名不会调用上游', async () => {
  reset()
  assert.equal(modules.peerEndpoints.length, 37)
  assert.equal(new Set(modules.peerEndpoints.map(e => e.path)).size, 37)
  assert.equal((await call('/user/login')).status, 404)
  const wrong = await call('/user/device/list', { method: 'GET' })
  assert.equal(wrong.status, 405)
  assert.equal(wrong.headers.get('allow'), 'POST')
  assert.equal((await call('/world/country/list', { signed: false })).status, 401)
  assert.equal(requests.length, 0)
})

test('免登录国家接口保留裸对象；私有接口检查登录和封禁', async () => {
  reset()
  responseBody = '{"countryId":"86","countryName":"中国"}'
  const result = await call('/world/country/default', { method: 'GET', token: '' })
  assert.equal(await result.text(), responseBody)
  assert.equal(requests[0].headers.token, undefined)
  assert.equal((await call('/user/device/list', { token: '' })).status, 401)
  assert.equal((await call('/user/device/list', { token: 'expired' })).status, 401)
  banned = true
  assert.equal((await call('/user/device/list')).status, 403)
  assert.equal(requests.length, 1)
})

test('表单兼容及头隔离：只向固定上游传当前用户 token', async () => {
  reset()
  const result = await call('/user/device/update', { body: 'mac=AA%3ABB&deviceNickName=%E5%B0%8F%E7%8B%97', headers: { 'Content-Type': 'application/x-www-form-urlencoded', token: 'forged', Cookie: 'private=1', Accept: 'application/json' } })
  assert.equal(result.status, 200)
  assert.equal(requests[0].headers.token, 'valid-token')
  assert.equal(requests[0].headers.authorization, undefined)
  assert.equal(requests[0].headers.cookie, undefined)
  assert.equal(requests[0].headers.accept, '*/*')
  assert.equal(new URLSearchParams(requests[0].body).get('deviceNickName'), '小狗')
})

test('GET 分页、JSON 播放与 shadow 的二次表单编码', async () => {
  reset()
  await call('/pet/share/mylist?pageNo=2&pageSize=20', { method: 'GET' })
  assert.equal(requests[0].method, 'GET')
  assert.equal(requests[0].url, '/pet/share/mylist?pageNo=2&pageSize=20')
  await call('/pet/sound/play', { body: { mac: 'AA', url: 'https://example.test/sound.mp3?a=1&b=2' } })
  assert.equal(requests[1].headers['content-type'], 'application/json')
  assert.equal(JSON.parse(requests[1].body).volume, 15)
  const data = '{"motor_0":{"direction":1,"speed":50}}'
  await call('/device/shadow/update', { body: { mac: 'AA', data } })
  assert.equal(new URLSearchParams(requests[2].body).get('data'), data)
})

test('长 ID 与根 list/业务码逐字保留，不重新序列化', async () => {
  reset()
  responseBody = '{"code":"0","list":[{"petId":1234647089750028288}],"pageTurn":{"total":1}}'
  const result = await call('/pet/info/update', { body: { petId: '1234647089750028288', petName: '小狗' } })
  assert.equal(await result.text(), responseBody)
  assert.equal(result.headers.get('cache-control'), 'no-store')
  assert.equal(new URLSearchParams(requests[0].body).get('petId'), '1234647089750028288')
  responseBody = '{"code":1010,"tip":"token 不存在","info":null}'
  const expired = await call('/user/device/list')
  assert.equal(expired.status, 200)
  assert.equal(await expired.text(), responseBody)
})

test('非法参数、超长数字 ID、缺选择器和身份注入在本地拒绝', async () => {
  reset()
  for (const [path, body] of [
    ['/pet/info/update', { petId: 1234647089750028288 }],
    ['/pet/info/get', {}], ['/user/device/detail', { mac: ['A', 'B'] }],
    ['/user/device/list', { token: 'forged' }],
    ['/pet/sound/play', { mac: 'AA', url: 'x', volume: 22 }],
    ['/device/shadow/update', { mac: 'AA', data: 'invalid' }],
  ]) assert.equal((await call(path, { body })).status, 400)
  assert.equal(requests.length, 0)
})

test('上游 HTTP 错误保留 JSON；HTML/重定向拒绝，超时不重试', async () => {
  reset()
  responseStatus = 403; responseBody = '{"code":403,"tip":"无权限"}'
  const denied = await call('/user/device/list')
  assert.equal(denied.status, 403)
  assert.equal(await denied.text(), responseBody)
  responseStatus = 500; responseBody = '<html>internal</html>'
  assert.equal((await call('/user/device/list')).status, 502)
  responseStatus = 302; responseBody = '{}'
  assert.equal((await call('/user/device/list')).status, 502)
  assert.equal(requests.length, 3)
  responseStatus = 200; config.peerBackendTimeoutMs = 25; delay = 150
  assert.equal((await call('/device/shadow/update', { body: { mac: 'AA', data: '{"motor_0":{"direction":0}}' } })).status, 504)
  assert.equal(requests.length, 4)
})

test('原账号封装复用同一出口，保持登录解包和注册幂等行为', async () => {
  reset()
  responseBody = '{"code":0,"info":{"ipet_token":"new-token"}}'
  assert.equal((await modules.peerLogin('13800138000')).ipet_token, 'new-token')
  assert.equal(requests[0].url, '/user/login')
  assert.equal(new URLSearchParams(requests[0].body).get('account'), '13800138000@qq.com')
  await modules.peerRefreshToken('refresh-value')
  assert.equal(new URLSearchParams(requests[1].body).get('refreshToken'), 'refresh-value')
  await modules.peerSyncProfile('valid-token', { name: '昵称' })
  assert.equal(requests[2].headers.token, 'valid-token')
  responseBody = '{"code":1,"tip":"账号已注册"}'
  await modules.peerEnsureRegistered('13800138000')
  assert.equal(requests[3].url, '/user/register')
})

async function loginPwd() {
  const ts = String(Date.now())
  return fetch(`${base}/sdkapi/auth/login-pwd`, {
    method: 'POST', headers: {
      'Content-Type': 'application/json', 'x-timestamp': ts,
      'x-signature': crypto.createHash('md5').update(ts + config.appApiSecret).digest('hex'),
      'x-nonce': crypto.randomUUID(),
    }, body: JSON.stringify({ phone: '13800138000', password: '123456' }),
  })
}

test('密码登录：注册提示已注册后，仍调用登录并建立会话', async () => {
  reset()
  accountResponses = {
    '/user/register': { body: '{"code":1,"tip":"账号已注册"}' },
    '/user/login': { body: '{"code":0,"info":{"ipet_token":"new-token","expiration":43200}}' },
  }
  const result = await loginPwd()
  assert.equal(result.status, 200)
  assert.equal((await result.json()).token, 'new-token')
  assert.deepEqual(requests.map(r => r.url), ['/user/register', '/user/login'])
  assert.equal(new URLSearchParams(requests[1].body).get('account'), '13800138000@qq.com')
  assert.ok(sessionWrites.some(([key]) => key === modules.tokenSessionKey('new-token')))
})

test('密码登录：已注册后登录超时，日志明确失败接口且不写会话', async () => {
  reset()
  config.peerBackendTimeoutMs = 50
  accountResponses = {
    '/user/register': { body: '{"code":1,"tip":"账号已注册"}' },
    '/user/login': { body: '{"code":0,"info":{"ipet_token":"private-token"}}', delay: 200 },
  }
  const errors = [], original = console.error
  console.error = value => errors.push(value)
  try {
    const result = await loginPwd()
    assert.equal(result.status, 504)
    assert.deepEqual(requests.map(r => r.url), ['/user/register', '/user/login'])
    assert.equal(sessionWrites.length, 0)
    const entry = errors.map(v => JSON.parse(v)).find(v => v.event === 'peer.request.error')
    assert.equal(entry.path, '/user/login')
    assert.equal(entry.requestId, 'test-login-request')
    assert.equal(entry.stage, 'waiting_headers')
    assert.equal(entry.errorCode, 'PEER_TIMEOUT')
    assert.equal(entry.outcome, 'timeout')
    assert.equal(entry.status, 504)
    assert.ok(entry.durationMs >= 40)
    assert.ok(!JSON.stringify(errors).includes('13800138000'))
    assert.ok(!JSON.stringify(errors).includes('private-token'))
  } finally { console.error = original; reset() }
})


test('Peer 删除成功后同步本地，原样返回上游；业务失败不写本地', async () => {
  reset()
  const writes = []
  syncConnection = {
    beginTransaction: async () => writes.push('begin'), commit: async () => writes.push('commit'),
    rollback: async () => writes.push('rollback'), release: () => writes.push('release'),
    query: async (sql, params) => { writes.push({ sql, params }); return [{}] },
  }
  responseBody = '{"code":"0","tip":"success"}'
  const result = await call('/pet/info/del', { body: { petId: '1234647089750028288' } })
  assert.equal(result.status, 200); assert.equal(await result.text(), responseBody)
  assert.deepEqual(writes[1].params, ['123', '1234647089750028288'])
  assert.deepEqual(writes.filter(v => typeof v === 'string'), ['begin', 'commit', 'release'])
  responseBody = '{"code":17806,"tip":"rejected"}'
  await call('/pet/info/del', { body: { petId: '1234647089750028288' } })
  assert.equal(writes.length, 4)
})

test('本地同步失败明确返回上游已执行，不重试写操作', async () => {
  reset()
  const result = await call('/pet/info/del', { body: { petId: '1234647089750028288' } })
  assert.equal(result.status, 502)
  const body = await result.json()
  assert.equal(body.data.code, 'PEER_LOCAL_SYNC_FAILED'); assert.equal(body.data.upstreamApplied, true)
  assert.equal(requests.length, 1)
})
