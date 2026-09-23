<template>
  <div class="min-h-dvh flex items-center justify-center relative overflow-x-hidden overflow-y-auto py-5 sm:py-10 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-100">

    <!-- 背景光晕 -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute -top-40 -right-40 w-96 h-96 bg-amber-300/30 rounded-full blur-3xl" />
      <div class="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-200/40 rounded-full blur-3xl" />
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-yellow-100/50 rounded-full blur-2xl" />
    </div>

    <div class="relative w-full max-w-md px-4 sm:px-6">
      <!-- Logo -->
      <div class="text-center mb-5 sm:mb-8">
        <div class="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 mb-3 sm:mb-5 rounded-2xl shadow-2xl shadow-amber-500/30"
          style="background: linear-gradient(135deg, #f59e0b, #ea580c)">
          <img src="/admin-favicon.svg" alt="宠联芯" class="size-12 rounded-xl" />
        </div>
        <h1 class="text-xl font-bold text-gray-700 tracking-tight">宠联芯管理后台</h1>
        <p class="text-sm text-gray-500 mt-1.5">使用管理员账号登录</p>
      </div>

      <!-- 登录卡片 -->
      <div class="rounded-2xl border border-orange-100 shadow-xl shadow-orange-100/50 p-5 sm:p-7 space-y-4 sm:space-y-5 bg-white/80 backdrop-blur-sm">

        <!-- 账号 -->
        <div class="space-y-1.5">
          <label class="block text-xs font-medium text-gray-500 uppercase tracking-wider">管理员账号</label>
          <div class="relative">
            <span class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <UIcon name="i-heroicons-user" class="w-4 h-4 text-gray-500" />
            </span>
            <input
              v-model="form.username"
              type="text"
              placeholder="请输入账号"
              class="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm text-gray-800 placeholder-gray-400 border border-orange-200 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all bg-white"
              @keyup.enter="login"
            />
          </div>
        </div>

        <!-- 密码 -->
        <div class="space-y-1.5">
          <label class="block text-xs font-medium text-gray-500 uppercase tracking-wider">登录密码</label>
          <div class="relative">
            <span class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <UIcon name="i-heroicons-lock-closed" class="w-4 h-4 text-gray-500" />
            </span>
            <input
              v-model="form.password"
              :type="showPwd ? 'text' : 'password'"
              placeholder="请输入密码"
              class="w-full pl-9 pr-10 py-2.5 rounded-lg text-sm text-gray-800 placeholder-gray-400 border border-orange-200 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all bg-white"
              @keyup.enter="login"
            />
            <button
              class="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
              @click="showPwd = !showPwd"
            >
              <UIcon :name="showPwd ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'" class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- 图形滑块验证 -->
        <div class="space-y-2">
          <label class="block text-xs font-medium text-gray-500 uppercase tracking-wider">安全验证</label>

          <!-- 图形验证码容器 -->
          <div
            class="relative w-full rounded-lg overflow-hidden border border-orange-200"
            :style="{ aspectRatio: `${captcha.imageWidth} / ${captcha.imageHeight}`, background: '#f5f5f5' }"
          >
            <!-- 加载中占位 -->
            <div v-if="captchaLoading" class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
              <div class="flex items-center gap-2 text-gray-400">
                <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
                <span class="text-sm">加载验证码中...</span>
              </div>
            </div>

            <!-- 背景图（带缺口） -->
            <img
              v-if="captcha.backgroundImage && !captchaLoading"
              :src="captcha.backgroundImage"
              class="w-full h-full object-cover select-none pointer-events-none"
              alt="验证码背景"
              draggable="false"
            />

            <!-- 拼图块（可拖动） -->
            <img
              v-if="captcha.puzzleImage && !captchaLoading"
              :src="captcha.puzzleImage"
              class="absolute select-none pointer-events-none transition-opacity"
              :style="puzzleStyle"
              alt="拼图块"
              draggable="false"
            />

            <!-- 刷新按钮 -->
            <button
              class="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded bg-white/90 hover:bg-white shadow transition-all hover:scale-110"
              :disabled="captchaLoading"
              @click="loadCaptcha"
            >
              <UIcon
                name="i-heroicons-arrow-path"
                class="w-3.5 h-3.5 text-gray-600"
                :class="{ 'animate-spin': captchaLoading }"
              />
            </button>
          </div>

          <!-- 滑动轨道 -->
          <div
            class="relative select-none rounded-full"
            style="height:40px;background:#ededed;box-shadow:inset 0 1px 2px rgba(0,0,0,0.06)"
            data-testid="captcha-track"
          >
            <!-- 只裁切轨道背景，避免滑块和阴影在两端被截断 -->
            <div class="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
              <div class="absolute inset-y-0 left-0 rounded-full transition-none" :style="fillStyle" />
            </div>

            <!-- 提示文字 -->
            <div class="absolute inset-0 flex items-center justify-center text-xs font-medium pointer-events-none" :style="{ color: verified ? '#059669' : '#999' }">
              {{ verified ? '✓ 验证成功' : '向右滑动完成验证' }}
            </div>

            <!-- 滑块 -->
            <div
              class="absolute top-0 z-10 flex items-center justify-center rounded-full shadow-lg touch-none"
              :class="verified ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'"
              :style="thumbStyle"
              role="slider"
              tabindex="0"
              aria-label="滑动验证码"
              :aria-valuemin="0"
              :aria-valuemax="maxOffset"
              :aria-valuenow="Math.round(offset)"
              @pointerdown="startDrag"
              @pointermove="onDrag"
              @pointerup="endDrag"
              @pointercancel="endDrag"
              @keydown="onSliderKeydown"
            >
              <UIcon :name="verified ? 'i-heroicons-check' : 'i-heroicons-chevron-right'" class="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        <!-- 错误提示 -->
        <p v-if="errorMsg" class="text-xs text-red-500 flex items-center gap-1.5">
          <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4 flex-shrink-0" />
          {{ errorMsg }}
        </p>

        <!-- 登录按钮 -->
        <button
          class="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all relative overflow-hidden"
          :class="loading ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-amber-500/20 active:scale-[0.98]'"
          style="background: linear-gradient(135deg, #f59e0b, #ea580c)"
          :disabled="loading"
          @click="login"
        >
          <span v-if="!loading">登 录</span>
          <span v-else class="flex items-center justify-center gap-2">
            <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            登录中…
          </span>
        </button>
      </div>

      <p class="text-center text-xs text-gray-400 mt-5 sm:mt-8">宠联芯管理后台 © 2026</p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const form     = reactive({ username: '', password: '' })
