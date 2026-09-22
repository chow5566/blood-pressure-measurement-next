<template>
  <el-dialog
    v-model="visible"
    class="app-scope"
    title="批量上传"
    width="460px"
    align-center
    draggable
    :close-on-click-modal="false"
    :close-on-press-escape="!running"
    :show-close="!running"
  >
    <div class="batch">
      <div class="batch__line">
        <span class="label-cap">上传进度</span>
        <span class="batch__count mono">{{ done }} / {{ total }}</span>
      </div>
      <div class="bar">
        <div class="bar__fill" :style="{ width: percent + '%' }"></div>
      </div>

      <div class="batch__stats">
        <span class="app-tag app-tag--ok">成功 {{ success }}</span>
        <span class="app-tag" :class="failed.length ? 'app-tag--danger' : ''">
          失败 {{ failed.length }}
        </span>
        <span v-if="running" class="batch__running">
          <span class="batch__spin"></span>
          正在上传…
        </span>
        <span v-else class="app-hint">已完成</span>
      </div>

      <div v-if="failed.length" class="batch__failed">
        <div class="label-cap batch__failed-title">失败明细</div>
        <div class="batch__failed-list">
          <div v-for="(item, index) in failed" :key="index" class="batch__failed-item">
            {{ item }}
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button :disabled="running" @click="visible = false">
        {{ running ? '上传中…' : '关闭' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/** 批量上传进度弹框：显示总数/成功/失败/进度条/失败明细 */
const props = defineProps<{
  modelValue: boolean
  total: number
  done: number
  success: number
  failed: string[]
  running: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const percent = computed(() =>
  props.total > 0 ? Math.min(100, Math.round((props.done / props.total) * 100)) : 0
)
</script>

<style scoped>
.batch {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}
.batch__line {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.batch__count {
  font-size: var(--fs-md);
  font-weight: 600;
  color: var(--t1);
}
.bar {
  height: 8px;
  background: var(--surface-3);
  overflow: hidden;
}
.bar__fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s ease;
}
.batch__stats {
  display: flex;
  align-items: center;
  gap: var(--s2);
}
.batch__running {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-sm);
  color: var(--t3);
}
.batch__spin {
  width: 12px;
  height: 12px;
  border: 2px solid var(--t3);
  border-top-color: transparent;
  border-radius: 50%;
  animation: batch-spin 0.7s linear infinite;
}
@keyframes batch-spin {
  to {
    transform: rotate(360deg);
  }
}
.batch__failed {
  border-top: 1px solid var(--line);
  padding-top: var(--s3);
}
.batch__failed-title {
  margin-bottom: var(--s2);
}
.batch__failed-list {
  max-height: 180px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.batch__failed-item {
  font-size: var(--fs-sm);
  color: var(--danger);
  line-height: 1.5;
}
</style>
