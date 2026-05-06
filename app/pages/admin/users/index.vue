<template>
  <div class="space-y-4">
    <!-- 搜索栏 -->
    <div class="bg-white rounded-2xl border p-4 flex items-center gap-3" style="border-color: #f0e6d8">
      <UInput v-model="search" placeholder="搜索手机号 / 昵称..." icon="i-heroicons-magnifying-glass" class="flex-1" @keyup.enter="() => { page = 1; loadList() }" />
      <UButton label="搜索" color="amber" @click="() => { page = 1; loadList() }" />
      <UButton label="重置" color="gray" variant="outline" @click="reset" />
      <UBadge :label="`共 ${total} 人`" color="amber" variant="subtle" size="xs" class="ml-auto" />
    </div>

    <!-- 页签 -->
    <UTabs v-model="activeTab" :items="tabs" color="amber" @update:model-value="onTabChange">
      <template #content="{ item }">
        <div class="pt-3">
          <!-- 表格 -->
          <div class="bg-white rounded-2xl border overflow-hidden" style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
            <UTable
              :data="list"
              :columns="columns"
              :loading="loading"
              :ui="{
                th: { base: 'text-xs text-stone-500 font-medium py-3 px-4 bg-amber-50/50 border-b border-orange-100' },
                td: { base: 'text-sm py-3 px-4 border-b border-stone-100' },
                tr: { base: 'hover:bg-amber-50/30 transition-colors' }
              }"
            >
              <template #avatar-cell="{ row }">
                <UAvatar :src="row.original.avatar" :alt="row.original.nickname || row.original.phone" size="sm" />
              </template>
              <template #nickname-cell="{ row }">
                <div>
                  <p class="text-stone-800 font-medium">{{ row.original.nickname || '未设置' }}</p>
                  <p class="text-xs text-stone-400">{{ row.original.phone }}</p>
                </div>
              </template>
              <template #status-cell="{ row }">
                <UBadge :label="row.original.status === 1 ? '正常' : '禁用'" :color="row.original.status === 1 ? 'green' : 'red'" variant="subtle" size="xs" />
              </template>
              <template #created_at-cell="{ row }">
                <span class="text-stone-400 text-xs">{{ formatDate(row.original.created_at) }}</span>
              </template>
              <template #actions-cell="{ row }">
                <UButton
                  :label="row.original.status === 1 ? '禁用' : '启用'"
                  :color="row.original.status === 1 ? 'red' : 'green'"
                  variant="subtle" size="xs"
                  :loading="row.original._loading"
                  @click="toggleStatus(row.original)"
                />
              </template>
            </UTable>

            <div v-if="!list.length && !loading" class="py-10 text-center text-sm text-stone-400">暂无数据</div>

            <!-- 分页 -->
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
  { label: '全部用户', key: '' },
  { label: '正常',     key: '1' },
  { label: '禁用',     key: '2' },
]

const activeTab = ref(0)
const search    = ref('')
const page      = ref(1)
const pageSize  = 20
const list      = ref<any[]>([])
const total     = ref(0)
const loading   = ref(false)

const columns = [
  { accessorKey: 'avatar',     header: '' },
  { accessorKey: 'nickname',   header: '用户信息' },
  { accessorKey: 'status',     header: '状态' },
  { accessorKey: 'created_at', header: '注册时间' },
  { accessorKey: 'actions',    header: '操作' },
]

function onTabChange(idx: number) { page.value = 1; loadList() }

async function loadList() {
  loading.value = true
  try {
    const statusVal = tabs[activeTab.value]?.key || ''
    const d = await $fetch<any>('/api/admin/users', {
      query: { page: page.value, size: pageSize, search: search.value, status: statusVal }
    })
    list.value  = d.list
    total.value = d.total
  } finally { loading.value = false }
}

function reset() { search.value = ''; activeTab.value = 0; page.value = 1; loadList() }

const toast = useToast()
async function toggleStatus(row: any) {
  row._loading = true
  try {
    await $fetch(`/api/admin/users/${row.id}/status`, { method: 'PUT', body: { status: row.status === 1 ? 2 : 1 } })
    row.status = row.status === 1 ? 2 : 1
    toast.add({ title: '操作成功', color: 'green' })
  } catch { toast.add({ title: '操作失败', color: 'red' }) }
  finally { row._loading = false }
}

function formatDate(s: string) { return s ? new Date(s).toLocaleDateString('zh-CN') : '-' }
onMounted(loadList)
</script>
