<template>
  <el-dialog
    v-model="visible"
    class="app-scope update-dialog"
    width="640px"
    align-center
    :close-on-click-modal="false"
    append-to-body
  >
    <template #header>
      <div class="ud__header">
        <div class="ud__title">
          <span>软件更新</span>
        </div>
        <div class="ud__subtitle">{{ subtitle }}</div>
      </div>
    </template>

    <div class="ud">
      <!-- 版本概览 -->
      <div class="ud__versions">
        <div class="ud__ver">
          <span class="ud__ver-label">当前版本</span>
          <span class="ud__ver-value">{{ currentVersion ? `v${currentVersion}` : '—' }}</span>
        </div>
        <div class="ud__arrow"><UiIcon name="switch" :size="16" /></div>
        <div class="ud__ver ud__ver--target">
          <span class="ud__ver-label">新版本</span>
          <span class="ud__ver-value">{{ targetVersion ? `v${targetVersion}` : '—' }}</span>
        </div>
      </div>

      <!-- 元信息 -->
      <div class="ud__meta">
        <span v-if="releaseDateText" class="ud__meta-item">
          <UiIcon name="clock" :size="13" /> 发布于 {{ releaseDateText }}
        </span>
        <span class="ud__meta-item">安装包 {{ sizeText }}</span>
        <span class="ud__meta-item">来源 GitHub Releases</span>
        <span v-if="resumableTag" class="ud__meta-item ud__meta-item--accent">{{
          resumableTag
        }}</span>
      </div>

      <!-- 更新说明 -->
      <div class="ud__section">
        <div class="ud__section-title">更新内容</div>
        <!-- eslint-disable-next-line vue/no-v-html -- renderMarkdown 已对内容做 HTML 转义 -->
        <div v-if="notesHtml" class="ud__notes md" v-html="notesHtml"></div>
        <div v-else class="ud__empty">
          <template v-if="status.state === 'not-available'">当前已是最新版本，无需更新。</template>
          <template v-else>本次更新未提供说明。</template>
        </div>
      </div>

      <!-- 下载进度 -->
      <div v-if="showProgress" class="ud__section ud__progress">
        <div class="ud__progress-head">
          <span class="ud__progress-percent">{{ percent }}%</span>
          <span class="ud__progress-state">{{ progressStateText }}</span>
        </div>
        <div class="ud__bar">
          <div class="ud__bar-fill" :style="{ width: percent + '%' }"></div>
        </div>
        <div class="ud__progress-meta">
          <span>{{ transferredText }} / {{ sizeText }}</span>
          <span v-if="speedText">{{ speedText }}</span>
          <span v-if="etaText">{{ etaText }}</span>
        </div>
      </div>

      <!-- 错误 -->
      <div v-if="status.state === 'error' && status.message" class="ud__error">
        <UiIcon name="close" :size="14" />
        <span>{{ status.message }}</span>
      </div>

      <!-- 已忽略版本 -->
      <div class="ud__skipped-toggle">
        <button class="ud__link" @click="showSkipped = !showSkipped">
          {{ showSkipped ? '收起' : '管理已忽略的版本' }}
          <span v-if="store.skipped.length" class="ud__badge">{{ store.skipped.length }}</span>
        </button>
      </div>
      <div v-if="showSkipped" class="ud__skipped">
        <div v-if="!store.skipped.length" class="ud__empty">暂无忽略的版本</div>
        <template v-else>
          <div v-for="item in store.skipped" :key="item" class="ud__skip-item">
            <span class="ud__skip-ver">v{{ item }}</span>
            <UiButton size="sm" variant="ghost" @click="store.unskip(item)">恢复提示</UiButton>
          </div>
          <div class="ud__skip-clear">
            <UiButton size="sm" variant="ghost" @click="store.clearSkipped()">全部恢复</UiButton>
          </div>
        </template>
      </div>
    </div>

    <template #footer>
      <div class="ud__footer">
        <div class="ud__footer-left">
          <span v-if="isDownloaded" class="ud__hint">已下载完成，可重启安装</span>
        </div>
        <div class="ud__footer-right">
          <template v-for="action in actions" :key="action.key">
            <UiButton
              :variant="action.variant"
              :size="'md'"
              :loading="action.loading"
              @click="action.onClick"
            >
              {{ action.label }}
            </UiButton>
          </template>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import UiButton from '@r/components/ui/UiButton.vue'
import UiIcon from '@r/components/ui/UiIcon.vue'
import { useUpdateStore } from '@r/stores/update'
import { renderMarkdown } from '@r/utils/markdown'
import { formatBytes, formatDate } from '@shared/utils/format'

const store = useUpdateStore()
const showSkipped = ref(false)

