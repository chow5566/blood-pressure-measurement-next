<template>
  <div
    class="blood-pressure-view flex flex-col items-center overflow-hidden select-none"
    :class="`blood-pressure-view--${status}`"
  >
    <div class="leading-none text-center text-[1.8vw] font-bold bp-title mt-[1vw]">maibobo</div>
    <div class="leading-none text-center text-[1vw] font-bold bp-title mt-[0.3vw]">
      {{ portInfo.friendlyName || 'unknown' }}
    </div>
    <div class="blood-pressure-view__content mt-[1vw] rounded-[0.2vw]">
      <div v-if="status !== 'error'" class="h-full flex flex-col justify-end items-end">
        <div class="w-full flex justify-between items-center mb-[2vw]">
          <div v-if="formData.userNum !== null" class="text-[1vw] ml-[1.2vw]">
            {{ formData.userNum === 1 ? '左侧' : '右侧' }}
          </div>
          <div></div>
          <div class="text-[1vw] mr-[1.2vw]">mmHg</div>
        </div>
        <!-- 收缩压 -->
        <div class="flex items-center justify-end mr-[-5vw] mb-[4vw]">
          <div class="text-[3.5vw] mr-[1vw]">
            <ModernFontView :value="formData.sbp" />
          </div>
          <div class="w-[5vw] flex flex-col justify-center items-center bp-label">
            <div class="leading-none text-[1.2vw] font-bold">收缩压</div>
            <div class="leading-none text-[1vw] mt-[0.4vw]">(高压)</div>
          </div>
        </div>
        <!-- 舒张压 -->
        <div class="flex items-center justify-end mr-[-5vw] mb-[4vw]">
          <div class="text-[3.5vw] mr-[1vw]">
            <ModernFontView :value="formData.dbp" />
          </div>
          <div class="w-[5vw] flex flex-col justify-center items-center bp-label">
            <div class="leading-none text-[1.2vw]">舒张压</div>
            <div class="leading-none text-[1vw] mt-[0.4vw]">(低压)</div>
          </div>
        </div>
        <!-- 脉搏 -->
        <div class="flex items-center justify-end mr-[-5vw] mb-[2vw]">
          <div class="text-[2.5vw] mr-[1vw]">
            <ModernFontView :value="formData.pulse" />
          </div>
          <div class="w-[5vw] flex flex-col justify-center items-center bp-label">
            <div class="leading-none text-[1.2vw]">脉 搏</div>
            <div class="leading-none text-[1vw] mt-[0.4vw]">次/分</div>
          </div>
        </div>
      </div>
      <div v-else class="p-[1vw] text-left w-full">
        <div class="text-[1.5vw]">发生错误：</div>
        <div class="text-[1.2vw]">{{ errorMsg || '未知错误' }}</div>
      </div>
    </div>
    <div class="flex-1 w-full flex items-center px-[2vw]">
      <div class="flex-1">
        <template v-if="status !== 'running'">
          <el-form
            ref="formRef"
            :model="formData"
            :rules="rules"
            :show-message="false"
            @keydown.enter="handleStartOrStop()"
          >
            <el-form-item prop="codeBar">
              <el-input
                v-model="formData.codeBar"
                placeholder="扫码枪扫描或输入条码号"
                size="large"
              ></el-input>
            </el-form-item>
          </el-form>
        </template>
        <template v-else>
          <div class="text-[1.5vw] text-center bp-title">正在测量中...</div>
        </template>
      </div>
      <div class="ml-[1vw] btn">
        <el-button
          circle
          plain
          :type="status === 'running' ? 'danger' : 'info'"
          :loading="btnLoading"
          :icon="SwitchButton"
          :title="status === 'running' ? '停止' : '启动'"
          @click="handleStartOrStop(status === 'running' ? 'stop' : 'start')"
        ></el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { FormInstance } from 'element-plus'
import { SwitchButton } from '@element-plus/icons-vue'
import ModernFontView from './ModernFontView.vue'
import { bloodPressureApi } from '../api/blood-pressure'
import {
  BP_START_DIRECTIVE,
  BP_STOP_DIRECTIVE,
  BLOOD_PRESSURE_ERROR_MAP
} from '@shared/domain/blood-pressure'
import type { BpPort, BloodPressureFrame } from '@shared/domain/blood-pressure'

/**
 * 单个血压计测量卡片（拟物化，视觉与旧项目一致）。
 * 业务逻辑（串口/协议/超时/上传）不变；`simulate` 为开发预览用。
 */

