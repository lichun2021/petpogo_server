<template>
  <div class="space-y-5">
    <!-- 顶部标题 -->
    <div class="flex items-center gap-3 flex-wrap">
      <AdminPageTitle class="flex items-center gap-2">
        <UIcon name="i-heroicons-sparkles" class="w-5 h-5 text-primary" />
        电子宠物环境编辑
      </AdminPageTitle>
    </div>

    <!-- 子模块 Tab -->
    <div class="flex items-center gap-2 flex-wrap">
      <button
        v-for="t in tabs" :key="t.key"
        :class="[
          'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
          activeTab === t.key
            ? 'bg-primary/10 text-primary font-medium'
            : 'bg-white border text-stone-500 hover:text-stone-700 hover:border-primary/30'
        ]"
        style="border-color: #e7e5e4"
        @click="activeTab = t.key"
      >{{ t.label }}</button>
    </div>

    <!-- ═══════════ 背景 ═══════════ -->
    <div v-if="activeTab === 'background'" class="space-y-3">
      <div class="flex justify-end">
        <UButton label="新建背景" icon="i-heroicons-plus" color="primary" size="sm" @click="openBgModal()" />
      </div>
      <div class="bg-white rounded-xl border overflow-hidden" style="border-color: #e7e5e4">
        <div v-if="bgLoading" class="flex justify-center py-10"><UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-stone-500 animate-spin" /></div>
        <div v-else-if="!backgrounds.length" class="py-10 text-center text-sm text-stone-500">暂无背景资源</div>
        <div v-else>
          <div class="grid grid-cols-[64px_1fr_100px_140px] gap-3 px-4 py-2 bg-stone-50 border-b border-stone-200 text-sm text-stone-500 font-medium">
            <span>预览</span><span>名称</span><span>状态</span><span>操作</span>
          </div>
          <div v-for="b in backgrounds" :key="b.id" class="grid grid-cols-[64px_1fr_100px_140px] gap-3 px-4 py-3 border-b border-stone-100 hover:bg-primary/5 items-center">
            <div class="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 flex items-center justify-center">
              <img v-if="b.image_url" :src="b.image_url" class="w-full h-full object-cover" />
              <UIcon v-else name="i-heroicons-photo" class="w-5 h-5 text-stone-300" />
            </div>
            <span class="text-sm text-stone-700 font-medium">{{ b.name }}</span>
            <UBadge :label="b.enabled ? '启用' : '停用'" :color="b.enabled ? 'success' : 'neutral'" variant="subtle" size="xs" class="w-fit" />
            <div class="flex items-center gap-1">
              <UButton icon="i-heroicons-pencil-square" color="primary" variant="ghost" size="xs" @click="openBgModal(b)" />
              <UButton icon="i-heroicons-trash" color="error" variant="ghost" size="xs" :loading="b._deleting" @click="deleteBg(b)" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════ 形象 GLB ═══════════ -->
    <div v-if="activeTab === 'model'" class="space-y-3">
      <div class="flex justify-end">
        <UButton label="新建形象" icon="i-heroicons-plus" color="primary" size="sm" @click="openModelModal()" />
      </div>
      <div class="bg-white rounded-xl border overflow-hidden" style="border-color: #e7e5e4">
        <div v-if="modelLoading" class="flex justify-center py-10"><UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-stone-500 animate-spin" /></div>
        <div v-else-if="!models.length" class="py-10 text-center text-sm text-stone-500">暂无形象资源</div>
        <div v-else>
          <div class="grid grid-cols-[64px_1fr_100px_140px] gap-3 px-4 py-2 bg-stone-50 border-b border-stone-200 text-sm text-stone-500 font-medium">
            <span>缩略图</span><span>名称</span><span>状态</span><span>操作</span>
          </div>
          <div v-for="m in models" :key="m.id" class="grid grid-cols-[64px_1fr_100px_140px] gap-3 px-4 py-3 border-b border-stone-100 hover:bg-primary/5 items-center">
            <div class="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 flex items-center justify-center">
              <img v-if="m.thumbnail_url" :src="m.thumbnail_url" class="w-full h-full object-cover" />
              <UIcon v-else name="i-heroicons-cube" class="w-5 h-5 text-stone-300" />
            </div>
            <div class="min-w-0">
              <p class="text-sm text-stone-700 font-medium truncate">{{ m.name }}</p>
              <a :href="m.glb_url" target="_blank" class="text-xs text-primary hover:underline">GLB 直链 ↗</a>
            </div>
            <UBadge :label="m.enabled ? '启用' : '停用'" :color="m.enabled ? 'success' : 'neutral'" variant="subtle" size="xs" class="w-fit" />
            <div class="flex items-center gap-1">
              <UButton icon="i-heroicons-pencil-square" color="primary" variant="ghost" size="xs" @click="openModelModal(m)" />
              <UButton icon="i-heroicons-trash" color="error" variant="ghost" size="xs" :loading="m._deleting" @click="deleteModel(m)" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════ GLB 动作标识库 ═══════════ -->
    <div v-if="activeTab === 'glbAction'" class="space-y-3">
      <p class="text-xs text-stone-500">
        动作是内嵌在各宠物形象 GLB 模型里的动画片段（clip），所有形象通用同一套命名，这里只登记「标识码」供互动类型/硬件动作码引用，不上传文件。标识码需与制作模型时约定的动画片段名一致。
      </p>
      <div class="flex justify-end">
        <UButton label="新建动作标识" icon="i-heroicons-plus" color="primary" size="sm" @click="openGlbModal()" />
      </div>
      <div class="bg-white rounded-xl border overflow-hidden" style="border-color: #e7e5e4">
        <div v-if="glbLoading" class="flex justify-center py-10"><UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-stone-500 animate-spin" /></div>
        <div v-else-if="!glbActions.length" class="py-10 text-center text-sm text-stone-500">暂无动作标识</div>
        <div v-else>
          <div class="grid grid-cols-[1fr_1fr_100px_140px] gap-3 px-4 py-2 bg-stone-50 border-b border-stone-200 text-sm text-stone-500 font-medium">
            <span>标识码</span><span>显示名称</span><span>状态</span><span>操作</span>
          </div>
          <div v-for="g in glbActions" :key="g.id" class="grid grid-cols-[1fr_1fr_100px_140px] gap-3 px-4 py-3 border-b border-stone-100 hover:bg-primary/5 items-center">
            <span class="text-sm text-stone-700 font-mono">{{ g.code }}</span>
            <span class="text-sm text-stone-700">{{ g.name }}</span>
            <UBadge :label="g.enabled ? '启用' : '停用'" :color="g.enabled ? 'success' : 'neutral'" variant="subtle" size="xs" class="w-fit" />
            <div class="flex items-center gap-1">
              <UButton icon="i-heroicons-pencil-square" color="primary" variant="ghost" size="xs" @click="openGlbModal(g)" />
              <UButton icon="i-heroicons-trash" color="error" variant="ghost" size="xs" :loading="g._deleting" @click="deleteGlb(g)" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════ 互动类型 ═══════════ -->
    <div v-if="activeTab === 'interaction'" class="space-y-3">
      <div class="flex justify-end">
        <UButton label="新建互动类型" icon="i-heroicons-plus" color="primary" size="sm" @click="openInteractionModal()" />
      </div>
      <div class="bg-white rounded-xl border overflow-hidden" style="border-color: #e7e5e4">
        <div v-if="interactionLoading" class="flex justify-center py-10"><UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-stone-500 animate-spin" /></div>
        <div v-else-if="!interactionTypes.length" class="py-10 text-center text-sm text-stone-500">暂无互动类型</div>
        <div v-else>
          <div class="grid grid-cols-[1fr_1fr_180px_100px_140px] gap-3 px-4 py-2 bg-stone-50 border-b border-stone-200 text-sm text-stone-500 font-medium">
            <span>名称</span><span>关联动作标识</span><span>属性效果</span><span>状态</span><span>操作</span>
          </div>
          <div v-for="it in interactionTypes" :key="it.id" class="grid grid-cols-[1fr_1fr_180px_100px_140px] gap-3 px-4 py-3 border-b border-stone-100 hover:bg-primary/5 items-center">
            <div>
              <p class="text-sm text-stone-700 font-medium">{{ it.name }}</p>
              <p class="text-xs text-stone-500 font-mono">{{ it.code }}</p>
            </div>
            <span class="text-xs text-stone-500 truncate">{{ it.glb_action_code ? `${it.glb_action_name}（${it.glb_action_code}）` : '未映射' }}</span>
            <div class="flex gap-2 text-xs">
              <span class="text-primary">饱腹{{ fmtDelta(it.satiety_delta) }}</span>
              <span class="text-pink-600">心情{{ fmtDelta(it.mood_delta) }}</span>
              <span class="text-sky-600">清洁{{ fmtDelta(it.cleanliness_delta) }}</span>
            </div>
            <UBadge :label="it.enabled ? '启用' : '停用'" :color="it.enabled ? 'success' : 'neutral'" variant="subtle" size="xs" class="w-fit" />
            <div class="flex items-center gap-1">
              <UButton icon="i-heroicons-pencil-square" color="primary" variant="ghost" size="xs" @click="openInteractionModal(it)" />
              <UButton icon="i-heroicons-trash" color="error" variant="ghost" size="xs" :loading="it._deleting" @click="deleteInteraction(it)" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── 背景弹窗 ── -->
    <AdminFormModal v-model:open="bgModal.show" :title="bgModal.editingId ? '编辑背景' : '新建背景'" :busy="bgModal.uploading || bgModal.saving">
      <div class="space-y-4">
          <div>
            <label class="text-sm text-stone-600 font-medium block mb-1">名称 *</label>
            <UInput v-model="bgModal.name" placeholder="背景名称" />
          </div>
          <div>
            <label class="text-sm text-stone-600 font-medium block mb-1">背景图 *</label>
            <div class="flex items-center gap-3">
              <div class="w-14 h-14 rounded-xl bg-stone-100 flex items-center justify-center overflow-hidden border border-dashed border-stone-300">
                <img v-if="bgModal.preview" :src="bgModal.preview" class="w-full h-full object-cover" />
                <UIcon v-else name="i-heroicons-photo" class="w-6 h-6 text-stone-300" />
              </div>
              <div class="flex-1">
                <input ref="bgFileInput" type="file" accept="image/*" class="hidden" @change="onBgFilePick" />
                <UButton :label="bgModal.imageUrl ? '已上传 ✓' : '选择图片'" :color="bgModal.imageUrl ? 'success' : 'neutral'" variant="outline" size="sm" :loading="bgModal.uploading" @click="bgFileInput?.click()" />
              </div>
            </div>
          </div>
          <div v-if="bgModal.editingId">
            <label class="text-sm text-stone-600 font-medium block mb-1">状态</label>
            <div class="flex gap-2">
              <button :class="stateBtnCls(bgModal.enabled === 1)" @click="bgModal.enabled = 1">✓ 启用</button>
              <button :class="stateBtnCls(bgModal.enabled === 0)" @click="bgModal.enabled = 0">× 停用</button>
            </div>
          </div>
        </div>
      <template #footer>
        <UButton label="取消" color="neutral" variant="ghost" class="min-w-20" @click="bgModal.show = false" :disabled="bgModal.uploading || bgModal.saving" />
        <UButton :label="bgModal.editingId ? '保存修改' : '创建'" color="primary" class="min-w-20" :loading="bgModal.saving" @click="saveBg" />
      </template>
    </AdminFormModal>

    <!-- ── 形象弹窗 ── -->
    <AdminFormModal v-model:open="modelModal.show" :title="modelModal.editingId ? '编辑形象' : '新建形象'" :busy="modelModal.thumbUploading || modelModal.glbUploading || modelModal.saving">
      <div class="space-y-4">
          <div>
            <label class="text-sm text-stone-600 font-medium block mb-1">名称 *</label>
            <UInput v-model="modelModal.name" placeholder="形象名称" />
          </div>
          <div>
            <label class="text-sm text-stone-600 font-medium block mb-1">预览缩略图</label>
            <div class="flex items-center gap-3">
              <div class="w-14 h-14 rounded-xl bg-stone-100 flex items-center justify-center overflow-hidden border border-dashed border-stone-300">
                <img v-if="modelModal.thumbPreview" :src="modelModal.thumbPreview" class="w-full h-full object-cover" />
                <UIcon v-else name="i-heroicons-photo" class="w-6 h-6 text-stone-300" />
              </div>
              <input ref="modelThumbInput" type="file" accept="image/*" class="hidden" @change="onModelThumbPick" />
              <UButton label="选择缩略图" color="neutral" variant="outline" size="sm" :loading="modelModal.thumbUploading" @click="modelThumbInput?.click()" />
            </div>
          </div>
          <div>
            <label class="text-sm text-stone-600 font-medium block mb-1">GLB 文件 *</label>
            <div class="flex items-center gap-3">
              <input ref="modelGlbInput" type="file" accept=".glb" class="hidden" @change="onModelGlbPick" />
              <UButton :label="modelModal.glbUrl ? '已上传 ✓' : '选择 GLB 文件'" :color="modelModal.glbUrl ? 'success' : 'neutral'" variant="outline" size="sm" :loading="modelModal.glbUploading" @click="modelGlbInput?.click()" />
            </div>
          </div>
          <div v-if="modelModal.editingId">
            <label class="text-sm text-stone-600 font-medium block mb-1">状态</label>
            <div class="flex gap-2">
              <button :class="stateBtnCls(modelModal.enabled === 1)" @click="modelModal.enabled = 1">✓ 启用</button>
              <button :class="stateBtnCls(modelModal.enabled === 0)" @click="modelModal.enabled = 0">× 停用</button>
            </div>
          </div>
        </div>
      <template #footer>
        <UButton label="取消" color="neutral" variant="ghost" class="min-w-20" @click="modelModal.show = false" :disabled="modelModal.thumbUploading || modelModal.glbUploading || modelModal.saving" />
        <UButton :label="modelModal.editingId ? '保存修改' : '创建'" color="primary" class="min-w-20" :loading="modelModal.saving" @click="saveModel" />
      </template>
    </AdminFormModal>

    <!-- ── GLB 动作标识弹窗 ── -->
    <AdminFormModal v-model:open="glbModal.show" :title="glbModal.editingId ? '编辑动作标识' : '新建动作标识'" :busy="glbModal.saving">
      <div class="space-y-4">
          <div v-if="!glbModal.editingId">
            <label class="text-sm text-stone-600 font-medium block mb-1">标识码 *（创建后不可改，需与模型内动画片段名一致）</label>
            <UInput v-model="glbModal.code" placeholder="如：lying / feed" />
          </div>
          <div>
            <label class="text-sm text-stone-600 font-medium block mb-1">显示名称 *</label>
            <UInput v-model="glbModal.name" placeholder="如：躺卧动画、喂食反馈动画" />
          </div>
          <div v-if="glbModal.editingId">
            <label class="text-sm text-stone-600 font-medium block mb-1">状态</label>
            <div class="flex gap-2">
              <button :class="stateBtnCls(glbModal.enabled === 1)" @click="glbModal.enabled = 1">✓ 启用</button>
              <button :class="stateBtnCls(glbModal.enabled === 0)" @click="glbModal.enabled = 0">× 停用</button>
            </div>
          </div>
        </div>
      <template #footer>
        <UButton label="取消" color="neutral" variant="ghost" class="min-w-20" @click="glbModal.show = false" :disabled="glbModal.saving" />
        <UButton :label="glbModal.editingId ? '保存修改' : '创建'" color="primary" class="min-w-20" :loading="glbModal.saving" @click="saveGlb" />
      </template>
    </AdminFormModal>

    <!-- ── 互动类型弹窗 ── -->
    <AdminFormModal v-model:open="interactionModal.show" :title="interactionModal.editingId ? '编辑互动类型' : '新建互动类型'" :busy="interactionModal.saving">
      <div class="space-y-4">
          <div v-if="!interactionModal.editingId">
            <label class="text-sm text-stone-600 font-medium block mb-1">标识码 *（创建后不可改）</label>
            <UInput v-model="interactionModal.code" placeholder="如：feed / play / clean" />
          </div>
          <div>
            <label class="text-sm text-stone-600 font-medium block mb-1">名称 *</label>
            <UInput v-model="interactionModal.name" placeholder="显示名称" />
          </div>
          <div>
            <label class="text-sm text-stone-600 font-medium block mb-1">关联 GLB 动作资源</label>
            <select v-model="interactionModal.glbActionId" class="admin-select w-full border rounded-lg px-3 py-2 text-sm text-stone-700 bg-white" style="border-color: #e5e7eb">
              <option value="">未映射</option>
              <option v-for="g in glbActions" :key="g.id" :value="g.id">{{ g.name }}（{{ g.code }}）</option>
            </select>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div>
              <label class="text-sm text-stone-600 font-medium block mb-1">饱腹度增减</label>
              <UInput v-model.number="interactionModal.satietyDelta" type="number" />
            </div>
            <div>
              <label class="text-sm text-stone-600 font-medium block mb-1">心情值增减</label>
              <UInput v-model.number="interactionModal.moodDelta" type="number" />
            </div>
            <div>
              <label class="text-sm text-stone-600 font-medium block mb-1">清洁度增减</label>
              <UInput v-model.number="interactionModal.cleanlinessDelta" type="number" />
            </div>
          </div>
          <div v-if="interactionModal.editingId">
            <label class="text-sm text-stone-600 font-medium block mb-1">状态</label>
            <div class="flex gap-2">
              <button :class="stateBtnCls(interactionModal.enabled === 1)" @click="interactionModal.enabled = 1">✓ 启用</button>
              <button :class="stateBtnCls(interactionModal.enabled === 0)" @click="interactionModal.enabled = 0">× 停用</button>
            </div>
          </div>
        </div>
      <template #footer>
        <UButton label="取消" color="neutral" variant="ghost" class="min-w-20" @click="interactionModal.show = false" :disabled="interactionModal.saving" />
        <UButton :label="interactionModal.editingId ? '保存修改' : '创建'" color="primary" class="min-w-20" :loading="interactionModal.saving" @click="saveInteraction" />
      </template>
    </AdminFormModal>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminVirtualPetScenes' })
