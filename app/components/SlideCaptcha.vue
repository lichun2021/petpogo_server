<!--
  图形滑块验证码组件示例

  使用方法：
  <SlideCaptcha @success="handleCaptchaSuccess" />

  事件：
  - @success: 验证成功，返回 { token, offset }
  - @fail: 验证失败
  - @refresh: 用户刷新验证码
-->

<template>
  <div class="slide-captcha">
    <div class="captcha-container" :style="{ width: trackWidth + 'px' }">
      <!-- 背景图（带缺口） -->
      <img
        v-if="backgroundImage"
        :src="backgroundImage"
        class="background-image"
        alt="验证码背景"
        draggable="false"
      />

      <!-- 拼图块（可拖动） -->
      <img
        v-if="puzzleImage"
        :src="puzzleImage"
        class="puzzle-piece"
        :style="{ left: puzzleLeft + 'px', opacity: isDragging ? 0.8 : 1 }"
        alt="拼图块"
        draggable="false"
      />

      <!-- 刷新按钮 -->
      <button class="refresh-btn" @click="refresh" :disabled="loading">
        <span v-if="!loading">🔄</span>
        <span v-else>⏳</span>
      </button>
    </div>

    <!-- 滑动轨道 -->
    <div class="track" :style="{ width: trackWidth + 'px' }">
      <div class="track-fill" :style="{ width: sliderLeft + 'px' }"></div>
      <div
        class="slider"
        :style="{ left: sliderLeft + 'px' }"
        @mousedown="startDrag"
        @touchstart="startDrag"
      >
        <span v-if="!verified">→</span>
        <span v-else>✓</span>
      </div>
      <div class="track-text" v-if="!verified">{{ hintText }}</div>
      <div class="track-text success" v-else>验证成功</div>
    </div>

    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const emit = defineEmits(['success', 'fail', 'refresh'])

const loading = ref(false)
const backgroundImage = ref('')
const puzzleImage = ref('')
const token = ref('')
const targetOffset = ref(0) // 后端返回的目标位置（仅用于调试，实际由后端校验）
const trackWidth = ref(300)
const puzzleWidth = ref(50)

const sliderLeft = ref(0)
const puzzleLeft = ref(0)
const isDragging = ref(false)
const startX = ref(0)
const verified = ref(false)
const errorMessage = ref('')
const hintText = ref('向右滑动完成验证')

// 获取验证码
async function fetchCaptcha() {
  loading.value = true
  errorMessage.value = ''
  verified.value = false
  sliderLeft.value = 0
  puzzleLeft.value = 0

  try {
    const res = await $fetch('/api/admin/captcha')
    token.value = res.token
    backgroundImage.value = res.backgroundImage
    puzzleImage.value = res.puzzleImage
    puzzleWidth.value = res.puzzleWidth || 50
    trackWidth.value = res.trackWidth || 300
    // targetOffset.value = res.target // 调试用，生产环境不返回
  } catch (err) {
    errorMessage.value = '验证码加载失败，请刷新重试'
  } finally {
    loading.value = false
  }
}

// 开始拖动
function startDrag(e: MouseEvent | TouchEvent) {
  if (verified.value || loading.value) return

  isDragging.value = true
  errorMessage.value = ''

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  startX.value = clientX - sliderLeft.value

  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  document.addEventListener('touchmove', onDrag)
  document.addEventListener('touchend', stopDrag)
}

// 拖动中
function onDrag(e: MouseEvent | TouchEvent) {
  if (!isDragging.value) return

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  let newLeft = clientX - startX.value

  // 限制在轨道范围内
  if (newLeft < 0) newLeft = 0
  if (newLeft > trackWidth.value - puzzleWidth.value) newLeft = trackWidth.value - puzzleWidth.value

  sliderLeft.value = newLeft
  puzzleLeft.value = newLeft // 拼图块同步移动
}

// 停止拖动，提交验证
async function stopDrag() {
  if (!isDragging.value) return

  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', stopDrag)

  // 简单的前端校验（实际由后端校验）
  // 这里仅作为用户体验优化，让用户知道大致位置
  const finalOffset = sliderLeft.value

  // 提交到父组件或直接校验
  emit('success', { token: token.value, offset: finalOffset })
  verified.value = true
}

// 刷新验证码
function refresh() {
  emit('refresh')
  fetchCaptcha()
}

onMounted(() => {
  fetchCaptcha()
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', onDrag)
  document.removeEventListener('touchend', stopDrag)
})
</script>

<style scoped>
.slide-captcha {
  width: 100%;
  max-width: 350px;
  margin: 0 auto;
}

.captcha-container {
  position: relative;
  height: 200px;
  border-radius: 8px;
  overflow: hidden;
  background: #f5f5f5;
  margin-bottom: 12px;
}

.background-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
  pointer-events: none;
}

.puzzle-piece {
  position: absolute;
  top: 75px; /* 与后端生成的 offsetY 一致 */
  width: 50px;
  height: 50px;
  transition: opacity 0.2s;
  user-select: none;
  pointer-events: none;
}

.refresh-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  font-size: 16px;
  transition: transform 0.2s;
}

.refresh-btn:hover {
  transform: scale(1.1);
}

.refresh-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.track {
  position: relative;
  height: 42px;
  border-radius: 21px;
  background: #e8e8e8;
  overflow: hidden;
}

.track-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
  transition: width 0.1s;
}

.slider {
  position: absolute;
  top: 1px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.3);
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: left 0.1s;
  user-select: none;
}

.slider:active {
  cursor: grabbing;
}

.track-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #999;
  font-size: 14px;
  user-select: none;
  pointer-events: none;
}

.track-text.success {
  color: #52c41a;
  font-weight: 600;
}

.error-message {
  margin-top: 8px;
  color: #ff4d4f;
  font-size: 13px;
  text-align: center;
}
</style>
