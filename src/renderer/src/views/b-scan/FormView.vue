<template>
  <div v-loading="store.pageLoading" class="bscan-form app-scope">
    <el-form ref="formRef" :model="formData" :rules="rules" label-position="top" size="default">
      <section class="fsection">
        <div class="fsection__title app-section-title">患者信息</div>
        <div class="fgrid">
          <el-form-item label="条码号" prop="barcode">
            <el-input
              ref="barcodeInput"
              v-model="formData.barcode"
              placeholder="扫码或输入条码号"
              @input="handleBarcodeInput"
              @keydown.enter="handleGetInfo"
              @blur="handleBarcodeBlur"
            />
          </el-form-item>

          <el-form-item label="体检类型">
            <el-radio-group :model-value="store.bScanType" @change="handleTypeChange">
              <el-radio value="GW" border>公卫体检</el-radio>
              <el-radio value="BS" border>商业体检</el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="姓名" prop="name">
            <el-input v-model="formData.name" placeholder="请输入姓名" />
          </el-form-item>

          <el-form-item label="身份证号" prop="idCard">
            <el-input
              v-model="formData.idCard"
              placeholder="请输入身份证号"
              @blur="handleIdCardBlur"
            />
          </el-form-item>

          <el-form-item label="出生日期" prop="birthday">
            <el-date-picker
              v-model="formData.birthday"
              class="full-width"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="请选择出生日期"
            />
          </el-form-item>

          <el-form-item label="性别" prop="gender">
            <el-radio-group v-model="formData.gender">
              <el-radio value="1" border>男</el-radio>
              <el-radio value="2" border>女</el-radio>
            </el-radio-group>
          </el-form-item>
        </div>
      </section>

      <section class="fsection">
        <div class="fsection__head">
          <div class="fsection__title app-section-title">检查信息</div>
          <HotkeyTooltip id="openTemplate">
            <el-button plain :icon="MessageBox" @click="openTemplateDialog"> 选择模板 </el-button>
          </HotkeyTooltip>
        </div>
        <div class="fgrid">
          <el-form-item label="检查部位" prop="bodyParts">
            <el-select v-model="formData.bodyParts" placeholder="请选择检查部位" class="full-width">
              <el-option
                v-for="item in BSCAN_BODY_PARTS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="检查结果" prop="isNormal">
            <el-radio-group v-model="formData.isNormal">
              <el-radio value="1" border>正常</el-radio>
              <el-radio value="2" border>异常</el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item class="fgrid__full" label="诊断结果" prop="diagnosis">
            <el-input
              v-model="formData.diagnosis"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 6 }"
              placeholder="请输入诊断结果"
            />
          </el-form-item>

          <el-form-item class="fgrid__full" label="诊断描述" prop="diagnosisDetails">
            <el-input
              v-model="formData.diagnosisDetails"
              type="textarea"
              :autosize="{ minRows: 4 }"
              placeholder="请输入诊断描述"
            />
          </el-form-item>

          <el-form-item class="fgrid__full" label="备注" prop="localRemark">
            <el-input
              v-model="formData.localRemark"
              type="textarea"
              :autosize="{ minRows: 2 }"
              placeholder="仅作本地保存参考"
            />
          </el-form-item>
        </div>
      </section>
    </el-form>

    <!-- 模板选择 -->
    <el-dialog
      v-model="templateDialogVisible"
      class="app-scope"
      title="选择模板"
      width="820px"
      align-center
      draggable
      @opened="onTemplateOpened"
      @closed="onTemplateClosed"
    >
      <div class="tpl-picker">
        <!-- 左：模板树 -->
        <section class="panel tpl-picker__left">
          <div class="panel__head">
            <div class="panel__title">模板</div>
            <el-autocomplete
              ref="templateSearchRef"
              v-model="templateKeyword"
              class="tpl-search"
              size="small"
              placeholder="搜索模板 / 类型"
              clearable
              popper-class="tpl-suggest-popper"
              :fetch-suggestions="fetchRecentSuggestions"
              @select="handleRecentSelect"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
              <template #default="{ item }">
                <div class="tpl-suggest">
                  <span class="tpl-suggest__name">{{ item.title || '未命名' }}</span>
                  <span class="tpl-suggest__type">{{ item.typeName || '最近使用' }}</span>
                </div>
              </template>
            </el-autocomplete>
          </div>

          <div v-loading="templateLoading" class="tpl-picker__tree">
            <el-tree
              ref="templateTreeRef"
              :data="templateTree"
              node-key="id"
              highlight-current
              default-expand-all
              :expand-on-click-node="false"
              :filter-node-method="filterTemplateNode"
              :props="{ label: 'typeName', children: 'children' }"
              @node-click="handleTemplateNodeClick"
            >
              <template #default="{ data }">
                <div class="tpl-node" @dblclick.stop="handleTemplateDblClick(data, $event)">
                  <el-icon class="tpl-node__icon" :size="14">
                    <Folder v-if="data.dataType === 'TYPE'" />
                    <Document v-else />
                  </el-icon>
                  <span class="tpl-node__name">
                    {{
                      data.dataType === 'TYPE' ? data.typeName || '未命名' : data.title || '未命名'
                    }}
                  </span>
                </div>
              </template>
            </el-tree>
          </div>
        </section>

        <!-- 右：模板详情 -->
        <section class="panel tpl-picker__right">
          <div class="panel__head">
            <div class="panel__title">模板详情</div>
            <span v-if="currentTemplate?.id" class="app-tag app-tag--info app-tag--plain">
              {{ currentTypeName }}
            </span>
          </div>

          <div class="tpl-detail">
            <template v-if="currentTemplate?.id">
              <div class="tpl-detail__title">{{ currentTemplate.title || '未命名' }}</div>
              <div class="kv kv--block">
                <span class="kv__k">诊断结果</span>
                <span class="kv__v kv__v--text">{{ currentTemplate.diagnosis || '—' }}</span>
              </div>
              <div class="kv kv--block">
                <span class="kv__k">诊断描述</span>
                <span class="kv__v kv__v--text">{{ currentTemplate.diagnosisDetails || '—' }}</span>
              </div>
            </template>
            <el-empty v-else description="请选择左侧模板" />
          </div>
        </section>
      </div>

      <template #footer>
        <div class="tpl-footer">
          <span class="tpl-footer__hint">
            双击追加 · Alt+双击替换 · 快捷键 {{ appendLabel }} / {{ replaceLabel }}
          </span>
          <div class="tpl-footer__actions">
            <el-button @click="templateDialogVisible = false">取消</el-button>
            <HotkeyTooltip id="templateAppend">
              <el-button plain :icon="Plus" @click="applyTemplate('APPEND')"> 追加 </el-button>
            </HotkeyTooltip>
            <HotkeyTooltip id="templateReplace">
              <el-button type="primary" :icon="Switch" @click="applyTemplate('REPLACE')">
                替换
              </el-button>
            </HotkeyTooltip>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import type { FormInstance } from 'element-plus'