definePageMeta({ layout: 'admin' })

const toast = useToast()

const tabs = [
  { key: 'background', label: '背景' },
  { key: 'model', label: '形象 GLB' },
  { key: 'glbAction', label: 'GLB 动作库' },
  { key: 'interaction', label: '互动类型' },
]
const activeTab = ref('background')

// ── OSS 上传工具（复用统一的宠物资源上传签名接口）──────────────
async function uploadToOss(file: File, folder: 'pet-background' | 'pet-model' | 'pet-glb-action', extHint?: string): Promise<string> {
  const sign = await $fetch<any>('/api/admin/pet-resources/upload-sign', {
    method: 'POST',
    body: { mimeType: file.type || 'application/octet-stream', ext: extHint, folder },
  })
  const res = await fetch(sign.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  })
  if (!res.ok) throw new Error(`OSS 上传失败: ${res.status} ${res.statusText}`)
  return sign.cdnUrl
}

function stateBtnCls(active: boolean) {
  return [
    'flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all',
    active ? 'border-green-400 bg-green-50 text-green-700' : 'border-stone-200 text-stone-500 hover:border-stone-300',
  ]
}
function fmtDelta(v: number) {
  const n = Number(v) || 0
  return n > 0 ? `+${n}` : `${n}`
}

// ═══════════ 背景 ═══════════
const backgrounds = ref<any[]>([])
const bgLoading   = ref(false)
const bgFileInput = ref<HTMLInputElement | null>(null)
const bgModal = reactive({ show: false, editingId: '', name: '', imageUrl: '', preview: '', enabled: 1, uploading: false, saving: false })

