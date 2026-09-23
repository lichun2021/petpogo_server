<template>
  <div class="space-y-4">
    <h2 class="text-xl font-bold text-stone-800 flex items-center gap-2">
      <UIcon name="i-heroicons-clock" class="w-5 h-5 text-amber-500" />
      宠物事件查询
    </h2>

    <!-- 筛选条 -->
    <div class="bg-white rounded-xl border p-4 space-y-3" style="border-color: #e7e5e4">
      <div class="flex items-center gap-3">
        <UInput v-model="petId" placeholder="按宠物ID筛选..." class="w-48" @keyup.enter="() => { page = 1; loadList() }" />
        <UInput v-model="deviceId" placeholder="按设备ID筛选..." class="w-48" @keyup.enter="() => { page = 1; loadList() }" />
        <UButton label="搜索" color="primary" @click="() => { page = 1; loadList() }" />
        <UButton label="重置" color="neutral" variant="outline" @click="reset" />
      </div>
      <div class="flex items-center gap-3 flex-wrap">
        <USelectMenu v-model="source" :items="sourceOptions" value-key="value" label-key="label" aria-label="事件来源" placeholder="事件来源" class="w-40" />
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
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">来源</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">宠物</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">设备</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">类型</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">发生时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in list" :key="row.id" class="border-b border-stone-100 hover:bg-amber-50/30 transition-colors">
            <td class="py-3 px-4">
              <UBadge :label="sourceLabel(row.source)" :color="row.source === 'interaction' ? 'primary' : 'info'" variant="subtle" size="xs" />
            </td>
            <td class="py-3 px-4 text-stone-700">{{ row.pet_name || '-' }}</td>
            <td class="py-3 px-4 text-xs text-stone-500 font-mono">{{ row.device_id || '-' }}</td>
            <td class="py-3 px-4">
              <p class="text-stone-800">{{ row.type_name || '-' }}</p>
              <p class="text-xs text-stone-500 font-mono">{{ row.type_code }}</p>
            </td>
            <td class="py-3 px-4 text-xs text-stone-500">{{ formatDate(row.occurred_at) }}</td>
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
defineOptions({ name: 'AdminVirtualPetEvents' })
definePageMeta({ layout: 'admin' })

const petId     = ref('')
const deviceId   = ref('')
const source     = ref<string | null>(null)
const startTime  = ref('')
const endTime    = ref('')
const page       = ref(1)
const pageSize   = 20
const list       = ref<any[]>([])
const loading    = ref(false)

const sourceOptions = [
  { label: '全部来源', value: null },
  { label: '互动触发', value: 'interaction' },
  { label: '硬件动作', value: 'hardware_action' },
]

function sourceLabel(s: string) {
  return ({ interaction: '互动触发', hardware_action: '硬件动作' } as any)[s] || s
}

async function loadList() {
  loading.value = true
  try {
    const d = await $fetch<any>('/api/admin/pet-events', {
      query: {
        petId: petId.value || undefined,
        deviceId: deviceId.value || undefined,
        source: source.value || undefined,
        start_time: startTime.value || undefined,
        end_time: endTime.value ? endTime.value + ' 23:59:59' : undefined,
        page: page.value,
        limit: pageSize,
      },
    })
    list.value = d.list
  } finally { loading.value = false }
}

function reset() {
  petId.value = ''
  deviceId.value = ''
  source.value = null
  startTime.value = ''
  endTime.value = ''
  page.value = 1
  loadList()
}

function formatDate(s: string) { return s ? new Date(s).toLocaleString('zh-CN') : '-' }

onMounted(loadList)
</script>
