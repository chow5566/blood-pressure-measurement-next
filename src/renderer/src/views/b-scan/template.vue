<template>
  <div class="tpl-page app-scope">
    <!-- 左：模板树 -->
    <section class="panel tpl-tree-panel">
      <div class="panel__head">
        <div class="panel__title">模板与类型</div>
        <el-input
          v-model="keyword"
          class="tpl-search"
          size="small"
          placeholder="搜索"
          clearable
          :prefix-icon="Search"
          @keydown.enter="load"
          @clear="load"
        />
      </div>

      <div v-loading="loading" class="tpl-tree">
        <el-tree
          ref="treeRef"
          :data="tree"
          node-key="id"
          highlight-current
          default-expand-all
          :expand-on-click-node="false"
          :props="{ label: 'typeName', children: 'children' }"
          @node-click="onNodeClick"
        >
          <template #default="{ data }">
            <div class="tpl-node">
              <el-icon class="tpl-node__icon" :size="14">
                <Folder v-if="data.dataType === 'TYPE'" />
                <Document v-else />
              </el-icon>
              <span class="tpl-node__name">{{ nodeLabel(data) }}</span>
              <span class="tpl-node__ops">
                <button
                  v-if="data.dataType === 'TYPE'"
                  class="tpl-op"
                  title="新增子节点"
                  @click.stop="openDialog(null, data.id)"
                >
                  <el-icon><Plus /></el-icon>
                </button>
                <button class="tpl-op" title="修改" @click.stop="openDialog(data)">
                  <el-icon><Edit /></el-icon>
                </button>
                <button class="tpl-op tpl-op--danger" title="删除" @click.stop="handleDelete(data)">
                  <el-icon><Delete /></el-icon>
                </button>
              </span>
            </div>
          </template>
        </el-tree>

        <el-empty v-if="!loading && tree.length === 0" description="暂无模板" />
      </div>

      <footer class="tpl-foot">
        <HotkeyTooltip id="templateAdd">
          <UiButton variant="primary" size="sm" @click="openDialog(null, '00')">新增</UiButton>
        </HotkeyTooltip>
        <HotkeyTooltip id="templateRefresh">
          <UiButton variant="secondary" size="sm" :loading="syncing" @click="handleSync">
            获取公共模板
          </UiButton>
        </HotkeyTooltip>
      </footer>
    </section>

    <!-- 右：详情 -->
    <section class="panel tpl-detail-panel">
      <div class="panel__head">
        <div class="panel__title">模板详情</div>
        <UiButton v-if="current?.id" variant="secondary" size="sm" @click="openDialog(current)">
          修改
        </UiButton>
      </div>
      <div class="tpl-detail">
        <template v-if="current?.id">
          <div class="kv">
            <span class="kv__k">数据类型</span>
            <span class="kv__v">{{ current.dataType === 'TYPE' ? '类型' : '模板' }}</span>
          </div>
          <div class="kv">
            <span class="kv__k">父节点</span>
            <span class="kv__v">{{ parentLabel(current.parentId) }}</span>
          </div>
          <template v-if="current.dataType === 'TYPE'">
            <div class="kv">
              <span class="kv__k">类型名称</span>
              <span class="kv__v">{{ current.typeName || '-' }}</span>
            </div>
            <div class="kv kv--block">
              <span class="kv__k">类型描述</span>
              <span class="kv__v kv__v--text">{{ current.typeDesc || '-' }}</span>
            </div>
          </template>
          <template v-else>
            <div class="kv">
              <span class="kv__k">模板标题</span>
              <span class="kv__v">{{ current.title || '-' }}</span>
            </div>
            <div class="kv kv--block">
              <span class="kv__k">诊断结果</span>
              <span class="kv__v kv__v--text">{{ current.diagnosis || '-' }}</span>
            </div>
            <div class="kv kv--block">
              <span class="kv__k">诊断描述</span>
              <span class="kv__v kv__v--text">{{ current.diagnosisDetails || '-' }}</span>
            </div>
          </template>
        </template>
        <el-empty v-else description="请选择左侧节点" />
      </div>
    </section>

    <!-- 新增/修改 -->
    <el-dialog
      v-model="dialogVisible"
      class="app-scope"
      :title="form.id ? '修改' : '新增'"
      width="560px"
      align-center
      draggable
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="父节点" prop="parentId">
          <el-tree-select
            v-model="form.parentId"
            class="full-width"
            :data="parentOptions"
            check-strictly
            :render-after-expand="false"
            value-key="id"
            :props="{ label: 'typeName', children: 'children' }"
            filterable
          />
        </el-form-item>
        <el-form-item label="数据类型" prop="dataType">
          <el-radio-group v-model="form.dataType">
            <el-radio value="TYPE">类型</el-radio>
            <el-radio value="TEMPLATE">模板</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="排序号" prop="sortNum">
          <el-input-number
            v-model="form.sortNum"
            :min="0"
            :max="999999"
            controls-position="right"
          />
        </el-form-item>

        <template v-if="form.dataType === 'TYPE'">
          <el-form-item label="类型名称" prop="typeName">
            <el-input v-model="form.typeName" placeholder="请输入类型名称" />
          </el-form-item>
          <el-form-item label="类型描述" prop="typeDesc">
            <el-input
              v-model="form.typeDesc"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 6 }"
              placeholder="请输入类型描述"
            />
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item label="模板标题" prop="title">
            <el-input v-model="form.title" placeholder="请输入模板标题" />
          </el-form-item>
          <el-form-item label="诊断结果" prop="diagnosis">
            <el-input
              v-model="form.diagnosis"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 6 }"
              placeholder="请输入诊断结果"
            />
          </el-form-item>
          <el-form-item label="诊断描述" prop="diagnosisDetails">
            <el-input
              v-model="form.diagnosisDetails"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 10 }"
              placeholder="请输入诊断描述"
            />
          </el-form-item>
        </template>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <HotkeyTooltip id="templateSave">
          <el-button type="primary" :loading="saving" @click="handleSubmit">保存</el-button>
        </HotkeyTooltip>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, reactive, ref } from 'vue'
