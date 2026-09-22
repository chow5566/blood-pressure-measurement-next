<template>
  <div class="settings app-scope">
    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tabs__item"
        :class="{ 'is-on': activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="pane">
      <!-- 基础配置 -->
      <template v-if="activeTab === 'basic'">
        <section class="panel">
          <header class="panel__head">
            <div class="panel__title">服务端</div>
            <span class="panel__meta">接口契约固定，请勿随意修改</span>
          </header>
          <div class="panel__body">
            <div class="row">
              <label class="row__label">服务端地址</label>
              <div class="row__field">
                <UiInput v-model="form.baseApi" />
                <div class="row__desc">后端接口地址，用于登录与数据上传</div>
              </div>
            </div>
            <div class="row">
              <label class="row__label">静态资源地址</label>
              <div class="row__field">
                <UiInput v-model="form.staticApi" />
                <div class="row__desc">用于加载服务器上的图片资源</div>
              </div>
            </div>
          </div>
          <footer class="pane__foot">
            <UiButton variant="primary" :loading="saving" @click="saveConfig">保存配置</UiButton>
          </footer>
        </section>

        <section class="panel">
          <header class="panel__head">
            <div class="panel__title">显示</div>
          </header>
          <div class="panel__body">
            <div class="row">
              <label class="row__label">渲染模式</label>
              <div class="row__field">
                <select v-model="form.renderMode" class="select">
                  <option value="gpu">GPU（默认）</option>
                  <option value="software">软件渲染</option>
                </select>
                <div class="row__desc">Win7 显示异常时可切换软件渲染（需重启）</div>
              </div>
            </div>

            <div class="row">
              <label class="row__label">报告模板标题</label>
              <div class="row__field">
                <UiInput v-model="form.reportTitle" />
                <div class="row__desc">B超报告顶部标题（通常为机构名称）</div>
              </div>
            </div>
          </div>
          <footer class="pane__foot">
            <UiButton variant="primary" :loading="saving" @click="saveConfig">保存配置</UiButton>
          </footer>
        </section>
      </template>

      <!-- 外观 -->
      <template v-else-if="activeTab === 'appearance'">
        <section class="panel">
          <header class="panel__head">
            <div class="panel__title">界面主题</div>
            <span class="panel__meta">立即生效，自动记忆</span>
          </header>
          <div class="panel__body">
            <div class="seg">
              <button
                v-for="opt in themeOptions"
                :key="opt.id"
                class="seg__item"
                :class="{ 'is-on': theme.mode === opt.id }"
                @click="theme.setMode(opt.id)"
              >
                <UiIcon :name="opt.icon" :size="14" />
                {{ opt.label }}
              </button>
            </div>
          </div>
        </section>
      </template>

      <!-- 设备与更新 -->
      <template v-else-if="activeTab === 'device'">
        <section class="panel">
          <header class="panel__head">
            <div class="panel__title">设备驱动</div>
            <span class="panel__meta">{{ driver?.osArch || '检测中' }}</span>
          </header>
          <div class="panel__body">
            <div class="row row--inline">
              <div class="row__field">
                <span class="app-tag" :class="driver?.installed ? 'app-tag--ok' : 'app-tag--warn'">
                  {{ driver?.installed ? '已安装' : '未安装' }}
                </span>
                <span class="row__meta">VGA2USB 采集卡驱动</span>
              </div>
              <div class="row__ops">
                <UiButton
                  variant="secondary"
                  size="sm"
                  :loading="driverLoading"
                  @click="refreshDriver"
                >
                  刷新
                </UiButton>
                <UiButton
                  v-if="!driver?.installed"
                  variant="primary"
                  size="sm"
                  :loading="driverLoading"
                  @click="installDriver"
                >
                  安装
                </UiButton>
                <UiButton
                  v-else
                  variant="danger"
                  size="sm"
                  :loading="driverLoading"
                  @click="uninstallDriver"
                >
                  卸载
                </UiButton>
              </div>
            </div>
          </div>
        </section>

        <section class="panel">
          <header class="panel__head">
            <div class="panel__title">软件更新</div>
            <span class="panel__meta">v{{ config.version }}</span>
          </header>
          <div class="panel__body">
            <div class="row row--inline">
              <div class="row__field">
                <span class="row__meta">{{ updateText }}</span>
              </div>
              <div class="row__ops">
                <UiButton variant="secondary" size="sm" :loading="checking" @click="checkUpdate">
                  检查更新
                </UiButton>
                <UiButton
                  v-if="update?.state === 'available'"
                  variant="primary"
                  size="sm"
                  :loading="downloading"
                  @click="downloadUpdate"
                >
                  下载更新
                </UiButton>
                <UiButton
                  v-if="update?.state === 'downloaded'"
                  variant="primary"
                  size="sm"
                  @click="installUpdate"
                >
                  重启安装
                </UiButton>
                <UiButton
                  v-if="update?.state === 'available'"
                  variant="ghost"
                  size="sm"
                  @click="handleSkipVersion"
                >
                  不再提示此版本
                </UiButton>
              </div>
            </div>
            <div
              v-if="update && update.state !== 'idle' && update.state !== 'checking'"
              class="update-meta"
            >
              <div class="update-meta__head">
                <span class="label-cap">版本</span>
                <span class="update-meta__ver">v{{ update.version || config.version }}</span>
                <span v-if="update.sizeBytes" class="app-hint">
                  安装包 {{ formatBytes(update.sizeBytes) }}
                </span>
              </div>
              <div v-if="update.releaseNotes" class="update-meta__notes">
                {{ update.releaseNotes }}
              </div>
            </div>
            <div v-if="update?.state === 'downloading'" class="bar">
              <div class="bar__fill" :style="{ width: (update.percent ?? 0) + '%' }"></div>
            </div>
          </div>
        </section>
      </template>

      <!-- 关于 -->
      <template v-else-if="activeTab === 'about'">
        <section class="panel">
          <header class="panel__head">
            <div class="panel__title">关于本软件</div>
            <span class="panel__meta">v{{ config.version }}</span>
          </header>
          <div class="panel__body about">
            <div class="about__watermark" aria-hidden="true">SKZX</div>
            <div class="about__name">血压及B超检测</div>
            <p class="about__desc">
              本软件是体检管理系统的一部分，由山东山科智心科技有限公司开发。
            </p>
            <div class="about__row">
              <span class="about__k">公司官网</span>
              <button class="link" @click="openExternal('http://www.skzxsci.com')">
                www.skzxsci.com
              </button>
            </div>
            <div class="about__row">
              <span class="about__k">项目地址</span>
              <button
                class="link"
                @click="openExternal('http://www.chealth.cn/local-data-display/#/login')"
              >
                http://www.chealth.cn/local-data-display/#/login
              </button>
            </div>
          </div>
        </section>
      </template>

      <!-- 数据存储 -->
      <template v-else-if="activeTab === 'storage'">
        <StorageView />
      </template>

      <!-- 快捷键 -->
      <template v-else-if="activeTab === 'hotkey'">
        <section class="panel">
          <header class="panel__head">
            <div class="panel__title">快捷键</div>
            <div class="hk-head">
              <span class="panel__meta">按功能分类，保存后立即生效</span>
              <UiButton variant="secondary" size="sm" @click="restoreAllHotkeys">
                恢复全部默认
              </UiButton>
            </div>
          </header>
          <div class="panel__body">
            <div v-for="group in hotkeyGroups" :key="group.category" class="hk-group">
              <div class="hk-group__title">{{ group.category }}</div>
              <table class="hktable">
                <thead>
                  <tr>
                    <th>功能</th>
                    <th class="hktable__col">快捷键</th>
                    <th class="hktable__ops-col"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in group.items" :key="item.id">
                    <td>
                      <div class="hk__name">{{ item.label }}</div>
                      <div class="hk__desc">{{ item.desc }}</div>
                    </td>
                    <td>
                      <kbd class="hk__kbd">{{ comboText(config.hotkeys[item.id]) }}</kbd>
                    </td>
                    <td class="hktable__ops">
                      <div class="hktable__ops-inner">
                        <UiButton variant="secondary" size="sm" @click="restoreHotkey(item)">
                          恢复默认
                        </UiButton>
                        <UiButton
                          variant="primary"
                          size="sm"
                          @click="openCapture(item.id, item.label, item.default)"
                        >
                          设置
                        </UiButton>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="app-hint hk-hint">
              点击「设置」后在输入框按下组合键即可；保存后立即生效。
            </div>
          </div>
        </section>
      </template>
    </div>

    <!-- 快捷键捕获 -->
    <el-dialog
      v-model="captureVisible"
      class="app-scope"
      :title="`设置快捷键 · ${captureLabel}`"
      width="400px"
      align-center
      draggable
      @opened="onCaptureOpened"
      @closed="onCaptureClosed"
    >
      <div class="cap">
        <div class="cap__tip">
          直接按下想要的组合键即可录制；单独按 Ctrl / Shift / Alt 无效，按 Esc 取消。
        </div>
        <div
          ref="captureBoxRef"
          class="cap__box"
          :class="{ 'is-empty': !captureDraft.key }"
          tabindex="0"
        >
          {{ captureDraft.key ? comboText(captureDraft) : '请按下组合键…' }}
        </div>
        <div class="cap__current">
          当前：<kbd class="hk__kbd">{{ comboText(config.hotkeys[captureKeyName]) }}</kbd>
        </div>
      </div>
      <template #footer>
        <el-button @click="captureVisible = false">取消</el-button>
        <el-button @click="useCaptureDefault">恢复默认</el-button>
        <el-button type="primary" :disabled="!captureDraft.key" @click="saveCapture">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import UiButton from '@r/components/ui/UiButton.vue'
