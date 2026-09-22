<template>
  <el-config-provider :locale="locale">
    <ToastHost />
    <ConfirmHost />
    <UpdateDialog />

    <LoginView v-if="!entered" @enter="handleEnter" @offline="handleOffline" />

    <div v-else class="shell" @click="closeMenus">
      <!-- 顶栏 -->
      <header class="topbar drag">
        <div class="topbar__brand">
          <UiLogo :size="24" />
          <span class="topbar__name">血压及B超检测</span>
        </div>
        <span class="topbar__divider"></span>
        <span class="topbar__page">{{ currentTitle }}</span>

        <div class="topbar__right no-drag">
          <span class="topbar__status">
            <span class="dot" :class="{ 'is-online': config.loggedIn }"></span>
            {{ config.loggedIn ? '在线' : '离线' }}
          </span>

          <div class="udrop">
            <button class="ubtn" @click.stop="toggleMenu('user')">
              <span class="ubtn__avatar">{{ avatarText }}</span>
              <span class="ubtn__name">{{ config.username || '离线使用' }}</span>
              <UiIcon name="chevron" :size="12" />
            </button>
            <div v-if="openMenu === 'user'" class="menu udrop__menu" @click.stop>
              <div class="menu__label">账号</div>
              <div class="menu__label menu__label--value">
                {{ config.username || '未登录' }} · {{ config.loggedIn ? '在线' : '离线' }}
              </div>
              <div class="menu__sep"></div>
              <button class="menu__item" @click="go('/settings')">
                <UiIcon name="settings" :size="13" /> 设置
              </button>
              <div class="menu__sep"></div>
              <div class="menu__label">主题</div>
              <button
                v-for="opt in themeOptions"
                :key="opt.id"
                class="menu__item"
                @click="theme.setMode(opt.id)"
              >
                <span
                  class="menu__check"
                  :style="{ visibility: theme.mode === opt.id ? 'visible' : 'hidden' }"
                >
                  <UiIcon name="check" :size="12" />
                </span>
                {{ opt.label }}
              </button>
              <div class="menu__sep"></div>
              <button class="menu__item menu__item--danger" @click="handleLogout">
                <UiIcon name="switch" :size="13" /> 退出登录
              </button>
            </div>
          </div>

          <WindowControls />
        </div>
      </header>

      <div class="body">
        <!-- 侧栏导航 -->
        <aside class="rail">
          <nav class="nav">
            <section v-for="group in navGroups" :key="group.label" class="group">
              <div class="group__label">{{ group.label }}</div>
              <router-link
                v-for="item in group.items"
                :key="item.path"
                :to="item.path"
                class="item"
                active-class="is-active"
              >
                <UiIcon :name="item.icon" :size="16" />
                <span>{{ item.title }}</span>
              </router-link>
            </section>
          </nav>
        </aside>

        <!-- 内容 -->
        <main class="content">
          <router-view v-slot="{ Component }">
            <keep-alive>
              <component :is="Component" />
            </keep-alive>
          </router-view>
        </main>
      </div>

      <!-- 底栏 -->
      <footer class="footer">
        <span class="footer__item">
          <span class="dot" :class="{ 'is-online': config.loggedIn }"></span>
          {{ config.loggedIn ? '在线' : '离线使用' }}
        </span>
        <span class="footer__item">{{ currentSub }}</span>
        <span class="footer__spacer"></span>
        <span class="footer__item" :title="config.baseApi">{{ serverHost }}</span>
        <span class="footer__item">v{{ config.version }}</span>
      </footer>
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LoginView from '@r/views/LoginView.vue'
import WindowControls from '@r/components/WindowControls.vue'
import ToastHost from '@r/components/ui/ToastHost.vue'
import ConfirmHost from '@r/components/ui/ConfirmHost.vue'
import UpdateDialog from '@r/components/UpdateDialog.vue'
import UiLogo from '@r/components/ui/UiLogo.vue'
import UiIcon from '@r/components/ui/UiIcon.vue'
import type { IconName } from '@r/components/ui/icons'
import { useConfigStore } from '@r/stores/config'
import { useUserStore } from '@r/stores/user'
import { useThemeStore, type ThemeMode } from '@r/stores/theme'
import { useUpdateStore } from '@r/stores/update'
import { authApi } from '@r/api/auth'
import { confirmBox } from '@r/utils/confirm'
import { configureHotkeys, installHotkeys, setPageScope } from '@r/hotkeys/manager'
import type { HotkeyScope } from '@shared/domain/hotkeys'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

/** 应用外壳：登录门控 + 顶栏（含账号菜单）+ 侧栏导航 + 底栏状态（精密栅格） */
const locale = zhCn
const config = useConfigStore()
const userStore = useUserStore()
const theme = useThemeStore()
const updateStore = useUpdateStore()
const route = useRoute()
const router = useRouter()
const entered = ref(false)

type MenuId = 'user'
const openMenu = ref<MenuId | null>(null)

interface NavItem {
  path: string
  title: string
  icon: IconName
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: '业务',
    items: [
      { path: '/blood-pressure', title: '血压检测', icon: 'heart' },
      { path: '/b-scan', title: 'B超检测', icon: 'video' }
    ]
  },
  {
    label: '系统',
    items: [{ path: '/settings', title: '设置', icon: 'settings' }]
  }
]

const themeOptions: { id: ThemeMode; label: string; icon: IconName }[] = [
  { id: 'light', label: '浅色', icon: 'sun' },
  { id: 'dark', label: '深色', icon: 'moon' },
  { id: 'system', label: '跟随系统', icon: 'monitor' }
]

