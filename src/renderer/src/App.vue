<template>
  <el-config-provider :locale="locale">
    <ToastHost />
    <ConfirmHost />
    <UpdateDialog v-if="updateStore.visible" />

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

          <UpdateChip />

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

      <!-- 底栏：实时系统状态 -->
      <footer class="footer">
        <el-popover
          trigger="click"
          placement="top-start"
          :width="264"
          popper-class="app-scope net-popover"
        >
          <template #reference>
            <span class="footer__item footer__item--btn" :title="network.title">
              <template v-if="network.type === 'wifi'">
                <svg class="net-bars" width="15" height="13" viewBox="0 0 15 13" aria-hidden="true">
                  <rect
                    v-for="(h, i) in WIFI_BAR_HEIGHTS"
                    :key="i"
                    :x="i * 4"
                    :y="13 - h"
                    width="3"
                    :height="h"
                    :class="{ 'is-on': i < network.wifiBars }"
                  />
                </svg>
                WiFi
              </template>
              <template v-else-if="network.type === 'wired'">
                <UiIcon name="ethernet" :size="14" />
                有线
              </template>
              <template v-else>
                <span class="dot"></span>
                未联网
              </template>
            </span>
          </template>

          <div class="net-panel">
            <div class="net-panel__row">
              <span>连接方式</span>
              <b>{{
                network.type === 'wifi' ? 'WiFi' : network.type === 'wired' ? '有线' : '未连接'
              }}</b>
            </div>
            <div v-if="network.type === 'wifi'" class="net-panel__row">
              <span>网络名称</span>
              <b>{{ network.wifiSsid || '—' }}</b>
            </div>
            <div v-if="network.type === 'wifi'" class="net-panel__row">
              <span>信号强度</span>
              <b>{{ network.wifiSignal != null ? network.wifiSignal + '%' : '—' }}</b>
            </div>
            <div class="net-panel__row">
              <span>最后检测</span>
              <b>{{ lastCheckedText }}</b>
            </div>
            <div class="net-panel__sep"></div>
            <label class="net-panel__switch">
              <el-switch
                :model-value="config.bScanPrefs.online"
                :disabled="!network.online"
                @change="toggleOnline"
              />
              <span>B超联网使用</span>
            </label>
            <label class="net-panel__switch">
              <el-switch :model-value="config.bpAutoUpload" @change="toggleBpAutoUpload" />
              <span>血压自动上传</span>
            </label>
            <div class="net-panel__hint">
              {{ network.online ? '可在线查询与上传' : '网络未连接，将仅保存在本地' }}
            </div>
          </div>
        </el-popover>
        <span class="footer__item" title="操作系统位数">
          <UiIcon name="cpu" :size="13" />
          系统 {{ osBitness }}
        </span>
        <span class="footer__spacer"></span>
        <span class="footer__item" :title="config.baseApi">{{ serverHost }}</span>
        <span class="footer__item">v{{ config.version }}</span>
      </footer>
    </div>

    <!-- 登录/退出切换遮罩：窗口缩放期间显示品牌闪屏，避免露出不匹配画面 -->
    <div v-if="switching" class="switching-mask">
      <UiLogo :size="48" />
      <div class="switching-mask__title">血压及B超检测</div>
      <div class="switching-mask__bar"><span></span></div>
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LoginView from '@r/views/LoginView.vue'
import WindowControls from '@r/components/WindowControls.vue'
import ToastHost from '@r/components/ui/ToastHost.vue'
import ConfirmHost from '@r/components/ui/ConfirmHost.vue'
import UpdateDialog from '@r/components/UpdateDialog.vue'
import UpdateChip from '@r/components/UpdateChip.vue'
import UiLogo from '@r/components/ui/UiLogo.vue'
import UiIcon from '@r/components/ui/UiIcon.vue'
import type { IconName } from '@r/components/ui/icons'
import { useConfigStore } from '@r/stores/config'
import { useUserStore } from '@r/stores/user'
import { useThemeStore, type ThemeMode } from '@r/stores/theme'
import { useUpdateStore } from '@r/stores/update'
import { useNetworkStore } from '@r/stores/network'
import { authApi } from '@r/api/auth'
import { appApi } from '@r/api/app'
import { windowApi } from '@r/api/window'
import { confirmBox } from '@r/utils/confirm'
import { formatDateTime } from '@shared/utils/format'
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

/** 网络状态（统一来源） */
const network = useNetworkStore()
const osArch = ref<'x86' | 'x64'>('x64')
const osBitness = computed(() => (osArch.value === 'x64' ? '64 位' : '32 位'))

/** WiFi 信号格（4 格，按信号强度点亮） */
const WIFI_BAR_HEIGHTS = [4, 7, 10, 13]