import { Document, Folder, MessageBox, Plus, Search, Switch } from '@element-plus/icons-vue'
import { bScanApi } from '@r/api/b-scan'
import { useBScanStore, type TempPic } from '@r/stores/b-scan'
import { useUserStore } from '@r/stores/user'
import { useConfigStore } from '@r/stores/config'
import { useNetworkStore } from '@r/stores/network'
import { buildTree } from '@r/utils/tree'
import { BSCAN_FORM_RULES } from '@r/utils/bscan-form'
import { comboText, matchesHotkey } from '@r/utils/hotkey'
import HotkeyTooltip from '@r/components/HotkeyTooltip.vue'
import { addRecentTemplateId, getRecentTemplateIds } from '@r/utils/template-recent'
import { BSCAN_BODY_PARTS } from '@shared/domain/b-scan'
import type { BScanTemplate } from '@shared/domain/b-scan'
import { parseIDCard } from '@shared/utils/idcard'
import { uuid } from '@shared/utils/uuid'

/**
 * B超患者/检查信息表单（离线优先）。
 * 通过 `bscan:get` 读取本地已有数据；模板来自本地库。
 */

const store = useBScanStore()
const userStore = useUserStore()
const formRef = ref<FormInstance>()
const barcodeInput = ref<{ focus: () => void }>()

const formData = reactive({
  barcode: '',
  name: '',
  idCard: '',
  gender: '',
  birthday: '',
  isNormal: '1',
  bodyParts: '2',
  localRemark: '',
  diagnosis: '',
  diagnosisDetails: ''
})

const rules = BSCAN_FORM_RULES

const originalBarcode = ref('')

// ── 模板选择 ──────────────────────────────────────────
type TemplateNode = BScanTemplate & { children?: TemplateNode[] }

