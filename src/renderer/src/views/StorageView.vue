<template>
  <div class="storage app-scope">
    <div v-if="lowSpace" class="banner">
      <UiIcon name="trash" :size="14" />
      <span
        >数据磁盘空间不足：剩余
        {{ formatBytes(info?.drive?.freeBytes ?? 0) }}，建议尽快更改存储位置。</span
      >
    </div>

    <section class="panel">
      <header class="panel__head">
        <div class="panel__title">本地数据存储</div>
        <UiButton variant="secondary" size="sm" @click="load">刷新</UiButton>
      </header>
      <div class="panel__body">
        <div class="overview">
          <div class="stat">
            <div class="label-cap">已用空间</div>
            <div class="stat__value tnum">{{ formatBytes(info?.usedBytes ?? 0) }}</div>
            <div class="stat__sub">数据库 · 图片 · 报告</div>
          </div>

          <div class="disk">
            <div class="disk__top">
              <span class="disk__drive">{{ info?.drive?.drive || '未知磁盘' }}</span>
              <span class="app-tag" :class="isLocalDisk ? 'app-tag--ok' : 'app-tag--danger'">
                {{ isLocalDisk ? '本地固定磁盘' : '非本地磁盘' }}
              </span>
            </div>
            <div class="bar">
              <div
                class="bar__fill"
                :class="{ 'is-warn': lowSpace }"
                :style="{ width: usedPercent + '%' }"
              ></div>
            </div>
            <div class="disk__bottom">
              <span :class="{ 'is-warn': lowSpace }">
                剩余 {{ formatBytes(info?.drive?.freeBytes ?? 0) }}
              </span>
              <span class="spacer"></span>
              <span>总容量 {{ formatBytes(info?.drive?.totalBytes ?? 0) }}</span>
              <span class="tnum">{{ usedPercent }}% 已用</span>
            </div>
          </div>
        </div>

        <div class="path">
          <span class="label-cap">数据目录</span>
          <span class="path__value mono">{{ info?.dataDir || '加载中…' }}</span>
          <UiButton variant="secondary" size="sm" @click="openDir">打开目录</UiButton>
        </div>
      </div>
    </section>

    <section class="panel">
      <header class="panel__head">
        <div class="panel__title">更改存储位置</div>
      </header>
      <div class="panel__body">
        <p class="note">
          当磁盘空间不足时，可将本地数据（数据库、图片、报告）迁移到其他<strong>本地固定磁盘</strong>。
          迁移成功后应用会自动重启，旧位置数据将被删除。
        </p>
        <ul class="note-list">
          <li>仅支持本地固定磁盘，禁止 U盘 / 移动硬盘 / 网络盘</li>
          <li>迁移期间请勿操作或关闭应用</li>
        </ul>
        <div class="grp-actions">
          <UiButton variant="primary" :loading="choosing" @click="handleChangeDir">
            选择新的存储目录
          </UiButton>
        </div>
      </div>
    </section>

    <!-- 迁移确认 -->
    <div v-if="confirmVisible" class="mask" @click.self="confirmVisible = false">
      <div class="modal app-scope">
        <div class="modal__title">确认迁移数据目录</div>
        <div class="modal__body">
          <div class="node">
            <div class="label-cap">当前位置</div>
            <div class="node__path mono">{{ info?.dataDir }}</div>
          </div>
          <div class="node-arrow">↓</div>
          <div class="node node--to">
            <div class="label-cap">目标位置</div>
            <div class="node__path mono">{{ target }}</div>
          </div>
          <table class="mini">
            <tbody>
              <tr>
                <td>需要空间</td>
                <td class="mono">{{ formatBytes(validation?.requiredBytes ?? 0) }}</td>
              </tr>
              <tr>
                <td>目标可用</td>
                <td class="mono">{{ formatBytes(validation?.drive?.freeBytes ?? 0) }}</td>
              </tr>
            </tbody>
          </table>
          <div class="warn">迁移期间请勿操作或关闭应用，完成后应用将自动重启。</div>
        </div>
        <div class="modal__actions">
          <UiButton variant="secondary" :disabled="migrating" @click="confirmVisible = false">
            取消
          </UiButton>
          <UiButton variant="primary" :loading="migrating" @click="confirmMigrate">
            开始迁移
          </UiButton>
        </div>
      </div>
    </div>

    <!-- 迁移进度 -->
    <div v-if="progressVisible" class="mask">
      <div class="modal app-scope">
        <div class="modal__title">正在迁移数据</div>
        <div class="modal__body">
          <div class="bar bar--lg">
            <div class="bar__fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <div class="progress__phase">{{ phaseLabel }}</div>
          <div v-if="progress.totalBytes > 0" class="progress__bytes mono">
            {{ formatBytes(progress.copiedBytes) }} / {{ formatBytes(progress.totalBytes) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import UiButton from '@r/components/ui/UiButton.vue'
import UiIcon from '@r/components/ui/UiIcon.vue'
import type {
  MigratePhase,
  MigrateProgress,
  StorageInfo,
  StorageValidateResult
} from '@shared/domain/storage'
import { SPACE_THRESHOLD } from '@shared/domain/storage'
import { formatBytes, toPercent } from '@shared/utils/format'
import { storageApi } from '../api/storage'
import { toast } from '@r/utils/toast'
import { confirmBox } from '@r/utils/confirm'

/* 状态 */
const info = ref<StorageInfo | null>(null)
const choosing = ref(false)
const target = ref('')
const validation = ref<StorageValidateResult | null>(null)
const confirmVisible = ref(false)
const progressVisible = ref(false)
const migrating = ref(false)
const progress = ref<MigrateProgress>({ phase: 'idle', percent: 0, copiedBytes: 0, totalBytes: 0 })

let unsubscribe: (() => void) | null = null
let unsubscribeLowSpace: (() => void) | null = null

/* 计算 */
const lowSpace = computed(
  () => !!info.value?.drive && info.value.drive.freeBytes < SPACE_THRESHOLD.warnBytes
)
const isLocalDisk = computed(() => info.value?.drive?.isLocalDisk === true)
const usedPercent = computed(() => {
  const drive = info.value?.drive
  if (!drive || drive.totalBytes <= 0) return 0
  return toPercent(drive.totalBytes - drive.freeBytes, drive.totalBytes)
})

const PHASE_LABEL: Record<MigratePhase, string> = {
  idle: '准备中',
  precheck: '预检中',
  freeze: '暂停数据写入',
  copy: '正在复制数据',
  verify: '校验数据完整性',
  switch: '切换存储位置',
  cleanup: '清理旧数据',
  reopen: '重新加载数据库',
  done: '迁移完成，即将重启',
  failed: '迁移失败'
}
const phaseLabel = computed(() => PHASE_LABEL[progress.value.phase] ?? '处理中')
const progressPercent = computed(() => Math.min(100, Math.max(0, progress.value.percent)))

/* 行为 */
async function load(): Promise<void> {
  try {
    info.value = await storageApi.info()
  } catch (error) {
    toast(`读取存储信息失败：${(error as Error).message}`, 'error')
  }
}

async function openDir(): Promise<void> {
  try {
    await storageApi.openDir()
  } catch (error) {
    toast((error as Error).message, 'error')
  }
}

async function handleChangeDir(): Promise<void> {
  choosing.value = true
  try {
    const dir = await storageApi.chooseDir()
    if (!dir) return
    target.value = dir
    const result = await storageApi.validate(dir)
    validation.value = result
    if (!result.ok) {
      const again = await confirmBox(result.reason || '该目录不可用', {
        title: '无法使用所选目录',
        confirmText: '重新选择',
        cancelText: '取消'
      })
      if (again) void handleChangeDir()
      return
    }
    confirmVisible.value = true
  } catch (error) {
    toast(`校验失败：${(error as Error).message}`, 'error')
  } finally {
    choosing.value = false
  }
}

async function confirmMigrate(): Promise<void> {
  migrating.value = true
  progress.value = { phase: 'precheck', percent: 0, copiedBytes: 0, totalBytes: 0 }
  progressVisible.value = true
  unsubscribe?.()
  unsubscribe = storageApi.onProgress((next) => {
    progress.value = next
  })
  try {
    const result = await storageApi.migrate(target.value)
    if (result.ok) {
      progress.value = { ...progress.value, phase: 'done', percent: 100 }
      confirmVisible.value = false
    } else {
      progressVisible.value = false
      toast(result.message || '迁移失败', 'error')
    }
  } catch (error) {
    progressVisible.value = false
    toast((error as Error).message, 'error')
  } finally {
    migrating.value = false
  }
}

onMounted(() => {
  void load()
  unsubscribeLowSpace = storageApi.onLowSpace((payload) => {
    toast(`数据磁盘剩余 ${formatBytes(payload.freeBytes)}，请及时迁移`, 'error')
  })
})

onUnmounted(() => {
  unsubscribe?.()
  unsubscribeLowSpace?.()
})
</script>

<style scoped>
.storage {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}

.banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: var(--s2) var(--s3);
  border-left: 3px solid var(--danger);
  background: var(--danger-weak);
  color: var(--danger);
  font-size: var(--fs-md);
}

.overview {
  display: grid;
  grid-template-columns: 180px 1fr;
  gap: var(--s6);
  align-items: center;
}
.stat__value {
  margin: 4px 0 2px;
  font-size: var(--fs-2xl);
  font-weight: 600;
  letter-spacing: -0.5px;
}
.stat__sub {
  font-size: var(--fs-xs);
  color: var(--t3);
}

.disk__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--s2);
}
.disk__drive {
  font-weight: 600;
  font-size: var(--fs-base);
}
.disk__bottom {
  display: flex;
  align-items: center;
  gap: var(--s4);
  margin-top: var(--s2);
  font-size: var(--fs-xs);
  color: var(--t3);
}
.disk__bottom .is-warn {
  color: var(--danger);
  font-weight: 600;
}
.spacer {
  flex: 1;
}

