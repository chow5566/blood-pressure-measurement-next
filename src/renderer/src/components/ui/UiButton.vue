<template>
  <button
    class="ui-btn"
    :class="[`ui-btn--${variant}`, `ui-btn--${size}`, { 'is-block': block }]"
    :type="nativeType"
    :disabled="disabled || loading"
  >
    <span v-if="loading" class="ui-btn__spin"></span>
    <slot />
  </button>
</template>

<script setup lang="ts">
/** 基础按钮（自建，无 Element 依赖） */
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    block?: boolean
    loading?: boolean
    disabled?: boolean
    nativeType?: 'button' | 'submit'
  }>(),
  {
    variant: 'secondary',
    size: 'md',
    block: false,
    loading: false,
    disabled: false,
    nativeType: 'button'
  }
)
</script>

<style scoped>
.ui-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  font-family: inherit;
  font-size: var(--fs-md);
  font-weight: 400;
  cursor: pointer;
}
.ui-btn.is-block {
  width: 100%;
}
.ui-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.ui-btn--sm {
  height: var(--ctrl-h-sm);
  padding: 0 10px;
}
.ui-btn--md {
  height: var(--ctrl-h);
  padding: 0 14px;
}
.ui-btn--lg {
  height: 40px;
  padding: 0 18px;
  font-size: var(--fs-base);
}

.ui-btn--primary {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--on-primary);
}
.ui-btn--primary:not(:disabled):hover {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
}

.ui-btn--secondary {
  background: var(--surface-2);
  border-color: var(--line-strong);
  color: var(--t1);
}
.ui-btn--secondary:not(:disabled):hover {
  background: var(--surface-3);
}

.ui-btn--ghost {
  background: transparent;
  color: var(--t2);
}
.ui-btn--ghost:not(:disabled):hover {
  background: var(--surface-3);
  color: var(--t1);
}

.ui-btn--danger {
  background: var(--surface-2);
  border-color: var(--line-strong);
  color: var(--danger);
}
.ui-btn--danger:not(:disabled):hover {
  background: var(--danger-soft);
  border-color: var(--danger);
}

.ui-btn__spin {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: ui-spin 0.7s linear infinite;
}
@keyframes ui-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
