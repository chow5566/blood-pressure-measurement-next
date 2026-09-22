<template>
  <teleport to="body">
    <div class="toast-host">
      <transition-group name="toast">
        <div v-for="item in toasts" :key="item.id" class="toast" :class="`toast--${item.type}`">
          <span class="toast__dot"></span>
          <span>{{ item.message }}</span>
        </div>
      </transition-group>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { toasts } from '@r/utils/toast'

/** 全局提示宿主，挂载于 App 根部 */
</script>

<style scoped>
.toast-host {
  position: fixed;
  left: 50%;
  top: 20px;
  transform: translateX(-50%);
  z-index: 3000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  pointer-events: none;
}
.toast {
  display: flex;
  align-items: center;
  gap: 9px;
  max-width: 460px;
  padding: 11px 16px;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--surface);
  box-shadow: var(--sh-2);
  color: var(--t1);
  font-size: 13.5px;
}
.toast__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--t3);
  flex-shrink: 0;
}
.toast--success .toast__dot {
  background: var(--ok);
}
.toast--error .toast__dot {
  background: var(--danger);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