.bar {
  height: 8px;
  background: var(--surface-3);
  overflow: hidden;
}
.bar--lg {
  height: 10px;
}
.bar__fill {
  height: 100%;
  background: var(--accent);
}
.bar__fill.is-warn {
  background: var(--danger);
}

.path {
  display: flex;
  align-items: center;
  gap: var(--s3);
  margin-top: var(--s4);
  padding-top: var(--s4);
  border-top: 1px solid var(--line);
}
.path__value {
  flex: 1;
  min-width: 0;
  font-size: var(--fs-sm);
  color: var(--t2);
  word-break: break-all;
  user-select: text;
}

.note {
  margin: 0 0 var(--s2);
  font-size: var(--fs-md);
  color: var(--t2);
  line-height: 1.6;
}
.note-list {
  margin: 0 0 var(--s3);
  padding-left: 18px;
  color: var(--t3);
  font-size: var(--fs-sm);
  line-height: 1.7;
}
.grp-actions {
  display: flex;
  justify-content: flex-end;
}

/* 弹窗 */
.mask {
  position: fixed;
  inset: 0;
  z-index: 2500;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}
.modal {
  width: 460px;
  background: var(--surface);
  border: 1px solid var(--line-strong);
  box-shadow: var(--sh-pop);
}
.modal__title {
  padding: var(--s3) var(--s4);
  background: var(--surface-2);
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-md);
  font-weight: 600;
  letter-spacing: var(--ls-label);
}
.modal__body {
  padding: var(--s4);
}
.modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--s2);
  padding: var(--s3) var(--s4);
  border-top: 1px solid var(--line);
  background: var(--surface-2);
}
.node {
  padding: var(--s2) var(--s3);
  border: 1px solid var(--line);
  background: var(--surface-2);
}
.node--to {
  border-color: var(--accent);
  background: var(--accent-weak);
}
.node__path {
  font-size: var(--fs-sm);
  color: var(--t2);
  word-break: break-all;
  user-select: text;
  margin-top: 3px;
}
.node-arrow {
  text-align: center;
  padding: 4px 0;
  color: var(--t3);
}
.mini {
  width: 100%;
  border-collapse: collapse;
  margin: var(--s3) 0;
  font-size: var(--fs-sm);
}
.mini td {
  padding: 5px 8px;
  border: 1px solid var(--line);
}
.mini td:first-child {
  width: 96px;
  color: var(--t3);
  background: var(--surface-2);
}
.mini td:last-child {
  font-weight: 600;
  font-size: var(--fs-md);
}
.warn {
  padding: var(--s2) var(--s3);
  border-left: 3px solid var(--warn);
  background: var(--warn-weak);
  color: var(--warn);
  font-size: var(--fs-sm);
}
.progress__phase {
  margin-top: var(--s3);
  font-size: var(--fs-md);
  color: var(--t2);
}
.progress__bytes {
  margin-top: 2px;
  font-size: var(--fs-sm);
  color: var(--t3);
}
</style>
