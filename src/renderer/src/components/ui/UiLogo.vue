<template>
  <span class="ui-logo" :style="logoStyle" aria-hidden="true"></span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import logoUrl from '@r/assets/logo.png'

/** 品牌标识：原 X 形 logo，用 CSS mask 取色为当前主题强调色 */
const props = withDefaults(defineProps<{ size?: number; color?: string }>(), {
  size: 30,
  color: 'var(--accent)'
})

const logoStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  color: props.color,
  WebkitMaskImage: `url(${logoUrl})`,
  maskImage: `url(${logoUrl})`
}))
</script>

<style scoped>
.ui-logo {
  display: inline-block;
  flex-shrink: 0;
  background-color: currentColor;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
}
</style>
