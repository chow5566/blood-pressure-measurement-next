<template>
  <div class="link-loading">
    <div class="link-loading__art" aria-hidden="true">
      <svg viewBox="0 0 120 60" width="120" height="60" fill="none">
        <!-- 笔记本电脑：屏幕 + 底座（整体居中，x 12~108） -->
        <rect x="50" y="8" width="52" height="34" stroke="currentColor" stroke-width="2" />
        <rect x="44" y="42" width="64" height="7" stroke="currentColor" stroke-width="2" />
        <!-- USB 接口（底座左侧开口） -->
        <rect x="44" y="45" width="6" height="3" fill="currentColor" />
        <!-- 连接成功信号点（呼吸闪烁） -->
        <circle class="signal" cx="76" cy="25" r="3" fill="var(--accent)" />
        <!-- USB 插头：外壳 + 两个触孔 + 尾线（整体往来插入动画） -->
        <g class="plug">
          <rect x="34" y="44" width="10" height="5" stroke="currentColor" stroke-width="2" />
          <rect x="36" y="45" width="2" height="2" fill="currentColor" />
          <rect x="39.5" y="45" width="2" height="2" fill="currentColor" />
          <rect x="26" y="43" width="8" height="7" stroke="currentColor" stroke-width="2" />
          <path
            d="M26 46.5 C21 46.5 19 50 12 49"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </g>
      </svg>
    </div>
    <div class="link-loading__title">未检测到血压计</div>
    <div class="link-loading__hint">请确认设备已连接，或点击下方「手动识别血压计」</div>
  </div>
</template>

<script setup lang="ts">
/** 血压计未连接时的占位：USB 插头插入电脑动画（线条风格，随主题） */
</script>

<style scoped>
.link-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s3);
  padding: var(--s6) var(--s6) var(--s2);
}
.link-loading__art {
  color: var(--t3);
}
/* 插头往复插入电脑 */
.plug {
  animation: link-plug 1.9s ease-in-out infinite;
}
@keyframes link-plug {
  0% {
    transform: translateX(-6px);
  }
  45%,
  60% {
    transform: translateX(1px);
  }
  100% {
    transform: translateX(-6px);
  }
}
/* 插入到位后信号点闪烁 */
.signal {
  opacity: 0;
  animation: link-signal 1.9s ease-in-out infinite;
}
@keyframes link-signal {
  0%,
  40% {
    opacity: 0;
  }
  50%,
  85% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

.link-loading__title {
  font-size: var(--fs-lg);
  font-weight: 600;
  color: var(--t1);
}
.link-loading__hint {
  font-size: var(--fs-md);
  color: var(--t3);
}
</style>
