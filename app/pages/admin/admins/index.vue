<template>
  <div class="space-y-4">

    <!-- 顶部：搜索 + 新增 -->
    <div class="flex items-center gap-3">
      <input
        v-model="keyword"
        type="text"
        placeholder="搜索账号 / 昵称"
        class="w-64 px-3.5 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-300 transition"
        style="border-color:#e2d9d0"
        @keyup.enter="page = 1; loadData()"
      />
      <div class="flex-1" />
      <button
        class="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
        style="background:linear-gradient(135deg,#f59e0b,#ea580c);box-shadow:0 2px 8px rgba(245,158,11,0.3)"
        @click="openAdd"
      >
        <UIcon name="i-heroicons-plus" class="w-4 h-4" />
        新增管理员
      </button>
    </div>

    <!-- 列表 -->
    <div class="bg-white rounded-2xl border overflow-hidden" style="border-color:#f0e6d8;box-shadow:0 1px 4px rgba(0,0,0,0.04)">

      <div class="grid px-5 py-2.5 border-b text-xs font-semibold text-stone-400 uppercase tracking-wide"
        style="grid-template-columns:1fr 100px 100px 160px 140px;border-color:#f0e6d8;background:#faf8f5">
        <span>账号 / 昵称</span>
        <span class="text-center">角色</span>
        <span class="text-center">状态</span>
        <span>最近登录</span>
        <span class="text-right">操作</span>
      </div>

      <div v-if="loading" class="flex items-center justify-center py-16">
        <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-amber-400 animate-spin" />
      </div>

      <div v-else-if="!list.length" class="flex flex-col items-center justify-center py-16 text-stone-400">
        <span class="text-4xl mb-3">🛡️</span>
        <p class="text-sm">暂无管理员，点击「新增管理员」添加</p>
      </div>

      <template v-else>
        <div v-for="item in list" :key="item.id"
          class="grid px-5 py-3.5 border-b items-center hover:bg-amber-50/30 transition-colors"
          style="grid-template-columns:1fr 100px 100px 160px 140px;border-color:#f5ede4">

          <div class="min-w-0 pr-4">
            <p class="text-sm font-medium text-stone-700 truncate">{{ item.username }}</p>
            <p class="text-xs text-stone-400 truncate mt-0.5">{{ item.nickname || '—' }}</p>
          </div>

          <div class="flex justify-center">
            <span class="inline-block px-2.5 py-1 rounded-full text-xs font-semibold"
              :style="item.role==='super_admin' ? 'background:#fef3c7;color:#92400e' : 'background:#e0f2fe;color:#075985'">
              {{ item.role==='super_admin' ? '超级管理员' : '普通管理员' }}
            </span>
          </div>

          <div class="flex justify-center">
            <button class="px-2.5 py-1 rounded-full text-xs font-medium border transition-all"
              :disabled="item.id === myAdminId"
              :style="item.status===1 ? 'background:#d1fae5;color:#065f46;border-color:#a7f3d0' : 'background:#fef2f2;color:#991b1b;border-color:#fecaca'"
              @click="toggleStatus(item)">
              {{ item.status===1 ? '正常' : '禁用' }}
            </button>
          </div>

          <div class="text-xs text-stone-500">
            {{ item.last_login_at ? new Date(item.last_login_at).toLocaleString('zh-CN') : '从未登录' }}
          </div>

          <div class="flex items-center justify-end gap-1">
            <button class="w-7 h-7 rounded-lg flex items-center justify-center text-stone-400 hover:text-amber-600 hover:bg-amber-50 transition-all" title="编辑" @click="openEdit(item)">
              <UIcon name="i-heroicons-pencil-square" class="w-4 h-4" />
            </button>
            <button
              class="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
              :class="item.id === myAdminId ? 'text-stone-200 cursor-not-allowed' : 'text-stone-400 hover:text-red-500 hover:bg-red-50'"
              :disabled="item.id === myAdminId"
              title="删除"
              @click="confirmDelete(item)"
            >
              <UIcon name="i-heroicons-trash" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- 分页 -->
    <div v-if="totalPages > 1" class="flex items-center justify-center gap-2">
      <button :disabled="page===1" class="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40 hover:bg-stone-50 transition-all" style="border-color:#e2d9d0" @click="page--;loadData()">上一页</button>
      <span class="text-sm text-stone-500">{{ page }} / {{ totalPages }}</span>
      <button :disabled="page===totalPages" class="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40 hover:bg-stone-50 transition-all" style="border-color:#e2d9d0" @click="page++;loadData()">下一页</button>
    </div>

  </div>

  <!-- ═══ 新增/编辑弹窗 ═══ -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modal.show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="closeModal" />
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" style="border:1px solid #f0e6d8">

          <div class="flex items-center justify-between mb-5">
            <p class="font-bold text-stone-800">{{ modal.isEdit ? '编辑管理员' : '新增管理员' }}</p>
            <button class="text-stone-400 hover:text-stone-600" @click="closeModal">
              <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
            </button>
          </div>

          <div class="space-y-4">
            <div v-if="!modal.isEdit">
              <label class="text-xs font-semibold text-stone-500 mb-1.5 block">登录账号 <span class="text-red-400">*</span></label>
              <input v-model="form.username" type="text" placeholder="登录用户名"
                class="w-full px-3.5 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-300 transition"
                style="border-color:#e2d9d0" />
            </div>

            <div>
              <label class="text-xs font-semibold text-stone-500 mb-1.5 block">昵称</label>
              <input v-model="form.nickname" type="text" placeholder="显示昵称"
                class="w-full px-3.5 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-300 transition"
                style="border-color:#e2d9d0" />
            </div>

            <div>
              <label class="text-xs font-semibold text-stone-500 mb-1.5 block">
                {{ modal.isEdit ? '重置密码（留空则不修改）' : '登录密码' }} <span v-if="!modal.isEdit" class="text-red-400">*</span>
              </label>
              <input v-model="form.password" type="password" placeholder="至少6位"
                class="w-full px-3.5 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-300 transition"
                style="border-color:#e2d9d0" />
            </div>

            <div v-if="!(modal.isEdit && modal.editId === myAdminId)">
              <label class="text-xs font-semibold text-stone-500 mb-1.5 block">角色</label>
              <div class="flex gap-1.5">
                <button class="px-3 py-2.5 rounded-xl text-xs font-medium border transition-all"
                  :style="form.role==='admin' ? 'background:#e0f2fe;border-color:#7dd3fc;color:#075985' : 'background:#faf8f5;border-color:#e2d9d0;color:#78716c'"
                  @click="form.role='admin'">普通管理员</button>
                <button class="px-3 py-2.5 rounded-xl text-xs font-medium border transition-all"
                  :style="form.role==='super_admin' ? 'background:#fef3c7;border-color:#fcd34d;color:#92400e' : 'background:#faf8f5;border-color:#e2d9d0;color:#78716c'"
                  @click="form.role='super_admin'">超级管理员</button>
              </div>
            </div>
          </div>

          <p v-if="errorMsg" class="text-xs text-red-500 mt-4">{{ errorMsg }}</p>

          <div class="flex gap-2 mt-6">
            <button class="flex-1 py-2.5 rounded-xl text-sm font-medium border text-stone-600 hover:bg-stone-50 transition-all" style="border-color:#e2d9d0" @click="closeModal">取消</button>
            <button class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style="background:linear-gradient(135deg,#f59e0b,#ea580c);box-shadow:0 2px 8px rgba(245,158,11,0.3)"
              :disabled="saving" @click="save">
              <UIcon v-if="saving" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin mr-1" />
              {{ saving ? '保存中…' : (modal.isEdit ? '保存修改' : '新增') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useHead({ title: '管理员管理 — 萌宠帮后台' })

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('admin_token')}` })
const myAdminId = ref('')

onMounted(() => {
  if (localStorage.getItem('admin_role') !== 'super_admin') {
    navigateTo('/admin')
    return
  }
  myAdminId.value = localStorage.getItem('admin_id') || ''
  loadData()
})

// ── 列表 ──────────────────────────────────────────────
const loading    = ref(false)
const list       = ref<any[]>([])
const total      = ref(0)
const page       = ref(1)
const pageSize   = 20
const keyword    = ref('')
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

async function loadData() {
  loading.value = true
  try {
    const data: any = await $fetch('/api/admin/admins', {
      params: { page: page.value, pageSize, keyword: keyword.value || undefined },
      headers: authHeader(),
    })
    list.value  = data.list  ?? []
    total.value = data.total ?? 0
  } finally { loading.value = false }
}

// ── 状态 / 删除 ───────────────────────────────────────
async function toggleStatus(item: any) {
  if (item.id === myAdminId.value) return
  const s = item.status === 1 ? 2 : 1
  try {
    await $fetch(`/api/admin/admins/${item.id}`, { method: 'PUT', body: { status: s }, headers: authHeader() })
    item.status = s
  } catch (e: any) {
    alert(e.data?.message || '操作失败')
  }
}
async function confirmDelete(item: any) {
  if (item.id === myAdminId.value) return
  if (!confirm(`确定删除管理员「${item.username}」？`)) return
  try {
    await $fetch(`/api/admin/admins/${item.id}`, { method: 'DELETE', headers: authHeader() })
    await loadData()
  } catch (e: any) {
    alert(e.data?.message || '删除失败')
  }
}

// ── 弹窗表单 ──────────────────────────────────────────
const modal    = reactive({ show: false, isEdit: false, editId: '' as string })
const saving   = ref(false)
const errorMsg = ref('')
const form     = reactive({ username: '', nickname: '', password: '', role: 'admin' })

function openAdd() {
  form.username = ''; form.nickname = ''; form.password = ''; form.role = 'admin'
  modal.isEdit = false; modal.editId = ''; modal.show = true; errorMsg.value = ''
}
function openEdit(item: any) {
  form.username = item.username; form.nickname = item.nickname || ''; form.password = ''
  form.role = item.role
  modal.isEdit = true; modal.editId = item.id; modal.show = true; errorMsg.value = ''
}
function closeModal() { modal.show = false }

async function save() {
  errorMsg.value = ''
  if (!modal.isEdit && !form.username.trim()) { errorMsg.value = '请填写登录账号'; return }
  if (!modal.isEdit && form.password.length < 6) { errorMsg.value = '密码长度至少6位'; return }

  saving.value = true
  try {
    if (modal.isEdit) {
      const body: any = { nickname: form.nickname.trim() }
      if (modal.editId !== myAdminId.value) body.role = form.role
      if (form.password) body.password = form.password
      await $fetch(`/api/admin/admins/${modal.editId}`, { method: 'PUT', body, headers: authHeader() })
    } else {
      await $fetch('/api/admin/admins', {
        method: 'POST',
        body: { username: form.username.trim(), nickname: form.nickname.trim(), password: form.password, role: form.role },
        headers: authHeader(),
      })
    }
    closeModal(); await loadData()
  } catch (e: any) {
    errorMsg.value = e.data?.message || '保存失败'
  } finally { saving.value = false }
}
</script>

<style scoped>
.modal-enter-active,.modal-leave-active{transition:all 0.2s ease}
.modal-enter-from,.modal-leave-to{opacity:0;transform:scale(0.96)}
</style>