const config = useConfigStore()
const network = useNetworkStore()

const templateDialogVisible = ref(false)
const templateLoading = ref(false)
const templateKeyword = ref('')
const templates = ref<BScanTemplate[]>([])
const currentTemplate = ref<BScanTemplate | null>(null)
const templateTreeRef = ref()
const templateSearchRef = ref<{ focus: () => void }>()
const recentIds = ref<string[]>(getRecentTemplateIds())

const templateTree = computed<TemplateNode[]>(() => buildTree(templates.value as TemplateNode[]))
const recentTemplates = computed(() =>
  recentIds.value
    .map((id) => templates.value.find((item) => item.id === id))
    .filter((item): item is BScanTemplate => !!item && item.dataType === 'TEMPLATE')
)

/** 当前模板所属类型名（模板自身不带 typeName，取父节点） */
const currentTypeName = computed(() => {
  const template = currentTemplate.value
  if (!template?.id || !template.parentId) return '未分类'
  const parent = templates.value.find((item) => item.id === template.parentId)
  return parent?.typeName || '未分类'
})

/** 搜索框下拉：把「最近使用」作为建议项（随输入过滤） */
function fetchRecentSuggestions(query: string, callback: (items: BScanTemplate[]) => void): void {
  const keyword = query.trim().toLowerCase()
  callback(
    recentTemplates.value.filter(
      (item) => !keyword || (item.title ?? '').toLowerCase().includes(keyword)
    )
  )
}

/** 选中下拉里的最近模板：高亮对应树节点并预览 */
function handleRecentSelect(item: BScanTemplate): void {
  currentTemplate.value = item
  templateKeyword.value = ''
  void nextTick(() => {
    templateTreeRef.value?.setCurrentKey(item.id)
    const el = document.querySelector('.tpl-picker__tree .el-tree-node.is-current')
    el?.scrollIntoView({ block: 'nearest' })
  })
}

/** 按树的显示顺序（深度优先）收集模板，用于方向键导航 */
function collectTemplates(nodes: TemplateNode[]): BScanTemplate[] {
  const out: BScanTemplate[] = []
  const walk = (list: TemplateNode[]): void => {
    for (const node of list) {
      if (node.dataType === 'TEMPLATE') out.push(node)
      if (node.children?.length) walk(node.children)
    }
  }
  walk(nodes)
  return out
}
const navTemplates = computed(() =>
  collectTemplates(templateTree.value).filter((item) =>
    filterTemplateNode(templateKeyword.value, item)
  )
)

const appendLabel = computed(() => comboText(config.hotkeys.templateAppend))
const replaceLabel = computed(() => comboText(config.hotkeys.templateReplace))

async function loadTemplates(): Promise<void> {
  templateLoading.value = true
  try {
    templates.value = await bScanApi.templates()
  } catch {
    templates.value = []
  } finally {
    templateLoading.value = false
  }
}

function openTemplateDialog(): void {
  currentTemplate.value = null
  templateKeyword.value = ''
  templateDialogVisible.value = true
  void loadTemplates()
}

function onTemplateOpened(): void {
  window.addEventListener('keydown', onTemplateKeydown, true)
  void nextTick(() => templateSearchRef.value?.focus())
}
function onTemplateClosed(): void {
  window.removeEventListener('keydown', onTemplateKeydown, true)
}

function onTemplateKeydown(event: KeyboardEvent): void {
  if (matchesHotkey(event, config.hotkeys.templateAppend)) {
    event.preventDefault()
    event.stopPropagation()
    applyTemplate('APPEND')
    return
  }
  if (matchesHotkey(event, config.hotkeys.templateReplace)) {
    event.preventDefault()
    event.stopPropagation()
    applyTemplate('REPLACE')
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    moveHighlight(event.key === 'ArrowDown' ? 1 : -1)
  }
}

/** 方向键在模板列表中移动选中（按树的显示顺序） */
function moveHighlight(delta: number): void {
  const list = navTemplates.value
  if (!list.length) return
  let index = currentTemplate.value?.id
    ? list.findIndex((item) => item.id === currentTemplate.value?.id)
    : -1
  index = Math.min(list.length - 1, Math.max(0, index + delta))
  const target = list[index]
  currentTemplate.value = target
  templateTreeRef.value?.setCurrentKey(target.id)
  void nextTick(() => {
    const el = document.querySelector('.tpl-picker__tree .el-tree-node.is-current')
    el?.scrollIntoView({ block: 'nearest' })
  })
}

