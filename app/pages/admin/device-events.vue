<template>
  <div class="space-y-4">
    <h1 class="text-xl font-semibold text-stone-900">设备事件</h1>
    <!-- 筛选条 -->
    <div class="bg-white rounded-xl border p-4 space-y-3" style="border-color: #e7e5e4">
      <div class="flex items-center gap-3">
        <UInput v-model="keyword" placeholder="搜索手机号 / 昵称..." icon="i-heroicons-magnifying-glass" class="w-full sm:max-w-sm" @keyup.enter="() => { page = 1; loadList() }" />
        <UInput v-model="userId" placeholder="或按 userId 精确查" class="w-48" @keyup.enter="() => { page = 1; loadList() }" />
        <UButton label="搜索" color="primary" @click="() => { page = 1; loadList() }" />
        <UButton label="重置" color="neutral" variant="outline" @click="reset" />
      </div>
      <div class="flex items-center gap-3 flex-wrap">
        <USelectMenu v-model="eventType" :items="typeOptions" value-key="value" label-key="label" aria-label="事件类型" placeholder="事件类型" class="w-40" />
        <USelectMenu v-model="isRead" :items="readOptions" value-key="value" label-key="label" aria-label="已读状态" placeholder="已读状态" class="w-36" />
        <UInput v-model="startTime" type="date" class="w-44" />
        <span class="text-xs text-stone-500">至</span>
        <UInput v-model="endTime" type="date" class="w-44" />
      </div>
    </div>

    <!-- 列表 -->
    <div class="bg-white rounded-xl border overflow-hidden" style="border-color: #e7e5e4; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
      <div v-if="loading" class="flex justify-center py-10">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-stone-500 animate-spin" />
      </div>
      <div v-else-if="!list.length" class="py-10 text-center text-sm text-stone-500">暂无数据</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="bg-stone-50 border-b border-stone-200">
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">用户</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">类型</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">设备</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">宠物</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">描述</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">已读</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in list" :key="row.id" class="border-b border-stone-100 hover:bg-amber-50/30 transition-colors">
            <td class="py-3 px-4">
              <p class="text-stone-800 font-medium">{{ row.nickname || '未设置' }}</p>
              <p class="text-xs text-stone-500">{{ row.phone }}</p>
            </td>
            <td class="py-3 px-4">
              <UBadge :label="typeLabel(row.event_type)" :color="typeColor(row.event_type)" variant="subtle" size="xs" />
            </td>
            <td class="py-3 px-4">
              <p class="text-stone-800">{{ row.device_name || '-' }}</p>
              <p class="text-xs text-stone-500 font-mono">{{ row.device_mac }}</p>
            </td>
            <td class="py-3 px-4 text-stone-700">{{ row.pet_name || '-' }}</td>
            <td class="py-3 px-4 text-xs text-stone-500 max-w-xs truncate" :title="row.description">{{ row.description || '-' }}</td>
            <td class="py-3 px-4">
              <UBadge :label="row.is_read ? '已读' : '未读'" :color="row.is_read ? 'success' : 'neutral'" variant="subtle" size="xs" />
            </td>
            <td class="py-3 px-4 text-xs text-stone-500">{{ formatDate(row.created_at) }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="list.length" class="flex justify-center py-4 border-t border-stone-100">
        <UPagination v-model:page="page" :items-per-page="pageSize" :total="page * pageSize + (list.length === pageSize ? pageSize : 0)" @update:page="loadList" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminDeviceEvents' })
definePageMeta({ layout: 'admin' })

const keyword   = ref('')
const userId    = ref('')
const eventType = ref<string | null>(null)
const isRead    = ref<string | null>(null)
const startTime = ref('')
const endTime   = ref('')
const page      = ref(1)
const pageSize  = 20
const list      = ref<any[]>([])
const loading   = ref(false)

const typeOptions = [
  { label: '全部类型', value: null },
  { label: '越界', value: 'breach' },
  { label: '离线', value: 'offline' },
  { label: '低电', value: 'low_battery' },
]
const readOptions = [
  { label: '全部状态', value: null },
  { label: '未读', value: '0' },
  { label: '已读', value: '1' },
]

function typeLabel(t: string) {
  return { breach: '越界', offline: '离线', low_battery: '低电' }[t] || t
}
function typeColor(t: string) {
  return ({ breach: 'error', offline: 'primary', low_battery: 'warning' } as any)[t] || 'neutral'
}

async function loadList() {
  loading.value = true
  try {
    const d = await $fetch<any>('/api/admin/device-events', {
      query: {
        keyword: keyword.value,
        userId: userId.value,
        event_type: eventType.value || undefined,
        is_read: isRead.value || undefined,
        start_time: startTime.value || undefined,
        end_time: endTime.value ? endTime.value + ' 23:59:59' : undefined,
        page: page.value,
        limit: pageSize,
      },
    })
    list.value = d.list
  } finally {
    loading.value = false
  }
}

function reset() {
  keyword.value = ''
  userId.value = ''
  eventType.value = null
  isRead.value = null
  startTime.value = ''
  endTime.value = ''
  page.value = 1
  loadList()
}

function formatDate(s: string) { return s ? new Date(s).toLocaleString('zh-CN') : '-' }

onMounted(loadList)
</script>
