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
            <span class="panel__meta">点击右侧可修改，修改后立即生效</span>
          </header>
          <div class="panel__body is-rows">
            <div class="srow">
              <div class="srow__main">
                <div class="srow__label">服务端地址</div>
                <div class="srow__desc">后端接口地址，用于登录与数据上传</div>
              </div>
              <div class="srow__ops">
                <span class="srow__value-text" :title="config.baseApi">
                  {{ config.baseApi || '未设置' }}
                </span>
                <UiButton variant="secondary" size="sm" @click="openEdit('baseApi')">
                  修改
                </UiButton>
              </div>
            </div>
            <div class="srow">
              <div class="srow__main">
                <div class="srow__label">静态资源地址</div>
                <div class="srow__desc">用于加载服务器上的图片资源</div>
              </div>
              <div class="srow__ops">
                <span class="srow__value-text" :title="config.staticApi">
                  {{ config.staticApi || '未设置' }}
                </span>
                <UiButton variant="secondary" size="sm" @click="openEdit('staticApi')">
                  修改
                </UiButton>
              </div>
            </div>
          </div>
        </section>

        <section class="panel">
          <header class="panel__head">
            <div class="panel__title">显示</div>
          </header>
          <div class="panel__body is-rows">
            <div class="srow">
              <div class="srow__main">
                <div class="srow__label">渲染模式</div>
                <div class="srow__desc">Win7 显示异常时可切换软件渲染（需重启）</div>
              </div>
              <el-select
                :model-value="config.renderMode"
                class="srow__select"
                popper-class="app-scope"
                @change="onRenderModeChange"
              >
                <el-option label="GPU（默认）" value="gpu" />
                <el-option label="软件渲染" value="software" />
              </el-select>
            </div>

            <div class="srow">
              <div class="srow__main">
                <div class="srow__label">报告模板标题</div>
                <div class="srow__desc">B超报告顶部标题（通常为机构名称）</div>
              </div>
              <div class="srow__ops">
                <span class="srow__value-text" :title="config.reportTemplate.title">
                  {{ config.reportTemplate.title || '未设置' }}
                </span>
                <UiButton variant="secondary" size="sm" @click="openEdit('reportTitle')">
                  修改
                </UiButton>
              </div>
            </div>
          </div>
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
            <span class="panel__meta">{{ osBitness }}</span>
          </header>
          <div class="panel__body">
            <p class="driver-tip">
              本应用<strong>不再负责驱动安装</strong>。请按采集卡型号自行安装驱动，并注意区分
              <strong>64 位 / 32 位</strong>（按系统位数选择）。本应用仅通过转接头 / VGA
              采集卡读取视频流。
            </p>
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
                <span class="row__meta">{{ updateSummary }}</span>
              </div>
              <div class="row__ops">
                <UiButton variant="secondary" size="sm" @click="openUpdateCenter">
                  更新中心
                  <span v-if="updateStore.hasUpdate" class="update-dot"></span>
                </UiButton>
              </div>
            </div>
            <div v-if="updateStore.skipped.length" class="row__meta update-skipped-hint">
              已忽略 {{ updateStore.skipped.length }} 个版本，可在更新中心恢复
            </div>
            <div v-if="isDownloading" class="bar">
              <div
                class="bar__fill"
                :style="{ width: Math.round(updateStore.status.percent ?? 0) + '%' }"
              ></div>
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

    <!-- 文本项编辑（点击行内值打开） -->
    <el-dialog
      v-model="editVisible"
      class="app-scope"
      :title="`修改 · ${editMeta.label}`"
      width="440px"
      align-center
      :lock-scroll="false"
      @closed="editError = ''"
    >
      <div class="edit">
        <div class="edit__desc">{{ editMeta.desc }}</div>
        <el-input
          v-model="editValue"
          size="large"
          :placeholder="editMeta.placeholder"
          @keydown.enter="saveEdit"
        />
        <div v-if="editError" class="edit__error">{{ editError }}</div>
      </div>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import UiButton from '@r/components/ui/UiButton.vue'
import UiIcon from '@r/components/ui/UiIcon.vue'
import StorageView from '@r/views/StorageView.vue'
import type { IconName } from '@r/components/ui/icons'
import { useConfigStore } from '@r/stores/config'
import { useThemeStore, type ThemeMode } from '@r/stores/theme'
import { useUpdateStore } from '@r/stores/update'
import { appApi } from '@r/api/app'
import { toast } from '@r/utils/toast'
import { confirmBox } from '@r/utils/confirm'
import { comboText } from '@r/utils/hotkey'
import { groupedHotkeyDefs, HOTKEY_DEFS, type HotkeyDef } from '@shared/domain/hotkeys'
import type { HotkeyConfig, PhotoHotkey } from '@shared/domain/app'

/** 设置页：基础配置 / 外观 / 设备与更新 / 快捷键（分类 Tab） */
const config = useConfigStore()
const theme = useThemeStore()

/** 系统位数（用于驱动提示） */
const arch = ref('')
const osBitness = computed(() => {
  const value = arch.value.toLowerCase()
  if (!value) return ''
  if (value === 'x64' || value === 'arm64') return '当前系统 64 位'
  if (value === 'ia32' || value === 'x86') return '当前系统 32 位'
  return `当前系统 ${arch.value}`
})

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

