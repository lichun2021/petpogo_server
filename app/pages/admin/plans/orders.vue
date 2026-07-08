<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-base font-semibold text-stone-800">计划购买订单</h2>
        <p class="text-xs text-stone-400 mt-0.5">人工确认订单支付状态后自动开通对应计划</p>
      </div>
      <UButton label="返回计划配置" color="gray" variant="outline" icon="i-heroicons-arrow-left" to="/admin/plans" />
    </div>

    <div class="flex gap-2">
      <button
        v-for="(tab, i) in tabs" :key="tab.key"
        :class="[
          'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
          activeTab === i
            ? 'bg-amber-500 text-white shadow-sm'
            : 'bg-white border text-stone-500 hover:text-stone-700 hover:border-amber-300'
        ]"
        style="border-color: #f0e6d8"
        @click="activeTab = i; loadList()"
      >{{ tab.label }}</button>
    </div>

    <div class="bg-white rounded-2xl border overflow-hidden" style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
      <div v-if="loading" class="flex justify-center py-10">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-stone-400 animate-spin" />
      </div>
      <div v-else-if="!list.length" class="py-10 text-center text-sm text-stone-400">暂无数据</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="bg-amber-50/50 border-b border-orange-100">
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">用户</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">计划</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">金额</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">状态</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">下单时间</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in list" :key="row.id" class="border-b border-stone-100 hover:bg-amber-50/30 transition-colors">
            <td class="py-3 px-4">
              <p class="text-stone-800 font-medium">{{ row.nickname || '未设置' }}</p>
              <p class="text-xs text-stone-400">{{ row.phone }}</p>
            </td>
            <td class="py-3 px-4">{{ row.plan_name }}</td>
            <td class="py-3 px-4">¥{{ row.amount }}</td>
            <td class="py-3 px-4">
              <UBadge :label="statusLabel(row.status)" :color="statusColor(row.status)" variant="subtle" size="xs" />
            </td>
            <td class="py-3 px-4 text-xs text-stone-400">{{ formatDate(row.created_at) }}</td>
            <td class="py-3 px-4">
              <UButton
                v-if="row.status === 0"
                label="确认支付并开通"
                color="amber" variant="subtle" size="xs"
                :loading="row._loading"
                @click="confirm(row)"
              />
              <span v-else class="text-xs text-stone-400">{{ row.paid_at ? formatDate(row.paid_at) : '-' }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminPlanOrders' })
definePageMeta({ layout: 'admin' })

const toast = useToast()

const tabs = [
  { label: '全部', key: '' },
  { label: '待支付', key: '0' },
  { label: '已支付', key: '1' },
  { label: '已取消', key: '2' },
]
const activeTab = ref(0)
const list      = ref<any[]>([])
const loading   = ref(false)

function statusLabel(s: number) {
  return { 0: '待支付', 1: '已支付', 2: '已取消' }[s] ?? '-'
}
function statusColor(s: number) {
  return { 0: 'amber', 1: 'green', 2: 'red' }[s] ?? 'gray'
}
function formatDate(s: string) {
  return s ? new Date(s).toLocaleString('zh-CN') : '-'
}

async function loadList() {
  loading.value = true
  try {
    const statusVal = tabs[activeTab.value]?.key || ''
    const d = await $fetch<any>('/api/admin/plans/orders', { query: statusVal !== '' ? { status: statusVal } : {} })
    list.value = d.list
  } finally {
    loading.value = false
  }
}

async function confirm(row: any) {
  row._loading = true
  try {
    await $fetch(`/api/admin/plans/orders/${row.id}/confirm`, { method: 'PUT' })
    toast.add({ title: '已确认并开通计划', color: 'green' })
    loadList()
  } catch {
    toast.add({ title: '操作失败', color: 'red' })
  } finally {
    row._loading = false
  }
}

onMounted(loadList)
</script>
