<template>
  <div class="bscan-page app-scope">
    <!-- 左：采集 -->
    <div class="bscan-col">
      <section class="panel panel--video">
        <div class="panel__head">
          <div class="panel__title">影像采集</div>
          <el-checkbox v-model="store.defaultCheckPic">采集后默认勾选</el-checkbox>
        </div>
        <div class="panel__body panel__body--tight">
          <VideoView ref="videoRef" :capture-enabled="captureReady" />
        </div>
      </section>

      <section class="panel panel--gallery">
        <div class="panel__head">
          <div class="panel__title">
            已采集
            <small>{{ store.tempPics.length }} / 20</small>
          </div>
          <span class="panel__meta">勾选即上传（最多 4 张），其余仅保存本地</span>
        </div>
        <div v-loading="store.pageLoading" class="gallery">
          <div v-if="store.tempPics.length === 0" class="gallery__empty">
            <span class="gallery__empty-icon"
              ><el-icon :size="24"><Picture /></el-icon
            ></span>
            <span class="gallery__empty-title">暂无采集图片</span>
            <span class="app-hint">
              {{
                captureReady
                  ? `在上方画面中点击「采集」，或按 ${takePhotoLabel} 快捷键`
                  : '请先扫描或输入条码号，再进行采集'
              }}
            </span>
          </div>
          <div v-else class="gallery__grid">
            <PicView
              v-for="(item, index) in store.tempPics"
              :key="item.id"
              :info="item"
              :index="index"
              :preview-src-list="store.tempPics"
              @toggle="toggleCheck(item)"
              @delete="store.removeTempPic($event)"
            />
          </div>
        </div>
      </section>
    </div>

    <!-- 右：表单与操作 -->
    <section class="panel panel--form">
      <div class="panel__head">
        <div class="panel__title">
          检查报告
          <span class="net-status" :class="{ 'is-off': !network.online }" :title="network.title">
            <span class="dot"></span>
            {{ network.online ? (network.type === 'wifi' ? 'WiFi' : '有线') : '未联网' }}
          </span>
        </div>
        <el-checkbox
          v-if="userStore.isOnline === 'Y'"
          v-model="store.isOnline"
          :disabled="!network.online"
          @change="handleOnlineChange"
        >
          联网使用
        </el-checkbox>
      </div>
      <div v-if="!network.online" class="net-banner">网络未连接，将先保存在本地，联网后可补传</div>
      <div class="panel__scroll">
        <FormView ref="formRef" />
      </div>
      <div class="panel__actions">
        <HotkeyTooltip id="changeBarcode">
          <el-button plain @click="handleChangeBarcode">切换条码</el-button>
        </HotkeyTooltip>
        <el-button plain @click="handlePreview">报告预览</el-button>
        <HotkeyTooltip id="saveLocal">
          <el-button :loading="submitting === 'local'" @click="handleSubmit(false)">
            保存到本地
          </el-button>
        </HotkeyTooltip>
        <HotkeyTooltip v-if="isOnlineQuery" id="saveUpload">
          <el-button type="primary" :loading="submitting === 'upload'" @click="handleSubmit(true)">
            {{ submitting === 'upload' ? '正在上传…' : '保存并上传' }}
          </el-button>
        </HotkeyTooltip>
      </div>
    </section>

    <!-- 报告预览 -->
    <el-image-viewer
      v-if="showViewer"
      :url-list="previewSrcList"
      teleported
      @close="showViewer = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue'
import { Picture } from '@element-plus/icons-vue'
import VideoView from '@r/components/video/VideoView.vue'
import FormView from './FormView.vue'
import PicView from './PicView.vue'
import HotkeyTooltip from '@r/components/HotkeyTooltip.vue'
import { useBScanStore, type TempPic } from '@r/stores/b-scan'
import { useUserStore } from '@r/stores/user'
import { useConfigStore } from '@r/stores/config'
import { useNetworkStore } from '@r/stores/network'
import { bScanApi, persistBScanImages } from '@r/api/b-scan'
import { wordToImage, toPngDataUrl } from '@r/utils/docx'
import { buildBScanReportParams } from '@r/utils/bscan-report'
import { comboText } from '@r/utils/hotkey'
import { useHotkey } from '@r/hotkeys/useHotkey'
import type { BScanImage } from '@shared/domain/b-scan'

/**
 * B超采集页：左侧视频采集 + 图片选择，右侧患者/检查表单与保存/预览。
 */
const store = useBScanStore()
const userStore = useUserStore()
const config = useConfigStore()
const network = useNetworkStore()

/** 采集快捷键文案（跟随设置动态变化） */
const takePhotoLabel = computed(() => comboText(config.hotkeys.takePhoto))

