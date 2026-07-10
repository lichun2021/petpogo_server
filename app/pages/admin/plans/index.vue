<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-base font-semibold text-stone-800">购买计划</h2>
        <p class="text-xs text-stone-400 mt-0.5">配置 Free / Pro / ProMax 三档计划的价格与积分额度</p>
      </div>
      <UButton label="购买订单" color="gray" variant="outline" icon="i-heroicons-receipt-percent" to="/admin/plans/orders" />
    </div>

    <div v-if="loading" class="flex justify-center py-16">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-stone-400 animate-spin" />
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div
        v-for="plan in list" :key="plan.id"
        class="bg-white rounded-2xl border overflow-hidden"
        style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)"
      >
        <div class="flex items-center gap-2.5 px-5 py-3.5 border-b" style="border-color: #f0e6d8; background: #fffbf5">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background: #fef3c7">
            <UIcon name="i-heroicons-sparkles" class="w-4 h-4 text-amber-600" />
          </div>
          <div class="flex-1">
            <p class="text-sm font-semibold text-stone-800">{{ planLabel(plan.plan_type) }}</p>
            <p class="text-[11px] text-stone-400">plan_type = {{ plan.plan_type }}</p>
          </div>
          <UBadge :label="plan.status === 1 ? '启用' : '停用'" :color="plan.status === 1 ? 'green' : 'red'" variant="subtle" size="xs" />
        </div>

        <div class="p-5 space-y-3">
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">名称</label>
            <UInput v-model="plan.name" size="sm" />
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">价格（元）</label>
            <UInput v-model.number="plan.price" type="number" size="sm" />
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">订阅周期（天，留空=永久）</label>
            <UInput v-model.number="plan.duration_days" type="number" size="sm" placeholder="永久" />
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">周积分额度（到期积分，每周一重置）</label>
            <UInput v-model.number="plan.weekly_points_grant" type="number" size="sm" />
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">永久积分赠送（购买时一次性发放）</label>
            <UInput v-model.number="plan.permanent_points_grant" type="number" size="sm" />
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">每周补签配额（次/周，周一重置）</label>
            <UInput v-model.number="plan.weekly_makeup_quota" type="number" size="sm" :min="0" />
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">说明</label>
            <UTextarea v-model="plan.description" size="sm" :rows="2" />
          </div>

          <div class="flex items-center justify-between pt-2">
            <button
              :class="[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none',
                plan.status === 1 ? 'bg-amber-500' : 'bg-stone-300'
              ]"
              @click="plan.status = plan.status === 1 ? 0 : 1"
            >
              <span
                :class="[
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
                  plan.status === 1 ? 'translate-x-6' : 'translate-x-1'
                ]"
              />
            </button>
            <UButton label="保存" color="amber" size="sm" :loading="plan._saving" @click="savePlan(plan)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminPlansList' })
definePageMeta({ layout: 'admin' })

const toast   = useToast()
const loading = ref(true)
const list    = ref<any[]>([])

function planLabel(t: number) {
  return { 0: 'Free', 1: 'Pro', 2: 'ProMax' }[t] ?? `计划${t}`
}

async function loadList() {
  loading.value = true
  try {
    const d = await $fetch<any>('/api/admin/plans')
    list.value = d.list
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
        price: plan.price,
        duration_days: plan.duration_days || null,
        weekly_points_grant: plan.weekly_points_grant,
        permanent_points_grant: plan.permanent_points_grant,
        weekly_makeup_quota: plan.weekly_makeup_quota ?? 1,
        description: plan.description,
        status: plan.status,
      },
    })
    toast.add({ title: '保存成功', color: 'green' })
  } catch {
    toast.add({ title: '保存失败', color: 'red' })
  } finally {
    plan._saving = false
  }
}

onMounted(loadList)
</script>
