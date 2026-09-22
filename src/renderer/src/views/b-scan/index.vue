<template>
  <div class="domain-page app-scope">
    <div class="tabs">
      <router-link class="tabs__item" to="/b-scan" exact-active-class="is-on">
        <UiIcon name="video" :size="16" />
        采集
      </router-link>
      <router-link class="tabs__item" to="/b-scan/history" exact-active-class="is-on">
        <UiIcon name="clock" :size="16" />
        历史
      </router-link>
      <router-link class="tabs__item" to="/b-scan/template" exact-active-class="is-on">
        <UiIcon name="folder" :size="16" />
        模板维护
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

/** B超域布局：采集 / 历史 / 模板维护（Tab 切换，面板保活） */
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
