<template>
  <div class="space-y-4">
    <!-- 顶部操作栏 -->
    <div class="flex items-center gap-3">
      <h2 class="text-base font-bold text-stone-800 flex items-center gap-2">
        <UIcon name="i-heroicons-heart" class="w-5 h-5 text-amber-500" />
        宠物档案管理
      </h2>
      <span class="text-xs text-stone-400">宠物档案由 App 端创建，后台可编辑/查询/删除</span>
    </div>

    <div class="bg-white rounded-2xl border p-4 flex items-center gap-3" style="border-color: #f0e6d8">
      <UInput v-model="keyword" placeholder="搜索宠物名 / 手机号 / 昵称..." icon="i-heroicons-magnifying-glass" class="flex-1" @keyup.enter="() => { page = 1; loadList() }" />
      <UInput v-model="userId" placeholder="或按 userId 精确查" class="w-48" @keyup.enter="() => { page = 1; loadList() }" />
      <UButton label="搜索" color="amber" @click="() => { page = 1; loadList() }" />
      <UButton label="重置" color="gray" variant="outline" @click="reset" />
      <UBadge :label="`共 ${total} 只`" color="amber" variant="subtle" size="xs" />
    </div>

    <!-- 列表 -->
    <div class="bg-white rounded-2xl border overflow-hidden" style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
      <div v-if="loading" class="flex justify-center py-10">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-stone-400 animate-spin" />
      </div>
      <div v-else-if="!list.length" class="py-10 text-center text-sm text-stone-400">暂无数据</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="bg-amber-50/50 border-b border-orange-100">
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">宠物</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">主人</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">物种/品种</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">养成状态</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">创建时间</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in list" :key="row.id" class="border-b border-stone-100 hover:bg-amber-50/30 transition-colors">
            <td class="py-3 px-4">
              <div class="flex items-center gap-2">
                <UAvatar :src="row.avatar" :alt="row.name" size="sm" />
                <span class="text-stone-800 font-medium">{{ row.name }}</span>
              </div>
            </td>
            <td class="py-3 px-4">
              <p class="text-stone-700">{{ row.nickname || '未设置' }}</p>
              <p class="text-xs text-stone-400">{{ row.phone }}</p>
            </td>
            <td class="py-3 px-4 text-stone-600">{{ row.species || '-' }} {{ row.breed ? `/ ${row.breed}` : '' }}</td>
            <td class="py-3 px-4">
              <div class="flex gap-2 text-[11px]">
                <span class="text-amber-600">饱腹 {{ row.satiety }}</span>
                <span class="text-pink-600">心情 {{ row.mood }}</span>
                <span class="text-sky-600">清洁 {{ row.cleanliness }}</span>
              </div>
            </td>
            <td class="py-3 px-4 text-xs text-stone-400">{{ formatDate(row.created_at) }}</td>
            <td class="py-3 px-4">
              <div class="flex items-center gap-1">
                <UButton icon="i-heroicons-pencil-square" color="amber" variant="ghost" size="xs" title="编辑" @click="openEditModal(row)" />
                <UButton icon="i-heroicons-trash" color="red" variant="ghost" size="xs" title="删除" :loading="row._deleting" @click="deletePet(row)" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="total > pageSize" class="flex justify-center py-4 border-t border-stone-100">
        <UPagination v-model="page" :page-count="pageSize" :total="total" @update:model-value="loadList" />
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <div v-if="modal.show" class="fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-[440px] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 class="font-semibold text-stone-800">编辑宠物档案</h3>

        <div class="space-y-3">
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">宠物名称 *</label>
            <UInput v-model="modal.name" placeholder="宠物名称" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-stone-500 font-medium block mb-1">物种</label>
              <UInput v-model="modal.species" placeholder="cat / dog" />
            </div>
            <div>
              <label class="text-xs text-stone-500 font-medium block mb-1">品种</label>
              <UInput v-model="modal.breed" placeholder="品种" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-stone-500 font-medium block mb-1">性别</label>
              <select v-model.number="modal.gender" class="w-full border rounded-lg px-3 py-2 text-sm text-stone-700 bg-white" style="border-color: #e5e7eb">
                <option :value="0">未知</option>
                <option :value="1">男</option>
                <option :value="2">女</option>
              </select>
            </div>
            <div>
              <label class="text-xs text-stone-500 font-medium block mb-1">出生日期</label>
              <UInput v-model="modal.birthday" type="date" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-stone-500 font-medium block mb-1">体重(kg)</label>
              <UInput v-model.number="modal.weight" type="number" placeholder="0" />
            </div>
            <div>
              <label class="text-xs text-stone-500 font-medium block mb-1">关联设备ID</label>
              <UInput v-model="modal.deviceId" placeholder="可选" />
            </div>
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">简介</label>
            <UInput v-model="modal.bio" placeholder="宠物简介" />
          </div>
        </div>

        <div class="flex gap-2 pt-2">
          <UButton label="取消" color="gray" variant="outline" class="flex-1" @click="modal.show = false" />
          <UButton label="保存修改" color="amber" class="flex-1" :loading="modal.saving" :disabled="!modal.name.trim()" @click="saveModal" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminPets' })
