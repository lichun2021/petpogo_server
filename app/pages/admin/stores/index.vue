<template>
  <div class="space-y-4">
    <!-- 搜索 -->
    <div class="bg-white rounded-2xl border p-4 flex items-center gap-3" style="border-color: #f0e6d8">
      <UInput v-model="search" placeholder="搜索门店名称 / 地址..." icon="i-heroicons-magnifying-glass" class="flex-1" @keyup.enter="() => { page = 1; loadList() }" />
      <UButton label="搜索" color="amber" @click="() => { page = 1; loadList() }" />
      <UButton label="重置" color="gray" variant="outline" @click="reset" />
      <UBadge :label="`共 ${total} 家`" color="amber" variant="subtle" size="xs" class="ml-auto" />
    </div>

    <!-- 页签（按门店分类） -->
    <UTabs v-model="activeTab" :items="tabs" color="amber" @update:model-value="onTabChange">
      <template #content="{ item }">
        <div class="pt-3">
          <div class="bg-white rounded-2xl border overflow-hidden" style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
            <!-- 空状态 -->
            <div v-if="!list.length && !loading" class="py-14 text-center">
              <UIcon name="i-heroicons-building-storefront" class="w-10 h-10 text-stone-200 mx-auto mb-3" />
              <p class="text-sm text-stone-400">暂无门店数据</p>
              <p class="text-xs text-stone-300 mt-1">请先通过 SQL 导入门店信息</p>
            </div>

            <UTable
              v-else
              :rows="list"
              :columns="columns"
              :loading="loading"
              :ui="{
                th: { base: 'text-xs text-stone-500 font-medium py-3 px-4 bg-amber-50/50 border-b border-orange-100' },
                td: { base: 'text-sm py-3 px-4 border-b border-stone-100' },
                tr: { base: 'hover:bg-amber-50/30 transition-colors' }
              }"
            >
              <template #name-data="{ row }">
                <div>
                  <p class="text-stone-800 font-medium">{{ row.name }}</p>
                  <p class="text-xs text-stone-400 truncate max-w-60">{{ row.address }}</p>
                </div>
              </template>
              <template #category-data="{ row }">
                <UBadge :label="row.category || '其他'" color="blue" variant="subtle" size="xs" />
              </template>
              <template #rating-data="{ row }">
                <div class="flex items-center gap-1">
                  <UIcon name="i-heroicons-star-solid" class="w-3.5 h-3.5 text-amber-400" />
                  <span class="text-stone-700 text-xs">{{ row.rating || '-' }}</span>
                </div>
              </template>
              <template #is_hot-data="{ row }">
                <UIcon v-if="row.is_hot" name="i-heroicons-fire-solid" class="w-4 h-4 text-orange-400" />
                <span v-else class="text-stone-300 text-xs">—</span>
              </template>
              <template #status-data="{ row }">
                <UBadge :label="row.status === 1 ? '营业中' : '已关闭'" :color="row.status === 1 ? 'green' : 'gray'" variant="subtle" size="xs" />
              </template>
            </UTable>

            <div v-if="total > pageSize" class="flex justify-center py-4 border-t border-stone-100">
              <UPagination v-model="page" :page-count="pageSize" :total="total" @update:model-value="loadList" />
            </div>
          </div>
        </div>
      </template>
    </UTabs>
  </div>
</template>

<script setup lang="ts">
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

const columns = [
  { key: 'name',     label: '门店信息' },
  { key: 'category', label: '分类' },
  { key: 'rating',   label: '评分' },
  { key: 'is_hot',   label: '热门' },
  { key: 'status',   label: '状态' },
]

function onTabChange() { page.value = 1; loadList() }

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
