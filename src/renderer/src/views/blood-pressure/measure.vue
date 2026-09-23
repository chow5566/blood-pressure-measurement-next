<template>
  <div class="bp-measure app-scope">
    <div class="bp-measure__bar">
      <div class="app-section-title">
        血压检测
        <small>{{ displayPorts.length }} 台设备</small>
      </div>
      <div class="bp-measure__bar-actions">
        <span v-if="displayPorts.length" class="app-hint">血压计用户 A = 左侧，用户 B = 右侧</span>
        <UiButton v-if="isDev && demo" variant="ghost" size="sm" @click="demo = false">
          关闭演示
        </UiButton>
        <UiButton
          v-if="displayPorts.length && !demo"
          variant="secondary"
          size="sm"
          :loading="loading"
          @click="reload(true)"
        >
          重新识别血压计
        </UiButton>
      </div>
    </div>

    <div v-if="displayPorts.length" class="bp-cards">
      <BloodPressureCard
        v-for="portInfo in displayPorts"
        :key="portInfo.path"
        :port-info="portInfo"
        :simulate="demo"
      />
    </div>

    <div v-else class="bp-empty">
      <LinkLoadingView />
      <div class="bp-empty__ops">
        <UiButton variant="primary" :loading="loading" @click="reload(false)">
          手动识别血压计
        </UiButton>
        <UiButton v-if="isDev" variant="secondary" @click="demo = true">模拟设备</UiButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onMounted, ref } from 'vue'
import BloodPressureCard from '@r/components/BloodPressureCard.vue'
import LinkLoadingView from '@r/components/LinkLoadingView.vue'
import UiButton from '@r/components/ui/UiButton.vue'
import { bloodPressureApi } from '@r/api/blood-pressure'
import type { BpPort } from '@shared/domain/blood-pressure'

/**
 * 血压测量页：最多同时展示 2 台血压计。
 * 设备列表通过主进程轮询推送（bp:devices），插拔后自动刷新。
 */

const isDev = import.meta.env.DEV
const demo = ref(false)
const MOCK_PORTS: BpPort[] = [
  { path: 'SIM-1', friendlyName: 'maibobo A（演示）' },
  { path: 'SIM-2', friendlyName: 'maibobo B（演示）' }
]

const ports = ref<BpPort[]>([])
const loading = ref(false)

/** 展示用设备列表（开发演示时使用模拟设备） */
const displayPorts = computed<BpPort[]>(() => (demo.value ? MOCK_PORTS : ports.value))

/** 获取血压计列表（最多 2 台） */
async function getPorts(): Promise<void> {
  ports.value = []
  loading.value = true
  try {
    const list = await bloodPressureApi.listPorts()
    ports.value = list.slice(0, 2)
  } catch {
    ElMessageBox({
      title: '错误',
      message: '获取血压计失败，若重新尝试失败，请重新打开本软件。',
      type: 'error',
      showCancelButton: false,
      cancelButtonText: '我知道了',
      confirmButtonText: '重新尝试'
    })
      .then(() => getPorts())
      .catch(() => undefined)
  } finally {
    loading.value = false
  }
}

/** 重新识别（needTips=true 时二次确认，可能丢失测量数据） */
function reload(needTips = true): void {
  if (!needTips) {
    void getPorts()
    return
  }
  ElMessageBox({
    title: '提示',
    message: '这可能导致正在测量的数据丢失，继续？',
    showCancelButton: true,
    cancelButtonText: '取消',
    confirmButtonText: '继续',
    type: 'warning'
  })
    .then(() => getPorts())
    .catch(() => undefined)
}

let unsubscribeDevices: (() => void) | null = null

onMounted(() => {
  void getPorts()
  // 设备插拔变化时刷新列表
  unsubscribeDevices = bloodPressureApi.onDevices((list) => {
    ports.value = list.slice(0, 2)
  })
})

onActivated(() => {
  if (ports.value.length === 0) void getPorts()
})

onBeforeUnmount(() => {
  unsubscribeDevices?.()
  void bloodPressureApi.closeAll()
})
</script>

<style scoped>
.bp-measure {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
  height: 100%;
  min-height: 0;
}

.bp-measure__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s4);
}
.bp-measure__bar-actions {
  display: flex;
  align-items: center;
  gap: var(--s4);
}

.bp-cards {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: var(--s8);
}

.bp-empty {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--s4);
}
.bp-empty__ops {
  display: flex;
  align-items: center;
  gap: var(--s3);
}
</style>