const props = defineProps<{ portInfo: BpPort; simulate?: boolean }>()

/** 测量状态 */
type MeasureStatus = 'normal' | 'running' | 'error' | 'success'

const status = ref<MeasureStatus>('normal')
const errorMsg = ref('')
const btnLoading = ref(false)
const formRef = ref<FormInstance>()

/** 8 秒无数据视为测量结束的定时器 */
let timer: ReturnType<typeof setTimeout> | null = null
/** 超时提示只弹一次 */
let isShowTips = false

const formData = reactive<{
  codeBar: string | null
  userNum: number | null
  sbp: number | null
  dbp: number | null
  pulse: number | null
}>({
  codeBar: null,
  userNum: null,
  sbp: null,
  dbp: null,
  pulse: null
})

const rules = {
  codeBar: [{ required: true, message: '请输入条码号', trigger: 'blur' }]
}

/** 打开串口 */
async function initializePort(): Promise<void> {
  try {
    await bloodPressureApi.open(props.portInfo.path)
  } catch (error) {
    status.value = 'error'
    errorMsg.value = (error as Error).message
  }
}

/** 发送启动/停止指令 */
async function sendDirective(directive: number[]): Promise<boolean> {
  btnLoading.value = true
  try {
    const result = await bloodPressureApi.send(props.portInfo.path, directive)
    return result.ok
  } catch (error) {
    status.value = 'error'
    errorMsg.value = (error as Error).message
    return false
  } finally {
    setTimeout(() => {
      btnLoading.value = false
    }, 1000)
  }
}

/** 开始 / 停止测量 */
function handleStartOrStop(type: 'start' | 'stop' = 'start'): void {
  if (props.simulate) {
    if (demoTimer) clearTimeout(demoTimer)
    demoCycle()
    return
  }
  const run = async (): Promise<void> => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (type === 'start') {
      resetData(['codeBar'])
    } else {
      resetData()
    }
    resetStatus()
    status.value = 'running'

    const ok = await sendDirective(type === 'start' ? BP_START_DIRECTIVE : BP_STOP_DIRECTIVE)
    if (ok) {
      status.value = type === 'start' ? 'running' : 'normal'
    } else {
      ElMessageBox({
        title: '提示',
        message: '指令发送失败，尝试拔出血压计USB接口后重新插入测量',
        type: 'warning',
        confirmButtonText: '我知道了'
      })
    }
  }

  if (formRef.value && type === 'start') {
    formRef.value
      .validate()
      .then(run)
      .catch(() => undefined)
  } else {
    void run()
  }
}

/** 处理解析后的设备帧 */
function handleFrame(frame: BloodPressureFrame): void {
  // 每次收到数据重置超时计时器
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  timer = setTimeout(() => {
    if (!isShowTips && status.value === 'running') {
      isShowTips = true
      ElMessageBox({
        title: '提示',
        message: '测量结果超时，请重新启动测量',
        type: 'warning',
        confirmButtonText: '我知道了'
      }).finally(() => {
        resetData()
        resetStatus()
        if (timer) clearTimeout(timer)
        timer = null
        isShowTips = false
      })
    }
  }, 8000)

  if (frame.kind === 'error') {
    if (timer) clearTimeout(timer)
    timer = null
    status.value = 'error'
    errorMsg.value = BLOOD_PRESSURE_ERROR_MAP[frame.code] || '测量失败，请检查血压计是否正常工作'
    return
  }

  if (frame.kind === 'progress') {
    status.value = 'running'
    formData.sbp = frame.sbp
    formData.dbp = frame.dbp
    return
  }

  if (frame.kind === 'result') {
    status.value = 'success'
    formData.userNum = frame.userNum
    formData.sbp = frame.sbp
    formData.dbp = frame.dbp
    formData.pulse = frame.pulse
    if (timer) clearTimeout(timer)
    timer = null
    void handleUpload()
  }
}

