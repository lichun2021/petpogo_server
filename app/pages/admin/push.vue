<template>
  <div class="space-y-5">

    <!-- 页面标题 -->
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
           style="background: linear-gradient(135deg, #f59e0b, #fb923c)">
        🔔
      </div>
      <div>
        <h1 class="text-lg font-bold text-stone-800">推送测试</h1>
        <p class="text-xs text-stone-400">通过极光推送向用户发送通知</p>
      </div>
    </div>

    <!-- 主体布局 -->
    <div class="grid grid-cols-3 gap-5">

      <!-- 左侧：发送表单 -->
      <div class="col-span-2 space-y-4">

        <!-- 推送目标 -->
        <div class="bg-white rounded-2xl border p-5 space-y-4"
             style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
          <p class="text-sm font-bold text-stone-700 flex items-center gap-2">
            <span class="w-5 h-5 rounded-md bg-amber-100 flex items-center justify-center text-xs">①</span>
            推送目标
          </p>

          <!-- 目标类型 Tab -->
          <div class="flex gap-2">
            <button
              v-for="t in targetTypes" :key="t.value"
              class="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-150"
              :style="form.targetType === t.value
                ? 'background: #fef3c7; border-color: #fbbf24; color: #92400e'
                : 'background: #faf8f5; border-color: #e2d9d0; color: #6b7280'"
              @click="form.targetType = t.value"
            >
              {{ t.emoji }} {{ t.label }}
            </button>
          </div>

          <!-- alias 输入框 -->
          <div v-if="form.targetType === 'alias'" class="space-y-1.5">
            <label class="text-xs font-semibold text-stone-500">用户 ID（alias）</label>
            <textarea
              v-model="form.alias"
              rows="3"
              placeholder="输入用户 ID，多个用逗号或换行分隔&#10;例：44162677806080, 44162677806081"
              class="w-full px-3.5 py-2.5 text-sm rounded-xl border resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 transition"
              style="border-color: #e2d9d0; background: #faf8f5; font-family: monospace"
            />
            <p class="text-xs text-stone-400">💡 用户登录 App 后，客户端会自动把 userId 注册为 alias</p>
          </div>

          <!-- 广播说明 -->
          <div v-else class="rounded-xl px-4 py-3 flex items-center gap-3"
               style="background: #fffbeb; border: 1px solid #fde68a">
            <span class="text-lg">📢</span>
            <p class="text-xs text-amber-700">将向所有已安装 App 并开启通知权限的用户发送推送</p>
          </div>
        </div>

        <!-- 通知内容 -->
        <div class="bg-white rounded-2xl border p-5 space-y-4"
             style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
          <p class="text-sm font-bold text-stone-700 flex items-center gap-2">
            <span class="w-5 h-5 rounded-md bg-amber-100 flex items-center justify-center text-xs">②</span>
            通知内容
          </p>

          <!-- 快速模板 -->
          <div class="flex flex-wrap gap-2">
            <button
              v-for="tpl in templates" :key="tpl.title"
              class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:shadow-sm"
              style="background: #faf8f5; border-color: #e2d9d0; color: #6b7280"
              @click="applyTemplate(tpl)"
            >
              {{ tpl.emoji }} {{ tpl.title }}
            </button>
          </div>

          <div class="space-y-3">
            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-stone-500">标题 <span class="text-red-400">*</span></label>
              <input
                v-model="form.title"
                maxlength="50"
                placeholder="通知标题（最多 50 字）"
                class="w-full px-3.5 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-300 transition"
                style="border-color: #e2d9d0; background: #faf8f5"
              />
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-stone-500">内容 <span class="text-red-400">*</span></label>
              <textarea
                v-model="form.content"
                rows="3"
                maxlength="200"
                placeholder="通知内容（最多 200 字）"
                class="w-full px-3.5 py-2.5 text-sm rounded-xl border resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 transition"
                style="border-color: #e2d9d0; background: #faf8f5"
              />
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-stone-500">
                设备码（MAC）
                <span class="font-normal text-stone-400 ml-1">（可选，填写后点开通知可跳转到对应设备界面）</span>
              </label>
              <input
                v-model="form.deviceMac"
                placeholder="例：ipet-esp32-Device-02"
                class="w-full px-3.5 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-300 transition font-mono"
                style="border-color: #e2d9d0; background: #faf8f5"
              />
              <p v-if="form.deviceMac.trim()" class="text-xs text-amber-600">
                ℹ️ extras 将自动注入 device_mac，App 点击通知可跳转设备页
              </p>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-stone-500">
                附加数据 extras
                <span class="font-normal text-stone-400 ml-1">（可选，JSON 格式，App 点击通知后可读取）</span>
              </label>
              <textarea
                v-model="form.extras"
                rows="2"
                placeholder='{ "type": "auto_capture" }'
                class="w-full px-3.5 py-2.5 text-xs rounded-xl border resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 transition font-mono"
                style="border-color: #e2d9d0; background: #faf8f5"
              />
            </div>
          </div>
        </div>

        <!-- 发送按钮 -->
        <div class="flex items-center gap-3">
          <button
            class="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white transition-all duration-150 disabled:opacity-50"
            :style="sending
              ? 'background: #d1d5db; cursor: not-allowed'
              : 'background: linear-gradient(135deg, #f59e0b, #fb923c); box-shadow: 0 4px 14px rgba(245,158,11,0.35)'"
            :disabled="sending"
            @click="sendPush"
          >
            <span v-if="sending" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span v-else>🚀</span>
            {{ sending ? '发送中…' : '立即发送' }}
          </button>
          <button
            class="px-4 py-3 rounded-xl text-sm font-medium border text-stone-500 hover:bg-stone-50 transition"
            style="border-color: #e2d9d0"
            @click="resetForm"
          >
            重置
          </button>
        </div>

      </div>

      <!-- 右侧：预览 + 历史 -->
      <div class="space-y-4">

        <!-- 手机预览 -->
        <div class="bg-white rounded-2xl border p-5"
             style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
          <p class="text-xs font-bold text-stone-500 mb-3">📱 通知预览</p>
          <div class="rounded-2xl p-4 space-y-1.5" style="background: #1c1c1e">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-5 h-5 rounded-md bg-amber-400 flex items-center justify-center">
                <span class="text-xs">🐾</span>
              </div>
              <span class="text-xs text-gray-400 font-medium">萌宠智伴</span>
              <span class="text-xs text-gray-500 ml-auto">现在</span>
            </div>
            <p class="text-sm font-semibold text-white">{{ form.title || '通知标题' }}</p>
            <p class="text-xs text-gray-400 leading-relaxed">{{ form.content || '通知内容将在这里显示…' }}</p>
          </div>
        </div>

        <!-- 发送历史 -->
        <div class="bg-white rounded-2xl border overflow-hidden"
             style="border-color: #f0e6d8; box-shadow: 0 1px 4px rgba(0,0,0,0.04)">
          <div class="px-4 py-3 border-b flex items-center justify-between"
               style="border-color: #f5ede4; background: #faf8f5">
            <p class="text-xs font-bold text-stone-600">发送记录</p>
            <span class="text-xs text-stone-400">本次会话</span>
          </div>

          <div v-if="!history.length" class="py-8 flex flex-col items-center gap-2 text-stone-300">
            <span class="text-2xl">📭</span>
            <p class="text-xs">暂无发送记录</p>
          </div>

          <div v-else class="divide-y max-h-96 overflow-y-auto" style="divide-color: #f5ede4">
            <div
              v-for="(h, i) in history" :key="i"
              class="px-4 py-3 space-y-1 cursor-pointer hover:bg-amber-50/40 transition-colors"
              @click="restoreHistory(h)"
            >
              <div class="flex items-center justify-between">
                <p class="text-xs font-semibold text-stone-700 truncate max-w-[160px]">{{ h.title }}</p>
                <span
                  class="text-xs px-2 py-0.5 rounded-full font-medium"
                  :style="h.success
                    ? 'background: #f0fdf4; color: #15803d'
                    : 'background: #fff1f2; color: #e11d48'"
                >
                  {{ h.success ? '✓ 成功' : '✗ 失败' }}
                </span>
              </div>
              <p class="text-xs text-stone-400 truncate">{{ h.content }}</p>
              <div class="flex items-center gap-2">
                <span class="text-xs text-stone-300">{{ h.targetLabel }}</span>
                <span class="text-xs text-stone-300">·</span>
                <span class="text-xs text-stone-300">{{ h.time }}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Toast 提示 -->
    <Teleport to="body">
      <Transition name="toast">
        <div
          v-if="toast.show"
          class="fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg font-medium text-sm"
          :style="toast.type === 'success'
            ? 'background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d'
            : 'background: #fff1f2; border: 1px solid #fecdd3; color: #e11d48'"
        >
          <span>{{ toast.type === 'success' ? '✅' : '❌' }}</span>
          <span>{{ toast.msg }}</span>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'AdminPush' })
