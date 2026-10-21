export interface AdminListResult<T> { list: T[]; total: number | string }

/** 列表保留最后一次成功数据；取消旧请求，防止快速筛选时旧响应覆盖新结果。 */
export function useAdminList<T>(loader: (signal: AbortSignal) => Promise<AdminListResult<T>>) {
  const list = ref<T[]>([])
  const total = ref(0)
  const loading = ref(true)
  const hasLoaded = ref(false)
  const error = ref('')
  const errorRequestId = ref('')
  const lastUpdated = ref<Date | null>(null)
  let controller: AbortController | undefined
  let sequence = 0
  async function load() {
    controller?.abort()
    const current = ++sequence
    controller = new AbortController()
    loading.value = true
    error.value = ''; errorRequestId.value = ''
    try {
      const result = await loader(controller.signal)
      if (current !== sequence) return
      const count = Number(result.total)
      if (!Array.isArray(result.list) || !Number.isSafeInteger(count) || count < 0) throw new Error('列表响应格式异常')
      list.value = result.list
      total.value = count
      hasLoaded.value = true
      lastUpdated.value = new Date()
    } catch (cause: any) {
      if (current !== sequence || controller.signal.aborted) return
      error.value = Number(cause?.statusCode || cause?.response?.status) === 403 ? '当前账号无权查看这些数据' : '加载失败，请检查网络或稍后重试'
      errorRequestId.value = cause?.response?.headers?.get?.('x-request-id') || ''
    } finally {
      if (current === sequence) loading.value = false
    }
  }
  onScopeDispose(() => { ++sequence; controller?.abort() })
  return { list, total, loading, hasLoaded, error, errorRequestId, lastUpdated, load }
}
