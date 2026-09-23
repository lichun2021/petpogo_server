<template>
  <div class="space-y-5">
    <!-- 顶部 -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold text-stone-800">购买计划</h2>
        <p class="text-xs text-stone-500 mt-0.5">管理订阅价格与积分发放规则</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton label="购买订单" color="neutral" variant="outline" icon="i-heroicons-receipt-percent" to="/admin/plans/orders" />
        <UButton label="新建计划" color="primary" icon="i-heroicons-plus" @click="openNew" />
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-16">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-stone-500 animate-spin" />
    </div>

    <AdminEmptyState v-else-if="loadError" title="计划加载失败" description="请重试后再进行编辑" icon="i-heroicons-exclamation-circle"><UButton label="重新加载" color="neutral" variant="outline" @click="loadList" /></AdminEmptyState>
    <AdminEmptyState v-else-if="!list.length" title="暂无购买计划" description="点击右上角新建计划" />
    <div v-else class="grid grid-cols-1 xl:grid-cols-3 md:grid-cols-2 gap-4">
      <div
        v-for="plan in list" :key="plan.id"
        class="bg-white rounded-xl border overflow-hidden relative flex flex-col"
        style="border-color: #e7e5e4; box-shadow: 0 1px 4px rgba(0,0,0,0.04)"
      >
        <!-- 卡片头 -->
        <div class="flex items-center gap-2.5 px-5 py-3.5 border-b" style="border-color: #e7e5e4; background: #fffbf5">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background: #fef3c7">
            <UIcon name="i-heroicons-sparkles" class="w-4 h-4 text-amber-600" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-stone-800">{{ plan.name }}</p>
            <p class="text-xs text-stone-500">计划编号 {{ plan.plan_type }}</p>
          </div>
          <UBadge :label="plan.status === 1 ? '启用' : '停用'" :color="plan.status === 1 ? 'success' : 'error'" variant="subtle" size="xs" />
        </div>

        <div class="p-5 gap-4 flex-1 flex flex-col">
          <!-- 基础 -->
          <div class="space-y-3">
            <div>
              <label class="text-xs text-stone-500 font-medium block mb-1">名称</label>
              <UInput v-model="plan.name" class="w-full" size="sm" />
            </div>
          </div>

          <!-- 价格（付费计划才显示月/年费；Free 显示免费） -->
          <div>
            <div class="flex items-center gap-2 mb-2">
              <div class="flex-1 h-px bg-stone-100" />
              <span class="text-xs text-stone-500 font-medium whitespace-nowrap">价格</span>
              <div class="flex-1 h-px bg-stone-100" />
            </div>
            <div v-if="plan.plan_type === 0" class="text-sm text-stone-500 min-h-[58px] flex items-center">免费计划，无需配置价格</div>
            <div v-else class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-xs text-stone-500 block mb-0.5">月费（元）</label>
                <UInput v-model.number="plan.price_monthly" type="number" class="w-full" size="sm" :min="0" />
              </div>
              <div>
                <label class="text-xs text-stone-500 block mb-0.5">年费（元）</label>
                <UInput v-model.number="plan.price_yearly" type="number" class="w-full" size="sm" :min="0" />
              </div>
            </div>
          </div>

          <!-- 周期赠送积分 -->
          <div>
            <div class="flex items-center gap-2 mb-2">
              <div class="flex-1 h-px bg-stone-100" />
              <span class="text-xs text-stone-500 font-medium whitespace-nowrap">周期赠送积分</span>
              <div class="flex-1 h-px bg-stone-100" />
            </div>
            <div class="space-y-2">
              <div>
                <label class="text-xs text-stone-500 block mb-0.5">积分类型</label>
                <select
                  v-model="plan.period_grant_type_code"
                  class="admin-select w-full rounded-lg text-sm py-1.5 px-2 focus:border-amber-400 focus:ring-amber-400"
                  style="border-color: #e7e5e4"
                >
                  <option :value="null">跟随默认</option>
                  <option v-for="t in pointTypes" :key="t.type_code" :value="t.type_code">
                    {{ t.name }}（{{ t.expire_days === 0 ? '永久' : `${t.expire_days}天` }}）
                  </option>
                </select>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-xs text-stone-500 block mb-0.5">发放周期（天）</label>
                  <UInput v-model.number="plan.grant_period_days" type="number" class="w-full" size="sm" :min="1" placeholder="7" />
                </div>
                <div>
                  <label class="text-xs text-stone-500 block mb-0.5">每次数量</label>
                  <UInput v-model.number="plan.period_grant_amount" type="number" class="w-full" size="sm" :min="0" />
                </div>
              </div>
              <p class="text-xs text-stone-500">按周期自动发放，积分有效期由所选类型决定</p>
            </div>
          </div>

          <!-- 其他 -->
          <div>
            <div class="flex items-center gap-2 mb-2">
              <div class="flex-1 h-px bg-stone-100" />
              <span class="text-xs text-stone-500 font-medium whitespace-nowrap">其他</span>
              <div class="flex-1 h-px bg-stone-100" />
            </div>
            <div class="space-y-3">
              <div>
                <label class="text-xs text-stone-500 font-medium block mb-1">每周补签配额（次）</label>
                <UInput v-model.number="plan.weekly_makeup_quota" type="number" class="w-full" size="sm" :min="0" />
              </div>
              <div>
                <label class="text-xs text-stone-500 font-medium block mb-1">说明</label>
                <UTextarea v-model="plan.description" class="w-full" size="sm" :rows="2" />
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between pt-4 border-t mt-auto" style="border-color: #f5f0e8">
            <!-- 启用/停用开关 -->
            <button
              :class="['relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200',
                plan.status === 1 ? 'bg-amber-500' : 'bg-stone-300']"
              role="switch" :aria-checked="plan.status === 1" :aria-label="`启用${plan.name}计划`"
              @click="plan.status = plan.status === 1 ? 0 : 1"
            >
              <span :class="['inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
                plan.status === 1 ? 'translate-x-6' : 'translate-x-1']" />
            </button>
            <div class="flex gap-2">
              <UButton
                v-if="plan.plan_type !== 0"
                icon="i-heroicons-trash"
                color="error" variant="ghost" size="sm"
                :loading="plan._deleting" aria-label="删除计划"
                @click="deletePlan(plan)"
              />
              <UButton label="保存" color="primary" size="sm" :loading="plan._saving" @click="savePlan(plan)" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建计划 Slideover -->
    <USlideover v-model:open="showNew" title="新建计划" description="配置订阅价格与积分发放规则" side="right" :ui="{ content: 'max-w-md' }">
      <template #content>
      <div class="flex flex-col h-full min-h-0">
        <div class="flex shrink-0 items-center justify-between px-5 py-4 border-b border-stone-100">
          <p class="font-semibold text-stone-800 text-sm">新建计划</p>
          <UButton icon="i-heroicons-x-mark" aria-label="关闭" color="neutral" variant="ghost" size="sm" @click="showNew = false" />
        </div>
        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">计划编号（整数，不可重复）</label>
            <UInput v-model.number="newPlan.plan_type" type="number" class="w-full" size="sm" placeholder="如 3" />
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">名称</label>
            <UInput v-model="newPlan.name" class="w-full" size="sm" placeholder="如 Elite" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-xs text-stone-500 font-medium block mb-1">月费（元）</label>
              <UInput v-model.number="newPlan.price_monthly" type="number" class="w-full" size="sm" :min="0" />
            </div>
            <div>
              <label class="text-xs text-stone-500 font-medium block mb-1">年费（元）</label>
              <UInput v-model.number="newPlan.price_yearly" type="number" class="w-full" size="sm" :min="0" />
            </div>
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">积分类型（决定有效期）</label>
            <select
              v-model="newPlan.period_grant_type_code"
              class="admin-select w-full rounded-lg text-sm py-1.5 px-2 focus:border-amber-400 focus:ring-amber-400"
              style="border-color: #e7e5e4"
            >
              <option :value="null">跟随默认</option>
              <option v-for="t in pointTypes" :key="t.type_code" :value="t.type_code">
                {{ t.name }}（{{ t.expire_days === 0 ? '永久' : `${t.expire_days}天` }}）
              </option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-xs text-stone-500 font-medium block mb-1">发放周期（天）</label>
              <UInput v-model.number="newPlan.grant_period_days" type="number" class="w-full" size="sm" :min="1" placeholder="7" />
            </div>
            <div>
              <label class="text-xs text-stone-500 font-medium block mb-1">每次数量</label>
              <UInput v-model.number="newPlan.period_grant_amount" type="number" class="w-full" size="sm" :min="0" />
            </div>
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">订阅周期（天，留空=永久）</label>
            <UInput v-model.number="newPlan.duration_days" type="number" class="w-full" size="sm" placeholder="永久" />
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">每周补签配额（次）</label>
            <UInput v-model.number="newPlan.weekly_makeup_quota" type="number" class="w-full" size="sm" :min="0" />
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">说明</label>
            <UTextarea v-model="newPlan.description" class="w-full" size="sm" :rows="3" />
          </div>
        </div>
        <div class="shrink-0 px-5 py-4 border-t border-stone-100">
          <UButton label="创建计划" color="primary" block :loading="creating" @click="createPlan" />
        </div>
      </div>
          </template>
    </USlideover>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminPlansList' })