definePageMeta({ layout: 'admin' })

// ── 表单状态 ──────────────────────────────────────
const form = reactive({
  targetType: 'all' as 'all' | 'alias',
  alias:     '',
  deviceMac: '',
  title:     '',
  content:   '',
  extras:    '',
})

const sending = ref(false)

// ── 目标类型 ──────────────────────────────────────
const targetTypes = [
  { value: 'all',   label: '全体广播', emoji: '📢' },
  { value: 'alias', label: '指定用户', emoji: '👤' },
]

// ── 内容模板 ──────────────────────────────────────
const templates = [
  { emoji: '📸', title: '自动抓拍',   content: '你的萌宠刚刚被自动抓拍了一张照片，快来看看吧！', extras: '{"type":"media"}' },
  { emoji: '🔊', title: '自动招呼',   content: '你的萌宠听到了招呼音，AI 情绪分析结果已更新。', extras: '{"type":"device"}' },
  { emoji: '🎉', title: '活动通知',   content: '萌宠智伴新功能上线，快来体验吧！', extras: '' },
  { emoji: '⚠️', title: '设备离线',   content: '你的设备已离线，请检查网络连接。', extras: '{"type":"device"}' },
  { emoji: '💊', title: '喂药提醒',   content: '该给你的宠物喂药了，别忘记哦！', extras: '' },
]

