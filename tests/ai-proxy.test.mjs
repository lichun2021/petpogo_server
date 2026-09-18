// 使用本地模拟 AI/Peer，验证中转协议和权限；不访问真实设备或推理服务。
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

let appServer, aiServer, peerServer, base, temp, modules
let requests = [], responseStatus = 200, responseText = '{"code":0,"info":{}}'
let mode = 'json', releaseStream, streamClosed, shared = false, delay = 0, banned = false
const petId = '1234647089750028288'
const config = { aiApiKey: 'test-key', aiApiSecret: 'test-secret', appApiSecret: 'app-secret', signatureNonceRequired: true, peerBackendTimeoutMs: 1000 }
const nonces = new Set()
const listen = server => new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)))
const close = server => new Promise(resolve => { if (!server) return resolve(); server.closeAllConnections(); server.close(resolve) })
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

before(async () => {
  temp = await mkdtemp(join(tmpdir(), 'ai-proxy-test-'))
  const output = join(temp, 'ai.cjs')
  await build({ stdin: { contents: `export * from './server/integrations/ai/handler.ts'; export * from './server/integrations/ai/endpoints.ts'; export { default as signature } from './server/middleware/signature.ts';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: output, logLevel: 'silent' })
  Object.assign(globalThis, {
    useRuntimeConfig: () => config,
    getHeader: h3.getHeader, createError: h3.createError, defineEventHandler: h3.defineEventHandler,
    RedisKey: { nonce: n => `nonce:${n}` },
    useRedis: () => ({
      get: async key => key === `peer_token:${crypto.createHash('sha256').update('valid-token').digest('hex')}` ? JSON.stringify({ userId: '1', phone: '13800138000' }) : null,
      setnx: async key => { if (nonces.has(key)) return 0; nonces.add(key); return 1 },
      expire: async () => 1,
    }),
    useDb: () => ({ query: async () => [[{ id: '1', status: banned ? 2 : 1 }]] }),
  })
  modules = (await import(pathToFileURL(output))).default
  peerServer = createServer(async (req, res) => {
    for await (const _ of req) {}
    assert.equal(req.headers.token, 'valid-token')
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/user/device/list') return res.end('{"code":0,"info":[{"mac":"AA:BB"}]}')
    if (req.url === '/pet/info/list') return res.end(shared ? '{"code":0,"info":[]}' : `{"code":0,"info":[{"petId":${petId}}]}`)
    if (req.url === '/pet/share/members') return res.end(JSON.stringify({ code: 0, info: { members: shared ? [{ account: '13800138000@qq.com' }] : [] } }))
    res.writeHead(404).end('{}')
  })
  config.peerBackendUrl = await listen(peerServer)
  aiServer = createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    requests.push({ path: req.url, headers: req.headers, body })
    const ts = req.headers['x-timestamp']
    assert.equal(req.headers['x-api-key'], config.aiApiKey)
    assert.equal(req.headers['x-signature'], crypto.createHash('md5').update(config.aiApiKey + ts + config.aiApiSecret).digest('hex'))
    assert.equal(req.headers.authorization, undefined)
    assert.equal(req.headers.cookie, undefined)
    if (req.url === '/session/messages') {
      res.setHeader('Content-Type', 'application/json')
      const id = JSON.parse(body).session_id
      return res.end(JSON.stringify({ code: 0, info: { session_id: id, pet_id: id === 'other-session' ? 'other-pet' : petId, turns: [] } }))
    }
    if (req.url === '/messages/stream' && mode !== 'json') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' })
      res.flushHeaders()
      streamClosed = new Promise(resolve => res.once('close', resolve))
      const activeMode = mode
      if (activeMode === 'idle') return
      res.write('event: start\ndata: "start"\n\n')
      await new Promise(resolve => { releaseStream = resolve })
      if (res.destroyed) return
      const delta = Buffer.from('event: delta\ndata: "你好，小狗"\n\n')
      const split = delta.indexOf(Buffer.from('你')) + 1
      res.write(delta.subarray(0, split))
      await wait(10)
      res.end(Buffer.concat([delta.subarray(split), Buffer.from('event: done\ndata: "done"\n\n')]))
      return
    }
    if (delay) await wait(delay)
    res.writeHead(responseStatus, { 'Content-Type': 'application/json' })
    res.end(responseText)
  })
  config.aiServiceUrl = await listen(aiServer)
  appServer = createServer(h3.toNodeListener(h3.createApp().use(modules.signature).use(modules.aiProxyHandler)))
  base = await listen(appServer)
})
after(async () => { releaseStream?.(); await close(appServer); await close(aiServer); await close(peerServer); await rm(temp, { recursive: true, force: true }) })

function reset() {
  releaseStream?.(); releaseStream = undefined
  requests = []; responseStatus = 200; responseText = '{"code":0,"info":{}}'; mode = 'json'; shared = false; delay = 0; banned = false
  Object.assign(config, { aiProxyTimeoutMs: 2000, aiProxyStreamTimeoutMs: 3000, aiProxyStreamIdleTimeoutMs: 1000, aiProxyRecordingTimeoutMs: 3000 })
}
function call(path, body = {}, { signed = true, token = 'valid-token', signal = AbortSignal.timeout(4000), method = 'POST' } = {}) {
  const ts = String(Date.now())
  const form = body instanceof FormData
  return fetch(`${base}/sdkapi/ai-proxy${path}`, {
    method, signal,
    headers: { ...(signed ? { 'x-timestamp': ts, 'x-signature': crypto.createHash('md5').update(ts + config.appApiSecret).digest('hex'), 'x-nonce': crypto.randomUUID() } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(form ? {} : { 'Content-Type': 'application/json' }), Cookie: 'must-not-forward=1' },
    body: method === 'GET' ? undefined : form ? body : JSON.stringify(body),
  })
}

test('只开放 20 条 POST，沿用签名和登录/封禁拦截', async () => {
  reset()
  assert.equal(modules.aiEndpoints.length, 20)
  assert.equal(new Set(modules.aiEndpoints.map(e => e.path)).size, 20)
  assert.equal((await call('/moment/trigger-schedule')).status, 404)
  assert.equal((await call('/session/new', {}, { method: 'GET' })).status, 405)
  assert.equal((await call('/session/new', { pet_id: petId }, { signed: false })).status, 401)
  assert.equal((await call('/session/new', { pet_id: petId }, { token: '' })).status, 401)
  banned = true
  assert.equal((await call('/session/new', { pet_id: petId })).status, 403)
  assert.equal(requests.length, 0)
})

test('宠物/设备/会话权限及消费账号不能靠伪造参数绕过', async () => {
  reset()
  assert.equal((await call('/health-data/overview', { pet_id: 'other-pet' })).status, 403)
  assert.equal((await call('/video/recording/start', { device_no: 'OTHER' })).status, 403)
  assert.equal((await call('/video/recording/start', { device_no: 'AA:BB', account: 'someone-else' })).status, 403)
  assert.equal((await call('/messages', { session_id: 'other-session', text: 'hello' })).status, 403)
  assert.deepEqual(requests.map(r => r.path), ['/session/messages'])
  shared = true
  assert.equal((await call('/health-data/overview', { pet_id: petId })).status, 200)
})

test('JSON 保留长 ID 和完整空结构；上游 tasks 404 透传', async () => {
  reset()
  responseText = `{"code":0,"info":{"pet_id":${petId},"behaviors":[],"baseline_ratio":null}}`
  const result = await call('/health-data/overview', { pet_id: petId, date: '2026-09-18' })
  assert.equal(await result.text(), responseText)
  assert.equal(JSON.parse(requests[0].body).pet_id, petId)
  responseStatus = 404; responseText = '{"detail":"Not Found"}'
  const missing = await call('/video/stream/auto-analysis/tasks', { device_no: 'AA:BB' })
  assert.equal(missing.status, 404)
  assert.equal(await missing.text(), responseText)
  assert.equal(JSON.parse(requests.at(-1).body).account, '13800138000')
})

test('分析 multipart 重建签名及 account，不改变裸响应格式', async () => {
  reset()
  const data = new FormData()
  data.append('url', 'https://example.test/image.jpg?a=1&b=2')
  data.append('pet_id', petId)
  responseText = '{"success":false,"reason":"非宠物"}'
  const result = await call('/image/analyze', data)
  assert.equal(await result.text(), responseText)
  const request = requests.at(-1)
  assert.match(request.headers['content-type'], /^multipart\/form-data; boundary=/)
  assert.match(request.body, /name="account"\r\n\r\n13800138000/)
  assert.match(request.body, /name="pet_id"/)
  const bad = new FormData(); bad.append('file', new Blob(['fake']), 'a.jpg'); bad.append('url', 'https://example.test/a.jpg')
  assert.equal((await call('/image/analyze', bad)).status, 400)
})

test('设置保留 boolean/数组类型，非法日期、ID 和字段在本地拒绝', async () => {
  reset()
  await call('/voice/stream/auto-analysis/settings/save', { device_no: 'AA:BB', effective_start_time: '09:00', effective_end_time: '18:00', repeat_weekdays: [1, 2], daily_analysis_count: 2, enabled: false })
  const body = JSON.parse(requests[0].body)
  assert.equal(body.enabled, false); assert.deepEqual(body.repeat_weekdays, [1, 2])
  for (const input of [{ pet_id: 1234647089750028288 }, { pet_id: petId, date: '2026-02-30' }, { pet_id: petId, period: 'year' }, { pet_id: petId, target: 'http://bad' }]) {
    assert.equal((await call('/health-data/behavior-analysis', input)).status, 400)
  }
  assert.equal(requests.length, 1)
})

test('实时 SSE 首帧先到达；跨 UTF-8 分片和 start/delta/done 保持完整', async () => {
  reset(); mode = 'stream'
  const result = await call('/messages/stream', { session_id: 'my-session', text: '小狗怎么样' })
  assert.match(result.headers.get('content-type'), /text\/event-stream/)
  assert.equal(result.headers.get('x-accel-buffering'), 'no')
  const reader = result.body.getReader()
  const first = await reader.read()
  assert.match(Buffer.from(first.value).toString(), /event: start/)
  assert.equal(typeof releaseStream, 'function') // 上游尚未生成后续回答，首帧已经到达客户端。
  releaseStream()
  const chunks = [first.value]
  while (true) { const next = await reader.read(); if (next.done) break; chunks.push(next.value) }
  const text = Buffer.concat(chunks).toString('utf8')
  assert.match(text, /你好，小狗/)
  assert.match(text, /event: done/)
  assert.equal(requests.filter(r => r.path === '/messages/stream').length, 1)
})

test('取消客户端连接会关闭上游 SSE，不继续等待完整回答', async () => {
  reset(); mode = 'stream'
  const abort = new AbortController()
  const result = await call('/messages/stream', { session_id: 'my-session', text: 'hello' }, { signal: abort.signal })
  const reader = result.body.getReader(); await reader.read()
  abort.abort()
  await Promise.race([streamClosed, wait(1000).then(() => { throw Error('未关闭上游流') })])
  releaseStream()
})

test('流空闲超时断开，不追加 JSON 或伪造结束事件', async () => {
  reset(); mode = 'idle'; config.aiProxyStreamIdleTimeoutMs = 40
  const result = await call('/messages/stream', { session_id: 'my-session', text: 'hello' })
  await assert.rejects(result.text())
  await streamClosed
})

test('普通超时不重试；录制停止使用独立长预算；AI 签名错误不误报登录过期', async () => {
  reset(); config.aiProxyTimeoutMs = 20; delay = 80
  assert.equal((await call('/voice/analyze', { url: 'https://example.test/a.wav' })).status, 504)
  assert.equal(requests.length, 1)
  assert.equal((await call('/video/recording/stop', { device_no: 'AA:BB' })).status, 200)
  delay = 0; config.aiProxyTimeoutMs = 1000; responseStatus = 401
  assert.equal((await call('/voice/analyze', { url: 'https://example.test/a.wav' })).status, 502)
})