definePageMeta({ layout: 'admin' })

const toast       = useToast()
const loading     = ref(true)
const loadError = ref(false)
const list        = ref<any[]>([])
const pointTypes  = ref<any[]>([])

const showNew  = ref(false)
const creating = ref(false)

const newPlan = reactive({
  plan_type: null as number | null,
  name: '',
  price_monthly: 0,
  price_yearly: 0,
  duration_days: null as number | null,
  grant_period_days: 7,
  period_grant_amount: 0,
  period_grant_type_code: null as string | null,
  weekly_makeup_quota: 1,
  description: '',
})

function openNew() {
  Object.assign(newPlan, {
    plan_type: null, name: '', price_monthly: 0, price_yearly: 0, duration_days: null,
    grant_period_days: 7, period_grant_amount: 0, period_grant_type_code: null,
    weekly_makeup_quota: 1, description: '',
  })
  showNew.value = true
}

async function loadList() {
  loading.value = true
  loadError.value = false
  try {
    const [d, pt] = await Promise.all([
      $fetch<any>('/api/admin/plans'),
      $fetch<any>('/api/admin/points/config'),
    ])
    list.value       = d.list
    pointTypes.value = pt.list
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

async function savePlan(plan: any) {
  plan._saving = true
  try {
    await $fetch(`/api/admin/plans/${plan.id}`, {
      method: 'PUT',
      body: {
        name: plan.name,
        price_monthly: plan.price_monthly,
        price_yearly: plan.price_yearly,
        duration_days: plan.duration_days || null,
        grant_period_days: plan.grant_period_days,
        period_grant_amount: plan.period_grant_amount,
        period_grant_type_code: plan.period_grant_type_code || null,
        weekly_makeup_quota: plan.weekly_makeup_quota ?? 1,
        description: plan.description,
        status: plan.status,
      },
    })
    toast.add({ title: '保存成功', color: 'success' })
  } catch (e: any) {
    toast.add({ title: '保存失败', description: e?.data?.message, color: 'error' })
  } finally {
    plan._saving = false
  }
}

async function deletePlan(plan: any) {
  if (!confirm(`确认删除「${plan.name}」计划？此操作不可恢复。`)) return
  plan._deleting = true
  try {
    await $fetch(`/api/admin/plans/${plan.id}`, { method: 'DELETE' })
    toast.add({ title: '删除成功', color: 'success' })
    list.value = list.value.filter(p => p.id !== plan.id)
  } catch (e: any) {
    toast.add({ title: e?.data?.message || '删除失败', color: 'error' })
  } finally {
    plan._deleting = false
  }
}

async function createPlan() {
  if (newPlan.plan_type === null) return toast.add({ title: '请填写计划编号', color: 'error' })
  if (!newPlan.name.trim()) return toast.add({ title: '名称不能为空', color: 'error' })
  creating.value = true
  try {
    await $fetch('/api/admin/plans', {
      method: 'POST',
      body: {
        plan_type: newPlan.plan_type,
        name: newPlan.name.trim(),
        price_monthly: newPlan.price_monthly,
        price_yearly: newPlan.price_yearly,
        duration_days: newPlan.duration_days || null,
        grant_period_days: newPlan.grant_period_days,
        period_grant_amount: newPlan.period_grant_amount,
        period_grant_type_code: newPlan.period_grant_type_code || null,
        weekly_makeup_quota: newPlan.weekly_makeup_quota,
        description: newPlan.description,
      },
    })
    toast.add({ title: '创建成功', color: 'success' })
    showNew.value = false
    await loadList()
  } catch (e: any) {
    toast.add({ title: e?.data?.message || '创建失败', color: 'error' })
  } finally {
    creating.value = false
  }
}

onMounted(loadList)
</script>
