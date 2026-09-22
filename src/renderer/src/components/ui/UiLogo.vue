<template>
  <span class="ui-logo" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg viewBox="0 0 24 24" :width="size * 0.55" :height="size * 0.55" fill="none">
      <path
        d="M3 13h3.2l2.1-5.2 3.1 9.4 2.2-6.2 1.5 2h5.9"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </span>
</template>

<script setup lang="ts">
/** 品牌标识：墨色圆角方块 + 极简线条（无渐变、无阴影） */
withDefaults(defineProps<{ size?: number }>(), { size: 30 })
</script>

<style scoped>
.ui-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-sm);
  background: var(--primary);
  color: var(--on-primary);
  flex-shrink: 0;
}
</style>
