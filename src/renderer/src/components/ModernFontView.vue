<template>
  <div class="modern-font-wrap">
    <!-- 占位层：用 8 撑出固定字宽，避免数字位数变化导致抖动 -->
    <div class="modern-font layer-opacity-0">
      <template v-for="item in numberLen" :key="`ghost-${item}`">8</template>
    </div>
    <!-- 颜色层：未点亮段（幽灵），随主题 -->
    <div class="modern-font layer-color">
      <template v-for="item in numberLen" :key="`color-${item}`">8</template>
    </div>
    <!-- 实际数值层 -->
    <div class="modern-font layer-value">{{ value ?? 0 }}</div>
  </div>
</template>

<script setup lang="ts">
/**
 * 数字显示屏组件（DSEG7 字体）。
 * 视觉基准，重构中保持与原项目一致，仅改为 TS 与组合式写法。
 */
withDefaults(
  defineProps<{
    value?: number | null
    numberLen?: number
  }>(),
  {
    value: null,
    numberLen: 3
  }
)
</script>

<style scoped>
.modern-font-wrap {
  position: relative;
  display: flex;
  padding: 0;
  margin: 0;
  line-height: 1;
  user-select: none;
}
.modern-font {
  letter-spacing: normal;
}
.layer-opacity-0 {
  opacity: 0;
}
.layer-color,
.layer-value {
  position: absolute;
  top: 0;
  right: 0;
}
.layer-color {
  z-index: 1;
  color: var(--bp-digit-ghost);
}
.layer-value {
  z-index: 2;
  color: var(--bp-digit);
}
</style>
