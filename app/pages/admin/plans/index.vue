<template>
  <div class="space-y-5">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div><AdminPageTitle>购买计划</AdminPageTitle><p class="mt-1 text-sm text-stone-500">管理订阅价格与积分发放规则</p></div>
      <div class="flex items-center gap-2 flex-wrap">
        <UButton label="购买订单" color="neutral" variant="outline" icon="i-heroicons-receipt-percent" to="/admin/plans/orders" />
        <UButton label="新建计划" icon="i-heroicons-plus" :disabled="loading || loadError" @click="openNew" />
      </div>
    </header>
    <div v-if="loading" class="flex items-center justify-center gap-2 py-16 text-stone-500" role="status"><UIcon name="i-heroicons-arrow-path" class="size-5 animate-spin" />正在加载计划</div>
    <AdminEmptyState v-else-if="loadError" title="计划加载失败" description="请重试后再进行编辑" icon="i-heroicons-exclamation-circle"><UButton label="重新加载" color="neutral" variant="outline" @click="loadList" /></AdminEmptyState>
    <AdminEmptyState v-else-if="!list.length" title="暂无购买计划" description="点击右上角新建计划" />
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      <article v-for="plan in list" :key="plan.id" class="admin-panel flex flex-col" :aria-label="`${plan.name}计划`">
        <div class="p-5 pb-4 flex items-start justify-between gap-3">
          <div><h2 class="text-base font-semibold text-stone-900">{{ plan.name }}</h2><p class="mt-1 text-xs text-stone-500">计划编号 {{ plan.plan_type }}</p></div>
          <UBadge :label="Number(plan.status) === 1 ? '启用' : '停用'" :color="Number(plan.status) === 1 ? 'success' : 'neutral'" variant="soft" />
        </div>
        <div class="px-5 pb-5">
          <div v-if="Number(plan.plan_type) === 0" class="min-h-20"><p class="text-2xl font-semibold text-stone-900">免费</p><p class="mt-1 text-xs text-stone-500">无需订阅费用</p></div>
          <div v-else class="min-h-20">
            <p><span class="text-2xl font-semibold tabular-nums text-stone-900">¥{{ formatPrice(plan.price_monthly) }}</span><span class="ml-1 text-sm text-stone-500">/ 月</span></p>
            <p class="mt-1 text-sm text-stone-500">年费 ¥{{ formatPrice(plan.price_yearly) }}</p>
          </div>
          <dl class="space-y-3 border-t border-stone-100 pt-4 text-sm">
            <div class="flex justify-between gap-4"><dt class="text-stone-500">周期积分</dt><dd class="font-medium text-stone-800 text-right">每 {{ plan.grant_period_days }} 天 · {{ plan.period_grant_amount }} 分</dd></div>
            <div class="flex justify-between gap-4"><dt class="text-stone-500 shrink-0">积分类型</dt><dd class="text-stone-700 text-right break-words">{{ pointTypeLabel(plan.period_grant_type_code) }}</dd></div>
            <div class="flex justify-between gap-4"><dt class="text-stone-500">补签配额</dt><dd class="text-stone-700">每周 {{ plan.weekly_makeup_quota }} 次</dd></div>
            <div class="flex justify-between gap-4"><dt class="text-stone-500">订阅周期</dt><dd class="text-stone-700">{{ plan.duration_days == null ? '永久' : `${plan.duration_days} 天` }}</dd></div>
          </dl>
          <p v-if="plan.description" class="mt-4 text-xs text-stone-500 leading-relaxed break-words">{{ plan.description }}</p>
        </div>
        <footer class="mt-auto px-5 py-3 border-t border-stone-100 flex justify-end">
          <UButton :aria-label="`编辑${plan.name}计划`" label="编辑计划" color="neutral" variant="outline" icon="i-heroicons-pencil-square" @click="openEdit(plan)" />
        </footer>
      </article>
    </div>

    <USlideover v-model:open="showEditor" :title="editingId === null ? '新建计划' : '编辑计划'" :description="editingId === null ? '设置订阅价格与权益' : `正在编辑 ${editingName}`" :dismissible="!saving && !deleting" :close="{ disabled: saving || deleting }" :ui="{ content: 'max-w-lg', body: 'p-5 sm:p-6', footer: 'justify-end gap-2' }">
      <template #body>
        <form id="plan-editor" @submit.prevent="save">
          <fieldset :disabled="saving || deleting" class="min-w-0 space-y-5">
            <UFormField v-if="editingId === null" label="计划编号" help="使用未占用的整数编号" required><UInput v-model.number="draft.plan_type" type="number" :min="0" :step="1" required /></UFormField>
            <UFormField label="计划名称" required><UInput v-model="draft.name" placeholder="输入计划名称" required /></UFormField>
            <section class="space-y-3">
              <h3 class="text-sm font-semibold text-stone-800">订阅价格</h3>
              <p v-if="draft.plan_type === 0" class="rounded-lg bg-stone-50 p-3 text-sm text-stone-500">免费计划，无需配置价格</p>
              <div v-else class="grid grid-cols-2 gap-3">
                <UFormField label="月费（元）"><UInput v-model.number="draft.price_monthly" type="number" :min="0" :step="0.01" required /></UFormField>
                <UFormField label="年费（元）"><UInput v-model.number="draft.price_yearly" type="number" :min="0" :step="0.01" required /></UFormField>
              </div>
              <UFormField label="订阅周期（天）" help="留空表示永久"><UInput v-model.number="draft.duration_days" type="number" :min="1" :step="1" placeholder="永久" /></UFormField>
            </section>
            <section class="space-y-3 border-t border-stone-100 pt-5">
              <h3 class="text-sm font-semibold text-stone-800">积分与权益</h3>
              <UFormField label="积分类型" help="积分有效期由所选类型决定">
                <select v-model="draft.period_grant_type_code" class="admin-select w-full rounded-lg px-3 py-2 text-sm" aria-label="积分类型">
                  <option :value="null">跟随默认</option><option v-for="item in pointTypes" :key="item.type_code" :value="item.type_code">{{ item.name }}（{{ Number(item.expire_days) === 0 ? '永久' : `${item.expire_days}天` }}）</option>
                </select>
              </UFormField>
              <div class="grid grid-cols-2 gap-3">
                <UFormField label="发放周期（天）"><UInput v-model.number="draft.grant_period_days" type="number" :min="1" :step="1" required /></UFormField>
                <UFormField label="每次发放积分"><UInput v-model.number="draft.period_grant_amount" type="number" :min="0" :step="1" required /></UFormField>
              </div>
              <UFormField label="每周补签配额（次）"><UInput v-model.number="draft.weekly_makeup_quota" type="number" :min="0" :step="1" required /></UFormField>
            </section>
            <UFormField label="说明"><UTextarea v-model="draft.description" :rows="3" placeholder="补充计划说明" /></UFormField>
            <div v-if="editingId !== null" class="flex justify-between items-center border-t border-stone-100 pt-4"><span class="text-sm text-stone-700">启用计划</span><USwitch :model-value="draft.status === 1" aria-label="启用计划" @update:model-value="draft.status = $event ? 1 : 0" /></div>
          </fieldset>
        </form>
      </template>
      <template #footer>
        <div class="w-full space-y-3">
          <p v-if="saveError" role="alert" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ saveError }}</p>
          <div class="flex items-center justify-end gap-2">
        <UButton v-if="editingId !== null && draft.plan_type !== 0" label="删除计划" color="error" variant="ghost" class="mr-auto" :loading="deleting" :disabled="saving" @click="deletePlan" />
        <UButton label="取消" color="neutral" variant="ghost" :disabled="saving || deleting" @click="showEditor = false" />
        <UButton :label="editingId === null ? '创建计划' : '保存修改'" type="submit" form="plan-editor" :loading="saving" :disabled="deleting" />
          </div>
        </div>
      </template>
    </USlideover>
  </div>