import type { FormInstance } from 'element-plus'
import { Delete, Document, Edit, Folder, Plus, Search } from '@element-plus/icons-vue'
import UiButton from '@r/components/ui/UiButton.vue'
import HotkeyTooltip from '@r/components/HotkeyTooltip.vue'
import { bScanApi } from '@r/api/b-scan'
import { buildTree } from '@r/utils/tree'
import { uuid } from '@shared/utils/uuid'
import { useHotkey } from '@r/hotkeys/useHotkey'
import type { BScanTemplate } from '@shared/domain/b-scan'

/**
 * B超模板维护：左侧类型/模板树（增删改），右侧详情，支持从服务器获取公共模板。
 */
type TemplateNode = BScanTemplate & { children?: TemplateNode[] }

const keyword = ref('')
const loading = ref(false)
const syncing = ref(false)
const allList = ref<BScanTemplate[]>([])
const tree = ref<TemplateNode[]>([])
const current = ref<BScanTemplate | null>(null)
const treeRef = ref()

function nodeLabel(data: BScanTemplate): string {
  return (data.dataType === 'TYPE' ? data.typeName : data.title) || '未命名'
}

function parentLabel(parentId?: string): string {
  if (!parentId || parentId === '00') return '顶级'
  const parent = allList.value.find((item) => item.id === parentId)
  return parent ? nodeLabel(parent) : '顶级'
}

async function load(): Promise<void> {
  loading.value = true
  try {
    allList.value = await bScanApi.templates(undefined, keyword.value || undefined)
    tree.value = buildTree(allList.value as TemplateNode[])
    if (current.value?.id && !allList.value.some((item) => item.id === current.value?.id)) {
      current.value = null
    }
  } catch (error) {
    ElMessage.error(`加载失败：${(error as Error).message}`)
  } finally {
    loading.value = false
  }
}

function onNodeClick(data: BScanTemplate): void {
  current.value = data
}

async function handleDelete(data: BScanTemplate): Promise<void> {
  await ElMessageBox.confirm('确定删除该节点吗？其子节点将失去关联。', '提示', { type: 'warning' })
  try {
    const result = await bScanApi.templateDelete(data.id as string)
    if (!result.ok) throw new Error(result.message || '删除失败')
    ElMessage.success('删除成功')
    if (current.value?.id === data.id) current.value = null
    await load()
  } catch (error) {
    ElMessage.error((error as Error).message)
  }
}

async function handleSync(): Promise<void> {
  await ElMessageBox.confirm('将从服务器获取公共模板并覆盖本地公共模板，是否继续？', '提示', {
    type: 'warning'
  })
  syncing.value = true
  try {
    const result = await bScanApi.templateSync()
    if (!result.ok) throw new Error(result.message || '获取失败')
    ElMessage.success('获取成功')
    await load()
  } catch (error) {
    ElMessage.error((error as Error).message)
  } finally {
    syncing.value = false
  }
}

// ── 新增 / 修改 ───────────────────────────────────────
const dialogVisible = ref(false)
const saving = ref(false)
const formRef = ref<FormInstance>()

