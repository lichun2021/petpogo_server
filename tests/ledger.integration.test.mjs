// 必须显式提供隔离 MySQL socket；不读取 .env，不访问生产网络。
import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import mysql from 'mysql2/promise'
import {build} from 'esbuild'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createError} from 'h3'
import {up} from '../migrations/001-security-ledger.mjs'
const enabled=Boolean(process.env.TEST_MYSQL_SOCKET)
let admin,pool,modules,temp,body={ruleId:'1'},routeId='1'
const database=`petpogo_ledger_test_${process.pid}`
before(async()=>{
 if(!enabled)return
 admin=await mysql.createConnection({socketPath:process.env.TEST_MYSQL_SOCKET,user:'root',multipleStatements:true})
 let sql=await readFile('sql/init.sql','utf8')
 sql=sql.replace(/CREATE DATABASE IF NOT EXISTS petpogo/g,`CREATE DATABASE IF NOT EXISTS ${database}`).replace(/USE petpogo;/g,`USE ${database};`)
 await admin.query(sql)
 await up(admin);await up(admin)
 pool=mysql.createPool({socketPath:process.env.TEST_MYSQL_SOCKET,user:'root',database,connectionLimit:25,supportBigNumbers:true,bigNumberStrings:true,dateStrings:true,timezone:'+08:00'})
 temp=await mkdtemp(join(tmpdir(),'ledger-test-'))
 await build({stdin:{contents:`export * from './server/utils/transaction.ts'; export * from './server/utils/businessDate.ts'; export * from './server/utils/points.ts'; export * from './server/utils/consumption.ts'; export * from './server/utils/plan.ts'; export {default as claim} from './server/routes/sdkapi/checkin/claim.post.ts'; export {default as confirm} from './server/routes/api/admin/plans/orders/[id]/confirm.put.ts';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'cjs',outfile:join(temp,'ledger.cjs'),logLevel:'silent'})
 Object.assign(globalThis,{useDb:()=>pool,createError,defineEventHandler:f=>f,requireAuth:async()=>({userId:'1'}),requireSuperAdmin:()=>({}),readBody:async()=>body,getRouterParam:()=>routeId})
 modules=(await import(join(temp,'ledger.cjs'))).default
 Object.assign(globalThis,modules)
})
after(async()=>{if(pool)await pool.end();if(admin){await admin.query(`DROP DATABASE IF EXISTS ${database}`);await admin.end()}if(temp)await rm(temp,{recursive:true,force:true})})
async function reset(){
 for(const table of ['t_points_operation','t_points_log','t_user_points_batch','t_checkin_claim_log','t_checkin_log','t_plan_order','t_user'])await pool.query(`DELETE FROM ${table}`)
 await pool.query("INSERT INTO t_user(id,phone,last_grant_at) VALUES(1,'test-user',NOW())")
 await pool.query("UPDATE t_plan SET period_grant_amount=100,period_grant_type_code='plan_free',grant_period_days=7 WHERE plan_type=0")
}
test('真实 MySQL：初始化及重复升级保留个人密码和配置',{skip:!enabled},async()=>{
 await reset();await pool.query("UPDATE t_user SET password='personal-hash' WHERE id=1")
 await up(admin)
 const [[u]]=await pool.query('SELECT password FROM t_user WHERE id=1');assert.equal(u.password,'personal-hash')
})
test('真实 MySQL：100积分并发扣80仅一次成功，流水与余额一致',{skip:!enabled},async()=>{
 await reset();await modules.grantPointsBatch('1',100,'permanent','test')
 const result=await Promise.allSettled([modules.spendPoints('1',80,'test'),modules.spendPoints('1',80,'test')])
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1)
 assert.equal(result.find(r=>r.status==='rejected').reason.statusCode,402)
 assert.equal((await modules.getPointsBalance('1')).total,20)
 const [[row]]=await pool.query('SELECT SUM(amount) AS spent FROM t_points_log WHERE direction=2');assert.equal(Number(row.spent),80)
})
test('真实 MySQL：20次同事件只扣一次，同ID换内容冲突',{skip:!enabled},async()=>{
 await reset();await modules.grantPointsBatch('1',100,'permanent','test')
 const replies=await Promise.all(Array.from({length:20},()=>modules.consumePointsEvent('1','test','event-1','image_analyze',1)))
 assert.ok(replies.every(r=>r.success&&r.deducted===5));assert.equal((await modules.getPointsBalance('1')).total,95)
 await assert.rejects(modules.consumePointsEvent('1','test','event-1','image_analyze',2),e=>e.statusCode===409)
 const [[row]]=await pool.query('SELECT COUNT(*) AS n FROM t_points_operation');assert.equal(Number(row.n),1)
})
test('真实 MySQL：流水写失败回滚全部扣款，领奖失败不占领取记录',{skip:!enabled},async()=>{
 await reset();await modules.grantPointsBatch('1',100,'permanent','test')
 await pool.query("INSERT INTO t_checkin_log(user_id,checkin_date,streak_count) VALUES(1,?,1)",[modules.businessDate()])
 await pool.query("CREATE TRIGGER ledger_failure BEFORE INSERT ON t_points_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected failure'")
 try{
  await assert.rejects(modules.spendPoints('1',80,'test'))
  await assert.rejects(modules.claim({}))
  const [[claims]]=await pool.query('SELECT COUNT(*) AS n FROM t_checkin_claim_log');assert.equal(Number(claims.n),0)
  assert.equal((await modules.getPointsBalance('1')).total,100)
 }finally{await pool.query('DROP TRIGGER ledger_failure')}
})
test('真实 MySQL：cron和余额并发只发一个周期，订单并发只发一次权益',{skip:!enabled},async()=>{
 await reset();await pool.query('UPDATE t_user SET last_grant_at=NULL WHERE id=1')
 await Promise.all([modules.grantScheduledPoints(),modules.getPointsBalance('1'),modules.ensurePeriodGrant('1')])
 const [[r]]=await pool.query("SELECT COUNT(*) AS n FROM t_user_points_batch WHERE ref_type='plan_period'");assert.equal(Number(r.n),1)
 await pool.query("INSERT INTO t_plan_order(id,user_id,plan_id,period,amount,status) VALUES(1,1,1,'monthly',0,0)")
 const results=await Promise.all([modules.confirm({}),modules.confirm({})]);assert.ok(results.every(r=>r.success))
 const [[orders]]=await pool.query("SELECT COUNT(*) AS n FROM t_user_points_batch WHERE ref_type='plan_order'");assert.equal(Number(orders.n),1)
})