const visible = computed({
  get: () => store.visible,
  set: (value: boolean) => (value ? store.open() : store.close())
})

const status = computed(() => store.status)
const currentVersion = computed(() => store.currentVersion)
const targetVersion = computed(() => store.targetVersion)
const isDownloaded = computed(() => status.value.state === 'downloaded')

const subtitle = computed(() => {
  switch (status.value.state) {
    case 'checking':
      return '正在检查更新…'
    case 'available':
      return '发现可用更新，建议尽快升级'
    case 'downloading':
      return '正在下载更新包'
    case 'paused':
      return '下载已暂停，可随时继续（支持断点续传）'
    case 'downloaded':
      return '更新包已就绪，重启后完成安装'
    case 'not-available':
      return '当前已是最新版本'
    case 'error':
      return '更新过程中出现问题'
    default:
      return '检查并安装新版本'
  }
})

const notesHtml = computed(() => renderMarkdown(status.value.releaseNotes || ''))

const percent = computed(() => Math.min(100, Math.max(0, Math.round(status.value.percent ?? 0))))

const sizeText = computed(() => {
  const bytes = status.value.sizeBytes || status.value.total
  return bytes ? formatBytes(bytes) : '未知'
})

const transferredText = computed(() => formatBytes(status.value.transferred ?? 0))

const speedText = computed(() => {
  const speed = status.value.bytesPerSecond ?? 0
  return speed > 0 ? `${formatBytes(speed)}/s` : ''
})

const etaText = computed(() => {
  const { total, transferred, bytesPerSecond } = status.value
  if (!total || !bytesPerSecond || bytesPerSecond <= 0) return ''
  const remain = Math.max(0, total - (transferred ?? 0))
  return `剩余约 ${formatDuration(Math.round(remain / bytesPerSecond))}`
})

const releaseDateText = computed(() => {
  const value = status.value.releaseDate
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : formatDate(date)
})

const showProgress = computed(() =>
  ['downloading', 'paused', 'downloaded'].includes(status.value.state)
)

const resumableTag = computed(() => {
  if (status.value.state === 'paused') return '已保留进度，支持断点续传'
  if (status.value.resumable) return '检测到未完成下载，可续传'
  return ''
})