const form = reactive({
  id: '',
  parentId: '00',
  dataType: 'TYPE' as 'TYPE' | 'TEMPLATE',
  sortNum: 0,
  typeName: '',
  typeDesc: '',
  title: '',
  diagnosis: '',
  diagnosisDetails: ''
})

const rules = {
  parentId: [{ required: true, message: '请选择父节点', trigger: 'change' }],
  dataType: [{ required: true, message: '请选择数据类型', trigger: 'change' }],
  typeName: [{ required: true, message: '请输入类型名称', trigger: 'blur' }],
  title: [{ required: true, message: '请输入模板标题', trigger: 'blur' }],
  diagnosis: [{ required: true, message: '请输入诊断结果', trigger: 'blur' }],
  diagnosisDetails: [{ required: true, message: '请输入诊断描述', trigger: 'blur' }]
}

/** 父节点选项：顶级 + 所有 TYPE 组成的树 */
const parentOptions = computed<TemplateNode[]>(() => {
  const types = allList.value.filter((item) => item.dataType === 'TYPE')
  const typeTree = buildTree(types as TemplateNode[])
  return [{ id: '00', typeName: '顶级', children: typeTree } as TemplateNode]
})

function openDialog(data: BScanTemplate | null, parentId = '00'): void {
  form.id = data?.id ?? ''
  form.parentId = data?.parentId ?? parentId
  form.dataType = (data?.dataType as 'TYPE' | 'TEMPLATE') ?? 'TYPE'
  form.sortNum = data?.sortNum ?? 0
  form.typeName = data?.typeName ?? ''
  form.typeDesc = data?.typeDesc ?? ''
  form.title = data?.title ?? ''
  form.diagnosis = data?.diagnosis ?? ''
  form.diagnosisDetails = data?.diagnosisDetails ?? ''
  dialogVisible.value = true
}

async function handleSubmit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    const payload: BScanTemplate = {
      id: form.id || uuid(),
      parentId: form.parentId,
      dataType: form.dataType,
      sortNum: form.sortNum,
      typeName: form.dataType === 'TYPE' ? form.typeName : '',
      typeDesc: form.dataType === 'TYPE' ? form.typeDesc : '',
      title: form.dataType === 'TEMPLATE' ? form.title : '',
      diagnosis: form.dataType === 'TEMPLATE' ? form.diagnosis : '',
      diagnosisDetails: form.dataType === 'TEMPLATE' ? form.diagnosisDetails : ''
    }
    const result = await bScanApi.templateSave(payload)
    if (!result.ok) throw new Error(result.message || '保存失败')
    ElMessage.success('保存成功')
    dialogVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error((error as Error).message)
  } finally {
    saving.value = false
  }
}

onActivated(() => {
  void load()
})

// ── 快捷键（作用域：bscan-template） ───────────────────
useHotkey('templateAdd', () => openDialog(null), 'bscan-template')
useHotkey(
  'templateSave',
  () => {
    if (dialogVisible.value) void handleSubmit()
  },
  'bscan-template'
)
useHotkey(
  'templateDelete',
  () => {
    if (current.value) void handleDelete(current.value)
  },
  'bscan-template'
)
useHotkey('templateRefresh', () => void handleSync(), 'bscan-template')
</script>

<style scoped>
.tpl-page {
  display: grid;
  grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: var(--s-card);
  height: 100%;
  min-height: 0;
}

.panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.tpl-search {
  width: 150px;
}

.tpl-tree {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--s1) 0;
}

.tpl-node {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  padding-right: 6px;
}
.tpl-node__icon {
  color: var(--t3);
  flex-shrink: 0;
}
.tpl-node__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tpl-node__ops {
  display: none;
  align-items: center;
  gap: 2px;
}
.tpl-node:hover .tpl-node__ops {
  display: flex;
}
.tpl-op {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--t2);
  cursor: pointer;
}
.tpl-op:hover {
  background: var(--surface-3);
  color: var(--t1);
}
.tpl-op--danger:hover {
  background: var(--danger-weak);
  color: var(--danger);
}

.tpl-foot {
  display: flex;
  gap: var(--s2);
  padding: var(--s3) var(--s4);
  border-top: 1px solid var(--line);
  background: var(--surface-2);
}

.tpl-detail {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--s4);
}
.kv {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: var(--s3);
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
  font-size: var(--fs-md);
}
.kv--block {
  grid-template-columns: 1fr;
  gap: 4px;
}
.kv__k {
  color: var(--t3);
}
.kv__v {
  color: var(--t1);
  word-break: break-word;
}
.kv__v--text {
  white-space: pre-wrap;
  line-height: 1.6;
  color: var(--t2);
}

:deep(.full-width) {
  width: 100%;
}
</style>