/** 是否已确认条码（未确认前禁止采集，避免先拍后输条码导致照片被覆盖） */
const captureReady = computed(() => store.barcodeConfirmed)

const videoRef = ref<InstanceType<typeof VideoView>>()
const formRef = ref<InstanceType<typeof FormView>>()
const submitting = ref<'local' | 'upload' | null>(null)

/** 进入采集页时聚焦条码输入框，便于扫码枪直接录入 */
function focusBarcode(): void {
  if (!captureReady.value) formRef.value?.letBarcodeInputFocus()
}
onMounted(focusBarcode)
onActivated(focusBarcode)

const showViewer = ref(false)
const previewSrcList = ref<string[]>([])

// 采集偏好从持久化配置初始化，并在变化时回写（防抖）
store.bScanType = config.bScanPrefs.type
store.defaultCheckPic = config.bScanPrefs.defaultCheckPic
store.isOnline = config.bScanPrefs.online
let prefsTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => [store.bScanType, store.defaultCheckPic, store.isOnline] as const,
  () => {
    if (prefsTimer) clearTimeout(prefsTimer)
    prefsTimer = setTimeout(() => {
      void config.update({
        bScanPrefs: {
          type: store.bScanType,
          defaultCheckPic: store.defaultCheckPic,
          online: store.isOnline
        }
      })
    }, 300)
  }
)

/** 切换联网使用：重新按条码查询 */
function handleOnlineChange(): void {
  formRef.value?.handleGetInfo()
}

/** 是否联网使用（联网使用勾选 + 已登录 + 网络可用）：否则仅本地保存 */
const isOnlineQuery = computed(() => store.isOnline && userStore.isOnline === 'Y' && network.online)

/** 切换图片勾选（最多 4 张） */
function toggleCheck(pic: TempPic): void {
  if (pic.isCheck === 'N' && store.checkedCount() >= 4) {
    ElMessage.warning('最多选择4张图片')
    return
  }
  pic.isCheck = pic.isCheck === 'Y' ? 'N' : 'Y'
}

/** 切换条码：有内容时二次确认，然后清空表单与图片 */
async function handleChangeBarcode(): Promise<void> {
  if (!formRef.value) return
  const data = formRef.value.getFormData()
  const hasContent =
    store.tempPics.length > 0 ||
    !!(data.barcode || data.name || data.idCard || data.diagnosis || data.diagnosisDetails)
  if (hasContent) {
    const ok = await ElMessageBox.confirm(
      '切换条码会清空当前表单与已采集图片，是否继续？',
      '切换条码',
      { type: 'warning', confirmButtonText: '清空并切换', cancelButtonText: '取消' }
    ).catch(() => false)
    if (!ok) return
  }
  resetForNext()
}

/** 清空表单与图片（供保存成功后/切换条码使用） */
function resetForNext(): void {
  formRef.value?.resetForm()
  store.removeAllTempPics()
  formRef.value?.letBarcodeInputFocus()
}

/** 生成报告图片（失败抛错，供预览/上传复用） */
async function buildReportImage(title: string): Promise<string> {
  if (!formRef.value) throw new Error('表单未就绪')
  const selected = store.tempPics.filter((item) => item.isCheck === 'Y')
  if (!selected.length) throw new Error('请至少采集并选择一张图片')
  const params = buildBScanReportParams({
    title,
    form: formRef.value.getFormData() ?? {},
    images: selected.map((item) => item.base64Path),
    doctorName: userStore.user.name
  })
  for (const key of ['image1', 'image2', 'image3', 'image4'] as const) {
    const value = params[key]
    if (value) params[key] = await toPngDataUrl(value)
  }
  const docxUrl = await bScanApi.renderReport(params)
  return await wordToImage(docxUrl)
}

/** 报告预览：生成图片并打开查看器 */
async function handlePreview(): Promise<void> {
  try {
    const imageUrl = await buildReportImage(config.reportTemplate.title || '报告预览')
    previewSrcList.value = [imageUrl]
    showViewer.value = true
  } catch (error) {
    ElMessageBox.alert(`报告预览失败：${(error as Error).message}`, '报告预览失败', {
      confirmButtonText: '我知道了'
    })
  }
}

