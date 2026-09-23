<template>
  <div class="space-y-5">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div><h1 class="text-xl font-semibold text-stone-900">设备管理</h1><p class="mt-1 text-sm text-stone-500">查看设备状态与最近活动</p></div>
      <span v-if="!loadError && !loading" class="text-sm text-stone-500">共 <strong class="text-stone-800 font-semibold">{{ total }}</strong> 台设备</span>
    </header>
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
      <div class="overflow-x-auto">
        <table class="w-full min-w-[640px] text-sm">
          <thead><tr class="bg-stone-50 border-b border-stone-200">
            <th v-for="label in ['设备信息', '状态', '最后位置', '最后上线']" :key="label" scope="col" class="text-left text-stone-600 font-medium py-3 px-5">{{ label }}</th>
          </tr></thead>
          <tbody>
            <tr v-if="loading"><td colspan="4"><div class="flex items-center justify-center gap-2 py-16 text-stone-500" role="status"><UIcon name="i-heroicons-arrow-path" class="size-5 animate-spin" />正在加载设备</div></td></tr>
            <tr v-else-if="loadError"><td colspan="4"><AdminEmptyState title="设备加载失败" description="请检查网络后重试" icon="i-heroicons-exclamation-circle"><UButton label="重新加载" color="neutral" variant="outline" @click="loadList" /></AdminEmptyState></td></tr>
            <tr v-else-if="!list.length"><td colspan="4"><AdminEmptyState :title="appliedSearch || activeTab ? '没有符合条件的设备' : '暂无设备'" :description="appliedSearch || activeTab ? '调整搜索内容或状态筛选后再试' : '设备接入后，可在这里查看状态与最近活动'" icon="i-heroicons-cpu-chip"><UButton v-if="appliedSearch || activeTab" label="清除筛选" color="neutral" variant="outline" @click="reset" /></AdminEmptyState></td></tr>
            <tr v-for="row in (!loading && !loadError ? list : [])" :key="row.mac" class="border-b border-stone-100 last:border-0 hover:bg-stone-50/70 transition-colors">
              <td class="py-4 px-5"><p class="text-stone-800 font-medium">{{ row.name || '未命名设备' }}</p><p class="mt-1 font-mono text-xs text-stone-500">{{ row.mac }}</p></td>
              <td class="py-4 px-5"><UBadge :label="row.online_status ? '在线' : '离线'" :color="row.online_status ? 'success' : 'neutral'" variant="soft" size="sm" /></td>
              <td class="py-4 px-5 text-stone-600 max-w-64 truncate" :title="row.address">{{ row.address || '—' }}</td>
              <td class="py-4 px-5 text-stone-600 whitespace-nowrap">{{ formatDate(row.last_online_at) }}</td>
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
const list      = ref<any[]>([])
const total     = ref(0)
const loading   = ref(true)
const loadError = ref(false)
let requestId = 0
const appliedSearch = ref('')
function searchList() { appliedSearch.value = search.value.trim(); page.value = 1; loadList() }

const onlineNum = computed(() => list.value.filter(d => d.online_status).length)

async function loadList() {
  const id = ++requestId
  loading.value = true
  loadError.value = false
  try {
    const onlineVal = tabs[activeTab.value]?.key
    const d = await $fetch<any>('/api/admin/devices', {
      query: { page: page.value, size: pageSize, search: appliedSearch.value, online: onlineVal }
    })
    if (id !== requestId) return
    list.value  = d.list
    total.value = d.total
  } catch {
    if (id === requestId) loadError.value = true
  } finally { if (id === requestId) loading.value = false }
}

function reset() { search.value = ''; appliedSearch.value = ''; activeTab.value = 0; page.value = 1; loadList() }
function formatDate(s: string) {
  return s ? new Date(s).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'
}
onMounted(loadList)
</script>
