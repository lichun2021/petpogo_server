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
const nonces = new Set()
const config = { peerBackendUrl: '', peerBackendTimeoutMs: 20000, peerBackendMerchantId: 1, appApiSecret: 'local-test-secret', signatureNonceRequired: true }
const listen = server => new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)))
const close = server => new Promise(resolve => { if (!server) return resolve(); server.closeAllConnections(); server.close(resolve) })

before(async () => {
  temp = await mkdtemp(join(tmpdir(), 'petpogo-peer-test-'))
  const output = join(temp, 'peer.cjs')
  await build({ stdin: { contents: `export * from './server/integrations/peer/handler.ts'; export * from './server/integrations/peer/endpoints.ts'; export * from './server/utils/peerBackend.ts'; export { default as signature } from './server/middleware/signature.ts';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: output, logLevel: 'silent' })
  Object.assign(globalThis, {
    useRuntimeConfig: () => config,
    getHeader: h3.getHeader, createError: h3.createError, defineEventHandler: h3.defineEventHandler,
    RedisKey: { nonce: n => `nonce:${n}` },
    useRedis: () => ({
      get: async key => key === `peer_token:${crypto.createHash('sha256').update('valid-token').digest('hex')}` ? JSON.stringify({ userId: '123', phone: '13800138000' }) : null,
      setnx: async key => { if (nonces.has(key)) return 0; nonces.add(key); return 1 },
      expire: async () => 1,
    }),
    useDb: () => ({ query: async () => [[{ id: '123', status: banned ? 2 : 1 }]] }),
  })
  modules = (await import(pathToFileURL(output))).default
  upstream = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    requests.push({ url: req.url, method: req.method, headers: req.headers, body })
    const status = responseStatus, text = responseBody, wait = delay
    if (wait) await new Promise(resolve => setTimeout(resolve, wait))
    res.writeHead(status, { 'Content-Type': 'application/json', Location: `${config.peerBackendUrl}/should-not-follow` })
    res.end(text)
  })
  config.peerBackendUrl = await listen(upstream)
  api = createServer(h3.toNodeListener(h3.createApp().use(modules.signature).use(modules.peerProxyHandler)))
  base = await listen(api)
})
after(async () => { await close(api); await close(upstream); await rm(temp, { recursive: true, force: true }) })

function call(path, { method = 'POST', body, token = 'valid-token', headers = {}, signed = true } = {}) {
  const ts = String(Date.now())
  const signedHeaders = signed ? { 'x-timestamp': ts, 'x-signature': crypto.createHash('md5').update(ts + config.appApiSecret).digest('hex'), 'x-nonce': crypto.randomUUID() } : {}
  return fetch(`${base}/sdkapi/peer${path}`, { method, signal: AbortSignal.timeout(3000), headers: { ...signedHeaders, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) })
}
function reset() { requests = []; responseBody = '{"code":0,"info":{}}'; responseStatus = 200; delay = 0; banned = false; config.peerBackendTimeoutMs = 20000 }

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
