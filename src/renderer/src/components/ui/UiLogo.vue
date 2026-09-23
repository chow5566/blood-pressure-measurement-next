<template>
  <img class="ui-logo" :src="logoUrl" :style="logoStyle" alt="" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import logoUrl from '@r/assets/logo.png'

/** 品牌标识：原 X 形 logo（已按主题色重新着色） */
const props = withDefaults(defineProps<{ size?: number }>(), { size: 30 })

const logoStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`
}))
</script>

<style scoped>
.ui-logo {
  display: inline-block;
  flex-shrink: 0;
  object-fit: contain;
}
</style>