</template>

<script setup lang="ts">
import { makePlanDraft, planPayload } from '~/utils/planEditor'
defineOptions({ name: 'AdminPlansList' })
definePageMeta({ layout: 'admin' })
const toast = useToast()
const loading = ref(true)
const loadError = ref(false)
const list = ref<any[]>([])
const pointTypes = ref<any[]>([])
const showEditor = ref(false)
const editingId = ref<string | number | null>(null)
const editingName = ref('')
const saveError = ref('')
const saving = ref(false)
const deleting = ref(false)
const draft = reactive(makePlanDraft())

function openNew() { saveError.value = ''; editingId.value = null; editingName.value = ''; Object.assign(draft, makePlanDraft()); showEditor.value = true }
function openEdit(plan: any) { saveError.value = ''; editingId.value = plan.id; editingName.value = plan.name; Object.assign(draft, makePlanDraft(plan)); showEditor.value = true }
function formatPrice(value: number | string) { return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 }) }
function pointTypeLabel(code: string | null) { return code ? pointTypes.value.find(item => item.type_code === code)?.name || code : '跟随默认' }

async function loadList() {
  loading.value = true; loadError.value = false
  try {
    const [plans, types] = await Promise.all([$fetch<any>('/api/admin/plans'), $fetch<any>('/api/admin/points/config')])
    list.value = plans.list; pointTypes.value = types.list
  } catch { loadError.value = true } finally { loading.value = false }
}

async function save() {
  if (saving.value || deleting.value) return
  if (!draft.name.trim()) return void (saveError.value = '请填写计划名称')
  if (editingId.value === null && (draft.plan_type === null || !Number.isInteger(draft.plan_type) || draft.plan_type < 0)) return void (saveError.value = '请填写有效的计划编号')
  saveError.value = ''
  saving.value = true
  try {
    const body = planPayload(draft)
    if (editingId.value === null) {
      const { status, ...fields } = body
      await $fetch('/api/admin/plans', { method: 'POST', body: { ...fields, plan_type: draft.plan_type } })
      await loadList()
    } else {
      await $fetch(`/api/admin/plans/${editingId.value}`, { method: 'PUT', body })
      list.value = list.value.map(plan => plan.id === editingId.value ? { ...plan, ...body } : plan)
    }
    showEditor.value = false
    toast.add({ title: '计划已保存', color: 'success' })
  } catch (e: any) { saveError.value = e?.data?.message || '保存失败，请重试' }
  finally { saving.value = false }
}

async function deletePlan() {
  if (saving.value || deleting.value || editingId.value === null) return
  if (!confirm(`确认删除「${editingName.value}」计划？此操作不可恢复。`)) return
  saveError.value = ''
  deleting.value = true
  try {
    await $fetch(`/api/admin/plans/${editingId.value}`, { method: 'DELETE' })
    list.value = list.value.filter(plan => plan.id !== editingId.value)
    showEditor.value = false
    toast.add({ title: '计划已删除', color: 'success' })
  } catch (e: any) { saveError.value = e?.data?.message || '删除失败，请重试' }
  finally { deleting.value = false }
}
onMounted(loadList)
</script>
