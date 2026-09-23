import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import {build} from 'esbuild'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {EventEmitter} from 'node:events'
import * as h3 from 'h3'
let m,temp
before(async()=>{
 temp=await mkdtemp(join(tmpdir(),'remediation-'))
 await build({stdin:{contents:`export * from './server/utils/userPassword.ts';export * from './server/utils/businessDate.ts';export * from './server/utils/requestSignature.ts';export * from './server/utils/consumption.ts';export * from './server/utils/resourceAccess.ts';export {readProxyBody} from './server/integrations/shared/bounds.ts';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'cjs',outfile:join(temp,'suite.cjs'),logLevel:'silent'})
 m=(await import(join(temp,'suite.cjs'))).default
})
after(async()=>rm(temp,{recursive:true,force:true}))
test('历史默认MD5不可验证，个人MD5可升级，scrypt带盐且支持长密码',async()=>{
 const defaultHash=crypto.createHash('md5').update('123456').digest('hex')
 for(const value of [null,'',defaultHash])assert.equal(await m.verifyUserPassword('123456',value),false)
 const personal='Individual!2026',legacy=crypto.createHash('md5').update(personal).digest('hex')
 assert.equal(await m.verifyUserPassword(personal,legacy),true)
 const a=await m.hashUserPassword(personal),b=await m.hashUserPassword(personal)
 assert.notEqual(a,b);assert.ok(a.length<=255);assert.equal(await m.verifyUserPassword(personal,a),true);assert.equal(await m.verifyUserPassword('wrong',a),false)
})
test('新账号初始密码123456以独立盐存储，可登录并可用旧密码校验改密',async()=>{
 const a=await m.hashUserPassword('123456'),b=await m.hashUserPassword('123456')
 assert.notEqual(a,b)
 assert.equal(m.needsPasswordSetup(a),false)
 assert.equal(await m.verifyUserPassword('123456',a),true)
 assert.equal(await m.verifyUserPassword('wrong',a),false)
})
test('北京时间独立进程时区，非法日期拒绝',()=>{
 const before=process.env.TZ
 try {for(const tz of ['UTC','Asia/Shanghai','America/New_York']){process.env.TZ=tz;assert.equal(m.businessDate(new Date('2026-09-22T16:00:00Z')),'2026-09-23');assert.equal(m.addBusinessDays('2024-02-28',1),'2024-02-29');assert.equal(m.businessMonday('2026-09-23'),'2026-09-21')}}finally{if(before===undefined)delete process.env.TZ;else process.env.TZ=before}
 assert.throws(()=>m.parseBusinessDate('2026-02-30'));assert.throws(()=>m.parseBusinessDate('2026-9-1'))
})
test('计费精确转换，拒绝隐式小数积分及非法数量',()=>{
 assert.equal(m.consumptionCost(5,'0.2'),1)
 for(const value of ['NaN','Infinity','-1','0','0.01'])assert.throws(()=>m.consumptionCost(5,value))
})
function event(path,headers,body){const req=new EventEmitter();req.url=path;req.method='POST';req.headers=headers;req.rawBody=body;const res=new EventEmitter();res.setHeader=()=>{};return h3.createEvent(req,res)}
test('v2覆盖路径正文nonce；重复nonce拒绝；正文缓存可供代理复用',async()=>{
 const seen=new Set(),secret='test-only-signature-secret'
 Object.assign(globalThis,{RedisKey:{signatureNonce:(s,k,n)=>`${s}:${k}:${n}`},useRedis:()=>({set:async key=>{if(seen.has(key))return null;seen.add(key);return 'OK'}})})
 const timestamp=String(Date.now()),nonce='test_nonce_unique_123',body=Buffer.from('{"text":"测试"}'),path='/sdkapi/test?b=2&a=1'
 const signature=crypto.createHmac('sha256',secret).update(m.signatureMessage('POST',path,timestamp,nonce,'primary',body)).digest('hex')
 const headers={'x-signature-version':'2','x-key-id':'primary','x-timestamp':timestamp,'x-nonce':nonce,'x-signature':signature}
 const first=event(path,headers,body)
 assert.equal(await m.verifyRequestSignatureV2(first,'sdkapi',secret),true)
 assert.equal((await m.readProxyBody(first)).toString(),body.toString())
 for(const e of [event(path,headers,body),event('/sdkapi/other',headers,body),event(path,{...headers,'x-nonce':'another_nonce_1234'},body),event(path,headers,Buffer.from('{}'))])await assert.rejects(m.verifyRequestSignatureV2(e,'sdkapi',secret),e=>e.statusCode===403)
})

test('设备权限区分所有者和共享，数字ID/MAC不匹配拒绝',async()=>{
 const original=globalThis.fetch
 let devices=[{deviceId:'1234567890123456789',mac:'AA',uType:1}]
 Object.assign(globalThis,{useRuntimeConfig:()=>({peerBackendUrl:'https://peer.example.test',peerBackendTimeoutMs:1000}),useDb:()=>({query:async()=>[[{mac:'AA'}]]})})
 globalThis.fetch=async()=>new Response(JSON.stringify({code:0,info:devices}),{status:200})
 try{
  const e=event('/sdkapi/pet/1',{'authorization':'Bearer test-token'},Buffer.alloc(0))
  await m.assertDeviceAccess(e,'1234567890123456789',true)
  devices[0].uType=2
  await m.assertDeviceAccess(e,'1234567890123456789')
  await assert.rejects(m.assertDeviceAccess(e,'1234567890123456789',true),e=>e.statusCode===403)
  devices[0].mac='OTHER'
  await assert.rejects(m.assertDeviceAccess(e,'1234567890123456789'),e=>e.statusCode===403)
  devices=[]
  await assert.rejects(m.assertDeviceAccess(e,'1234567890123456789'),e=>e.statusCode===403)
 }finally{globalThis.fetch=original}
})