async function loadBackgrounds() {
  bgLoading.value = true
  try { backgrounds.value = (await $fetch<any>('/api/admin/pet-backgrounds/list')).list }
  finally { bgLoading.value = false }
}
function openBgModal(b?: any) {
  if (b) Object.assign(bgModal, { show: true, editingId: b.id, name: b.name, imageUrl: b.image_url, preview: b.image_url, enabled: b.enabled ? 1 : 0 })
  else Object.assign(bgModal, { show: true, editingId: '', name: '', imageUrl: '', preview: '', enabled: 1 })
}
async function onBgFilePick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  bgModal.uploading = true
  bgModal.imageUrl = ''
  try {
    bgModal.preview = URL.createObjectURL(file)
    bgModal.imageUrl = await uploadToOss(file, 'pet-background')
  } catch (err: any) { toast.add({ title: `上传失败: ${err?.message || '未知错误'}`, color: 'error' }) }
  finally { bgModal.uploading = false }
}
async function saveBg() {
  if (!bgModal.name.trim()) return toast.add({ title: '请填写名称', color: 'error' })
  if (!bgModal.imageUrl) return toast.add({ title: '请上传背景图', color: 'error' })
  bgModal.saving = true
  try {
    const body = { name: bgModal.name.trim(), image_url: bgModal.imageUrl, enabled: bgModal.enabled }
    if (bgModal.editingId) await $fetch(`/api/admin/pet-backgrounds/${bgModal.editingId}`, { method: 'PUT', body })
    else await $fetch('/api/admin/pet-backgrounds/create', { method: 'POST', body })
    bgModal.show = false
    toast.add({ title: '保存成功', color: 'success' })
    await loadBackgrounds()
  } catch (err: any) { toast.add({ title: err?.data?.message || '保存失败', color: 'error' }) }
  finally { bgModal.saving = false }
}
async function deleteBg(b: any) {
  if (!confirm(`确定删除背景「${b.name}」？`)) return
  b._deleting = true
  try { await $fetch(`/api/admin/pet-backgrounds/${b.id}`, { method: 'DELETE' }); await loadBackgrounds() }
  finally { b._deleting = false }
}

