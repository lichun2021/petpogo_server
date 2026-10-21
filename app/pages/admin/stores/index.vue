<template>
  <div class="space-y-4">
    <AdminPageHeader title="门店管理" description="查看门店信息、分类与营业状态" :count="hasLoaded ? total : undefined" unit="家门店"><UButton label="刷新" icon="i-heroicons-arrow-path" color="neutral" variant="outline" :loading="loading" @click="loadList" /></AdminPageHeader>
    <!-- 搜索 -->
    <div class="bg-white rounded-xl border p-4 flex flex-wrap items-center gap-3" style="border-color: #e7e5e4">
      <UInput v-model="search" placeholder="搜索门店名称 / 地址..." icon="i-heroicons-magnifying-glass" class="w-full sm:max-w-sm" @keyup.enter="searchList" />
      <UButton label="搜索" color="primary" @click="searchList" />
      <UButton label="重置" color="neutral" variant="outline" @click="reset" />

    </div>

    <!-- 分类筛选 -->
    <div class="admin-segment flex-wrap" aria-label="门店分类筛选"><button v-for="(tab, i) in tabs" :key="tab.key" :aria-pressed="activeTab === i" @click="activeTab = i; page = 1; loadList()">{{ tab.label }}</button></div>

    <!-- 表格 -->
    <div class="bg-white rounded-xl border overflow-hidden" style="border-color: #e7e5e4; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
      <AdminListState :loading="loading" :has-data="list.length > 0" :empty="hasLoaded" :error="loadError" :request-id="errorRequestId" :filtered="!!appliedSearch || !!activeTab" empty-title="暂无门店" empty-description="门店资料录入后会显示在这里" icon="i-heroicons-building-storefront" @retry="loadList" @reset="reset" />
      <div v-if="list.length" class="admin-table-scroll">
      <table class="admin-table">
        <thead>
          <tr class="bg-stone-50 border-b border-stone-200">
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">门店信息</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">分类</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">评分</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">热门</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">状态</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in list" :key="row.id"
            class="border-b border-stone-100 hover:bg-primary/5 transition-colors"
          >
            <td class="py-3 px-4">
              <p class="text-stone-800 font-medium">{{ row.name }}</p>
              <p class="text-xs text-stone-500 truncate max-w-60">{{ row.address }}</p>
            </td>
            <td class="py-3 px-4">
              <UBadge :label="row.category || '其他'" color="info" variant="subtle" size="xs" />
            </td>
            <td class="py-3 px-4">
              <div class="flex items-center gap-1">
                <UIcon name="i-heroicons-star-solid" class="w-3.5 h-3.5 text-primary" />
                <span class="text-stone-700 text-xs">{{ row.rating || '-' }}</span>
              </div>
            </td>
            <td class="py-3 px-4">
              <UIcon v-if="row.is_hot" name="i-heroicons-fire-solid" class="w-4 h-4 text-orange-400" />
              <span v-else class="text-stone-300 text-xs">—</span>
            </td>
            <td class="py-3 px-4">
              <UBadge :label="row.status === 1 ? '营业中' : '已关闭'" :color="row.status === 1 ? 'success' : 'neutral'" variant="subtle" size="xs" />
            </td>
          </tr>
        </tbody>
      </table>
      </div>

      <div v-if="total > pageSize" class="flex justify-center py-4 border-t border-stone-100">
        <UPagination v-model:page="page" :items-per-page="pageSize" :total="total" @update:page="loadList" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminStoresList' })
definePageMeta({ layout: 'admin' })

const tabs = [
  { label: '全部门店', key: '' },
  { label: '宠物医院', key: '宠物医院' },
  { label: '美容洗澡', key: '美容' },
  { label: '寄养托管', key: '寄养' },
  { label: '宠物用品', key: '宠物店' },
]

const activeTab = ref(0)
const search    = ref('')
const page      = ref(1)
const pageSize  = 20
const appliedSearch = ref('')
function searchList() { appliedSearch.value = search.value.trim(); page.value = 1; loadList() }
interface StoreRow { id: string; name: string; address: string; category: string; rating: number; is_hot: boolean; status: number }
const { list, total, loading, hasLoaded, error: loadError, errorRequestId, load: loadList } = useAdminList<StoreRow>(signal => $fetch('/api/admin/stores', {
  query: { page: page.value, size: pageSize, search: appliedSearch.value, category: tabs[activeTab.value]?.key || '' }, signal,
}))
function reset() { search.value = ''; appliedSearch.value = ''; activeTab.value = 0; page.value = 1; loadList() }
onMounted(loadList)
</script>