// ── 基础配置：文本项点击弹框编辑（修改后立即生效，无需保存按钮） ─────
type EditKey = 'baseApi' | 'staticApi' | 'reportTitle'

const EDIT_META: Record<EditKey, { label: string; desc: string; placeholder: string }> = {
  baseApi: {
    label: '服务端地址',
    desc: '后端接口地址，用于登录与数据上传。修改后立即生效。',
    placeholder: 'http://…/health-display-local/'
  },
  staticApi: {
    label: '静态资源地址',
    desc: '用于加载服务器上的图片资源。修改后立即生效。',
    placeholder: 'http://…/local-data-display/'
  },
  reportTitle: {
    label: '报告模板标题',
    desc: 'B超报告顶部标题（通常为机构名称）。修改后立即生效。',
    placeholder: '如：社区卫生服务中心'
  }
}

const editVisible = ref(false)
const editKey = ref<EditKey>('baseApi')
const editValue = ref('')
const editError = ref('')
const editMeta = computed(() => EDIT_META[editKey.value])

function openEdit(key: EditKey): void {
  editKey.value = key
  editValue.value =
    key === 'baseApi'
      ? config.baseApi
      : key === 'staticApi'
        ? config.staticApi
        : config.reportTemplate.title
  editError.value = ''
  editVisible.value = true
}

async function saveEdit(): Promise<void> {
  const value = editValue.value.trim()
  if (!value) {
    editError.value = '不能为空'
    return
  }
  try {
    if (editKey.value === 'baseApi') await config.update({ baseApi: value })
    else if (editKey.value === 'staticApi') await config.update({ staticApi: value })
    else await config.update({ reportTemplate: { title: value } })
    editVisible.value = false
    toast('已保存', 'success')
  } catch (error) {
    editError.value = (error as Error).message
  }
}

async function onRenderModeChange(value: string | number | boolean): Promise<void> {
  try {
    await config.update({ renderMode: value as 'gpu' | 'software' })
    toast('已切换（重启后生效）', 'success')
  } catch (error) {
    toast((error as Error).message, 'error')
  }
}

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

// ── 更新 ──────────────────────────────────────────────
const updateStore = useUpdateStore()
const isDownloading = computed(() => updateStore.status.state === 'downloading')

const updateSummary = computed(() => {
  const status = updateStore.status
  switch (status.state) {
    case 'checking':
      return '正在检查更新…'
    case 'available':
      return `发现新版本 v${status.version}`
    case 'downloading':
      return status.retry
        ? `网络不稳定，正在重试… ${Math.round(status.percent ?? 0)}%`
        : `正在下载更新… ${Math.round(status.percent ?? 0)}%`
    case 'paused':
      return `更新下载已暂停 ${Math.round(status.percent ?? 0)}%（可续传）`
    case 'finalizing':
      return '正在校验并准备安装…'
    case 'downloaded':
      return `v${status.version} 已下载，重启后安装`
    case 'not-available':
      return '当前已是最新版本'
    case 'error':
      return `更新失败：${status.message ?? ''}`
    default:
      return '打开更新中心检查并安装新版本'
  }
})

function openUpdateCenter(): void {
  void updateStore.init()
  updateStore.open()
}

function openExternal(url: string): void {
  void appApi.openExternal(url)
}

onMounted(() => {
  void updateStore.init()
  void appApi
    .info()
    .then((info) => {
      arch.value = info.arch
    })
    .catch(() => undefined)
})
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
  background: var(--foot-bg);
}

/* 设备驱动说明 */
.driver-tip {
  max-width: 640px;
  margin: 0;
  font-size: var(--fs-md);
  line-height: 1.9;
  color: var(--t2);
}
.driver-tip strong {
  color: var(--t1);
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

/* ── 行式设置项：左标题+描述，右控件 ── */
.panel__body.is-rows {
  display: flex;
  flex-direction: column;
}
.srow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s5);
  padding: var(--s4) 0;
}
.srow + .srow {
  border-top: 1px solid var(--line);
}
.srow__main {
  min-width: 0;
}
.srow__label {
  font-size: var(--fs-md);
  color: var(--t1);
}
.srow__desc {
  margin-top: 3px;
  font-size: var(--fs-xs);
  line-height: 1.5;
  color: var(--t3);
}
.srow__ops {
  display: flex;
  align-items: center;
  gap: var(--s3);
  flex-shrink: 0;
}
.srow__value-text {
  max-width: 320px;
  overflow: hidden;
  color: var(--t3);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.srow__select {
  width: 180px;
  flex-shrink: 0;
}

/* 文本项编辑弹框 */
.edit__desc {
  margin-bottom: var(--s4);
  font-size: var(--fs-sm);
  line-height: 1.6;
  color: var(--t3);
}
.edit__error {
  margin-top: var(--s2);
  font-size: var(--fs-xs);
  color: var(--danger);
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

/* 更新状态提示 */
.update-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-left: 6px;
  background: var(--accent);
  vertical-align: middle;
}
.update-skipped-hint {
  margin-top: var(--s2);
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