// ═══════════ 形象 GLB ═══════════
const models = ref<any[]>([])
const modelLoading = ref(false)
const modelThumbInput = ref<HTMLInputElement | null>(null)
const modelGlbInput = ref<HTMLInputElement | null>(null)
const modelModal = reactive({ show: false, editingId: '', name: '', glbUrl: '', thumbUrl: '', thumbPreview: '', enabled: 1, thumbUploading: false, glbUploading: false, saving: false })

async function loadModels() {
  modelLoading.value = true
  try { models.value = (await $fetch<any>('/api/admin/pet-models/list')).list }
  finally { modelLoading.value = false }
}
function openModelModal(m?: any) {
  if (m) Object.assign(modelModal, { show: true, editingId: m.id, name: m.name, glbUrl: m.glb_url, thumbUrl: m.thumbnail_url || '', thumbPreview: m.thumbnail_url || '', enabled: m.enabled ? 1 : 0 })
  else Object.assign(modelModal, { show: true, editingId: '', name: '', glbUrl: '', thumbUrl: '', thumbPreview: '', enabled: 1 })
}
async function onModelThumbPick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  modelModal.thumbUploading = true
  try {
    modelModal.thumbPreview = URL.createObjectURL(file)
    modelModal.thumbUrl = await uploadToOss(file, 'pet-model')
  } catch (err: any) { toast.add({ title: `上传失败: ${err?.message || '未知错误'}`, color: 'error' }) }
  finally { modelModal.thumbUploading = false }
}
async function onModelGlbPick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  modelModal.glbUploading = true
  modelModal.glbUrl = ''
  try { modelModal.glbUrl = await uploadToOss(file, 'pet-model', 'glb') }
  catch (err: any) { toast.add({ title: `上传失败: ${err?.message || '未知错误'}`, color: 'error' }) }
  finally { modelModal.glbUploading = false }
}
async function saveModel() {
  if (!modelModal.name.trim()) return toast.add({ title: '请填写名称', color: 'error' })
  if (!modelModal.glbUrl) return toast.add({ title: '请上传 GLB 文件', color: 'error' })
  modelModal.saving = true
  try {
    const body = { name: modelModal.name.trim(), glb_url: modelModal.glbUrl, thumbnail_url: modelModal.thumbUrl || null, enabled: modelModal.enabled }
    if (modelModal.editingId) await $fetch(`/api/admin/pet-models/${modelModal.editingId}`, { method: 'PUT', body })
    else await $fetch('/api/admin/pet-models/create', { method: 'POST', body })
    modelModal.show = false
    toast.add({ title: '保存成功', color: 'success' })
    await loadModels()
  } catch (err: any) { toast.add({ title: err?.data?.message || '保存失败', color: 'error' }) }
  finally { modelModal.saving = false }
}
async function deleteModel(m: any) {
  if (!confirm(`确定删除形象「${m.name}」？`)) return
  m._deleting = true
  try { await $fetch(`/api/admin/pet-models/${m.id}`, { method: 'DELETE' }); await loadModels() }
  finally { m._deleting = false }
}

