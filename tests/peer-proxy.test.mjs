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
let loginHash
let deviceRows = []
let syncConnection
const nonces = new Set()
const config = { peerBackendUrl: '', peerBackendTimeoutMs: 20000, peerBackendMerchantId: 1, appApiSecret: 'local-test-secret', signatureNonceRequired: true }
const listen = server => new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)))
const close = server => new Promise(resolve => { if (!server) return resolve(); server.closeAllConnections(); server.close(resolve) })

before(async () => {
  temp = await mkdtemp(join(tmpdir(), 'petpogo-peer-test-'))
  const output = join(temp, 'peer.cjs')
  await build({ stdin: { contents: `export * from './server/integrations/peer/handler.ts'; export * from './server/integrations/peer/endpoints.ts'; export * from './server/utils/peerBackend.ts'; export * from './server/utils/userPassword.ts'; export { default as signature } from './server/middleware/signature.ts'; export { default as loginPwd } from './server/routes/sdkapi/auth/login-pwd.post.ts';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: output, logLevel: 'silent' })
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
    useDb: () => ({ query: async (sql) => sql.startsWith('SELECT id,mac,network_type') ? [deviceRows] : [[{ id: '123', phone: '13800138000', password: loginHash, status: banned ? 2 : 1 }]], getConnection: async () => { if (!syncConnection) throw new Error('local database unavailable'); return syncConnection } }),
  })
  modules = (await import(pathToFileURL(output))).default
  loginHash = await modules.hashUserPassword('Individual!2026')
  for (const name of ['needsPasswordSetup','verifyUserPassword','hashUserPassword']) globalThis[name] = modules[name]
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
function reset() { deviceRows = []; syncConnection = undefined; requests = []; accountResponses = {}; sessionWrites = []; responseBody = '{"code":0,"info":{}}'; responseStatus = 200; delay = 0; banned = false; config.peerBackendTimeoutMs = 20000 }

test('43 条清单无重复；未知接口/错误方法/缺签名不会调用上游', async () => {
  reset()
  assert.equal(modules.peerEndpoints.length, 43)
  assert.equal(new Set(modules.peerEndpoints.map(e => e.path)).size, 43)
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

test('设备属性查询：GET 转发 MAC 和当前用户 token，完整保留电量等属性', async () => {
  reset()
  responseBody = JSON.stringify({
    code: 0,
    info: {
      battery: '57', temp: '37.5',
      led_r: '', led_g: '', led_b: '',
      brightness_r: '', brightness_g: '', brightness_b: '',
      speaker: '', speaker_volume: '', speaker_sound: '',
      mic: '', mic_level: '', reportDataTime: 0,
    },
    tip: '响应成功',
  })
  const result = await call('/device/property/query?mac=ipet-esp32-Device-03', {
    method: 'GET', headers: { token: 'forged', Cookie: 'private=1' },
  })
  assert.equal(result.status, 200)
  assert.equal(await result.text(), responseBody)
  assert.equal(result.headers.get('cache-control'), 'no-store')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].method, 'GET')
  assert.equal(requests[0].url, '/device/property/query?mac=ipet-esp32-Device-03')
  assert.equal(requests[0].body, '')
  assert.equal(requests[0].headers.token, 'valid-token')
  assert.equal(requests[0].headers.authorization, undefined)
  assert.equal(requests[0].headers.cookie, undefined)
})

test('设备属性查询：缺失或非法 MAC、错误方法、未登录和缺签名均不调用上游', async () => {
  reset()
  for (const query of ['', '?mac=', '?mac=%20', '?mac=AA&mac=BB', '?mac=AA&deviceId=123']) {
    assert.equal((await call(`/device/property/query${query}`, { method: 'GET' })).status, 400)
  }
  const path = '/device/property/query?mac=ipet-esp32-Device-03'
  const wrong = await call(path)
  assert.equal(wrong.status, 405)
  assert.equal(wrong.headers.get('allow'), 'GET')
  assert.equal((await call(path, { method: 'GET', token: '' })).status, 401)
  assert.equal((await call(path, { method: 'GET', token: 'expired' })).status, 401)
  assert.equal((await call(path, { method: 'GET', signed: false })).status, 401)
  assert.equal(requests.length, 0)
})

test('音视频开始：JSON 布尔值转表单，保留 wsAppUrl、shared 及上游默认参数', async () => {
  reset()
  responseBody = '{"code":0,"info":{"mac":"ipet-bot-01","wsAppUrl":"ws://stream.example.test:8006/ws/app/ipet-bot-01?ticket=future-ticket","video":true,"audio":true,"shared":true},"tip":"响应成功"}'
  const result = await call('/pet/stream/start', {
    body: { mac: 'ipet-bot-01', video: true, audio: false, fps: 10, quality: 20, serverHost: 'stream.example.test', serverPort: 8006 },
    headers: { token: 'forged' },
  })
  assert.equal(result.status, 200)
  assert.equal(await result.text(), responseBody)
  assert.equal(result.headers.get('cache-control'), 'no-store')
  assert.equal(requests[0].url, '/pet/stream/start')
  assert.equal(requests[0].method, 'POST')
  assert.equal(requests[0].headers['content-type'], 'application/x-www-form-urlencoded')
  assert.equal(requests[0].headers.token, 'valid-token')
  assert.deepEqual(Object.fromEntries(new URLSearchParams(requests[0].body)), {
    mac: 'ipet-bot-01', video: 'true', audio: 'false', fps: '10', quality: '20', serverHost: 'stream.example.test', serverPort: '8006',
  })
  assert.equal((await call('/pet/stream/start', { body: { mac: 'ipet-bot-01' } })).status, 200)
  assert.equal(requests[1].body, 'mac=ipet-bot-01')
  // 允许建议范围之外的 fps，以及最小质量值；由 Peer 决定设备实际能力。
  assert.equal((await call('/pet/stream/start', { body: { mac: 'ipet-bot-01', fps: '30', quality: 0 } })).status, 200)
})

test('音视频停止与开关：兼容表单和 JSON false，业务失败原样返回', async () => {
  reset()
  responseBody = '{"code":0,"info":"success","tip":"响应成功"}'
  for (const [path, body, headers = {}] of [
    ['/pet/stream/stop', { mac: 'ipet-bot-01' }],
    ['/pet/stream/video', { mac: 'ipet-bot-01', enable: false }],
    ['/pet/stream/audio', 'mac=ipet-bot-01&enable=true', { 'Content-Type': 'application/x-www-form-urlencoded' }],
    ['/pet/stream/start', 'mac=ipet-bot-01&video=false&audio=true', { 'Content-Type': 'application/x-www-form-urlencoded' }],
  ]) {
    const result = await call(path, { body, headers })
    assert.equal(result.status, 200)
    assert.equal(await result.text(), responseBody)
    assert.equal(requests.at(-1).url, path)
    assert.equal(requests.at(-1).method, 'POST')
    assert.equal(requests.at(-1).headers.token, 'valid-token')
  }
  assert.equal(new URLSearchParams(requests[1].body).get('enable'), 'false')
  assert.equal(new URLSearchParams(requests[2].body).get('enable'), 'true')
  assert.equal(new URLSearchParams(requests[3].body).get('video'), 'false')
  for (const code of [1, 1010, 12003, 12021]) {
    responseBody = JSON.stringify({ code, info: null, tip: '上游失败' })
    const result = await call('/pet/stream/start', { body: { mac: 'ipet-bot-01' } })
    assert.equal(result.status, 200)
    assert.equal(await result.text(), responseBody)
  }
})

test('音视频状态：免登录 GET 查询，仍需应用签名且不转发客户端凭证', async () => {
  reset()
  responseBody = '{"code":0,"info":{"deviceConnected":true,"appViewerCount":2},"tip":"响应成功"}'
  const path = '/pet/stream/status?mac=ipet-bot-01'
  const result = await call(path, { method: 'GET', token: '', headers: { token: 'forged', Cookie: 'private=1' } })
  assert.equal(result.status, 200)
  assert.equal(await result.text(), responseBody)
  assert.equal(result.headers.get('cache-control'), 'no-store')
  assert.equal(requests[0].url, path)
  assert.equal(requests[0].method, 'GET')
  assert.equal(requests[0].body, '')
  assert.equal(requests[0].headers.token, undefined)
  assert.equal(requests[0].headers.cookie, undefined)
  assert.equal((await call(path, { method: 'GET', signed: false })).status, 401)
  assert.equal((await call('/pet/stream/status', { method: 'GET', token: '' })).status, 400)
  assert.equal(requests.length, 1)
})

test('音视频控制：非法参数、登录、签名和方法拦截，未开放的流路径不会调用上游', async () => {
  reset()
  for (const [path, body] of [
    ['/pet/stream/start', {}],
    ['/pet/stream/start', { mac: ['AA', 'BB'] }],
    ['/pet/stream/start', { mac: true }],
    ['/pet/stream/start', { mac: 'AA', video: 1 }],
    ['/pet/stream/start', { mac: 'AA', audio: 'yes' }],
    ['/pet/stream/start', { mac: 'AA', audio: ['true'] }],
    ['/pet/stream/start', { mac: 'AA', fps: 0 }],
    ['/pet/stream/start', { mac: 'AA', fps: 1.5 }],
    ['/pet/stream/start', { mac: 'AA', fps: '' }],
    ['/pet/stream/start', { mac: 'AA', quality: -1 }],
    ['/pet/stream/start', { mac: 'AA', quality: 'NaN' }],
    ['/pet/stream/start', { mac: 'AA', serverPort: 65536 }],
    ['/pet/stream/start', { mac: 'AA', serverPort: 0 }],
    ['/pet/stream/start', { mac: 'AA', serverHost: '' }],
    ['/pet/stream/start', { mac: 'AA', token: 'forged' }],
    ['/pet/stream/stop', { mac: ' ' }],
    ['/pet/stream/video', { mac: 'AA' }],
    ['/pet/stream/audio', { mac: 'AA', enable: 'on' }],
    ['/pet/info/update', { petId: '123', petName: true }],
  ]) assert.equal((await call(path, { body })).status, 400)
  for (const path of ['/pet/stream/start', '/pet/stream/stop', '/pet/stream/video', '/pet/stream/audio']) {
    assert.equal((await call(path, { token: '', body: { mac: 'AA', enable: true } })).status, 401)
    assert.equal((await call(path, { signed: false, body: { mac: 'AA', enable: true } })).status, 401)
    assert.equal((await call(`${path}?mac=AA`, { method: 'GET' })).status, 405)
  }
  assert.equal((await call('/pet/stream/status', { body: { mac: 'AA' }, token: '' })).status, 405)
  assert.equal((await call('/pet/stream/unknown', { body: { mac: 'AA' } })).status, 404)
  assert.equal(requests.length, 0)
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
    }, body: JSON.stringify({ phone: '13800138000', password: 'Individual!2026' }),
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
    const entry = errors.map(v => JSON.parse(String(v).replace(/^\[[^\]]+\] /, ''))).find(v => v.event === 'peer.request.error')
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

test('绑定通网类型只接受4g/wifi，兼容旧客户端省略', () => {
  const endpoint = modules.peerEndpoints.find(e => e.path === '/user/device/bind')
  assert.equal(modules.validatePeerParams(endpoint, {mac:'AA',networkType:' WiFi '}).networkType,'wifi')
  assert.equal(modules.validatePeerParams(endpoint, {mac:'AA',networkType:'4G'}).networkType,'4g')
  assert.equal(modules.validatePeerParams(endpoint, {mac:'AA'}).networkType,undefined)
  assert.throws(()=>modules.validatePeerParams(endpoint, {mac:'AA',networkType:'ethernet'}),e=>e.statusCode===400)
})

test('设备列表补充本地通网类型，保留共享设备、业务字段及长ID精度', async () => {
  reset()
  deviceRows = [{id:'1237250046272094208',mac:'AA',network_type:'wifi'}, {id:'2',mac:'BB',network_type:'4g'}, {id:'3',mac:'different',network_type:'wifi'}]
  responseBody = '{"code":0,"tip":"成功","info":[{"deviceId":1237250046272094208,"mac":"AA","uType":2},{"deviceId":"2","mac":"BB"},{"deviceId":"3","mac":"CC"},{"deviceId":"4","mac":"DD"}]}'
  const r = await call('/user/device/list')
  assert.equal(r.status,200)
  const data = await r.json()
  assert.equal(data.tip,'成功');assert.equal(data.info.length,4)
  assert.equal(data.info[0].deviceId,'1237250046272094208');assert.equal(data.info[0].uType,2)
  assert.deepEqual(data.info.map(d=>d.networkType),['wifi','4g',null,null])
})
test('设备列表兼容list结构，空列表不追加本地设备', async () => {
  reset();deviceRows=[{id:'2',mac:'BB',network_type:'4g'}]
  responseBody='{"code":0,"list":[{"id":"2","mac":"BB"}]}'
  assert.equal((await (await call('/user/device/list')).json()).list[0].networkType,'4g')
  responseBody='{"code":0,"info":[]}'
  assert.deepEqual((await (await call('/user/device/list')).json()).info,[])
})


test('静默代理超时仍把上游路径、阶段、耗时和错误码传回请求上下文', async () => {
  reset(); config.peerBackendTimeoutMs = 25; delay = 150
  const context = {}
  await assert.rejects(modules.peerRequest('/user/device/list', { method: 'POST', encoding: 'form', token: 'test-token', quiet: true, context }), error => error.statusCode === 504)
  assert.equal(context.proxyUpstreamPath, '/user/device/list')
  assert.equal(context.proxyUpstreamStage, 'waiting_headers')
  assert.equal(context.requestErrorCode, 'PEER_TIMEOUT')
  assert.equal(context.proxyOutcome, 'timeout')
  assert.ok(context.proxyUpstreamMs >= 20)
  assert.ok(context.proxyUpstreamHost)
})