/** 保存（upload=true 时本地保存成功后再上传；全部结束后只给一次提示） */
async function handleSubmit(upload: boolean): Promise<void> {
  const formVm = formRef.value
  if (!formVm || submitting.value) return
  if (!store.tempPics.some((item) => item.isCheck === 'Y')) {
    ElMessage.error('请至少采集并选择一张图片')
    return
  }

  submitting.value = upload ? 'upload' : 'local'
  try {
    // 表单校验：失败时 EP 已高亮字段，这里不再重复弹窗
    let form: Awaited<ReturnType<typeof formVm.submit>>
    try {
      form = await formVm.submit()
    } catch {
      return
    }

    store.tempPics.forEach((item, index) => {
      item.sortNum = index + 1
    })

    const images: BScanImage[] = store.tempPics.map((item) => ({
      id: item.id,
      barcode: form.barcode,
      isUpload: 'N',
      isCheck: item.isCheck,
      sortNum: item.sortNum,
      localPath: item.localPath,
      base64Path: item.base64Path
    }))

    // 1) 本地保存：记录 + 图片（先清空再按批追加）
    const saveResult = await bScanApi.save({
      record: {
        barcode: form.barcode,
        checkType: store.bScanType,
        name: form.name,
        idCard: form.idCard,
        gender: form.gender,
        birthday: form.birthday,
        isUpload: 'N',
        isNormal: form.isNormal,
        diagnosis: form.diagnosis,
        bodyParts: form.bodyParts,
        diagnosisDetails: form.diagnosisDetails,
        localRemark: form.localRemark
      },
      images: [],
      isUpload: 'N'
    })
    if (!saveResult.ok) {
      throw new Error(saveResult.message || '保存失败')
    }

    const imagesResult = await persistBScanImages(form.barcode, images)
    if (!imagesResult.ok) {
      throw new Error(imagesResult.message || '图片保存失败')
    }

    // 2) 上传：本地已保存成功后执行；本地与线上全部结束才提示一次
    if (!upload) {
      ElNotification({ title: '保存成功', message: '数据已保存到本地', type: 'success' })
      resetForNext()
      return
    }

    try {
      const reportImage = await buildReportImage(config.reportTemplate.title || '社区卫生服务中心')
      const uploadResult = await bScanApi.upload({
        barcode: form.barcode,
        reportImageBase64: reportImage
      })
      if (!uploadResult.ok) throw new Error(uploadResult.message || '上传失败')
      ElNotification({
        title: '保存并上传成功',
        message: '数据已保存到本地并上传到服务器',
        type: 'success'
      })
      resetForNext()
    } catch (error) {
      // 本地已保存，仅上传失败：保留表单与图片，便于就地重试
      ElNotification({
        title: '已保存到本地，上传失败',
        message: `${(error as Error).message}，可修改后重试上传`,
        type: 'warning',
        duration: 8000
      })
    }
  } catch (error) {
    ElMessageBox.alert(`保存失败：${(error as Error).message}`, '保存失败', {
      confirmButtonText: '我知道了'
    })
  } finally {
    submitting.value = null
  }
}

// ── 快捷键（作用域：collect） ──────────────────────────
useHotkey('saveLocal', () => void handleSubmit(false), 'collect')
useHotkey(
  'saveUpload',
  () => {
    if (isOnlineQuery.value) void handleSubmit(true)
  },
  'collect'
)
useHotkey('changeBarcode', () => void handleChangeBarcode(), 'collect')
useHotkey('openTemplate', () => formRef.value?.openTemplateDialog(), 'collect')
</script>

<style scoped>
.bscan-page {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: var(--s-card);
  height: 100%;
  min-height: 0;
}

.bscan-col {
  display: flex;
  flex-direction: column;
  gap: var(--s-card);
  min-height: 0;
}

.panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.panel--video {
  flex: 1 1 0;
  min-height: 220px;
}

.panel--gallery {
  flex: 1 1 0;
  min-height: 200px;
}

.panel--form {
  overflow: hidden;
}

.panel__body--tight {
  flex: 1;
  min-height: 0;
  display: flex;
  padding: var(--s3);
}

.panel__scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--s4);
}

.panel__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--s-card);
  padding: 8px var(--s4);
  border-top: 1px solid var(--line);
  background: var(--foot-bg);
}

/* 头部联网状态徽标 */
.net-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: 8px;
  font-size: var(--fs-xs);
  font-weight: 400;
  color: var(--ok);
}
.net-status.is-off {
  color: var(--t3);
}
.net-status .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

/* 离线提示条 */
.net-banner {
  padding: 6px var(--s4);
  border-bottom: 1px solid var(--line);
  background: var(--warn-weak);
  color: var(--warn);
  font-size: var(--fs-xs);
}

.gallery {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scrollbar-gutter: stable;
  margin: var(--s3);
  padding: var(--s2);
  background: var(--surface-2);
  border: 1px solid var(--line);
}

.gallery__empty {
  height: 100%;
  min-height: 110px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--t3);
}
.gallery__empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-bottom: 2px;
  border-radius: var(--r-sm);
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--t3);
}
.gallery__empty-title {
  font-size: var(--fs-md);
  font-weight: 700;
  color: var(--t2);
}

.gallery__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(124px, 1fr));
  gap: 8px;
}
</style>