import UiInput from '@r/components/ui/UiInput.vue'
import UiIcon from '@r/components/ui/UiIcon.vue'
import StorageView from '@r/views/StorageView.vue'
import type { IconName } from '@r/components/ui/icons'
import { useConfigStore } from '@r/stores/config'
import { useThemeStore, type ThemeMode } from '@r/stores/theme'
import { driverApi } from '@r/api/driver'
import { updateApi } from '@r/api/update'
import { appApi } from '@r/api/app'
import { toast } from '@r/utils/toast'
import { confirmBox } from '@r/utils/confirm'
import { skipVersion } from '@r/utils/update'
import { comboText } from '@r/utils/hotkey'
import { groupedHotkeyDefs, HOTKEY_DEFS, type HotkeyDef } from '@shared/domain/hotkeys'
import { formatBytes } from '@shared/utils/format'
import type { DriverStatus, HotkeyConfig, PhotoHotkey, UpdateStatus } from '@shared/domain/app'

/** 设置页：基础配置 / 外观 / 设备与更新 / 快捷键（分类 Tab） */
const config = useConfigStore()
const theme = useThemeStore()

type TabId = 'basic' | 'appearance' | 'device' | 'storage' | 'hotkey' | 'about'
const activeTab = ref<TabId>('basic')
const tabs: { id: TabId; label: string }[] = [
  { id: 'basic', label: '基础配置' },
  { id: 'appearance', label: '外观' },
  { id: 'device', label: '设备与更新' },
  { id: 'storage', label: '数据存储' },
  { id: 'hotkey', label: '快捷键' },
  { id: 'about', label: '关于' }
]