watch(templateKeyword, (value) => {
  templateTreeRef.value?.filter(value)
})

function filterTemplateNode(value: string, data: BScanTemplate): boolean {
  if (!value) return true
  const text = `${data.typeName ?? ''}${data.title ?? ''}`.toLowerCase()
  return text.includes(value.toLowerCase())
}

function handleTemplateNodeClick(data: BScanTemplate): void {
  currentTemplate.value = data.dataType === 'TEMPLATE' ? data : null
}

/** 双击：默认追加，Alt 双击替换 */
function handleTemplateDblClick(data: BScanTemplate, event?: Event): void {
  if (data.dataType !== 'TEMPLATE') return
  currentTemplate.value = data
  const replace = event instanceof MouseEvent && event.altKey
  applyTemplate(replace ? 'REPLACE' : 'APPEND')
}

/** 追加 / 替换诊断内容 */
function applyTemplate(type: 'APPEND' | 'REPLACE'): void {
  const template = currentTemplate.value
  if (!template?.id || template.dataType !== 'TEMPLATE') {
    ElMessage.warning('请选择模板')
    return
  }
  const diagnosis = template.diagnosis ?? ''
  const details = template.diagnosisDetails ?? ''
  if (type === 'REPLACE') {
    formData.diagnosis = diagnosis
    formData.diagnosisDetails = details
  } else {
    formData.diagnosis = formData.diagnosis ? `${formData.diagnosis}\n${diagnosis}` : diagnosis
    formData.diagnosisDetails = formData.diagnosisDetails
      ? `${formData.diagnosisDetails}\n${details}`
      : details
  }
  addRecentTemplateId(template.id)
  recentIds.value = getRecentTemplateIds()
  templateDialogVisible.value = false
}

// ── 数据读取 ──────────────────────────────────────────
/** 条码失焦：值变化时查询 */
/** 输入条码时先锁定采集，待确认后再解锁 */
function handleBarcodeInput(): void {
  store.setBarcodeConfirmed(false)
}

function handleBarcodeBlur(): void {
  if (!formData.barcode) return
  if (formData.barcode !== originalBarcode.value) {
    void handleGetInfo()
  }
}

/** 读取本地记录并填充表单；联网时合并在线数据 */
let loadToken = 0
async function handleGetInfo(): Promise<void> {
  if (!formData.barcode) {
    resetForm()
    originalBarcode.value = ''
    return
  }
  // 同一已确认条码且已有图片：避免重复回车清空已采集图片
  if (formData.barcode === originalBarcode.value && store.tempPics.length > 0) {
    store.setBarcodeConfirmed(true)
    return
  }
  const token = ++loadToken
  store.pageLoading = true
  try {
    const record = await bScanApi.get(formData.barcode)
    // 已被重置/新查询作废：丢弃本次结果，避免把旧图片回填
    if (token !== loadToken) return
    if (record) {
      formData.name = record.name ?? ''
      formData.idCard = record.idCard ?? ''
      formData.gender = record.gender ?? ''
      formData.birthday = record.birthday ?? ''
      formData.isNormal = `${record.isNormal ?? '1'}`
      formData.bodyParts = record.bodyParts ?? '2'
      formData.localRemark = record.localRemark ?? ''
      formData.diagnosis = record.diagnosis ?? ''
      formData.diagnosisDetails = record.diagnosisDetails ?? ''
      store.tempPics = (record.images ?? []).map(
        (image) =>
          ({
            ...image,
            base64Path: image.base64Path ?? '',
            isCheck: image.isCheck ?? 'N'
          }) as TempPic
      )
    } else {
      store.tempPics = []
    }
    originalBarcode.value = formData.barcode
    store.setBarcodeConfirmed(true)

    // 联网使用：拉取在线数据（失败静默，保留本地）；网络未连接时跳过
    if (store.isOnline && userStore.isOnline === 'Y' && network.online) {
      await mergeOnlineData(token)
    }
  } catch {
    if (token === loadToken) {
      store.tempPics = []
      store.setBarcodeConfirmed(false)
    }
  } finally {
    if (token === loadToken) store.pageLoading = false
  }
}

