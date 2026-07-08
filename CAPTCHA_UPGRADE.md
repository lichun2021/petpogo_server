# 图形滑块验证码升级说明

已将管理后台登录的纯数字滑块验证码升级为**图形拼图滑块验证码**。

---

## 📦 安装依赖

```bash
npm install sharp --save
```

---

## 🖼️ 准备背景图（可选）

验证码背景图存放在 `assets/captcha-backgrounds/` 目录。

### 方式 1：使用渐变背景（默认，无需额外操作）

如果目录为空，系统会自动生成随机渐变色背景。

### 方式 2：添加自定义背景图（推荐）

```bash
cd assets/captcha-backgrounds

# 下载示例图片（或手动放入任意风景照）
wget https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800 -O bg1.jpg
wget https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800 -O bg2.jpg
wget https://images.unsplash.com/photo-1511593358241-7eea1f3c84e5?w=800 -O bg3.jpg
```

**图片要求：**
- 格式：`.jpg` / `.png` / `.webp`
- 尺寸：建议 800×600 以上
- 内容：风景、纹理、抽象图案均可
- 数量：10-20 张（系统随机选择）

---

## 🔧 后端已完成

### 新增文件

1. **`server/utils/slideCaptcha.ts`** — 验证码生成工具
   - 使用 `sharp` 从背景图裁剪拼图块
   - 在背景图上绘制缺口
   - 返回 base64 图片

2. **`assets/captcha-backgrounds/`** — 背景图目录

### 修改文件

1. **`server/routes/api/admin/captcha.get.ts`** — 生成图形验证码
   - 返回 `backgroundImage`（带缺口的背景图 base64）
   - 返回 `puzzleImage`（拼图块图片 base64）
   - `token` 和 `offsetX` 存入 Redis（120秒 TTL）

2. **`server/routes/api/admin/login.post.ts`** — 校验逻辑
   - 容错范围从 6px 调整为 8px（图形验证更宽容）

---

## 🎨 前端集成

### 方式 1：使用示例组件（Vue 3）

已提供完整的 Vue 组件示例：`app/components/SlideCaptcha.vue`

**在登录页使用：**

```vue
<template>
  <div class="login-page">
    <input v-model="username" placeholder="用户名" />
    <input v-model="password" type="password" placeholder="密码" />

    <!-- 图形滑块验证码 -->
    <SlideCaptcha @success="handleCaptchaSuccess" />

    <button @click="login" :disabled="!captchaData">登录</button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const username = ref('')
const password = ref('')
const captchaData = ref(null)

function handleCaptchaSuccess({ token, offset }) {
  captchaData.value = { token, offset }
}

async function login() {
  if (!captchaData.value) {
    alert('请先完成验证')
    return
  }

  const res = await $fetch('/api/admin/login', {
    method: 'POST',
    body: {
      username: username.value,
      password: password.value,
      captchaToken: captchaData.value.token,
      captchaOffset: captchaData.value.offset,
    },
  })

  if (res.token) {
    localStorage.setItem('admin_token', res.token)
    navigateTo('/admin/dashboard')
  }
}
</script>
```

### 方式 2：自己实现前端

**接口调用流程：**

1. **获取验证码：** `GET /api/admin/captcha`

```json
// 响应
{
  "token": "uuid",
  "backgroundImage": "data:image/png;base64,...",  // 带缺口的背景图
  "puzzleImage": "data:image/png;base64,...",      // 拼图块
  "puzzleWidth": 50,
  "trackWidth": 300
}
```

2. **前端渲染：**
   - 显示 `backgroundImage` 作为背景
   - 显示 `puzzleImage` 作为可拖动的拼图块
   - 用户拖动拼图块到缺口位置
   - 记录最终的 `offsetX`（拼图块左边距）

3. **提交登录：** `POST /api/admin/login`

```json
{
  "username": "admin",
  "password": "password",
  "captchaToken": "uuid",
  "captchaOffset": 123  // 用户拖动到的位置（px）
}
```

**后端校验：**
- 允许 ±8px 的误差
- 验证码一次性使用（验证后立即失效）
- 120秒超时

---

## 🚀 启动测试

```bash
npm run build
npm run dev
```

访问 `/admin/login`，应该看到图形滑块验证码。

---

## 🔍 调试模式

如果需要查看目标位置（仅开发环境），可以在 `captcha.get.ts` 中临时添加：

```ts
return {
  token,
  backgroundImage,
  puzzleImage,
  puzzleWidth: 50,
  trackWidth: 300,
  // target: offsetX  // 取消注释以查看正确位置（生产环境移除）
}
```

---

## ⚠️ 注意事项

1. **sharp 依赖原生模块**，首次安装可能需要编译，确保系统有 C++ 编译环境
2. **背景图不是必需的**，没有背景图时会用渐变色替代
3. **验证容错范围**：当前为 8px，可根据实际体验调整
4. **前端需要防止作弊**：拼图块的 CSS `pointer-events: none`，防止用户直接拖动图片
5. **移动端支持**：示例组件已支持 `touchstart` / `touchmove` / `touchend`

---

## 📸 效果预览

**验证码示例：**
- 背景图显示缺口（半透明白色 + 描边）
- 拼图块可拖动，需要拖到缺口位置
- 拖动时拼图块半透明，松手后验证

**交互流程：**
1. 页面加载自动获取验证码
2. 用户拖动拼图块
3. 松手时提交验证
4. 验证成功后可以登录
5. 失败则点击刷新按钮重新获取

---

## 🛠️ 自定义调整

### 修改拼图大小

在 `server/utils/slideCaptcha.ts` 中修改：

```ts
const PUZZLE_SIZE = 50 // 改为 60 或其他值
```

### 修改图片尺寸

```ts
const IMAGE_WIDTH = 350  // 背景图宽度
const IMAGE_HEIGHT = 200 // 背景图高度
```

### 修改容错范围

在 `server/routes/api/admin/login.post.ts` 中修改：

```ts
const CAPTCHA_TOLERANCE = 8 // 改为 6 或 10
```

---

如有问题，可以查看 `app/components/SlideCaptcha.vue` 示例组件的完整实现。
