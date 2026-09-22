<template>
  <div
    class="pic-view"
    :class="{ 'is-checked': checkable && info.isCheck === 'Y', 'is-static': !checkable }"
    @click="onRootClick"
  >
    <img
      v-if="url && !loadError"
      class="pic-view__img"
      :src="url"
      alt=""
      draggable="false"
      @error="loadError = true"
    />
    <div v-else class="pic-view__missing">
      <el-icon :size="18"><Picture /></el-icon>
      <span>图片缺失</span>
    </div>

    <!-- 选择框（左上，明确可见） -->
    <button
      v-if="checkable"
      class="pic-view__select"
      type="button"
      :title="info.isCheck === 'Y' ? '取消选择' : '选择用于报告'"
      @click.stop="emit('toggle')"
    >
      <el-icon v-if="info.isCheck === 'Y'" :size="12"><Check /></el-icon>
    </button>

    <!-- 上传状态（右上）：勾选的（最多4张）会上传服务器，其余仅本地 -->
    <div v-if="uploadBadge" class="pic-view__upload" :class="`is-${uploadBadge.kind}`">
      {{ uploadBadge.label }}
    </div>

    <!-- 底部工具条：序号 / 预览 / 删除 -->
    <div class="pic-view__bar">
      <span class="pic-view__index">{{ index + 1 }}</span>
      <span class="pic-view__tools">
        <button class="pic-view__tool" type="button" title="放大预览" @click.stop="openViewer">
          <el-icon :size="14"><ZoomIn /></el-icon>
        </button>
        <button
          v-if="showDelete"
          class="pic-view__tool"
          type="button"
          title="删除"
          @click.stop="handleDelete"
        >
          <el-icon :size="14"><Delete /></el-icon>
        </button>
      </span>
    </div>

    <el-image-viewer
      v-if="viewerVisible"
      :url-list="previewUrls"
      :initial-index="index"
      teleported
      @close="viewerVisible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, Delete, Picture, ZoomIn } from '@element-plus/icons-vue'
import { useConfigStore } from '@r/stores/config'
import type { TempPic } from '@r/stores/b-scan'

/**
 * 单张采集图片。
 * - checkable=true：整图点击 / 勾选框切换选择（用于入报告）；
 * - checkable=false：整图点击打开预览（历史详情用）；
 * - 底部工具条提供预览 / 删除，不再用覆盖式悬浮按钮。
 */
const props = withDefaults(
  defineProps<{
    info: TempPic
    index: number
    showDelete?: boolean
    checkable?: boolean
    showUploadBadge?: boolean
    recordUploaded?: boolean
    previewSrcList?: TempPic[]
  }>(),
  {
    showDelete: true,
    checkable: true,
    showUploadBadge: false,
    recordUploaded: false,
    previewSrcList: () => []
  }
)

const emit = defineEmits<{ toggle: []; delete: [id: string] }>()

const config = useConfigStore()
const viewerVisible = ref(false)
const loadError = ref(false)

/** 上传状态角标：勾选图 → 已上传/待上传；未勾选 → 仅本地 */
const uploadBadge = computed<{ label: string; kind: 'uploaded' | 'pending' | 'local' } | null>(
  () => {
    if (!props.showUploadBadge) return null
    if (props.info.isCheck === 'Y') {
      return props.recordUploaded
        ? { label: '已上传', kind: 'uploaded' }
        : { label: '待上传', kind: 'pending' }
    }
    return { label: '仅本地', kind: 'local' }
  }
)

// 图片地址变化时重置加载错误状态
watch(
  () => props.info.base64Path,
  () => {
    loadError.value = false
  }
)

/** 本地 base64 优先，其次服务器地址 */
const url = computed(() => {
  const info = props.info
  if (info.base64Path && info.base64Path.startsWith('data:image')) return info.base64Path
  if (info.isUpload === 'Y' && info.uploadUrl) return config.staticApi + info.uploadUrl
  return info.base64Path
})

/** 预览列表（优先使用传入列表，否则仅当前图） */
const previewUrls = computed(() => {
  const list = props.previewSrcList.length ? props.previewSrcList : [props.info]
  return list
    .map((item) => {
      if (item.base64Path && item.base64Path.startsWith('data:image')) return item.base64Path
      if (item.isUpload === 'Y' && item.uploadUrl) return config.staticApi + item.uploadUrl
      return item.base64Path
    })
    .filter(Boolean)
})

function onRootClick(): void {
  if (props.checkable) emit('toggle')
  else openViewer()
}

function openViewer(): void {
  if (!previewUrls.value.length) return
  viewerVisible.value = true
}

/** 删除 */
async function handleDelete(): Promise<void> {
  await ElMessageBox.confirm('确定要删除这张图片？', '删除确认', { type: 'warning' })
  emit('delete', props.info.id ?? '')
}
</script>

<style scoped>
.pic-view {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  background: #0a0a0a;
  cursor: pointer;
  overflow: hidden;
}
.pic-view.is-static {
  cursor: zoom-in;
}
/* 用叠加环做边框：盖在底部操作条之上，且不占布局、不产生缝隙 */
.pic-view::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px solid transparent;
  pointer-events: none;
  z-index: 2;
}
.pic-view:hover:not(.is-checked)::after {
  border-color: var(--line-strong);
}
.pic-view.is-checked::after {
  border-color: var(--accent);
}

.pic-view__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.pic-view__missing {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: var(--surface-2);
  color: var(--t3);
  font-size: var(--fs-xs);
}

/* 左上选择框 */
.pic-view__select {
  position: absolute;
  left: 6px;
  top: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.85);
  background: rgba(22, 22, 22, 0.55);
  color: #fff;
  cursor: pointer;
}
.pic-view.is-checked .pic-view__select {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--on-accent);
}

.pic-view__upload {
  position: absolute;
  right: 6px;
  top: 6px;
  display: flex;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  font-size: var(--fs-micro);
  font-weight: 600;
  background: rgba(22, 22, 22, 0.72);
  color: #fff;
}
.pic-view__upload.is-uploaded {
  background: var(--accent);
  color: var(--on-accent);
}
.pic-view__upload.is-pending {
  background: #d97706;
  color: #fff;
}
.pic-view__upload.is-local {
  background: rgba(22, 22, 22, 0.72);
  color: #fff;
}

/* 底部工具条 */
.pic-view__bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 24px;
  padding: 0 4px 0 6px;
  background: rgba(22, 22, 22, 0.72);
  color: #fff;
}
.pic-view__index {
  font-size: var(--fs-micro);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.pic-view__tools {
  display: flex;
  align-items: center;
  gap: 2px;
}
.pic-view__tool {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
}
.pic-view__tool:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}
</style>
