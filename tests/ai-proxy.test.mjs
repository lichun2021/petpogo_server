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
let requestLogs = []
const originalInfo = console.info
let requests = [], responseStatus = 200, responseText = '{"code":0,"info":{}}'
let mode = 'json', releaseStream, streamClosed, shared = false, delay = 0, banned = false
const petId = '1234647089750028288'
const config = { aiMediaAllowedHosts: 'example.test', aiApiKey: 'test-key', aiApiSecret: 'test-secret', appApiSecret: 'app-secret', signatureNonceRequired: true, peerBackendTimeoutMs: 1000 }
const nonces = new Set()
const listen = server => new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)))
const close = server => new Promise(resolve => { if (!server) return resolve(); server.closeAllConnections(); server.close(resolve) })
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

before(async () => {
  temp = await mkdtemp(join(tmpdir(), 'ai-proxy-test-'))
  const output = join(temp, 'ai.cjs')
  await build({ stdin: { contents: `export { default as logger } from './server/plugins/logger.ts'; export * from './server/integrations/ai/handler.ts'; export * from './server/integrations/ai/endpoints.ts'; export { default as signature } from './server/middleware/signature.ts';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: output, logLevel: 'silent' })
  Object.assign(globalThis, {
    useRuntimeConfig: () => config,
    getHeader: h3.getHeader, createError: h3.createError, defineEventHandler: h3.defineEventHandler, defineNitroPlugin: p => p,
    RedisKey: { nonce: n => `nonce:${n}` },
    useRedis: () => ({
      get: async key => key === `peer_token:${crypto.createHash('sha256').update('valid-token').digest('hex')}` ? JSON.stringify({ userId: '1', phone: '13800138000' }) : null,
      set: async key => { if (nonces.has(key)) return null; nonces.add(key); return 'OK' },
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
    if (mode === 'disconnect') { req.socket.destroy(); return }
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
      if (activeMode === 'error') return res.end('event: error\ndata: {"message":"private text"}\n\n')
      if (activeMode === 'incomplete') return res.end('event: delta\ndata: "partial"\n\n')
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
  const hooks = {}
  modules.logger({ hooks: { hook: (name, fn) => { hooks[name] = fn } } })
  console.info = value => {
    try { const row = JSON.parse(value); if (row.event?.startsWith('request.')) { requestLogs.push(row); return } } catch {}
    originalInfo(value)
  }
  appServer = createServer(h3.toNodeListener(h3.createApp().use(event => hooks.request(event)).use(modules.signature).use(modules.aiProxyHandler)))
  base = await listen(appServer)
})
after(async () => { console.info = originalInfo; releaseStream?.(); await close(appServer); await close(aiServer); await close(peerServer); await rm(temp, { recursive: true, force: true }) })

function reset() {
  releaseStream?.(); releaseStream = undefined
  requests = []; requestLogs = []; responseStatus = 200; responseText = '{"code":0,"info":{}}'; mode = 'json'; shared = false; delay = 0; banned = false
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
  await wait(5)
  const ends = requestLogs.filter(r => r.event === 'request.end' && r.path.endsWith('/messages/stream'))
  assert.equal(ends.length, 1); assert.equal(ends[0].outcome, 'complete')
  assert.ok(ends[0].streamBytes > 0); assert.ok(ends[0].firstByteMs >= 0)
  assert.ok(ends[0].permissionMs >= 0); assert.equal(ends[0].upstreamStatus, 200)
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
  await wait(5)
  assert.equal(requestLogs.filter(r => r.event === 'request.end').at(-1).outcome, 'client_closed')
})

test('流空闲超时断开，不追加 JSON 或伪造结束事件', async () => {
  reset(); mode = 'idle'; config.aiProxyStreamIdleTimeoutMs = 40
  const result = await call('/messages/stream', { session_id: 'my-session', text: 'hello' })
  await assert.rejects(result.text())
  await streamClosed
  await wait(5)
  assert.equal(requestLogs.filter(r => r.event === 'request.end').at(-1).outcome, 'timeout')
})

test('普通超时不重试；录制停止使用独立长预算；AI 签名错误不误报登录过期', async () => {
  reset(); config.aiProxyTimeoutMs = 20; delay = 80
  assert.equal((await call('/voice/analyze', { url: 'https://example.test/a.wav' })).status, 504)
  assert.equal(requests.length, 1)
  assert.equal((await call('/video/recording/stop', { device_no: 'AA:BB' })).status, 200)
  delay = 0; config.aiProxyTimeoutMs = 1000; responseStatus = 401
  assert.equal((await call('/voice/analyze', { url: 'https://example.test/a.wav' })).status, 502)
})

test('拒绝内网/非白名单素材 URL 以及超大请求，不触发上游', async () => {
  reset()
  for (const url of ['http://127.0.0.1/private', 'https://169.254.169.254/meta', 'https://example.test:8443/a', 'https://evil.test/a', 'https://example.test.evil.test/a']) {
    assert.equal((await call('/image/analyze', { url })).status, 400)
  }
  assert.equal((await call('/messages', { session_id: 'my-session', text: 'a'.repeat(128 * 1024) })).status, 413)
  assert.equal(requests.length, 0)
})

test('上游超大响应提前停止读取', async () => {
  reset(); responseText = JSON.stringify({ code: 0, info: 'a'.repeat(4 * 1024 * 1024) })
  assert.equal((await call('/health-data/overview', { pet_id: petId })).status, 502)
})

test('本地中转性能样本：4 并发、40 次健康查询，全部响应完整', async () => {
  reset()
  const latency = []
  const start = performance.now()
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let i = 0; i < 10; i++) {
      const before = performance.now()
      const result = await call('/health-data/overview', { pet_id: petId })
      assert.equal(result.status, 200)
      assert.equal((await result.json()).code, 0)
      latency.push(performance.now() - before)
    }
  }))
  latency.sort((a,b) => a-b)
  console.info(JSON.stringify({ sample: 'local_mock_40_requests_4_concurrency', totalMs: Math.round(performance.now()-start), p50Ms: Math.round(latency[19]), p95Ms: Math.round(latency[37]) }))
})


test('SSE 的 error 事件和缺失 done 不误记为成功，日志不含事件正文', async () => {
  for (const kind of ['error', 'incomplete']) {
    reset(); mode = kind
    const result = await call('/messages/stream', { session_id: 'my-session', text: 'hello' })
    const reader = result.body.getReader(); await reader.read(); releaseStream()
    while (!(await reader.read()).done) {}
    await wait(5)
    const ended = requestLogs.filter(r => r.event === 'request.end')
    assert.equal(ended.length, 1)
    assert.equal(ended[0].outcome, kind === 'error' ? 'upstream_event_error' : 'incomplete_stream')
    assert.doesNotMatch(JSON.stringify(requestLogs), /private text|partial/)
  }
})


test('AI 鉴权、重定向和异常响应日志保留实际上游状态与错误分类', async () => {
  for (const [status, body, code] of [
    [401, '{}', 'AI_UPSTREAM_AUTH_FAILED'],
    [403, '{}', 'AI_UPSTREAM_AUTH_FAILED'],
    [302, '{}', 'AI_UPSTREAM_REDIRECT'],
    [502, '<html>private error</html>', 'AI_INVALID_JSON'],
  ]) {
    reset(); responseStatus = status; responseText = body
    const response = await call('/session/new', { pet_id: petId })
    assert.equal(response.status, 502)
    await response.text()
    const ended = requestLogs.find(row => row.event === 'request.end')
    assert.equal(ended.upstreamStatus, status)
    assert.equal(ended.upstreamPath, '/session/new')
    assert.equal(ended.upstreamHost, new URL(config.aiServiceUrl).host)
    assert.equal(ended.errorCode, code)
    assert.ok(ended.upstreamHeaderMs >= 0)
    assert.ok(!JSON.stringify(requestLogs).includes('private error'))
    assert.ok(!JSON.stringify(requestLogs).includes(config.aiApiSecret))
  }
})

test('AI 连接被关闭时记录网络错误码与等待响应阶段', async () => {
  reset(); mode = 'disconnect'
  const response = await call('/session/by-pet', { pet_id: petId })
  assert.equal(response.status, 502)
  await response.text()
  const ended = requestLogs.find(row => row.event === 'request.end')
  assert.equal(ended.errorCode, 'UND_ERR_SOCKET')
  assert.equal(ended.upstreamPath, '/session/by-pet')
  assert.equal(ended.upstreamStage, 'waiting_headers')
  assert.equal(ended.upstreamStatus, undefined)
})
