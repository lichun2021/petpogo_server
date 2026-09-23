import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

let folder, makePlanDraft, planPayload
before(async () => {
  folder = await mkdtemp(join(tmpdir(), 'admin-plan-editor-'))
  const outfile = join(folder, 'editor.mjs')
  await build({ entryPoints: ['app/utils/planEditor.ts'], outfile, format: 'esm', platform: 'node', bundle: true })
  ;({ makePlanDraft, planPayload } = await import(pathToFileURL(outfile)))
})
after(async () => { await rm(folder, { recursive: true, force: true }) })

test('修改草稿不污染卡片，取消后重新打开恢复已保存值', () => {
  const saved = Object.freeze({ id: '42', plan_type: 1, name: 'Pro', price_monthly: '29.00', status: 1, description: '原说明' })
  const draft = makePlanDraft(saved)
  draft.name = '未保存'; draft.price_monthly = 99; draft.status = 0; draft.description = ''
  assert.equal(saved.name, 'Pro')
  assert.equal(saved.price_monthly, '29.00')
  const reopened = makePlanDraft(saved)
  assert.equal(reopened.name, 'Pro')
  assert.equal(reopened.price_monthly, 29)
  assert.equal(reopened.status, 1)
  assert.equal(reopened.description, '原说明')
})

test('数据库字符串转成可编辑数字，零额度和停用状态原样保存', () => {
  const draft = makePlanDraft({ id: '42', plan_type: '2', name: '  Pro Max  ', price_monthly: '58.50', price_yearly: '598.00', duration_days: '365', grant_period_days: '14', period_grant_amount: '0', period_grant_type_code: 'vip', weekly_makeup_quota: '0', description: '说明', status: '0', sort_order: 8 })
  assert.equal(draft.plan_type, 2)
  assert.deepEqual(planPayload(draft), { name: 'Pro Max', price_monthly: 58.5, price_yearly: 598, duration_days: 365, grant_period_days: 14, period_grant_amount: 0, period_grant_type_code: 'vip', weekly_makeup_quota: 0, description: '说明', status: 0 })
})

test('清空订阅周期及积分类型发送 null，新建草稿不继承上个计划', () => {
  const draft = makePlanDraft({ duration_days: 30, period_grant_type_code: 'vip', weekly_makeup_quota: 0 })
  draft.duration_days = ''; draft.period_grant_type_code = ''
  const body = planPayload(draft)
  assert.equal(body.duration_days, null)
  assert.equal(body.period_grant_type_code, null)
  assert.equal(body.weekly_makeup_quota, 0)
  const fresh = makePlanDraft()
  assert.equal(fresh.plan_type, null)
  assert.equal(fresh.name, '')
  assert.equal(fresh.duration_days, null)
  assert.equal(fresh.status, 1)
})