const themeOptions: { id: ThemeMode; label: string; icon: IconName }[] = [
  { id: 'light', label: '浅色', icon: 'sun' },
  { id: 'dark', label: '深色', icon: 'moon' },
  { id: 'system', label: '跟随系统', icon: 'monitor' }
]

const form = reactive({
  baseApi: config.baseApi,
  staticApi: config.staticApi,
  renderMode: config.renderMode,
  reportTitle: config.reportTemplate.title
})
const saving = ref(false)

// ── 快捷键（由注册表按功能分组派生） ─────────────────────
const hotkeyGroups = groupedHotkeyDefs()

const captureVisible = ref(false)
const captureKeyName = ref('')
const captureLabel = ref('')
const captureDefault = ref<PhotoHotkey>({ key: '', ctrl: false, alt: false, shift: false })
const captureDraft = ref<PhotoHotkey>({ key: '', ctrl: false, alt: false, shift: false })
const captureBoxRef = ref<HTMLElement>()

function openCapture(key: string, label: string, fallback: PhotoHotkey): void {
  captureKeyName.value = key
  captureLabel.value = label
  captureDefault.value = { ...fallback }
  captureDraft.value = { key: '', ctrl: false, alt: false, shift: false }
  captureVisible.value = true
}

/** 弹框动画结束后自动聚焦并开始监听，无需先点击 */
function onCaptureOpened(): void {
  captureBoxRef.value?.focus()
  window.addEventListener('keydown', onCaptureKeydown, true)
}
function onCaptureClosed(): void {
  window.removeEventListener('keydown', onCaptureKeydown, true)
}