const progressStateText = computed(() => {
  switch (status.value.state) {
    case 'downloading':
      return '下载中'
    case 'paused':
      return '已暂停'
    case 'downloaded':
      return '下载完成'
    default:
      return ''
  }
})

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes} 分 ${rest} 秒`
}

interface DialogAction {
  key: string
  label: string
  variant: 'primary' | 'secondary' | 'ghost' | 'danger'
  loading?: boolean
  onClick: () => void
}

const actions = computed<DialogAction[]>(() => {
  const state = status.value.state
  const version = targetVersion.value
  const list: DialogAction[] = []

  switch (state) {
    case 'idle':
    case 'not-available':
      list.push({ key: 'close', label: '关闭', variant: 'ghost', onClick: () => store.close() })
      list.push({
        key: 'check',
        label: '检查更新',
        variant: 'primary',
        onClick: () => void store.check()
      })
      break
    case 'checking':
      list.push({
        key: 'checking',
        label: '检查中…',
        variant: 'secondary',
        loading: true,
        onClick: () => undefined
      })
      break
    case 'available':
      list.push({ key: 'later', label: '稍后', variant: 'ghost', onClick: () => store.close() })
      if (version) {
        list.push({
          key: 'skip',
          label: '忽略此版本',
          variant: 'ghost',
          onClick: () => store.skip(version)
        })
      }
      list.push({
        key: 'download',
        label: status.value.resumable ? '继续下载' : '立即更新',
        variant: 'primary',
        onClick: () => void store.download()
      })
      break
    case 'downloading':
      list.push({
        key: 'background',
        label: '后台下载',
        variant: 'ghost',
        onClick: () => store.close()
      })
      list.push({
        key: 'pause',
        label: '暂停',
        variant: 'secondary',
        onClick: () => void store.pause()
      })
      break
    case 'paused':
      list.push({
        key: 'cancel',
        label: '取消更新',
        variant: 'ghost',
        onClick: () => void store.cancel()
      })
      list.push({
        key: 'resume',
        label: '继续下载',
        variant: 'primary',
        onClick: () => void store.download()
      })
      break
    case 'downloaded':
      list.push({ key: 'later', label: '稍后', variant: 'ghost', onClick: () => store.close() })
      if (version) {
        list.push({
          key: 'skip',
          label: '忽略此版本',
          variant: 'ghost',
          onClick: () => store.skip(version)
        })
      }
      list.push({
        key: 'install',
        label: '重启并安装',
        variant: 'primary',
        onClick: () => store.install()
      })
      break
    case 'error':
      list.push({ key: 'close', label: '关闭', variant: 'ghost', onClick: () => store.close() })
      list.push({
        key: 'retry',
        label: '重试',
        variant: 'primary',
        onClick: () => void (status.value.version ? store.download() : store.check())
      })
      break
    default:
      list.push({ key: 'close', label: '关闭', variant: 'ghost', onClick: () => store.close() })
  }
  return list
})
</script>

<style scoped>
.ud__header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ud__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-lg);
  font-weight: 600;
}
.ud__subtitle {
  font-size: var(--fs-xs);
  color: var(--t3);
}

.ud {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}

/* 版本概览 */
.ud__versions {
  display: flex;
  align-items: center;
  gap: var(--s4);
  padding: var(--s3) var(--s4);
  background: var(--surface-2);
  border: 1px solid var(--line);
}
.ud__ver {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ud__ver-label {
  font-size: var(--fs-micro);
  color: var(--t3);
  letter-spacing: var(--ls-label);
}
.ud__ver-value {
  font-size: var(--fs-lg);
  font-weight: 600;
  font-family: var(--font-mono);
}
.ud__ver--target .ud__ver-value {
  color: var(--accent-ink);
}
.ud__arrow {
  color: var(--t3);
  display: flex;
  align-items: center;
}

/* 元信息 */
.ud__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2) var(--s4);
  font-size: var(--fs-sm);
  color: var(--t2);
}
.ud__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.ud__meta-item--accent {
  color: var(--accent-ink);
}

/* 更新说明 */
.ud__section {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
}
.ud__section-title {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--t1);
}
.ud__notes {
  max-height: 220px;
  overflow: auto;
  padding: var(--s3);
  border: 1px solid var(--line);
  background: var(--surface-2);
  font-size: var(--fs-sm);
  color: var(--t2);
  line-height: 1.7;
}
.ud__empty {
  font-size: var(--fs-sm);
  color: var(--t3);
  padding: var(--s2) 0;
}

/* 进度 */
.ud__progress {
  gap: var(--s2);
}
.ud__progress-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.ud__progress-percent {
  font-size: var(--fs-2xl);
  font-weight: 600;
  font-family: var(--font-mono);
}
.ud__progress-state {
  font-size: var(--fs-sm);
  color: var(--t3);
}
.ud__bar {
  height: 8px;
  background: var(--surface-3);
  border: 1px solid var(--line);
  overflow: hidden;
}
.ud__bar-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s linear;
}
.ud__progress-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2) var(--s4);
  font-size: var(--fs-xs);
  color: var(--t3);
  font-family: var(--font-mono);
}

/* 错误 */
.ud__error {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: var(--s2) var(--s3);
  background: var(--danger-weak);
  color: var(--danger);
  border: 1px solid var(--danger);
  font-size: var(--fs-sm);
}

/* 忽略版本 */
.ud__skipped-toggle {
  border-top: 1px solid var(--line);
  padding-top: var(--s3);
}
.ud__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  color: var(--t2);
  font-size: var(--fs-sm);
  cursor: pointer;
  font-family: inherit;
  padding: 0;
}
.ud__link:hover {
  color: var(--t1);
}
.ud__badge {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-micro);
  background: var(--surface-3);
  color: var(--t2);
}
.ud__skipped {
  display: flex;
  flex-direction: column;
  gap: var(--s1);
  margin-top: var(--s1);
}
.ud__skip-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--s1) var(--s2);
  background: var(--surface-2);
  border: 1px solid var(--line);
}
.ud__skip-ver {
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
}
.ud__skip-clear {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--s1);
}

/* 底栏 */
.ud__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  width: 100%;
}
.ud__footer-left {
  flex: 1;
  text-align: left;
}
.ud__hint {
  font-size: var(--fs-xs);
  color: var(--t3);
}
.ud__footer-right {
  display: flex;
  align-items: center;
  gap: var(--s2);
}

/* 更新说明 Markdown */
.md :deep(.md__h) {
  font-size: var(--fs-md);
  font-weight: 600;
  color: var(--t1);
  margin: var(--s2) 0 var(--s1);
}
.md :deep(.md__h:first-child) {
  margin-top: 0;
}
.md :deep(.md__p) {
  margin: 0 0 var(--s1);
}
.md :deep(.md__ul) {
  margin: 0 0 var(--s1);
  padding-left: 18px;
}
.md :deep(li) {
  margin: 2px 0;
}
.md :deep(code) {
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  background: var(--surface-3);
  padding: 0 4px;
}
.md :deep(a) {
  color: var(--accent-ink);
}
</style>
