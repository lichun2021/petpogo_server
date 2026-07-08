<template>
  <div class="space-y-4">
    <div class="bg-white rounded-2xl border p-4 flex items-center gap-3" style="border-color: #f0e6d8">
      <UInput v-model="keyword" placeholder="搜索手机号 / 昵称..." icon="i-heroicons-magnifying-glass" class="flex-1" @keyup.enter="() => { page = 1; loadList() }" />
      <UButton label="搜索" color="amber" @click="() => { page = 1; loadList() }" />
      <UButton label="重置" color="gray" variant="outline" @click="reset" />
      <UButton label="返回规则配置" color="gray" variant="outline" icon="i-heroicons-arrow-left" to="/admin/points/rules" />
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
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">方向</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">积分类型</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">数量</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">变动后余额</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">原因</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in list" :key="row.id" class="border-b border-stone-100 hover:bg-amber-50/30 transition-colors">
            <td class="py-3 px-4">
              <p class="text-stone-800 font-medium">{{ row.nickname || '未设置' }}</p>
              <p class="text-xs text-stone-400">{{ row.phone }}</p>
            </td>
            <td class="py-3 px-4">
              <UBadge :label="row.direction === 1 ? '获得' : '消耗'" :color="row.direction === 1 ? 'green' : 'amber'" variant="subtle" size="xs" />
            </td>
            <td class="py-3 px-4 text-xs text-stone-500">{{ row.points_type === 1 ? '周积分' : '永久积分' }}</td>
            <td class="py-3 px-4">{{ row.direction === 1 ? '+' : '-' }}{{ row.amount }}</td>
            <td class="py-3 px-4">{{ row.balance_after }}</td>
            <td class="py-3 px-4 text-xs text-stone-500">{{ row.reason }}</td>
            <td class="py-3 px-4 text-xs text-stone-400">{{ formatDate(row.created_at) }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="list.length" class="flex justify-center py-4 border-t border-stone-100">
        <UPagination v-model="page" :page-count="pageSize" :total="page * pageSize + (list.length === pageSize ? pageSize : 0)" @update:model-value="loadList" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminPointsLogs' })
definePageMeta({ layout: 'admin' })

const keyword  = ref('')
const page     = ref(1)
const pageSize = 20
const list     = ref<any[]>([])
const loading  = ref(false)

async function loadList() {
  loading.value = true
  try {
    const d = await $fetch<any>('/api/admin/points/logs', {
      query: { keyword: keyword.value, page: page.value, limit: pageSize }
    })
    list.value = d.list
  } finally {
    loading.value = false
  }
}

function reset() { keyword.value = ''; page.value = 1; loadList() }
function formatDate(s: string) { return s ? new Date(s).toLocaleString('zh-CN') : '-' }

onMounted(loadList)
</script>
