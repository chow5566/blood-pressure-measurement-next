<template>
  <div class="ui-card" :class="{ 'ui-card--pad': pad }">
    <slot />
  </div>
</template>

<script setup lang="ts">
/** 基础卡片（自建，扁平描边） */
withDefaults(defineProps<{ pad?: boolean }>(), { pad: true })
</script>

<style scoped>
.ui-card {
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: var(--r-sm);
}
.ui-card--pad {
  padding: var(--s4);
}
</style>