function onCaptureKeydown(event: KeyboardEvent): void {
  event.preventDefault()
  event.stopPropagation()
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return
  if (event.key === 'Escape') {
    captureVisible.value = false
    return
  }
  captureDraft.value = {
    key: event.code,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey
  }
}

function useCaptureDefault(): void {
  captureDraft.value = { ...captureDefault.value }
}

/** 构造纯对象快捷键（剔除响应式代理），避免 IPC 结构化克隆失败 */
function plainHotkeys(): HotkeyConfig {
  const out: HotkeyConfig = {}
  for (const [key, value] of Object.entries(config.hotkeys)) {
    out[key] = { ...value }
  }
  return out
}

async function saveCapture(): Promise<void> {
  if (!captureDraft.value.key) {
    toast('请先按下组合键', 'error')
    return
  }
  await config.update({
    hotkeys: { ...plainHotkeys(), [captureKeyName.value]: { ...captureDraft.value } }
  })
  captureVisible.value = false
  toast(`已保存：${comboText(captureDraft.value)}`, 'success')
}

async function restoreHotkey(item: HotkeyDef): Promise<void> {
  await config.update({ hotkeys: { ...plainHotkeys(), [item.id]: { ...item.default } } })
  toast(`「${item.label}」已恢复默认`, 'success')
}

/** 恢复全部快捷键为默认值 */
async function restoreAllHotkeys(): Promise<void> {
  const ok = await confirmBox('将全部快捷键恢复为默认值？', { title: '恢复全部默认' })
  if (!ok) return
  const next: HotkeyConfig = {}
  for (const def of HOTKEY_DEFS) next[def.id] = { ...def.default }
  await config.update({ hotkeys: next })
  toast('已恢复全部默认快捷键', 'success')
}

// ── 驱动 / 更新 ───────────────────────────────────────
const driver = ref<DriverStatus | null>(null)
const driverLoading = ref(false)

const update = ref<UpdateStatus | null>(null)
const checking = ref(false)
const downloading = ref(false)

let unsubscribeStatus: (() => void) | null = null

const updateText = computed(() => {
  const state = update.value?.state
  switch (state) {
    case 'checking':
      return '正在检查更新…'
    case 'available':
      return `发现新版本 v${update.value?.version}`
    case 'not-available':
      return '当前已是最新版本'
    case 'downloading':
      return `正在下载… ${update.value?.percent ?? 0}%`
    case 'downloaded':
      return '下载完成，可重启安装'
    case 'error':
      return `更新失败：${update.value?.message ?? ''}`
    default:
      return '点击「检查更新」获取最新版本'
  }
})

async function saveConfig(): Promise<void> {
  saving.value = true
  try {
    await config.update({
      baseApi: form.baseApi,
      staticApi: form.staticApi,
      renderMode: form.renderMode,
      reportTemplate: { title: form.reportTitle }
    })
    toast('保存成功', 'success')
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    saving.value = false
  }
}

