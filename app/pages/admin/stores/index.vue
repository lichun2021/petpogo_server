<template>
  <div class="space-y-4">
    <h1 class="text-xl font-semibold text-stone-900">门店管理</h1>
    <!-- 搜索 -->
    <div class="bg-white rounded-xl border p-4 flex flex-wrap items-center gap-3" style="border-color: #e7e5e4">
      <UInput v-model="search" placeholder="搜索门店名称 / 地址..." icon="i-heroicons-magnifying-glass" class="w-full sm:max-w-sm" @keyup.enter="() => { page = 1; loadList() }" />
      <UButton label="搜索" color="primary" @click="() => { page = 1; loadList() }" />
      <UButton label="重置" color="neutral" variant="outline" @click="reset" />
      <UBadge :label="`共 ${total} 家`" color="primary" variant="subtle" size="xs" class="ml-auto" />
    </div>

    <!-- 分类筛选 -->
    <div class="flex gap-2 flex-wrap">
      <button
        v-for="(tab, i) in tabs" :key="tab.key"
        :class="[
          'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
          activeTab === i
            ? 'bg-amber-500 text-white shadow-sm'
            : 'bg-white border text-stone-500 hover:text-stone-700 hover:border-amber-300'
        ]"
        style="border-color: #e7e5e4"
        @click="activeTab = i; page = 1; loadList()"
      >{{ tab.label }}</button>
    </div>

    <!-- 表格 -->
    <div class="bg-white rounded-xl border overflow-hidden" style="border-color: #e7e5e4; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
      <div v-if="!list.length && !loading" class="py-14 text-center">
        <UIcon name="i-heroicons-building-storefront" class="w-10 h-10 text-stone-200 mx-auto mb-3" />
        <p class="text-sm text-stone-500">暂无门店数据</p>
        <p class="text-xs text-stone-300 mt-1">请先通过 SQL 导入门店信息</p>
      </div>

      <div v-else-if="loading" class="flex justify-center py-10">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-stone-500 animate-spin" />
      </div>

      <table v-else class="w-full text-sm">
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
            class="border-b border-stone-100 hover:bg-amber-50/30 transition-colors"
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
                <UIcon name="i-heroicons-star-solid" class="w-3.5 h-3.5 text-amber-400" />
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
const list      = ref<any[]>([])
const total     = ref(0)
const loading   = ref(false)

async function loadList() {
  loading.value = true
  try {
    const categoryVal = tabs[activeTab.value]?.key || ''
    const d = await $fetch<any>('/api/admin/stores', {
      query: { page: page.value, size: pageSize, search: search.value, category: categoryVal }
    }).catch(() => ({ list: [], total: 0 }))
    list.value  = (d as any).list  || []
    total.value = (d as any).total || 0
  } finally { loading.value = false }
}

function reset() { search.value = ''; activeTab.value = 0; page.value = 1; loadList() }
onMounted(loadList)
</script>
