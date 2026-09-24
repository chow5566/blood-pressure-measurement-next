<template>
  <div class="video-view">
    <div class="video-view__bar">
      <el-select
        v-model="selectedDeviceId"
        class="video-view__select"
        placeholder="请选择采集设备"
        @change="startPlay"
      >
        <el-option
          v-for="device in devices"
          :key="device.deviceId"
          :label="device.label || '未命名设备'"
          :value="device.deviceId"
        />
      </el-select>
      <el-button :icon="Refresh" @click="init">重新加载</el-button>
      <el-popover placement="bottom-end" :width="300" trigger="click">
        <template #reference>
          <el-button :icon="Setting">画面调节</el-button>
        </template>
        <div class="filter-panel">
          <div class="filter-panel__grid">
            <div v-for="item in sliders" :key="item.key" class="filter-panel__field">
              <span class="filter-panel__label">{{ item.label }}</span>
              <el-slider
                v-model="store.videoFilter[item.key]"
                :min="item.min"
                :max="item.max"
                :show-tooltip="false"
                class="filter-panel__slider"
              />
              <span class="filter-panel__value"
                >{{ store.videoFilter[item.key] }}{{ item.unit }}</span
              >
            </div>
          </div>
          <div class="filter-panel__toggles">
            <el-checkbox v-model="store.videoFilter.gray">灰度</el-checkbox>
            <el-checkbox v-model="store.videoFilter.invert">反色</el-checkbox>
            <el-button
              text
              type="primary"
              size="small"
              class="filter-panel__reset"
              @click="store.resetVideoFilter()"
            >
              恢复默认
            </el-button>
          </div>
        </div>
      </el-popover>
    </div>

    <div class="video-view__stage">
      <div
        v-loading="loading"
        class="video-view__frame"
        :class="{ 'is-ready': canCapture }"
        @click="handleFrameClick"
      >
        <video ref="videoRef" class="video-view__player" :style="{ filter: filterStyle }" />
        <div v-if="videoError" class="video-view__error">
          <el-icon :size="16"><WarningFilled /></el-icon>
          <span>{{ videoError }}</span>
        </div>
        <template v-else>
          <span class="video-view__hint">
            {{
              captureEnabled === false
                ? '请先扫描或输入条码号'
                : canCapture
                  ? `点击画面采集 · 快捷键 ${takePhotoLabel}`
                  : '设备未就绪'
            }}
          </span>
        </template>
        <span v-if="canCapture && fps > 0" class="video-view__fps">{{ fps }} FPS</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { Refresh, Setting, WarningFilled } from '@element-plus/icons-vue'
import { getVideoDevices, getUserMedia, stopStream } from './video'
import { useBScanStore, type TempPic } from '@r/stores/b-scan'
import { useConfigStore } from '@r/stores/config'
import { comboText } from '@r/utils/hotkey'
import { useHotkey } from '@r/hotkeys/useHotkey'
import { uuid } from '@shared/utils/uuid'

/**
 * B超视频采集视图。
 * - 枚举/播放采集卡视频；
 * - CSS 滤镜（灰度/亮度/对比度/色相/饱和度）；
 * - canvas 截图：默认存入 store（采集页）；传入 `pics` 时仅 emit `capture`（历史弹框等）；
 * - 支持可配置快捷键采集（默认 F3）；
 * - `autoStart`：非 keep-alive 场景（如弹框）在挂载时取流、卸载时释放。
 */

const props = withDefaults(
  defineProps<{ pics?: TempPic[]; autoStart?: boolean; captureEnabled?: boolean }>(),
  {
    autoStart: false,
    captureEnabled: true
  }
)
const emit = defineEmits<{ capture: [pic: TempPic] }>()

const store = useBScanStore()
const config = useConfigStore()

/** 采集目标集合：传入 `pics` 用传入的，否则用 store（采集页） */
const targetPics = computed(() => props.pics ?? store.tempPics)

function checkedCountOf(list: TempPic[]): number {
  return list.filter((item) => item.isCheck === 'Y').length
}

const takePhotoLabel = computed(() => comboText(config.hotkeys.takePhoto))

