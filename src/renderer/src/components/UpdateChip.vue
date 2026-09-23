<template>
  <button
    v-if="store.hasUpdate"
    class="update-chip"
    :class="{ 'is-active': store.status.state === 'downloading' }"
    @click="store.open()"
  >
    <span class="update-chip__dot"></span>
    <span class="update-chip__text">{{ text }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUpdateStore } from '@r/stores/update'

/**
 * 顶栏更新指示（独立组件）。
 * 单独抽出的目的：把对 `updateStore.status` 的响应式依赖限制在本组件内，
 * 避免更新进度广播导致整个 App 外壳（含当前路由）反复重渲染。
 */
const store = useUpdateStore()

const percent = computed(() => Math.round(store.status.percent ?? 0))

const text = computed(() => {
  const status = store.status
  switch (status.state) {
    case 'available':
      return '有新版本'
    case 'downloading':
      return status.retry ? `重试中 ${percent.value}%` : `更新 ${percent.value}%`
    case 'paused':
      return `暂停 ${percent.value}%`
    case 'finalizing':
      return '准备安装'
    case 'downloaded':
      return '待安装'
    default:
      return '更新'
  }
})
</script>

<style scoped>
.update-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 92px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--accent-line);
  background: var(--accent-weak);
  color: var(--accent-ink);
  font-family: inherit;
  font-size: var(--fs-xs);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.update-chip:hover {
  border-color: var(--accent);
}
.update-chip__dot {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  background: var(--accent);
}
.update-chip.is-active .update-chip__dot {
  animation: update-pulse 1s ease-in-out infinite;
}
@keyframes update-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
</style>