async function refreshDriver(): Promise<void> {
  driverLoading.value = true
  try {
    driver.value = await driverApi.status('VGA2USB')
  } finally {
    driverLoading.value = false
  }
}

async function installDriver(): Promise<void> {
  driverLoading.value = true
  try {
    driver.value = await driverApi.install('VGA2USB')
    toast('驱动安装完成', 'success')
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    driverLoading.value = false
  }
}

async function uninstallDriver(): Promise<void> {
  const ok = await confirmBox('确认卸载 VGA2USB 驱动？', { danger: true })
  if (!ok) return
  driverLoading.value = true
  try {
    driver.value = await driverApi.uninstall('VGA2USB')
    toast('驱动已卸载', 'success')
  } catch (error) {
    toast((error as Error).message, 'error')
  } finally {
    driverLoading.value = false
  }
}

async function checkUpdate(): Promise<void> {
  checking.value = true
  try {
    update.value = await updateApi.check()
  } finally {
    checking.value = false
  }
}

async function downloadUpdate(): Promise<void> {
  downloading.value = true
  try {
    update.value = await updateApi.download()
  } finally {
    downloading.value = false
  }
}

async function installUpdate(): Promise<void> {
  const ok = await confirmBox('将退出并安装更新，是否继续？')
  if (ok) updateApi.install()
}

function handleSkipVersion(): void {
  const version = update.value?.version
  if (!version) return
  skipVersion(version)
  toast(`已忽略版本 v${version}`, 'success')
}

function openExternal(url: string): void {
  void appApi.openExternal(url)
}

onMounted(() => {
  void refreshDriver()
  void updateApi.status().then((s) => (update.value = s))
  unsubscribeStatus = updateApi.onStatus((s) => (update.value = s))
})

onUnmounted(() => unsubscribeStatus?.())
</script>

<style scoped>
.settings {
  max-width: 840px;
  margin: 0 auto;
  padding: 0 var(--s7) var(--s7);
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}

/* 分类 Tab 使用全局 .tabs 样式（components.scss），并固定于顶部 */
.settings .tabs {
  position: sticky;
  top: 0;
  z-index: 5;
  padding-top: var(--s4);
  background: var(--bg);
}

.pane {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}

.row {
  display: grid;
  grid-template-columns: 112px 1fr;
  gap: var(--s4);
  align-items: start;
  padding: var(--s2) 0;
}
.row + .row {
  border-top: 1px solid var(--line);
}
.row--inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
}
.row__label {
  padding-top: 7px;
  font-size: var(--fs-md);
  color: var(--t2);
}
.row__field {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--s3);
  flex-wrap: wrap;
}
.row__desc {
  margin-top: 6px;
  font-size: var(--fs-xs);
  color: var(--t3);
  flex-basis: 100%;
}
.row__meta {
  font-size: var(--fs-md);
  color: var(--t2);
}
.row__ops {
  display: flex;
  align-items: center;
  gap: var(--s2);
  flex-shrink: 0;
}

.pane__foot {
  display: flex;
  justify-content: flex-end;
  padding: var(--s3) var(--s4);
  border-top: 1px solid var(--line);
  background: var(--surface-2);
}

.select {
  height: var(--ctrl-h);
  min-width: 160px;
  padding: 0 8px;
  border: 1px solid var(--line-strong);
  background: var(--surface);
  color: var(--t1);
  font-family: inherit;
  font-size: var(--fs-md);
  outline: none;
  cursor: pointer;
}
.select:focus {
  border-color: var(--accent);
}

.seg {
  display: inline-flex;
  border: 1px solid var(--line-strong);
}
.seg__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: calc(var(--ctrl-h) - 2px);
  padding: 0 14px;
  border: none;
  border-right: 1px solid var(--line-strong);
  background: var(--surface);
  color: var(--t2);
  font-family: inherit;
  font-size: var(--fs-md);
  cursor: pointer;
}
.seg__item:last-child {
  border-right: none;
}
.seg__item:hover {
  background: var(--surface-3);
}
.seg__item.is-on {
  background: var(--accent);
  color: var(--on-accent);
}

