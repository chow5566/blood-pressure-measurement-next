<template>
  <div class="domain-page app-scope">
    <div class="tabs">
      <router-link class="tabs__item" to="/blood-pressure" exact-active-class="is-on">
        <UiIcon name="heart" :size="16" />
        测量
      </router-link>
      <router-link class="tabs__item" to="/blood-pressure/history" exact-active-class="is-on">
        <UiIcon name="clock" :size="16" />
        历史
      </router-link>
    </div>

    <div class="domain-body">
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </div>
  </div>
</template>

<script setup lang="ts">
import UiIcon from '@r/components/ui/UiIcon.vue'

/** 血压域布局：测量 / 历史（Tab 切换，面板保活） */
</script>

<style scoped>
.domain-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.domain-page > .tabs {
  padding: 0 var(--s3);
  background: var(--surface);
}
.domain-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: var(--s3);
}
</style>
