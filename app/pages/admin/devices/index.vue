<template>
  <div class="space-y-4">
    <!-- 搜索栏 -->
    <div class="bg-white rounded-2xl border p-4 flex items-center gap-3" style="border-color: #f0e6d8">
      <UInput v-model="search" placeholder="搜索 MAC / 设备名..." icon="i-heroicons-magnifying-glass" class="flex-1" @keyup.enter="() => { page = 1; loadList() }" />
      <UButton label="搜索" color="amber" @click="() => { page = 1; loadList() }" />
      <UButton label="重置" color="gray" variant="outline" @click="reset" />
      <div class="ml-auto flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-green-400" />
        <span class="text-xs text-stone-500">{{ onlineNum }} 在线</span>
        <UBadge :label="`共 ${total}`" color="amber" variant="subtle" size="xs" />
      </div>
    </div>

    <!-- 状态筛选 -->
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
        @click="activeTab = i; page = 1; loadList()"
      >{{ tab.label }}</button>
    </div>

    <!-- 表格 -->
    <div class="bg-white rounded-2xl border overflow-hidden" style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
      <div v-if="loading" class="flex justify-center py-10">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-stone-400 animate-spin" />
      </div>
      <div v-else-if="!list.length" class="py-10 text-center text-sm text-stone-400">暂无设备数据</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="bg-amber-50/50 border-b border-orange-100">
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">设备信息</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">状态</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">最后位置</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">最后上线</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in list" :key="row.mac"
            class="border-b border-stone-100 hover:bg-amber-50/30 transition-colors"
          >
            <td class="py-3 px-4">
              <div class="flex items-center gap-2">
                <span :class="['w-2 h-2 rounded-full flex-shrink-0', row.online_status ? 'bg-green-400' : 'bg-stone-300']" />
                <div>
                  <p class="text-stone-800 font-mono text-xs font-medium">{{ row.mac }}</p>
                  <p class="text-xs text-stone-400">{{ row.name || '未命名' }}</p>
                </div>
              </div>
            </td>
            <td class="py-3 px-4">
              <UBadge :label="row.online_status ? '在线' : '离线'" :color="row.online_status ? 'green' : 'gray'" variant="subtle" size="xs" />
            </td>
            <td class="py-3 px-4 text-xs text-stone-400 truncate max-w-48">{{ row.address || '-' }}</td>
            <td class="py-3 px-4 text-xs text-stone-400">{{ formatDate(row.last_online_at) }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="total > pageSize" class="flex justify-center py-4 border-t border-stone-100">
        <UPagination v-model="page" :page-count="pageSize" :total="total" @update:model-value="loadList" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const tabs = [
  { label: '全部设备', key: '' },
  { label: '在线',     key: '1' },
  { label: '离线',     key: '0' },
]

const activeTab = ref(0)
const search    = ref('')
const page      = ref(1)
const pageSize  = 20
const list      = ref<any[]>([])
const total     = ref(0)
const loading   = ref(false)

const onlineNum = computed(() => list.value.filter(d => d.online_status).length)

async function loadList() {
  loading.value = true
  try {
    const onlineVal = tabs[activeTab.value]?.key
    const d = await $fetch<any>('/api/admin/devices', {
      query: { page: page.value, size: pageSize, search: search.value, online: onlineVal }
    })
    list.value  = d.list
    total.value = d.total
  } finally { loading.value = false }
}

function reset() { search.value = ''; activeTab.value = 0; page.value = 1; loadList() }
function formatDate(s: string) {
  return s ? new Date(s).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'
}
onMounted(loadList)
</script>