/** 上传/保存测量结果 */
async function handleUpload(): Promise<void> {
  if (props.simulate) return
  if (!formData.codeBar || formData.sbp === null || formData.dbp === null) return
  try {
    const result = await bloodPressureApi.record({
      codeBar: formData.codeBar,
      userNum: formData.userNum ?? 1,
      sbp: formData.sbp,
      dbp: formData.dbp,
      pulse: formData.pulse
    })
    status.value = 'success'
    formData.codeBar = null
    const tips = result.uploaded
      ? '，数据已上传'
      : result.reason === 'offline'
        ? '，已离线保存，联网后可在历史记录中补传'
        : result.reason === 'disabled'
          ? '，已保存到本地（已关闭自动上传）'
          : '，上传失败，请在历史记录中查看'
    ElNotification({
      title: '测量结果',
      message: `条码号：${result.codeBar}${tips}`,
      type: result.uploaded ? 'success' : result.reason === 'disabled' ? 'info' : 'warning',
      position: 'bottom-right',
      duration: 10000
    })
  } catch (error) {
    status.value = 'error'
    errorMsg.value = (error as Error).message
  }
}

/** 重置表单数据（可保留部分字段） */
function resetData(unIncludes: string[] = []): void {
  const init: Record<string, unknown> = {
    codeBar: null,
    userNum: null,
    sbp: null,
    dbp: null,
    pulse: null
  }
  Object.keys(init).forEach((key) => {
    if (!unIncludes.includes(key)) {
      ;(formData as Record<string, unknown>)[key] = init[key]
    }
  })
}

/** 重置状态 */
function resetStatus(): void {
  status.value = 'normal'
  errorMsg.value = ''
  btnLoading.value = false
}

let unsubscribeData: (() => void) | null = null

/* 演示模式（开发预览）：循环模拟一次测量，不访问真实串口 */
let demoTimer: ReturnType<typeof setTimeout> | null = null
let demoInterval: ReturnType<typeof setInterval> | null = null

function demoCycle(): void {
  const right = props.portInfo.path.endsWith('2')
  const target = right ? { sbp: 128, dbp: 82, pulse: 76 } : { sbp: 118, dbp: 76, pulse: 68 }
  resetData()
  resetStatus()
  status.value = 'running'
  formData.userNum = right ? 2 : 1
  const steps = 12
  let i = 0
  if (demoInterval) clearInterval(demoInterval)
  demoInterval = setInterval(() => {
    i += 1
    formData.sbp = Math.round(90 + (target.sbp - 90) * (i / steps))
    formData.dbp = Math.round(60 + (target.dbp - 60) * (i / steps))
    if (i >= steps) {
      if (demoInterval) clearInterval(demoInterval)
      demoInterval = null
      status.value = 'success'
      formData.pulse = target.pulse
      demoTimer = setTimeout(demoCycle, 4000)
    }
  }, 120)
}

onMounted(() => {
  if (props.simulate) {
    demoCycle()
    return
  }
  void initializePort()
  unsubscribeData = bloodPressureApi.onData((payload) => {
    if (payload.path !== props.portInfo.path) return
    handleFrame(payload.frame)
  })
})

onBeforeUnmount(() => {
  if (demoTimer) clearTimeout(demoTimer)
  if (demoInterval) clearInterval(demoInterval)
  unsubscribeData?.()
})
</script>

<style scoped lang="scss">
.blood-pressure-view {
  width: 30vw;
  aspect-ratio: 1/1.44;
  background-color: var(--bp-shell);
  border-radius: 6vw;
  border: 0.6vw solid var(--bp-shell-border);
  box-shadow: var(--bp-shadow);
  overflow: hidden;
  .blood-pressure-view__content {
    width: 18vw;
    aspect-ratio: 1/1.44;
    background-color: var(--bp-screen);
  }
}

.bp-title {
  color: var(--bp-title);
}
.bp-label {
  color: var(--bp-label);
}

.blood-pressure-view--running {
  .blood-pressure-view__content {
    background-color: var(--bp-screen-running);
  }
}

.blood-pressure-view--error {
  .blood-pressure-view__content {
    background-color: var(--bp-screen-error);
  }
}

.blood-pressure-view--success {
  .blood-pressure-view__content {
    background-color: var(--bp-screen-success);
  }
}

:deep(.el-form) {
  .el-form-item {
    margin-bottom: 0 !important;
  }
  .el-input {
    .el-input__wrapper {
      background-color: var(--bp-input-bg) !important;
      border-radius: 1vw !important;
      box-shadow: none !important;
    }
    .el-input__inner {
      height: 4vw;
      font-size: 1.4vw;
    }
  }
  .el-form-item.is-error {
    .el-input__inner::placeholder {
      color: var(--el-color-danger);
    }
  }
}

:deep(.btn) {
  .el-button {
    width: 4.6vw;
    height: 4.6vw;
    border-radius: 50% !important;
    font-size: 1.8vw;
  }
}
</style>