// 滤镜从持久化配置初始化，并在调整后回写（防抖）
store.videoFilter = { ...config.videoFilter }
let filterSaveTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => store.videoFilter,
  (value) => {
    if (filterSaveTimer) clearTimeout(filterSaveTimer)
    filterSaveTimer = setTimeout(() => {
      void config.update({ videoFilter: { ...value } })
    }, 400)
  },
  { deep: true }
)

const videoRef = ref<HTMLVideoElement>()
const devices = ref<MediaDeviceInfo[]>([])
const selectedDeviceId = ref('')
const stream = ref<MediaStream | null>(null)
const loading = ref(false)
const videoError = ref('')
/** 实时帧率（叠加在画面上） */
const fps = ref(0)

/** 是否可采集（已取流且无错误） */
const canCapture = computed(() => !videoError.value && !!stream.value)

function handleFrameClick(): void {
  if (canCapture.value) takePhoto()
}

/** 页面是否处于激活状态（keep-alive）：用于丢弃离开页面后才返回的取流结果 */
let isActive = false

const sliders = [
  { key: 'brightness', label: '增益', min: 50, max: 200, unit: '%' },
  { key: 'contrast', label: '对比度', min: 50, max: 200, unit: '%' },
  { key: 'saturation', label: '饱和度', min: 0, max: 200, unit: '%' },
  { key: 'hue', label: '色调', min: 0, max: 360, unit: '°' },
  { key: 'blur', label: '降噪', min: 0, max: 4, unit: 'px' }
] as const

/** CSS 滤镜样式 */
const filterStyle = computed(() => {
  const f = store.videoFilter
  return [
    `grayscale(${f.gray ? 100 : 0}%)`,
    `invert(${f.invert ? 100 : 0}%)`,
    `brightness(${f.brightness}%)`,
    `contrast(${f.contrast}%)`,
    `saturate(${f.saturation}%)`,
    `hue-rotate(${f.hue}deg)`,
    `blur(${f.blur}px)`
  ].join(' ')
})

/** 开始播放指定设备 */
async function startPlay(deviceId?: string): Promise<void> {
  const id = deviceId || selectedDeviceId.value
  if (!id) return
  try {
    videoError.value = ''
    loading.value = true
    if (stream.value) {
      stopStream(stream.value)
      stream.value = null
    }
    stream.value = await getUserMedia(id)
    if (!isActive) {
      stopStream(stream.value)
      stream.value = null
      return
    }
    if (videoRef.value) {
      videoRef.value.srcObject = stream.value
      await videoRef.value.play()
      startFpsMeter()
    }
  } catch (error) {
    videoError.value = `打开设备失败：${(error as Error).message}`
  } finally {
    loading.value = false
  }
}

/** 重新加载设备列表 */
async function init(): Promise<void> {
  try {
    videoError.value = ''
    loading.value = true
    devices.value = await getVideoDevices()
    selectedDeviceId.value = devices.value[0]?.deviceId ?? ''
    await startPlay()
  } catch (error) {
    videoError.value = (error as Error).message
  } finally {
    loading.value = false
  }
}

/** 采集一帧 */
function takePhoto(): string | null {
  // 采集页要求先确认条码，避免先拍后输条码导致照片被覆盖
  if (props.captureEnabled === false) {
    ElMessage('请先扫描或输入条码号')
    return null
  }
  if (!canCapture.value) return null
  const video = videoRef.value
  if (!video || !video.videoWidth) return null

  if (targetPics.value.length >= 20) {
    ElMessageBox.alert('最多采集20张图片', '提示', { confirmButtonText: '我知道了' })
    return null
  }

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.filter = filterStyle.value
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  const base64 = canvas.toDataURL('image/jpeg', 0.85)

  const shouldCheck = store.defaultCheckPic && checkedCountOf(targetPics.value) < 4
  const pic: TempPic = {
    id: uuid(),
    isUpload: 'N',
    base64Path: base64,
    isCheck: shouldCheck ? 'Y' : 'N'
  }
  if (props.pics) emit('capture', pic)
  else store.addTempPic(pic)
  return base64
}

/** 停止播放并释放摄像头 */
function stopPlayback(): void {
  stopFpsMeter()
  stopStream(stream.value)
  stream.value = null
  if (videoRef.value) {
    videoRef.value.srcObject = null
  }
}

/** 采样实际渲染帧率（requestVideoFrameCallback），供底栏展示 */
type VideoWithRvfc = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number) => void) => number
}
let fpsRunning = false
let fpsFrames = 0
let fpsTick = 0

