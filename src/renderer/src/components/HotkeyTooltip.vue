<template>
  <el-tooltip :content="text" placement="top" :show-after="200" :disabled="!text">
    <slot />
  </el-tooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useConfigStore } from '@r/stores/config'
import { comboText } from '@r/utils/hotkey'

/**
 * 包裹按钮，hover 时提示其快捷键（如「保存并上传（Ctrl + Shift + S）」）。
 * 快捷键未设置时禁用提示。
 */
const props = defineProps<{ id: string; label?: string }>()
const config = useConfigStore()

const text = computed(() => {
  const combo = comboText(config.hotkeys[props.id])
  if (combo === '未设置') return ''
  return props.label ? `${props.label}（${combo}）` : combo
})
</script>
