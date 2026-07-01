// composables/useTabStore.ts
// 多页签状态管理（使用 Nuxt useState 全局共享，无需 Pinia）

export interface TabItem {
  path: string
  title: string
  icon?: string
  closable: boolean
}

const TAB_ICONS: Record<string, string> = {
  '/admin':             'i-heroicons-squares-2x2',
  '/admin/users':       'i-heroicons-users',
  '/admin/devices':     'i-heroicons-cpu-chip',
  '/admin/posts':       'i-heroicons-photo',
  '/admin/stores':      'i-heroicons-building-storefront',
  '/admin/ai-analysis': 'i-heroicons-sparkles',
  '/admin/music':       'i-heroicons-musical-note',
  '/admin/sound':       'i-heroicons-speaker-wave',
  '/admin/media':       'i-heroicons-photo',
  '/admin/feedback':    'i-heroicons-chat-bubble-left-ellipsis',
  '/admin/push':        'i-heroicons-bell',
  '/admin/settings':    'i-heroicons-cog-6-tooth',
  '/admin/admins':      'i-heroicons-shield-check',
}

const TAB_TITLES: Record<string, string> = {
  '/admin':             '数据概览',
  '/admin/users':       '用户管理',
  '/admin/devices':     '设备管理',
  '/admin/posts':       '帖子审核',
  '/admin/stores':      '门店管理',
  '/admin/ai-analysis': 'AI 识别记录',
  '/admin/music':       '宠物音乐',
  '/admin/sound':       '情绪声音',
  '/admin/media':       '用户图库',
  '/admin/feedback':    '用户反馈',
  '/admin/push':        '推送测试',
  '/admin/settings':    '系统设置',
  '/admin/admins':      '管理员管理',
}

function resolveTitleAndIcon(path: string): { title: string; icon: string } {
  // 精确匹配
  if (TAB_TITLES[path]) {
    return { title: TAB_TITLES[path], icon: TAB_ICONS[path] || 'i-heroicons-document' }
  }
  // 动态路由：/admin/posts/123 → 帖子详情
  if (path.startsWith('/admin/posts/')) {
    return { title: `帖子 #${path.split('/').pop()}`, icon: 'i-heroicons-document-text' }
  }
  if (path.startsWith('/admin/users/')) {
    return { title: `用户 #${path.split('/').pop()}`, icon: 'i-heroicons-user' }
  }
  return { title: '页面', icon: 'i-heroicons-document' }
}

export function useTabStore() {
  const tabs = useState<TabItem[]>('admin-tabs', () => [
    { path: '/admin', title: '数据概览', icon: 'i-heroicons-squares-2x2', closable: false },
  ])

  const activeTab = useState<string>('admin-active-tab', () => '/admin')

  const router = useRouter()

  /** 打开或切换到某个 tab（不存在则新建） */
  function openTab(path: string, customTitle?: string) {
    const existing = tabs.value.find(t => t.path === path)
    if (!existing) {
      const { title, icon } = resolveTitleAndIcon(path)
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
    tabs.value = tabs.value.filter(t => !t.closable || t.path === path)
    activeTab.value = path
    router.push(path)
  }

  /** 关闭所有可关闭 tab */
  function closeAll() {
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

  return { tabs, activeTab, openTab, closeTab, closeOthers, closeAll, syncRoute }
}
