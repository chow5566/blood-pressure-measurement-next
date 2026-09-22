<template>
  <transition name="fade">
    <div v-if="confirmState.open" class="confirm-mask" @click.self="cancel">
      <div class="confirm">
        <div class="confirm__title">{{ confirmState.title }}</div>
        <div class="confirm__msg">{{ confirmState.message }}</div>
        <div class="confirm__actions">
          <UiButton variant="ghost" @click="cancel">{{ confirmState.cancelText }}</UiButton>
          <UiButton :variant="confirmState.danger ? 'danger' : 'primary'" @click="ok">
            {{ confirmState.confirmText }}
          </UiButton>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import UiButton from './UiButton.vue'
import { confirmState, settleConfirm } from '@r/utils/confirm'

/** 全局确认框宿主 */
function ok(): void {
  settleConfirm(true)
}
function cancel(): void {
  settleConfirm(false)
}
</script>

<style scoped>
.confirm-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.28);
}
.confirm {
  width: 400px;
  padding: 24px;
  border-radius: var(--r-lg);
  background: var(--surface);
  box-shadow: var(--sh-2);
}
.confirm__title {
  font-size: 16px;
  font-weight: 600;
}
.confirm__msg {
  margin-top: 10px;
  font-size: 13.5px;
  color: var(--t2);
  line-height: 1.7;
  white-space: pre-wrap;
}
.confirm__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 22px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.16s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
