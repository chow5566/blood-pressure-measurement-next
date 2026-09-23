<template>
  <div class="win-controls">
    <button class="wc" title="最小化" @click="minimize">
      <UiIcon name="minus" :size="16" />
    </button>
    <button
      v-if="showMaximize"
      class="wc"
      :title="maximized ? '还原' : '最大化'"
      @click="toggleMaximize"
    >
      <UiIcon :name="maximized ? 'restore' : 'square'" :size="14" />
    </button>
    <button class="wc wc--close" title="关闭" @click="close">
      <UiIcon name="close" :size="16" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import UiIcon from './ui/UiIcon.vue'
import { windowApi } from '@r/api/window'

/** 无边框窗口的自定义控件（自建） */
withDefaults(defineProps<{ showMaximize?: boolean }>(), { showMaximize: true })

const maximized = ref(false)
let unsubscribe: (() => void) | null = null

function minimize(): void {
  windowApi.minimize()
}
async function toggleMaximize(): Promise<void> {
  maximized.value = await windowApi.toggleMaximize()
}
function close(): void {
  windowApi.close()
}

onMounted(async () => {
  maximized.value = await windowApi.isMaximized()
  unsubscribe = windowApi.onMaximized((value) => (maximized.value = value))
})

onUnmounted(() => unsubscribe?.())
</script>

<style scoped>
.win-controls {
  display: flex;
  align-items: stretch;
  height: 100%;
}
.wc {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--t2);
  cursor: pointer;
}
.wc:hover {
  background: var(--surface-3);
  color: var(--t1);
}
.wc--close:hover {
  background: var(--danger);
  color: #fff;
}
</style>