/** 最近检测时间 HH:mm:ss */
const lastCheckedText = computed(() =>
  network.lastCheckedAt ? formatDateTime(new Date(network.lastCheckedAt)).slice(11) : '—'
)

/** 联网使用开关：写回 B超偏好 */
async function toggleOnline(value: string | number | boolean): Promise<void> {
  try {
    await config.update({ bScanPrefs: { ...config.bScanPrefs, online: Boolean(value) } })
  } catch {
    // 忽略
  }
}

/** 血压自动上传开关 */
async function toggleBpAutoUpload(value: string | number | boolean): Promise<void> {
  try {
    await config.update({ bpAutoUpload: Boolean(value) })
  } catch {
    // 忽略
  }
}
/** 登录/退出切换中：盖一层品牌遮罩，避免窗口缩放时露出不匹配的画面 */
const switching = ref(false)

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 等待两帧，确保 DOM（遮罩）已真正绘制 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  )
}

/** 进入应用：先绘制遮罩 → 放大窗口 → 渲染主界面 → 揭开遮罩 */
async function enterApp(): Promise<void> {
  if (switching.value) return
  switching.value = true
  await nextTick()
  await nextFrame()
  await windowApi.setMode('main')
  entered.value = true
  await nextTick()
  await delay(280)
  switching.value = false
  void autoCheckUpdate()
  prefetchRoutes()
}

/** 退出登录：先绘制遮罩 → 渲染登录页 → 缩小窗口 → 揭开遮罩 */
async function leaveApp(): Promise<void> {
  if (switching.value) return
  switching.value = true
  entered.value = false
  await nextTick()
  await nextFrame()
  await windowApi.setMode('login')
  await delay(280)
  switching.value = false
}

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
  void enterApp()
}
function handleOffline(): void {
  userStore.isOnline = 'N'
  void enterApp()
}

/**
 * 空闲时预取各路由的懒加载 chunk：把首次进入页面的「加载/解析」成本提前到启动空闲期，
 * 让后续路由切换与首次渲染保持顺滑（与数据存储/Pinia 无关）。
 */
let routePrefetched = false
function prefetchRoutes(): void {
  if (routePrefetched) return
  routePrefetched = true
  const run = (): void => {
    for (const record of router.getRoutes()) {
      const loader = record.components?.default
      if (typeof loader === 'function') {
        void (loader as unknown as () => Promise<unknown>)().catch(() => undefined)
      }
    }
  }
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number })
    .requestIdleCallback
  if (idle) idle(run)
  else setTimeout(run, 1500)
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
    await leaveApp()
  }
}

onMounted(async () => {
  theme.init()
  await config.load()
  entered.value = config.loggedIn
  userStore.isOnline = config.loggedIn ? 'Y' : 'N'
  void updateStore.init()
  if (entered.value) {
    void autoCheckUpdate()
    prefetchRoutes()
  }
  configureHotkeys(() => config.hotkeys)
  installHotkeys()
  void appApi
    .info()
    .then((info) => {
      osArch.value = info.osArch
    })
    .catch(() => undefined)
  network.start()
})

onUnmounted(() => {
  network.stop()
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
  background: var(--accent-weak);
  color: var(--accent-ink);
  font-weight: 600;
}
.item.is-active .ui-icon {
  color: var(--accent-ink);
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

/* WiFi 信号格 */
.net-bars {
  flex-shrink: 0;
}
.net-bars rect {
  fill: var(--line-strong);
}
.net-bars rect.is-on {
  fill: var(--t1);
}

/* 底栏网络项可点击 */
.footer__item--btn {
  cursor: pointer;
}
.footer__item--btn:hover {
  color: var(--t1);
}

/* 网络详情面板 */
.net-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.net-panel__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: var(--fs-sm);
  color: var(--t2);
}
.net-panel__row b {
  max-width: 160px;
  overflow: hidden;
  color: var(--t1);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.net-panel__sep {
  height: 1px;
  background: var(--line);
}
.net-panel__switch {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-sm);
  color: var(--t1);
  cursor: pointer;
}
.net-panel__hint {
  font-size: var(--fs-xs);
  color: var(--t3);
}

/* 登录/退出切换遮罩（品牌闪屏） */
.switching-mask {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  background: var(--bg);
  -webkit-app-region: drag;
}
.switching-mask__title {
  font-size: var(--fs-xs);
  color: var(--t3);
  letter-spacing: var(--ls-label);
}
.switching-mask__bar {
  width: 120px;
  height: 2px;
  background: var(--line);
  overflow: hidden;
}
.switching-mask__bar span {
  display: block;
  width: 40%;
  height: 100%;
  background: var(--accent);
  animation: switching-slide 1s ease-in-out infinite;
}
@keyframes switching-slide {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(320%);
  }
}
</style>