function applyTemplate(tpl: typeof templates[0]) {
  form.title   = tpl.title
  form.content = tpl.content
  if (tpl.extras) form.extras = tpl.extras
}

// ── 历史记录 ──────────────────────────────────────
interface HistoryItem {
  targetType: string
  alias: string
  deviceMac: string
  title: string
  content: string
  extras: string
  success: boolean
  targetLabel: string
  msgId?: string
  time: string
}
const history = ref<HistoryItem[]>([])

function restoreHistory(h: HistoryItem) {
  form.targetType = h.targetType as any
  form.alias      = h.alias
  form.deviceMac  = h.deviceMac
  form.title      = h.title
  form.content    = h.content
  form.extras     = h.extras
}

// ── Toast ─────────────────────────────────────────
const toast = reactive({ show: false, type: 'success', msg: '' })
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(type: 'success' | 'error', msg: string) {
  if (toastTimer) clearTimeout(toastTimer)
  toast.type = type
  toast.msg  = msg
  toast.show = true
  toastTimer = setTimeout(() => { toast.show = false }, 4000)
}

// ── 发送逻辑 ──────────────────────────────────────
async function sendPush() {
  if (!form.title.trim())   return showToast('error', '请填写通知标题')
  if (!form.content.trim()) return showToast('error', '请填写通知内容')
  if (form.targetType === 'alias' && !form.alias.trim())
    return showToast('error', '请输入用户 ID')

  // 合并 extras：手动输入 JSON + 设备码自动注入
  let mergedExtras: Record<string, string> = {}
  if (form.extras.trim()) {
    try { mergedExtras = JSON.parse(form.extras) } catch { return showToast('error', 'extras JSON 格式错误') }
  }
  if (form.deviceMac.trim()) {
    mergedExtras.device_mac = form.deviceMac.trim()
    if (!mergedExtras.type) mergedExtras.type = 'device'
  }

  sending.value = true
  const h: HistoryItem = {
    targetType:  form.targetType,
    alias:       form.alias,
    deviceMac:   form.deviceMac,
    title:       form.title,
    content:     form.content,
    extras:      form.extras,
    success:     false,
    targetLabel: form.targetType === 'all' ? '全体广播' : `用户: ${form.alias.substring(0, 20)}…`,
    time:        new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
  }

  try {
    const res = await $fetch<any>('/api/admin/push', {
      method: 'POST',
      body: {
        targetType: form.targetType,
        alias:      form.alias,
        title:      form.title,
        content:    form.content,
        extras:     Object.keys(mergedExtras).length ? JSON.stringify(mergedExtras) : undefined,
      },
    })
    h.success = true
    h.msgId   = res.msgId
    showToast('success', `推送成功！msg_id: ${res.msgId}`)
  } catch (e: any) {
    const msg = e?.data?.message ?? e?.message ?? '推送失败，请检查配置'
    showToast('error', msg)
  } finally {
    history.value.unshift(h)
    sending.value = false
  }
}

// ── 重置 ──────────────────────────────────────────
function resetForm() {
  form.targetType = 'all'
  form.alias      = ''
  form.deviceMac  = ''
  form.title      = ''
  form.content    = ''
  form.extras     = ''
}
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
