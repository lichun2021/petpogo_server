<template>
  <div class="space-y-4">
    <div class="flex items-center gap-3">
      <h2 class="text-base font-bold text-stone-800 flex items-center gap-2">
        <UIcon name="i-heroicons-bolt" class="w-5 h-5 text-amber-500" />
        宠物硬件动作管理
      </h2>
      <UButton label="新建动作码" icon="i-heroicons-plus" color="amber" size="sm" class="ml-auto" @click="openModal()" />
    </div>

    <div class="bg-white rounded-2xl border overflow-hidden" style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
      <div v-if="loading" class="flex justify-center py-10"><UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-stone-400 animate-spin" /></div>
      <div v-else-if="!list.length" class="py-10 text-center text-sm text-stone-400">暂无动作码</div>
      <div v-else>
        <div class="grid grid-cols-[1fr_180px_100px_140px] gap-3 px-4 py-2 bg-amber-50/50 border-b border-orange-100 text-xs text-stone-500 font-medium">
          <span>名称 / 标识码</span><span>关联GLB动作</span><span>状态</span><span>操作</span>
        </div>
        <div v-for="h in list" :key="h.id" class="grid grid-cols-[1fr_180px_100px_140px] gap-3 px-4 py-3 border-b border-stone-100 hover:bg-amber-50/20 items-center">
          <div>
            <p class="text-sm text-stone-700 font-medium">{{ h.name }}</p>
            <p class="text-xs text-stone-400 font-mono">{{ h.code }}</p>
          </div>
          <span class="text-xs text-stone-500 truncate">{{ h.glb_action_code ? `${h.glb_action_name}（${h.glb_action_code}）` : '未映射' }}</span>
          <UBadge :label="h.enabled ? '启用' : '停用'" :color="h.enabled ? 'green' : 'gray'" variant="subtle" size="xs" class="w-fit" />
          <div class="flex items-center gap-1">
            <UButton icon="i-heroicons-pencil-square" color="amber" variant="ghost" size="xs" @click="openModal(h)" />
            <UButton icon="i-heroicons-trash" color="red" variant="ghost" size="xs" :loading="h._deleting" @click="deleteAction(h)" />
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑/新建弹窗 -->
    <div v-if="modal.show" class="fixed inset-0 z-50 flex items-center justify-center" style="background: rgba(0,0,0,0.4)">
      <div class="bg-white rounded-2xl shadow-xl w-[420px] p-6 space-y-4">
        <h3 class="font-semibold text-stone-800">{{ modal.editingId ? '编辑动作码' : '新建动作码' }}</h3>
        <div class="space-y-3">
          <div v-if="!modal.editingId">
            <label class="text-xs text-stone-500 font-medium block mb-1">标识码 *（创建后不可改）</label>
            <UInput v-model="modal.code" placeholder="如：lying / eating / jumping" />
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">显示名称 *</label>
            <UInput v-model="modal.name" placeholder="如：躺卧" />
          </div>
          <div>
            <label class="text-xs text-stone-500 font-medium block mb-1">关联 GLB 动作资源</label>
            <select v-model="modal.glbActionId" class="w-full border rounded-lg px-3 py-2 text-sm text-stone-700 bg-white" style="border-color: #e5e7eb">
              <option value="">未映射</option>
              <option v-for="g in glbActions" :key="g.id" :value="g.id">{{ g.name }}（{{ g.code }}）</option>
            </select>
          </div>
          <div v-if="modal.editingId">
            <label class="text-xs text-stone-500 font-medium block mb-1">状态</label>
            <div class="flex gap-2">
              <button :class="stateBtnCls(modal.enabled === 1)" @click="modal.enabled = 1">✓ 启用</button>
              <button :class="stateBtnCls(modal.enabled === 0)" @click="modal.enabled = 0">× 停用</button>
            </div>
          </div>
        </div>
        <div class="flex gap-2 pt-2">
          <UButton label="取消" color="gray" variant="outline" class="flex-1" @click="modal.show = false" />
          <UButton :label="modal.editingId ? '保存修改' : '创建'" color="amber" class="flex-1" :loading="modal.saving" @click="saveModal" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminVirtualPetActions' })
definePageMeta({ layout: 'admin' })

const toast = useToast()

const list = ref<any[]>([])
const glbActions = ref<any[]>([])
const loading = ref(false)

async function loadList() {
  loading.value = true
  try { list.value = (await $fetch<any>('/api/admin/pet-hardware-actions/list')).list }
  finally { loading.value = false }
}
async function loadGlbActions() {
  glbActions.value = (await $fetch<any>('/api/admin/pet-glb-actions/list')).list
}

function stateBtnCls(active: boolean) {
  return [
    'flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all',
    active ? 'border-green-400 bg-green-50 text-green-700' : 'border-stone-200 text-stone-400 hover:border-stone-300',
  ]
}

const modal = reactive({ show: false, editingId: '', code: '', name: '', glbActionId: '', enabled: 1, saving: false })

function openModal(h?: any) {
  if (h) Object.assign(modal, { show: true, editingId: h.id, code: h.code, name: h.name, glbActionId: h.glb_action_id || '', enabled: h.enabled ? 1 : 0 })
  else Object.assign(modal, { show: true, editingId: '', code: '', name: '', glbActionId: '', enabled: 1 })
}

async function saveModal() {
  if (!modal.editingId && !modal.code.trim()) return toast.add({ title: '请填写标识码', color: 'red' })
  if (!modal.name.trim()) return toast.add({ title: '请填写名称', color: 'red' })
  modal.saving = true
  try {
    const body: any = { name: modal.name.trim(), glb_action_id: modal.glbActionId || null, enabled: modal.enabled }
    if (modal.editingId) {
      await $fetch(`/api/admin/pet-hardware-actions/${modal.editingId}`, { method: 'PUT', body })
    } else {
      body.code = modal.code.trim()
      await $fetch('/api/admin/pet-hardware-actions/create', { method: 'POST', body })
    }
    modal.show = false
    toast.add({ title: '保存成功', color: 'green' })
    await loadList()
  } catch (err: any) { toast.add({ title: err?.data?.message || '保存失败', color: 'red' }) }
  finally { modal.saving = false }
}

async function deleteAction(h: any) {
  if (!confirm(`确定删除动作码「${h.name}」？删除后硬件用该状态码上报会被拒绝。`)) return
  h._deleting = true
  try { await $fetch(`/api/admin/pet-hardware-actions/${h.id}`, { method: 'DELETE' }); await loadList() }
  finally { h._deleting = false }
}

onMounted(async () => { await Promise.all([loadList(), loadGlbActions()]) })
</script>
