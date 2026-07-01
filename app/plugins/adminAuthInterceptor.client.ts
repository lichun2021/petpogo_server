// 统一处理管理后台的 $fetch 鉴权：
//  1. 自动给 /api/admin/** 请求带上 Authorization（此前各页面各自手写 authHeader()，
//     很容易漏掉——比如 dashboard 页面就漏了，导致中间件补上鉴权后直接 401）
//  2. 401 时清空本地登录态并跳回登录页
export default defineNuxtPlugin(() => {
  const wrapped = $fetch.create({
    onRequest({ request, options }) {
      const url = typeof request === 'string' ? request : request.url
      if (!url.includes('/api/admin/')) return
      if (url.includes('/api/admin/login') || url.includes('/api/admin/captcha')) return

      const token = localStorage.getItem('admin_token')
      if (!token) return

      const headers = new Headers(options.headers as HeadersInit)
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`)
      }
      options.headers = headers
    },
    onResponseError({ request, response }) {
      if (response.status !== 401) return

      const url = typeof request === 'string' ? request : request.url
      if (url.includes('/api/admin/login')) return // 登录失败本身也是 401，不应触发跳转

      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_id')
      localStorage.removeItem('admin_role')
      localStorage.removeItem('admin_username')

      if (window.location.pathname !== '/admin/login') {
        navigateTo('/admin/login')
      }
    },
  })

  globalThis.$fetch = wrapped as typeof globalThis.$fetch
})