const currentTitle = computed(() => (route.meta.title as string) || '血压及B超检测')
const currentSub = computed(() => (route.meta.subtitle as string) || '')

/** 路由名 → 快捷键作用域 */
const SCOPE_BY_ROUTE: Record<string, HotkeyScope> = {
  'b-scan': 'collect',
  'b-scan-history': 'bscan-history',
  'b-scan-template': 'bscan-template',
  'blood-pressure': 'bp-measure',
  'blood-pressure-history': 'bp-history'
}
watch(
  () => route.name,
  (name) => {
    setPageScope(typeof name === 'string' ? (SCOPE_BY_ROUTE[name] ?? null) : null)
  },
  { immediate: true }
)

const avatarText = computed(() => (config.username || '离').slice(0, 1).toUpperCase())
const serverHost = computed(() => {
  const api = config.baseApi || ''
  try {
    return new URL(api).host || api
  } catch {
    return api || '未配置服务地址'
  }
})

function toggleMenu(id: MenuId): void {
  openMenu.value = openMenu.value === id ? null : id
}
function closeMenus(): void {
  openMenu.value = null
}
function go(path: string): void {
  closeMenus()
  void router.push(path)
}

function handleEnter(): void {
  userStore.isOnline = 'Y'
  entered.value = true
  void autoCheckUpdate()
}
function handleOffline(): void {
  userStore.isOnline = 'N'
  entered.value = true
}
async function handleLogout(): Promise<void> {
  closeMenus()
  const ok = await confirmBox('确认退出当前账号？', { title: '退出登录', danger: true })
  if (!ok) return
  try {
    if (config.loggedIn) await authApi.logout()
  } finally {
    await config.load()
    userStore.isOnline = 'N'
    entered.value = false
  }
}

onMounted(async () => {
  theme.init()
  await config.load()
  entered.value = config.loggedIn
  userStore.isOnline = config.loggedIn ? 'Y' : 'N'
  void updateStore.init()
  if (entered.value) void autoCheckUpdate()
  configureHotkeys(() => config.hotkeys)
  installHotkeys()
})

/** 启动后自动检查更新（发现新版本会自动弹框；忽略的版本不弹；开发环境不检查） */
async function autoCheckUpdate(): Promise<void> {
  if (import.meta.env.DEV) return
  await updateStore.init()
  await updateStore.check()
}
</script>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg);
}

/* ── 顶栏 ───────────────────────────────────────── */
.topbar {
  display: flex;
  align-items: center;
  gap: var(--s3);
  height: var(--header-h);
  flex-shrink: 0;
  padding-left: var(--s4);
  background: var(--surface);
  border-bottom: 1px solid var(--line);
}
.topbar__brand {
  display: flex;
  align-items: center;
  gap: var(--s2);
}
.topbar__name {
  font-size: var(--fs-md);
  font-weight: 600;
  letter-spacing: var(--ls-label);
  white-space: nowrap;
}
.topbar__divider {
  width: 1px;
  height: 18px;
  background: var(--line);
}
.topbar__page {
  font-size: var(--fs-md);
  color: var(--t2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.topbar__right {
  display: flex;
  align-items: center;
  gap: var(--s4);
  margin-left: auto;
  height: 100%;
}
.topbar__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-xs);
  color: var(--t2);
  letter-spacing: var(--ls-label);
}

.udrop {
  position: relative;
}
.ubtn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 8px;
  border: none;
  background: transparent;
  color: var(--t1);
  font-family: inherit;
  font-size: var(--fs-md);
  cursor: pointer;
}
.ubtn:hover {
  background: var(--surface-3);
}
.ubtn__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: var(--accent);
  color: var(--on-accent);
  font-size: var(--fs-micro);
  font-weight: 600;
}
.ubtn__name {
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.udrop__menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 2000;
}
.menu__label--value {
  text-transform: none;
  letter-spacing: 0;
  font-size: var(--fs-md);
  color: var(--t1);
  padding-top: 0;
}

/* ── 主体 ───────────────────────────────────────── */
.body {
  flex: 1;
  min-height: 0;
  display: flex;
}

/* 侧栏：白色背景 + 分组标签 */
.rail {
  width: var(--sidebar-w);
  flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.nav {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  padding: var(--s3) var(--s2);
}
.group {
  padding: 0;
}
.group__label {
  padding: 8px 8px 4px;
  font-size: var(--fs-micro);
  font-weight: 600;
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  color: var(--t3);
}
.item {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 8px;
  color: var(--t2);
  font-size: var(--fs-md);
  text-decoration: none;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}
.item:hover {
  background: var(--surface-3);
  color: var(--t1);
}
.item.is-active {
  background: var(--accent);
  color: var(--on-accent);
  font-weight: 600;
}
.item.is-active .ui-icon {
  color: var(--on-accent);
}

.content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0;
  background: var(--bg);
}

/* ── 底栏 ───────────────────────────────────────── */
.footer {
  display: flex;
  align-items: center;
  height: var(--footer-h);
  flex-shrink: 0;
  padding: 0 var(--s4);
  background: var(--surface);
  border-top: 1px solid var(--line);
  font-size: var(--fs-xs);
  color: var(--t3);
}
.footer__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding-right: var(--s4);
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.footer__spacer {
  flex: 1;
}

.dot {
  width: 6px;
  height: 6px;
  background: var(--t3);
  border-radius: 50%;
}
.dot.is-online {
  background: var(--ok);
}
</style>
