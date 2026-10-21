import { resolveAdminPage } from '../utils/adminPages'
// composables/useTabStore.ts
// 多页签状态管理（使用 Nuxt useState 全局共享，无需 Pinia）

export interface TabItem {
  path: string
  title: string
  icon?: string
  closable: boolean
}

export function useTabStore() {
  const tabs = useState<TabItem[]>('admin-tabs', () => [
    { path: '/admin', title: '数据概览', icon: 'i-heroicons-squares-2x2', closable: false },
  ])

  const activeTab = useState<string>('admin-active-tab', () => '/admin')

  const router = useRouter()
  const forms = useState<Record<string, boolean>>('admin-dirty-forms', () => ({}))
  const generations = useState<Record<string, number>>('admin-tab-generations', () => ({}))
  function canClose(paths: string[]) {
    return !paths.some(path => forms.value[path]) || window.confirm('页面有未保存修改，关闭后将丢弃这些修改。是否继续？')
  }
  function clearPage(path: string) {
    generations.value[path] = (generations.value[path] || 0) + 1
    delete forms.value[path]
    if (path === '/admin/music') clearNuxtState(key => key.startsWith('admin-music-'))
    if (path === '/admin/posts') clearNuxtState('admin-posts-cache')
  }

  /** 打开或切换到某个 tab（不存在则新建） */
  function openTab(path: string, customTitle?: string) {
    const existing = tabs.value.find(t => t.path === path)
    if (!existing) {
      const { title, icon } = resolveAdminPage(path)
      tabs.value.push({
        path,
        title: customTitle || title,
        icon,
        closable: path !== '/admin',
      })
    } else if (customTitle) {
      existing.title = customTitle
    }
    activeTab.value = path
    router.push(path)
  }

  /** 关闭指定 tab */
  function closeTab(path: string) {
    const idx = tabs.value.findIndex(t => t.path === path)
    if (idx === -1 || !tabs.value[idx].closable) return

    if (!canClose([path])) return
    clearPage(path)
    tabs.value.splice(idx, 1)

    // 关闭的是当前激活 tab → 跳转到相邻 tab
    if (activeTab.value === path) {
      const nextTab = tabs.value[idx] || tabs.value[idx - 1] || tabs.value[0]
      if (nextTab) {
        activeTab.value = nextTab.path
        router.push(nextTab.path)
      }
    }
  }

  /** 关闭其他所有 tab（保留首页和当前） */
  function closeOthers(path: string) {
    const closing = tabs.value.filter(tab => tab.closable && tab.path !== path).map(tab => tab.path)
    if (!canClose(closing)) return
    closing.forEach(clearPage)
    tabs.value = tabs.value.filter(t => !t.closable || t.path === path)
    activeTab.value = path
    router.push(path)
  }

  /** 关闭所有可关闭 tab */
  function closeAll() {
    const closing = tabs.value.filter(tab => tab.closable).map(tab => tab.path)
    if (!canClose(closing)) return
    closing.forEach(clearPage)
    tabs.value = tabs.value.filter(t => !t.closable)
    activeTab.value = '/admin'
    router.push('/admin')
  }

  /** 同步路由变化到激活 tab（直接输入 URL 时） */
  function syncRoute(path: string) {
    const found = tabs.value.find(t => t.path === path)
    if (found) {
      activeTab.value = path
    } else {
      // 路由不在 tab 中，自动开一个
      openTab(path)
    }
  }

  return { tabs, activeTab, generations, openTab, closeTab, closeOthers, closeAll, syncRoute }
}