const loading  = ref(false)
const showPwd  = ref(false)
const errorMsg = ref('')

// ── 图形滑块验证 ──────────────────────────────────────────
const captcha = reactive({
  token: '',
  backgroundImage: '',
  puzzleImage: '',
  trackWidth: 300,
  imageWidth: 350,
  imageHeight: 100,
  puzzleWidth: 50,
  puzzleY: 25  // 拼图块垂直位置（居中占位，后端可能返回实际位置）
})
const offset         = ref(0)
const dragging       = ref(false)
const verified       = ref(false)
const captchaLoading = ref(false)
let dragStartX = 0
let dragStartOffset = 0
let dragTrackWidth = 0
const THUMB_SIZE = 40

const maxOffset = computed(() => Math.max(0, captcha.trackWidth - captcha.puzzleWidth))
const offsetRatio = computed(() => maxOffset.value ? offset.value / maxOffset.value : 0)

const thumbStyle = computed(() => ({
  left: `calc(${offsetRatio.value * 100}% - ${offsetRatio.value * THUMB_SIZE}px)`,
  width: THUMB_SIZE + 'px',
  height: THUMB_SIZE + 'px',
  background: verified.value ? 'linear-gradient(135deg,#34d399,#059669)' : 'linear-gradient(135deg,#f59e0b,#ea580c)',
}))
const fillStyle = computed(() => ({
  width: `calc(${offsetRatio.value * 100}% + ${(1 - offsetRatio.value) * THUMB_SIZE}px)`,
  background: verified.value
    ? 'linear-gradient(90deg, rgba(52,211,153,0.28), rgba(5,150,105,0.38))'
    : 'linear-gradient(90deg, rgba(245,158,11,0.28), rgba(234,88,12,0.38))',
}))
const puzzleStyle = computed(() => ({
  left: `${offset.value / captcha.imageWidth * 100}%`,
  top: `${captcha.puzzleY / captcha.imageHeight * 100}%`,
  width: `${captcha.puzzleWidth / captcha.imageWidth * 100}%`,
  height: `${captcha.puzzleWidth / captcha.imageHeight * 100}%`,
  opacity: dragging.value ? 0.8 : 1,
}))