/** 合并在线数据（在线数据优先，本地备注保留） */
async function mergeOnlineData(token: number): Promise<void> {
  try {
    const online = await bScanApi.onlineLookup(formData.barcode, store.bScanType)
    if (token !== loadToken || !online) return
    formData.name = online.name ?? formData.name
    formData.idCard = online.idCard ?? formData.idCard
    formData.gender = online.gender ?? formData.gender
    formData.birthday = online.birthday ?? formData.birthday
    if (online.diagnosis) formData.diagnosis = online.diagnosis
    if (online.diagnosisDetails) formData.diagnosisDetails = online.diagnosisDetails
    if (online.localRemark) formData.localRemark = online.localRemark
    if (online.images?.length) {
      store.tempPics = online.images.map((image) => ({
        ...image,
        id: image.id || uuid(),
        base64Path: image.base64Path ?? '',
        isCheck: (image.isCheck ?? 'N') as 'Y' | 'N'
      })) as TempPic[]
    }
  } catch {
    // 在线查询失败不影响本地录入
  }
}

function handleTypeChange(value: string | number | boolean | undefined): void {
  store.bScanType = value === 'BS' ? 'BS' : 'GW'
  void handleGetInfo()
}

function resetForm(): void {
  formRef.value?.resetFields()
  originalBarcode.value = ''
  store.setBarcodeConfirmed(false)
  // 作废进行中的查询，避免重置后旧结果把图片回填
  loadToken++
}

async function handleIdCardBlur(): Promise<void> {
  await nextTick()
  const info = parseIDCard(formData.idCard)
  if (info) {
    formData.birthday = info.birthDate
    formData.gender = info.gender
  }
}

/** 校验并返回表单数据 */
function submit(): Promise<typeof formData> {
  return new Promise((resolve, reject) => {
    formRef.value?.validate((valid) => {
      if (valid) resolve(formData)
      else reject(new Error('表单校验失败'))
    })
  })
}

function getFormData(): typeof formData {
  return formData
}

function letBarcodeInputFocus(): void {
  barcodeInput.value?.focus()
}

defineExpose({
  getFormData,
  handleGetInfo,
  letBarcodeInputFocus,
  submit,
  resetForm,
  openTemplateDialog
})
</script>

<style scoped>
.bscan-form {
  display: flex;
  flex-direction: column;
}

.fsection + .fsection {
  margin-top: var(--s5);
  padding-top: var(--s5);
  border-top: 1px solid var(--line);
}
.fsection__title {
  margin-bottom: var(--s3);
}
.fsection__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  margin-bottom: var(--s3);
}
.fsection__head .fsection__title {
  margin-bottom: 0;
}

.fgrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  /* 行距留出校验提示（绝对定位）的空间，避免与下一行 label 相挤 */
  gap: 22px var(--s4);
}
.fgrid__full {
  grid-column: 1 / -1;
}

.bscan-form :deep(.el-form-item) {
  margin-bottom: 0;
}
.bscan-form :deep(.el-form-item__label) {
  margin-bottom: 4px;
  padding-bottom: 0;
  line-height: 1.4;
  color: var(--t2);
}

:deep(.full-width) {
  width: 100%;
}

/* 模板选择弹窗：左右两块 panel（与「模板维护」保持一致） */
.tpl-picker {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: var(--s-card);
  height: 540px;
}
.tpl-picker__left,
.tpl-picker__right {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.tpl-search {
  width: 168px;
}
.tpl-picker__tree {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--s1) 0;
}
.tpl-node {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.tpl-node__icon {
  flex-shrink: 0;
  color: var(--t3);
}
.tpl-node__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 右侧详情（键值行，发丝线分隔） */
.tpl-detail {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--s4);
}
.tpl-detail__title {
  margin-bottom: var(--s3);
  font-size: var(--fs-lg);
  font-weight: 600;
  line-height: 1.45;
  color: var(--t1);
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

/* 搜索框下拉建议（最近使用） */
.tpl-suggest {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
}
.tpl-suggest__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tpl-suggest__type {
  flex-shrink: 0;
  font-size: var(--fs-xs);
  color: var(--t3);
}

.tpl-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s4);
  width: 100%;
}
.tpl-footer__hint {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--fs-xs);
  color: var(--t3);
}
.tpl-footer__actions {
  display: flex;
  align-items: center;
  gap: var(--s-card);
  flex-shrink: 0;
}

@media (max-width: 1200px) {
  .fgrid {
    grid-template-columns: 1fr;
  }
}
</style>