// ═══════════ GLB 动作标识库（不上传文件，只登记模型内动画片段名）═══════════
const glbActions = ref<any[]>([])
const glbLoading = ref(false)
const glbModal = reactive({ show: false, editingId: '', code: '', name: '', enabled: 1, saving: false })

async function loadGlbActions() {
  glbLoading.value = true
  try { glbActions.value = (await $fetch<any>('/api/admin/pet-glb-actions/list')).list }
  finally { glbLoading.value = false }
}
function openGlbModal(g?: any) {
  if (g) Object.assign(glbModal, { show: true, editingId: g.id, code: g.code, name: g.name, enabled: g.enabled ? 1 : 0 })
  else Object.assign(glbModal, { show: true, editingId: '', code: '', name: '', enabled: 1 })
}
async function saveGlb() {
  if (!glbModal.editingId && !glbModal.code.trim()) return toast.add({ title: '请填写标识码', color: 'error' })
  if (!glbModal.name.trim()) return toast.add({ title: '请填写名称', color: 'error' })
  glbModal.saving = true
  try {
    if (glbModal.editingId) {
      await $fetch(`/api/admin/pet-glb-actions/${glbModal.editingId}`, { method: 'PUT', body: { name: glbModal.name.trim(), enabled: glbModal.enabled } })
    } else {
      await $fetch('/api/admin/pet-glb-actions/create', { method: 'POST', body: { code: glbModal.code.trim(), name: glbModal.name.trim() } })
    }
    glbModal.show = false
    toast.add({ title: '保存成功', color: 'success' })
    await loadGlbActions()
  } catch (err: any) { toast.add({ title: err?.data?.message || '保存失败', color: 'error' }) }
  finally { glbModal.saving = false }
}
async function deleteGlb(g: any) {
  if (!confirm(`确定删除动作标识「${g.name}」？关联的互动类型/硬件动作会解除映射。`)) return
  g._deleting = true
  try {
    await $fetch(`/api/admin/pet-glb-actions/${g.id}`, { method: 'DELETE' })
    await loadGlbActions()
    await loadInteractionTypes()
  } finally { g._deleting = false }
}