/* 快捷键表 */
.hk-head {
  display: flex;
  align-items: center;
  gap: var(--s3);
}
.hk-group + .hk-group {
  margin-top: var(--s5);
}
.hk-group__title {
  margin-bottom: var(--s2);
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--t1);
  letter-spacing: var(--ls-label);
}
.hktable {
  width: 100%;
  border-collapse: collapse;
}
.hktable th {
  padding: 4px 8px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  font-size: var(--fs-micro);
  font-weight: 600;
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  color: var(--t3);
}
.hktable td {
  padding: 10px 8px;
  border-bottom: 1px solid var(--line);
  vertical-align: middle;
}
.hktable__col {
  width: 190px;
}
.hktable__ops-col {
  width: 170px;
}
.hktable__ops {
  text-align: right;
  white-space: nowrap;
}
.hktable__ops-inner {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
}
.hk-hint {
  margin-top: var(--s3);
}
.hk__name {
  font-size: var(--fs-md);
  color: var(--t1);
}
.hk__desc {
  margin-top: 2px;
  font-size: var(--fs-xs);
  color: var(--t3);
}
.hk__kbd {
  display: inline-block;
  min-width: 84px;
  padding: 3px 10px;
  border: 1px solid var(--line-strong);
  background: var(--surface-2);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  text-align: center;
  color: var(--t1);
}

.cap__tip {
  margin-bottom: 10px;
  font-size: var(--fs-sm);
  color: var(--t3);
  line-height: 1.6;
}
.cap__box {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  padding: 0 12px;
  border: 1px dashed var(--line-strong);
  background: var(--surface-2);
  color: var(--t1);
  font-family: var(--font-mono);
  font-size: var(--fs-lg);
  outline: none;
}
.cap__box:focus {
  border-style: solid;
  border-color: var(--accent);
  background: var(--surface);
}
.cap__box.is-empty {
  color: var(--t3);
}
.cap__current {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
  font-size: var(--fs-md);
  color: var(--t2);
}

.bar {
  height: 4px;
  margin-top: var(--s3);
  background: var(--surface-3);
  overflow: hidden;
}
.bar__fill {
  height: 100%;
  background: var(--accent);
}

/* 关于 */
.about {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.about__watermark {
  position: absolute;
  right: -8px;
  bottom: -24px;
  font-size: 96px;
  font-weight: 800;
  letter-spacing: 8px;
  color: var(--t1);
  opacity: 0.04;
  transform: rotate(-18deg);
  pointer-events: none;
  user-select: none;
}

/* 更新说明 */
.update-meta {
  margin-top: var(--s3);
  padding-top: var(--s3);
  border-top: 1px solid var(--line);
}
.update-meta__head {
  display: flex;
  align-items: center;
  gap: var(--s2);
}
.update-meta__ver {
  font-size: var(--fs-md);
  font-weight: 600;
  color: var(--t1);
}
.update-meta__notes {
  margin-top: var(--s2);
  max-height: 160px;
  overflow: auto;
  font-size: var(--fs-sm);
  color: var(--t2);
  line-height: 1.7;
  white-space: pre-wrap;
}
.about__name {
  font-size: var(--fs-lg);
  font-weight: 600;
}
.about__desc {
  margin: 0 0 8px;
  font-size: var(--fs-md);
  color: var(--t2);
  line-height: 1.7;
}
.about__row {
  display: flex;
  gap: var(--s3);
  font-size: var(--fs-md);
}
.about__k {
  width: 72px;
  flex-shrink: 0;
  color: var(--t3);
}
.link {
  border: none;
  background: transparent;
  padding: 0;
  color: var(--accent-ink);
  font-family: inherit;
  font-size: var(--fs-md);
  text-align: left;
  word-break: break-all;
  cursor: pointer;
}
.link:hover {
  text-decoration: underline;
}
</style>
