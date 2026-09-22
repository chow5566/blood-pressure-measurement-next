<template>
  <svg
    class="ui-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path v-for="(d, i) in paths" :key="i" :d="d" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ICONS, type IconName } from './icons'

/** 极简线性图标（自建，内联 SVG） */
const props = withDefaults(defineProps<{ name: IconName; size?: number; stroke?: number }>(), {
  size: 18,
  stroke: 1.7
})

const paths = computed(() => ICONS[props.name] ?? [])
</script>

<style scoped>
.ui-icon {
  display: block;
  flex-shrink: 0;
}
</style>