definePageMeta({ layout: 'admin' })

const toast = useToast()

const keyword  = ref('')
const userId   = ref('')
const page     = ref(1)
const pageSize = 20
const list     = ref<any[]>([])
const total    = ref(0)
const loading  = ref(false)

async function loadList() {
  loading.value = true
  try {
    const d = await $fetch<any>('/api/admin/pets/list', {
      query: { keyword: keyword.value, userId: userId.value, page: page.value, limit: pageSize },
    })
    list.value = d.list
    total.value = d.total
  } finally { loading.value = false }
}

function reset() { keyword.value = ''; userId.value = ''; page.value = 1; loadList() }

const modal = reactive({
  show: false,
  editingId: '',
  name: '',
  species: '',
  breed: '',
  gender: 0,
  birthday: '',
  weight: 0,
  bio: '',
  deviceId: '',
  saving: false,
})

function openEditModal(row: any) {
  Object.assign(modal, {
    show: true,
    editingId: row.id,
    name: row.name || '',
    species: row.species || '',
    breed: row.breed || '',
    gender: Number(row.gender) || 0,
    birthday: row.birthday || '',
    weight: Number(row.weight) || 0,
    bio: row.bio || '',
    deviceId: row.device_id || '',
  })
}

async function saveModal() {
  if (!modal.name.trim()) return toast.add({ title: '请填写宠物名称', color: 'red' })
  modal.saving = true
  try {
    await $fetch(`/api/admin/pets/${modal.editingId}`, {
      method: 'PUT',
      body: {
        name: modal.name.trim(),
        species: modal.species || null,
        breed: modal.breed || null,
        gender: modal.gender,
        birthday: modal.birthday || null,
        weight: modal.weight || null,
        bio: modal.bio || null,
        deviceId: modal.deviceId || null,
      },
    })
    modal.show = false
    toast.add({ title: '已更新', color: 'green' })
    await loadList()
  } catch (err: any) {
    toast.add({ title: err?.data?.message || '保存失败', color: 'red' })
  } finally { modal.saving = false }
}

async function deletePet(row: any) {
  if (!confirm(`确定删除宠物「${row.name}」？`)) return
  row._deleting = true
  try {
    await $fetch(`/api/admin/pets/${row.id}`, { method: 'DELETE' })
    list.value = list.value.filter(x => x.id !== row.id)
    total.value--
    toast.add({ title: '已删除', color: 'green' })
  } catch (err: any) {
    toast.add({ title: err?.data?.message || '删除失败', color: 'red' })
  } finally { row._deleting = false }
}

function formatDate(s: string) { return s ? new Date(s).toLocaleDateString('zh-CN') : '-' }

onMounted(loadList)
</script>
