<template>
  <div class="space-y-5">
    <AdminPageHeader title="设备管理" description="查看设备联网状态、位置与最近活动" :count="hasLoaded ? total : undefined" unit="台设备"><UButton label="刷新" icon="i-heroicons-arrow-path" color="neutral" variant="outline" :loading="loading" @click="loadList" /></AdminPageHeader>
    <section class="admin-panel" aria-label="设备列表" :aria-busy="loading">
      <div class="admin-toolbar border-b border-stone-100">
        <form class="flex flex-wrap items-center gap-2 w-full lg:w-auto lg:flex-1" @submit.prevent="searchList">
          <UInput v-model="search" aria-label="搜索设备" placeholder="搜索 MAC / 设备名" icon="i-heroicons-magnifying-glass" class="w-full sm:w-80" />
          <UButton label="搜索" type="submit" :loading="loading" />
          <UButton label="重置" color="neutral" variant="outline" @click="reset" />
        </form>
        <div class="admin-segment" aria-label="设备状态筛选">
          <button v-for="(tab, i) in tabs" :key="tab.key" :aria-pressed="activeTab === i" @click="activeTab = i; page = 1; loadList()">{{ tab.label }}</button>
        </div>
      </div>
      <AdminListState :loading="loading" :has-data="list.length > 0" :empty="hasLoaded" :error="loadError" :request-id="errorRequestId" :filtered="!!appliedSearch || !!activeTab" empty-title="暂无设备" empty-description="设备接入后，可在这里查看状态与最近活动" icon="i-heroicons-cpu-chip" @retry="loadList" @reset="reset" />
      <div v-if="list.length" class="admin-table-scroll">
        <table class="admin-table">
          <thead><tr class="bg-stone-50 border-b border-stone-200">
            <th v-for="label in ['设备信息', '通网类型', '状态', '最后位置', '最后上线']" :key="label" scope="col" class="text-left text-stone-600 font-medium py-3 px-5">{{ label }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="row in list" :key="row.mac" class="border-b border-stone-100 last:border-0 hover:bg-stone-50/70 transition-colors">
              <td class="py-2 px-5"><p class="text-stone-800 font-medium">{{ row.name || '未命名设备' }}</p><p class="mt-0.5 font-mono text-xs text-stone-500">{{ row.mac }}</p></td>
              <td class="py-2 px-5 text-stone-600">{{ row.network_type === '4g' ? '4G' : row.network_type === 'wifi' ? 'Wi-Fi' : '未设置' }}</td>
              <td class="py-2 px-5"><UBadge :label="row.online_status ? '在线' : '离线'" :color="row.online_status ? 'success' : 'neutral'" variant="soft" size="sm" /></td>
              <td class="py-2 px-5 text-stone-600 max-w-64 truncate" :title="row.address">{{ row.address || '—' }}</td>
              <td class="py-2 px-5 text-stone-600 whitespace-nowrap">{{ formatDate(row.last_online_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer v-if="!loading && !loadError && list.length" class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-stone-200">
        <span class="text-xs text-stone-500">本页 {{ list.length }} 台 · 在线 {{ onlineNum }} 台</span>
        <UPagination v-if="total > pageSize" v-model:page="page" :items-per-page="pageSize" :total="total" @update:page="loadList" />
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminDevicesList' })
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
const appliedSearch = ref('')
function searchList() { appliedSearch.value = search.value.trim(); page.value = 1; loadList() }



interface DeviceRow { id: string; mac: string; name: string | null; network_type: '4g' | 'wifi' | null; online_status: boolean; address: string | null; last_online_at: string | null }
const { list, total, loading, hasLoaded, error: loadError, errorRequestId, load: loadList } = useAdminList<DeviceRow>(signal => $fetch('/api/admin/devices', {
  query: { page: page.value, size: pageSize, search: appliedSearch.value, online: tabs[activeTab.value]?.key }, signal,
}))

const onlineNum = computed(() => list.value.filter(d => d.online_status).length)

function reset() { search.value = ''; appliedSearch.value = ''; activeTab.value = 0; page.value = 1; loadList() }
function formatDate(s: string | null) {
  return s ? new Date(s).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'
}
onMounted(loadList)
</script>