function startFpsMeter(): void {
  const video = videoRef.value as VideoWithRvfc | undefined
  if (!video?.requestVideoFrameCallback) return
  stopFpsMeter()
  fpsRunning = true
  fpsFrames = 0
  fpsTick = performance.now()
  const tick = (now: number): void => {
    if (!fpsRunning) return
    fpsFrames++
    if (now - fpsTick >= 1000) {
      fps.value = fpsFrames
      fpsFrames = 0
      fpsTick = now
    }
    video.requestVideoFrameCallback?.(tick)
  }
  video.requestVideoFrameCallback(tick)
}

function stopFpsMeter(): void {
  fpsRunning = false
  fpsFrames = 0
  fps.value = 0
}

/**
 * 生命周期：
 * - keep-alive 场景（采集页）：`onActivated` 取流、`onDeactivated` 释放；
 * - `autoStart` 场景（弹框）：`onMounted` 取流、`onBeforeUnmount` 释放。
 */
onMounted(() => {
  if (!props.autoStart) return
  isActive = true
  void init()
})

onActivated(() => {
  if (props.autoStart) return
  isActive = true
  if (!devices.value.length) void init()
  else void startPlay()
})

onDeactivated(() => {
  if (props.autoStart) return
  isActive = false
  stopPlayback()
})

onBeforeUnmount(() => {
  isActive = false
  stopPlayback()
})

/** 采集页：注册采集快捷键（作用域由当前路由决定） */
if (!props.autoStart) useHotkey('takePhoto', () => takePhoto(), 'collect')

defineExpose({ takePhoto, init })
</script>

<style scoped>
.video-view {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  flex: 1;
  min-height: 0;
}

.video-view__bar {
  display: flex;
  align-items: center;
  gap: var(--s2);
  flex-shrink: 0;
}

.video-view__select {
  flex: 1;
  min-width: 0;
}

.video-view__stage {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--line-strong);
}

.video-view__frame {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: #05070c;
  cursor: default;
}
.video-view__frame.is-ready {
  cursor: pointer;
}

.video-view__player {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}

.video-view__hint {
  position: absolute;
  left: 12px;
  top: 12px;
  padding: 4px 10px;
  border-radius: var(--r-pill);
  background: rgba(0, 0, 0, 0.55);
  color: rgba(255, 255, 255, 0.82);
  font-size: var(--fs-xs);
  letter-spacing: 0.3px;
  pointer-events: none;
}

.video-view__fps {
  position: absolute;
  right: 10px;
  top: 10px;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.55);
  color: rgba(255, 255, 255, 0.85);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
}
.video-view__error {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  text-align: center;
  color: #fca5a5;
  font-size: var(--fs-md);
}

.filter-panel__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}
.filter-panel__field {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) 44px;
  align-items: center;
  gap: var(--s2);
}
.filter-panel__label {
  font-size: var(--fs-sm);
  color: var(--t2);
}
.filter-panel__slider {
  min-width: 0;
}
.filter-panel__value {
  font-size: var(--fs-xs);
  color: var(--t3);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.filter-panel__toggles {
  display: flex;
  align-items: center;
  gap: var(--s3);
  margin-top: var(--s2);
  padding-top: var(--s2);
  border-top: 1px solid var(--line);
}
.filter-panel__reset {
  margin-left: auto;
}

/* 快捷键设置面板 */
.hotkey-panel__head {
  font-size: var(--fs-md);
  font-weight: 600;
  color: var(--t1);
  margin-bottom: 10px;
}
.hotkey-panel__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: var(--fs-md);
  color: var(--t2);
}
.hotkey-panel__kbd {
  min-width: 76px;
  padding: 2px 8px;
  border: 1px solid var(--line-strong);
  background: var(--surface-2);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  text-align: center;
  color: var(--t1);
}
.hotkey-panel__input {
  width: 100%;
  height: var(--ctrl-h);
  padding: 0 8px;
  border: 1px solid var(--line-strong);
  background: var(--surface);
  color: var(--t1);
  font-family: var(--font-mono);
  font-size: var(--fs-md);
  cursor: pointer;
  outline: none;
}
.hotkey-panel__input:focus {
  border-color: var(--accent);
}
.hotkey-panel__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin: 10px 0 4px;
}
</style>
