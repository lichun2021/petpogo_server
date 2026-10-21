/** 标签切换保留草稿；关闭标签、刷新浏览器或离开后台前确认未保存修改。 */
export function useAdminDirtyForm(dirty: Ref<boolean>) {
  const route = useRoute()
  const path = route.path
  const forms = useState<Record<string, boolean>>('admin-dirty-forms', () => ({}))
  watch(dirty, value => { forms.value[path] = value }, { immediate: true })
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (!Object.values(forms.value).some(Boolean)) return
    event.preventDefault(); event.returnValue = ''
  }
  onMounted(() => window.addEventListener('beforeunload', beforeUnload))
  onBeforeUnmount(() => { delete forms.value[path]; window.removeEventListener('beforeunload', beforeUnload) })
}