async function loadCaptcha() {
  captchaLoading.value = true
  verified.value = false
  offset.value = 0
  try {
    const res: any = await $fetch('/api/admin/captcha')
    captcha.token           = res.token
    captcha.backgroundImage = res.backgroundImage
    captcha.puzzleImage     = res.puzzleImage
    captcha.trackWidth      = res.trackWidth || 300
    captcha.imageWidth      = res.imageWidth || 350
    captcha.imageHeight     = res.imageHeight || 100
    captcha.puzzleWidth     = res.puzzleWidth || 50
    captcha.puzzleY         = res.puzzleY ?? 25  // 使用后端返回的 Y 坐标
  } catch (err) {
    errorMsg.value = '验证码加载失败，请刷新重试'
  } finally { captchaLoading.value = false }
}
onMounted(loadCaptcha)

function startDrag(e: PointerEvent) {
  if (verified.value || captchaLoading.value) return
  dragging.value = true
  errorMsg.value = ''
  dragStartX = e.clientX
  dragStartOffset = offset.value
  dragTrackWidth = (e.currentTarget as HTMLElement).parentElement?.clientWidth || captcha.trackWidth
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onDrag(e: PointerEvent) {
  if (!dragging.value) return
  const delta = e.clientX - dragStartX
  const maxDragDistance = Math.max(1, dragTrackWidth - THUMB_SIZE)
  const logicalDelta = delta / maxDragDistance * maxOffset.value
  offset.value = Math.min(maxOffset.value, Math.max(0, dragStartOffset + logicalDelta))
}
function endDrag() {
  if (!dragging.value) return
  dragging.value = false
  verified.value = offset.value > 0
}
function onSliderKeydown(e: KeyboardEvent) {
  if (verified.value || captchaLoading.value) return
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault()
    const delta = e.key === 'ArrowRight' ? 5 : -5
    offset.value = Math.min(maxOffset.value, Math.max(0, offset.value + delta))
  } else if ((e.key === 'Enter' || e.key === ' ') && offset.value > 0) {
    e.preventDefault()
    verified.value = true
  }
}

async function login() {
  if (!form.username || !form.password) { errorMsg.value = '请输入账号和密码'; return }
  if (!verified.value) { errorMsg.value = '请先完成滑动验证'; return }
  loading.value = true; errorMsg.value = ''
  try {
    const res: any = await $fetch('/api/admin/login', {
      method: 'POST',
      body: {
        username: form.username,
        password: form.password,
        captchaToken: captcha.token,
        captchaOffset: Math.round(offset.value),
      },
    })
    localStorage.setItem('admin_token', res.token)
    localStorage.setItem('admin_id', res.id)
    localStorage.setItem('admin_role', res.role)
    localStorage.setItem('admin_username', res.username)
    await navigateTo('/admin')
  } catch (e: any) {
    errorMsg.value = e.data?.message || '登录失败，请重试'
    await loadCaptcha() // 验证码一次性使用，失败后需重新滑动
  } finally { loading.value = false }
}
</script>
