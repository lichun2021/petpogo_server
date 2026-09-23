<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <AdminPageTitle>积分规则</AdminPageTitle>
        <p class="text-xs text-stone-500 mt-0.5">配置各类 AI 消费行为对应的积分单价（AI 服务上报消费时按此扣分）</p>
      </div>
      <div class="flex gap-2 flex-wrap">
        <UButton label="积分流水" color="neutral" variant="outline" icon="i-heroicons-clipboard-document-list" to="/admin/points/logs" />
        <UButton label="新增规则" color="primary" icon="i-heroicons-plus" @click="openModal()" />
      </div>
    </div>

    <div class="bg-white rounded-xl border overflow-hidden" style="border-color: #e7e5e4; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
      <div v-if="loading" class="flex justify-center py-10">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-stone-500 animate-spin" />
      </div>
      <div v-else-if="!list.length" class="py-10 text-center text-sm text-stone-500">暂无数据</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="bg-stone-50 border-b border-stone-200">
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">消费类型标识</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">展示名称</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">单价（积分）</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">计费方式</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">状态</th>
            <th class="text-left text-sm text-stone-500 font-medium py-3 px-4">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in list" :key="row.id" class="border-b border-stone-100 hover:bg-primary/5 transition-colors">
            <td class="py-3 px-4 font-mono text-xs text-stone-600">{{ row.consume_type }}</td>
            <td class="py-3 px-4">{{ row.name }}</td>
            <td class="py-3 px-4">{{ row.unit_points }}</td>
            <td class="py-3 px-4 text-xs text-stone-500">{{ row.unit_basis === 'per_call' ? '按次' : '按数量' }}</td>
            <td class="py-3 px-4">
              <UBadge :label="row.status === 1 ? '启用' : '停用'" :color="row.status === 1 ? 'success' : 'error'" variant="subtle" size="xs" />
            </td>
            <td class="py-3 px-4">
              <div class="flex gap-2">
                <UButton label="编辑" color="neutral" variant="subtle" size="xs" @click="openModal(row)" />
                <UButton label="删除" color="error" variant="subtle" size="xs" @click="remove(row)" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新建/编辑弹窗 -->
    <AdminFormModal v-model:open="modal.show" :title="modal.editingId ? '编辑积分规则' : '新增积分规则'" :busy="modal.saving">
      <div class="space-y-4">
          <div v-if="!modal.editingId">
            <label class="text-sm text-stone-600 font-medium block mb-1">消费类型标识 *</label>
            <UInput v-model="modal.consumeType" placeholder="如 image_analyze / consult_token" />
          </div>
          <div>
            <label class="text-sm text-stone-600 font-medium block mb-1">展示名称 *</label>
            <UInput v-model="modal.name" placeholder="如 图片情绪分析" />
          </div>
          <div>
            <label class="text-sm text-stone-600 font-medium block mb-1">单价（积分）*</label>
            <UInput v-model.number="modal.unitPoints" type="number" />
          </div>
          <div>
            <label class="text-sm text-stone-600 font-medium block mb-1">计费方式</label>
            <div class="flex gap-2">
              <button
                v-for="opt in [{v:'per_call',l:'按次'},{v:'per_unit',l:'按上报数量'}]" :key="opt.v"
                :class="['flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  modal.unitBasis === opt.v ? 'bg-primary text-white border-amber-500' : 'bg-white text-stone-500 border-stone-200']"
                @click="modal.unitBasis = opt.v"
              >{{ opt.l }}</button>
            </div>
          </div>
          <div>
            <label class="text-sm text-stone-600 font-medium block mb-1">排序（越小越靠前）</label>
            <UInput v-model.number="modal.sortOrder" type="number" placeholder="0" />
          </div>
          <div v-if="modal.editingId">
            <label class="text-sm text-stone-600 font-medium block mb-1">状态</label>
            <div class="flex gap-2">
              <button
                :class="['flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all', modal.status === 1 ? 'bg-green-500 text-white border-green-500' : 'bg-white text-stone-500 border-stone-200']"
                @click="modal.status = 1"
              >启用</button>
              <button
                :class="['flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all', modal.status === 0 ? 'bg-red-500 text-white border-red-500' : 'bg-white text-stone-500 border-stone-200']"
                @click="modal.status = 0"
              >停用</button>
            </div>
          </div>
        </div>
      <template #footer>
        <UButton label="取消" color="neutral" variant="ghost" class="min-w-20" @click="modal.show = false" :disabled="modal.saving" />
        <UButton
            :label="modal.editingId ? '保存修改' : '创建'"
            color="primary" class="min-w-20"
            :loading="modal.saving"
            :disabled="!modal.name.trim() || !modal.unitPoints"
            @click="save"
          />
      </template>
    </AdminFormModal>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminPointsRules' })
definePageMeta({ layout: 'admin' })

const toast   = useToast()
const loading = ref(true)
const list    = ref<any[]>([])

async function loadList() {
  loading.value = true
  try {
    const d = await $fetch<any>('/api/admin/points/rules')
    list.value = d.list
  } finally {
    loading.value = false
  }
}

const modal = reactive({
  show: false,
  editingId: null as number | null,
  consumeType: '',
  name: '',
  unitPoints: 1,
  unitBasis: 'per_call',
  sortOrder: 0,
  status: 1,
  saving: false,
})

function openModal(row?: any) {
  if (row) {
    Object.assign(modal, {
      show: true, editingId: row.id, consumeType: row.consume_type, name: row.name,
      unitPoints: row.unit_points, unitBasis: row.unit_basis, sortOrder: row.sort_order, status: row.status,
    })
  } else {
    Object.assign(modal, {
      show: true, editingId: null, consumeType: '', name: '', unitPoints: 1,
      unitBasis: 'per_call', sortOrder: 0, status: 1,
    })
  }
}

async function save() {
  modal.saving = true
  try {
    const isEdit = modal.editingId != null
    const body: any = {
      name: modal.name.trim(),
      unit_points: modal.unitPoints,
      unit_basis: modal.unitBasis,
      sort_order: modal.sortOrder,
      status: modal.status,
    }
    if (!isEdit) body.consume_type = modal.consumeType.trim()

    await $fetch(isEdit ? `/api/admin/points/rules/${modal.editingId}` : '/api/admin/points/rules', {
      method: isEdit ? 'PUT' : 'POST',
      body,
    })
    toast.add({ title: '保存成功', color: 'success' })
    modal.show = false
    loadList()
  } catch (e: any) {
    toast.add({ title: '保存失败', description: e?.data?.message, color: 'error' })
  } finally {
    modal.saving = false
  }
}

async function remove(row: any) {
  try {
    await $fetch(`/api/admin/points/rules/${row.id}`, { method: 'DELETE' })
    toast.add({ title: '删除成功', color: 'success' })
    loadList()
  } catch {
    toast.add({ title: '删除失败', color: 'error' })
  }
}

onMounted(loadList)
</script>
