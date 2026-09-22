<template>
  <div class="bp-empty">
    <span class="bp-empty__icon">
      <!-- 内联 USB 图标，避免额外图标系统依赖 -->
      <svg viewBox="0 0 1024 1024" width="26" height="26" fill="currentColor">
        <path
          d="M760 448h-96V352h96a32 32 0 0 0 32-32V224a32 32 0 0 0-32-32h-96a32 32 0 0 0-32 32v96h-96V96a32 32 0 0 0-32-32H352a32 32 0 0 0-32 32v224h-96a32 32 0 0 0-32 32v96a32 32 0 0 0 32 32h96v96a32 32 0 0 0 32 32h96v160a32 32 0 0 0 32 32h64a32 32 0 0 0 32-32V704h96a32 32 0 0 0 32-32v-96h96a32 32 0 0 0 32-32v-96a32 32 0 0 0-32-32z"
        />
      </svg>
    </span>
    <div class="bp-empty__title">未检测到血压计</div>
    <div class="bp-empty__hint">请确认设备已连接，或点击下方「手动识别血压计」</div>
  </div>
</template>

<script setup lang="ts">
/** 血压计未连接时的占位（简洁，随主题） */
</script>

<style scoped>
.bp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s2);
  padding: var(--s6);
}
.bp-empty__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  margin-bottom: var(--s2);
  border: 1px solid var(--line-strong);
  background: var(--surface-2);
  color: var(--t3);
}
.bp-empty__title {
  font-size: var(--fs-lg);
  font-weight: 600;
  color: var(--t1);
}
.bp-empty__hint {
  font-size: var(--fs-md);
  color: var(--t3);
}
</style>