// ═══════════ 互动类型 ═══════════
const interactionTypes = ref<any[]>([])
const interactionLoading = ref(false)
const interactionModal = reactive({
  show: false, editingId: '', code: '', name: '', glbActionId: '',
  satietyDelta: 0, moodDelta: 0, cleanlinessDelta: 0, enabled: 1, saving: false,
})

async function loadInteractionTypes() {
  interactionLoading.value = true
  try { interactionTypes.value = (await $fetch<any>('/api/admin/pet-interaction-types/list')).list }
  finally { interactionLoading.value = false }
}
function openInteractionModal(it?: any) {
  if (it) Object.assign(interactionModal, {
    show: true, editingId: it.id, code: it.code, name: it.name,
    glbActionId: it.glb_action_id || '',
    satietyDelta: Number(it.satiety_delta) || 0, moodDelta: Number(it.mood_delta) || 0, cleanlinessDelta: Number(it.cleanliness_delta) || 0,
    enabled: it.enabled ? 1 : 0,
  })
  else Object.assign(interactionModal, {
    show: true, editingId: '', code: '', name: '', glbActionId: '',
    satietyDelta: 0, moodDelta: 0, cleanlinessDelta: 0, enabled: 1,
  })
}
async function saveInteraction() {
  if (!interactionModal.editingId && !interactionModal.code.trim()) return toast.add({ title: '请填写标识码', color: 'error' })
  if (!interactionModal.name.trim()) return toast.add({ title: '请填写名称', color: 'error' })
  interactionModal.saving = true
  try {
    const body: any = {
      name: interactionModal.name.trim(),
      glb_action_id: interactionModal.glbActionId || null,
      satiety_delta: interactionModal.satietyDelta,
      mood_delta: interactionModal.moodDelta,
      cleanliness_delta: interactionModal.cleanlinessDelta,
      enabled: interactionModal.enabled,
    }
    if (interactionModal.editingId) {
      await $fetch(`/api/admin/pet-interaction-types/${interactionModal.editingId}`, { method: 'PUT', body })
    } else {
      body.code = interactionModal.code.trim()
      await $fetch('/api/admin/pet-interaction-types/create', { method: 'POST', body })
    }
    interactionModal.show = false
    toast.add({ title: '保存成功', color: 'success' })
    await loadInteractionTypes()
  } catch (err: any) { toast.add({ title: err?.data?.message || '保存失败', color: 'error' }) }
  finally { interactionModal.saving = false }
}
async function deleteInteraction(it: any) {
  if (!confirm(`确定删除互动类型「${it.name}」？`)) return
  it._deleting = true
  try { await $fetch(`/api/admin/pet-interaction-types/${it.id}`, { method: 'DELETE' }); await loadInteractionTypes() }
  finally { it._deleting = false }
}

onMounted(async () => {
  await Promise.all([loadBackgrounds(), loadModels(), loadGlbActions(), loadInteractionTypes()])
})
</script>
