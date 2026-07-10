<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-base font-semibold text-stone-800">积分类型</h2>
        <p class="text-xs text-stone-400 mt-0.5">配置积分类型与有效期（有效期=获得后N天到期，0=永不过期）。数量在各业务页（计划/签到）单独配置</p>
      </div>
      <div class="flex gap-2">
        <UButton label="积分流水" color="gray" variant="outline" icon="i-heroicons-clipboard-document-list" to="/admin/points/logs" />
        <UButton label="积分规则" color="gray" variant="outline" icon="i-heroicons-currency-yen" to="/admin/points/rules" />
        <UButton label="新增类型" color="amber" icon="i-heroicons-plus" @click="openModal()" />
      </div>
    </div>

    <div class="bg-white rounded-2xl border overflow-hidden" style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
      <div v-if="loading" class="flex justify-center py-10">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-stone-400 animate-spin" />
      </div>
      <div v-else-if="!list.length" class="py-10 text-center text-sm text-stone-400">暂无数据</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="bg-amber-50/50 border-b border-orange-100">
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">类型标识</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">显示名称</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">有效期（天）</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">状态</th>
            <th class="text-left text-xs text-stone-500 font-medium py-3 px-4">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in list" :key="row.id" class="border-b border-stone-100 hover:bg-amber-50/30 transition-colors">
            <td class="py-3 px-4 font-mono text-xs text-stone-600">{{ row.type_code }}</td>
            <td class="py-3 px-4">{{ row.name }}</td>
            <td class="py-3 px-4">
              <span v-if="row.expire_days === 0" class="text-xs text-emerald-600 font-medium">永不过期</span>
              <span v-else>{{ row.expire_days }} 天</span>
            </td>
            <td class="py-3 px-4">
              <UBadge :label="row.status === 1 ? '启用' : '停用'" :color="row.status === 1 ? 'green' : 'red'" variant="subtle" size="xs" />
            </td>
            <td class="py-3 px-4">
              <div class="flex gap-2">
                <UButton label="编辑" color="gray" variant="subtle" size="xs" @click="openModal(row)" />
                <UButton label="删除" color="red" variant="subtle" size="xs" @click="remove(row)" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新建/编辑弹窗 -->
    <div v-if="modal.show" class="fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-96 p-6 space-y-4">
        <h3 class="font-semibold text-stone-800">{{ modal.editingId ? '编辑积分类型' : '新增积分类型' }}</h3>

        <div class="space-y-3">
          <div v-if="!modal.editingId">
            <label class="text-xs text-stone-500 font-medium block mb-1">类型标识 type_code *</label>
            <UInput v-model="modal.typeCode" placeholder="如 plan_vip / activity" />
            <p class="text-[10px] text-stone-400 mt-1">程序内引用，创建后不可改，建议用英文小写+下划线</p>
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">显示名称 *</label>
            <UInput v-model="modal.name" placeholder="如 VIP计划积分" />
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">有效期天数 *</label>
            <UInput v-model.number="modal.expireDays" type="number" :min="0" placeholder="0 = 永不过期" />
            <p class="text-[10px] text-stone-400 mt-1">每笔该类型积分从获得时刻起 N 天后到期，0 表示永久</p>
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">排序（越小越靠前）</label>
            <UInput v-model.number="modal.sortOrder" type="number" placeholder="0" />
          </div>
          <div v-if="modal.editingId">
            <label class="text-xs text-stone-500 font-medium block mb-1">状态</label>
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

        <div class="flex gap-2 pt-2">
          <UButton label="取消" color="gray" variant="outline" class="flex-1" @click="modal.show = false" />
          <UButton
            :label="modal.editingId ? '保存修改' : '创建'"
            color="amber" class="flex-1"
            :loading="modal.saving"
            :disabled="!modal.name.trim() || (!modal.editingId && !modal.typeCode.trim())"
            @click="save"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminPointsConfig' })
definePageMeta({ layout: 'admin' })

const toast   = useToast()
const loading = ref(true)
const list    = ref<any[]>([])

async function loadList() {
  loading.value = true
  try {
    const d = await $fetch<any>('/api/admin/points/config')
    list.value = d.list
  } finally {
    loading.value = false
  }
}

const modal = reactive({
  show: false,
  editingId: null as number | null,
  typeCode: '',
  name: '',
  expireDays: 7,
  sortOrder: 0,
  status: 1,
  saving: false,
})

function openModal(row?: any) {
  if (row) {
    Object.assign(modal, {
      show: true, editingId: row.id, typeCode: row.type_code, name: row.name,
      expireDays: row.expire_days, sortOrder: row.sort_order, status: row.status,
    })
  } else {
    Object.assign(modal, {
      show: true, editingId: null, typeCode: '', name: '', expireDays: 7,
      sortOrder: 0, status: 1,
    })
  }
}

async function save() {
  modal.saving = true
  try {
    const isEdit = modal.editingId != null
    const body: any = {
      name: modal.name.trim(),
      expire_days: modal.expireDays,
      sort_order: modal.sortOrder,
      status: modal.status,
    }
    if (!isEdit) body.type_code = modal.typeCode.trim()

    await $fetch(isEdit ? `/api/admin/points/config/${modal.editingId}` : '/api/admin/points/config', {
      method: isEdit ? 'PUT' : 'POST',
      body,
    })
    toast.add({ title: '保存成功', color: 'green' })
    modal.show = false
    loadList()
  } catch (e: any) {
    toast.add({ title: '保存失败', description: e?.data?.message, color: 'red' })
  } finally {
    modal.saving = false
  }
}

async function remove(row: any) {
  try {
    await $fetch(`/api/admin/points/config/${row.id}`, { method: 'DELETE' })
    toast.add({ title: '删除成功', color: 'green' })
    loadList()
  } catch (e: any) {
    toast.add({ title: '删除失败', description: e?.data?.message, color: 'red' })
  }
}

onMounted(loadList)
</script>
