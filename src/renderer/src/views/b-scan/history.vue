<template>
  <div class="bscan-history app-scope">
    <!-- 查询区 -->
    <div class="query-bar app-card">
      <el-input
        v-model="query.keyword"
        class="query-bar__input"
        placeholder="条码号 / 姓名 / 身份证号"
        clearable
        :prefix-icon="Search"
        @keydown.enter="handleQuery"
      />
      <el-select
        v-model="query.isUpload"
        class="query-bar__select"
        placeholder="上传状态"
        clearable
      >
        <el-option label="已上传" value="Y" />
        <el-option label="未上传" value="N" />
      </el-select>
      <el-select v-model="query.checkType" class="query-bar__select" placeholder="类型" clearable>
        <el-option label="公卫" value="GW" />
        <el-option label="商业" value="BS" />
      </el-select>
      <div class="query-bar__date">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          class="full-width"
        />
      </div>
      <div class="query-bar__actions">
        <el-button type="primary" :icon="Search" @click="handleQuery">搜索</el-button>
        <el-button :icon="RefreshLeft" @click="handleReset">重置</el-button>
      </div>
    </div>

    <div class="history-body">
      <!-- 列表 -->
      <div class="history-list app-card">
        <div class="list-toolbar">
          <span class="list-toolbar__info">已选 {{ selection.length }} 条</span>
          <HotkeyTooltip id="bscanBatchUpload">
            <el-button
              size="small"
              type="primary"
              :icon="Upload"
              :disabled="!selection.length"
              :loading="uploadLoading"
              @click="handleBatchUpload"
            >
              批量上传
            </el-button>
          </HotkeyTooltip>
          <el-button
            size="small"
            type="danger"
            plain
            :icon="Delete"
            :disabled="!selection.length"
            @click="handleBatchDelete"
          >
            批量删除
          </el-button>
        </div>
        <el-table
          ref="tableRef"
          v-loading="listLoading"
          :data="rows"
          height="100%"
          border
          stripe
          size="small"
          highlight-current-row
          @current-change="handleCurrentChange"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="44" align="center" fixed="left" />
          <el-table-column label="类型" width="64" align="center">
            <template #default="{ row }">{{ row.checkType === 'BS' ? '商业' : '公卫' }}</template>
          </el-table-column>
          <el-table-column prop="barcode" label="条码号" min-width="110" show-overflow-tooltip />
          <el-table-column prop="name" label="姓名" width="80" show-overflow-tooltip />
          <el-table-column
            prop="createTime"
            label="创建时间"
            min-width="150"
            show-overflow-tooltip
          />
          <el-table-column label="是否上传" width="84" align="center" fixed="right">
            <template #default="{ row }">
              <el-tag size="small" :type="row.isUpload === 'Y' ? 'success' : 'warning'">
                {{ row.isUpload === 'Y' ? '已上传' : '未上传' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination">
          <el-pagination
            size="small"
            background
            layout="total, sizes, prev, pager, next"
            :pager-count="5"
            :current-page="query.pageNum"
            :page-size="query.pageSize"
            :page-sizes="[10, 30, 50, 100, 200]"
            :total="total"
            @size-change="handleSizeChange"
            @current-change="handlePageChange"
          />
        </div>
      </div>

      <!-- 详情 -->
      <div v-loading="detailLoading" class="history-detail app-card">
        <template v-if="detail">
          <div class="detail-head">
            <div class="app-section-title">{{ editing ? '编辑记录' : '记录详情' }}</div>
            <el-tag :type="detail.isUpload === 'Y' ? 'success' : 'warning'" effect="plain">
              {{ detail.isUpload === 'Y' ? '已上传' : '未上传' }}
            </el-tag>
          </div>

          <div class="history-detail__scroll">
            <el-form :model="form" label-position="top">
              <div class="detail-grid">
                <el-form-item label="条码号">
                  <el-input v-model="form.barcode" :readonly="!editing" />
                </el-form-item>
                <el-form-item label="姓名">
                  <el-input v-model="form.name" :readonly="!editing" />
                </el-form-item>
                <el-form-item label="身份证号">
                  <el-input v-model="form.idCard" :readonly="!editing" />
                </el-form-item>
                <el-form-item label="性别">
                  <el-radio-group v-model="form.gender" :disabled="!editing">
                    <el-radio value="1" border>男</el-radio>
                    <el-radio value="2" border>女</el-radio>
                  </el-radio-group>
                </el-form-item>
                <el-form-item label="出生日期">
                  <el-date-picker
                    v-model="form.birthday"
                    class="full-width"
                    type="date"
                    value-format="YYYY-MM-DD"
                    :disabled="!editing"
                  />
                </el-form-item>
                <el-form-item label="年龄">
                  <el-input :value="(ageOf(form.birthday) ?? '-') + ' 岁'" readonly />
                </el-form-item>
              </div>

              <el-form-item class="pics-item">
                <template #label>
                  <span class="pics-head">
                    <span>采集图片</span>
                    <el-button
                      v-if="editing"
                      size="small"
                      type="primary"
                      :icon="Picture"
                      @click="openImageDialog"
                    >
                      编辑图片
                    </el-button>
                  </span>
                </template>
                <div class="detail-grid detail-grid--pics">
                  <PicView
                    v-for="(item, index) in displayImages"
                    :key="item.id"
                    :info="item"
                    :index="index"
                    :show-delete="false"
                    :checkable="false"
                    :show-upload-badge="true"
                    :record-uploaded="detail.isUpload === 'Y'"
                    :preview-src-list="displayImages"
                  />
                </div>
              </el-form-item>

              <div class="detail-grid">
                <el-form-item label="检查部位">
                  <el-select v-model="form.bodyParts" class="full-width" :disabled="!editing">
                    <el-option
                      v-for="item in BSCAN_BODY_PARTS"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="检查结果">
                  <el-radio-group v-model="form.isNormal" :disabled="!editing">
                    <el-radio value="1" border>正常</el-radio>
                    <el-radio value="2" border>异常</el-radio>
                  </el-radio-group>
                </el-form-item>
              </div>

              <el-form-item label="诊断结果">
                <el-input v-model="form.diagnosis" type="textarea" autosize :readonly="!editing" />
              </el-form-item>
              <el-form-item label="诊断描述">
                <el-input
                  v-model="form.diagnosisDetails"
                  type="textarea"
                  autosize
                  :readonly="!editing"
                />
              </el-form-item>
              <el-form-item label="备注">
                <el-input
                  v-model="form.localRemark"
                  type="textarea"
                  autosize
                  :readonly="!editing"
                />
              </el-form-item>
            </el-form>
          </div>

          <div class="history-detail__actions">
            <template v-if="!editing">
              <el-button type="danger" plain :icon="Delete" @click="handleDelete">删除</el-button>
              <HotkeyTooltip id="bscanEdit">
                <el-button :icon="Edit" @click="startEdit">编辑</el-button>
              </HotkeyTooltip>
              <HotkeyTooltip id="bscanPreview">
                <el-button :icon="Picture" :loading="previewLoading" @click="handlePreview">
                  报告预览
                </el-button>
              </HotkeyTooltip>
              <el-button
                v-if="userStore.isOnline === 'Y'"
                :icon="Switch"
                title="用服务器数据覆盖本地记录与图片"
                @click="handleSync"
              >
                同步数据
              </el-button>
              <el-button
                type="primary"
                :icon="Upload"
                :loading="uploadLoading"
                @click="handleUpload"
              >
                {{ detail.isUpload === 'Y' ? '重新上传' : '立即上传' }}
              </el-button>
            </template>
            <template v-else>
              <el-button :disabled="saving" @click="cancelEdit">取消</el-button>
              <HotkeyTooltip id="bscanPreview">
                <el-button :icon="Picture" :loading="previewLoading" @click="handlePreview">
                  报告预览
                </el-button>
              </HotkeyTooltip>
              <HotkeyTooltip id="bscanSave">
                <el-button :loading="saving" @click="saveEdit(false)">保存</el-button>
              </HotkeyTooltip>
              <HotkeyTooltip id="bscanSaveUpload">
                <el-button type="primary" :loading="saving" @click="saveEdit(true)">
                  保存并上传
                </el-button>
              </HotkeyTooltip>
            </template>
          </div>
        </template>

        <div v-else class="history-detail__empty">
          <UiIcon name="clock" :size="30" />
          <span>请选择左侧记录查看详情</span>
        </div>
      </div>
    </div>

    <!-- 编辑图片 -->
    <el-dialog
      v-model="imageDialogVisible"
      class="app-scope"
      title="编辑图片"
      width="880px"
      align-center
      draggable
    >
      <div class="img-editor">
        <div class="img-editor__video">
          <VideoView
            v-if="imageDialogVisible"
            auto-start
            :pics="editImages"
            @capture="handleCapture"
          />
        </div>
        <div class="img-editor__gallery">
          <div class="panel__head">
            <div class="app-section-title">
              图片 <small>{{ editImages.length }} / 20</small>
            </div>
            <span class="app-hint">已选 {{ checkedEditCount }} 张 · 最多 4 张入报告</span>
          </div>
          <div class="img-editor__grid">
            <PicView
              v-for="(item, index) in editImages"
              :key="item.id"
              :info="item"
              :index="index"
              :preview-src-list="editImages"
              @toggle="toggleEditImage(item)"
              @delete="removeEditImage($event)"
            />
            <div v-if="!editImages.length" class="img-editor__empty">
              暂无图片，点击左侧画面采集
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="imageDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmImages">确定</el-button>
      </template>
    </el-dialog>

    <!-- 报告预览 -->
    <el-image-viewer
      v-if="showViewer"
      :url-list="previewSrcList"
      teleported
      @close="showViewer = false"
    />

    <!-- 批量上传进度 -->
    <BatchUploadProgress
      v-model="batchVisible"
      :total="batch.total"
      :done="batch.done"
      :success="batch.success"
      :failed="batch.failed"
      :running="batch.running"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onActivated, onMounted, reactive, ref, watch } from 'vue'
import { Delete, Edit, Picture, RefreshLeft, Search, Switch, Upload } from '@element-plus/icons-vue'
import type { TableInstance } from 'element-plus'
import { bScanApi, persistBScanImages } from '@r/api/b-scan'
import PicView from './PicView.vue'
import VideoView from '@r/components/video/VideoView.vue'
import BatchUploadProgress from '@r/components/BatchUploadProgress.vue'
import HotkeyTooltip from '@r/components/HotkeyTooltip.vue'
import UiIcon from '@r/components/ui/UiIcon.vue'
import { useUserStore } from '@r/stores/user'
import { useConfigStore } from '@r/stores/config'
import { toPngDataUrl, wordToImage } from '@r/utils/docx'
import { buildBScanReportParams } from '@r/utils/bscan-report'
import { runLimited } from '@r/utils/async'
import { useHotkey } from '@r/hotkeys/useHotkey'
import { ageFromBirthday } from '@shared/utils/format'
import { BSCAN_BODY_PARTS } from '@shared/domain/b-scan'
import type { BScanRecord } from '@shared/domain/b-scan'
import type { TempPic } from '@r/stores/b-scan'

/**
 * B超历史：查询列表 + 详情（就地编辑全部字段）+ 图片弹框编辑 + 删除 / 上传 / 同步 / 报告预览。
 */
const userStore = useUserStore()
const config = useConfigStore()

const query = ref({
  pageNum: 1,
  pageSize: 30,
  keyword: '',
  isUpload: undefined as 'Y' | 'N' | undefined,
  checkType: undefined as 'GW' | 'BS' | undefined
})
const dateRange = ref<[string, string] | null>(defaultDateRange())

/** 默认查询范围：最近 7 天 */
function defaultDateRange(): [string, string] {
  const fmt = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`
  const end = new Date()
  const start = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
  return [fmt(start), fmt(end)]
}
const rows = ref<BScanRecord[]>([])
const total = ref(0)
const listLoading = ref(false)
const tableRef = ref<TableInstance>()
const detail = ref<BScanRecord | null>(null)
const detailLoading = ref(false)
const uploadLoading = ref(false)
const selection = ref<BScanRecord[]>([])

/* 批量上传进度 */
const batchVisible = ref(false)
const batch = reactive({ total: 0, done: 0, success: 0, failed: [] as string[], running: false })

/* 编辑态 */
const editing = ref(false)
const saving = ref(false)
const form = reactive({
  barcode: '',
  name: '',
  idCard: '',
  gender: '',
  birthday: '',
  bodyParts: '2',
  isNormal: '1',
  diagnosis: '',
  diagnosisDetails: '',
  localRemark: ''
})

function loadForm(record: BScanRecord | null): void {
  form.barcode = record?.barcode ?? ''
  form.name = record?.name ?? ''
  form.idCard = record?.idCard ?? ''
  form.gender = record?.gender ?? ''
  form.birthday = record?.birthday ?? ''
  form.bodyParts = record?.bodyParts ?? '2'
  form.isNormal = `${record?.isNormal ?? '1'}`
  form.diagnosis = record?.diagnosis ?? ''
  form.diagnosisDetails = record?.diagnosisDetails ?? ''
  form.localRemark = record?.localRemark ?? ''
}

/** 构造纯对象（剔除响应式代理与 images），避免 IPC 结构化克隆失败 */
function plainRecord(
  record: BScanRecord | null,
  overrides: Partial<BScanRecord> = {}
): BScanRecord {
  const source = record ?? ({} as BScanRecord)
  return {
    barcode: source.barcode,
    checkType: source.checkType,
    name: source.name,
    idCard: source.idCard,
    gender: source.gender,
    birthday: source.birthday,
    isUpload: source.isUpload,
    isNormal: source.isNormal,
    diagnosis: source.diagnosis,
    bodyParts: source.bodyParts,
    diagnosisDetails: source.diagnosisDetails,
    localRemark: source.localRemark,
    ...overrides
  }
}

/* 图片编辑 */
const imageDialogVisible = ref(false)
const editImages = ref<TempPic[]>([])
const pendingImages = ref<TempPic[] | null>(null)

/* 报告预览 */
const previewLoading = ref(false)
const showViewer = ref(false)
const previewSrcList = ref<string[]>([])

const detailImages = computed<TempPic[]>(
  () =>
    (detail.value?.images ?? []).map((image) => ({
      ...image,
      base64Path: image.base64Path ?? '',
      isCheck: image.isCheck ?? 'N'
    })) as TempPic[]
)
const displayImages = computed<TempPic[]>(() => pendingImages.value ?? detailImages.value)
const checkedEditCount = computed(
  () => editImages.value.filter((item) => item.isCheck === 'Y').length
)

/** 图片来源：优先本地 base64，其次服务器地址 */
function imageSrc(item: TempPic): string {
  if (item.base64Path && item.base64Path.startsWith('data:image')) return item.base64Path
  if (item.isUpload === 'Y' && item.uploadUrl) {
    return `${config.staticApi.replace(/\/$/, '')}/${item.uploadUrl.replace(/^\//, '')}`
  }
  return ''
}

function ageOf(birthday?: string): number | null {
  return ageFromBirthday(birthday)
}

function openImageDialog(): void {
  editImages.value = detailImages.value.map((item) => ({ ...item }))
  imageDialogVisible.value = true
}

function handleCapture(pic: TempPic): void {
  if (editImages.value.length >= 20) {
    ElMessage.warning('最多采集20张图片')
    return
  }
  editImages.value.unshift(pic)
}

function toggleEditImage(pic: TempPic): void {
  if (pic.isCheck === 'N' && checkedEditCount.value >= 4) {
    ElMessage.warning('最多选择4张图片')
    return
  }
  pic.isCheck = pic.isCheck === 'Y' ? 'N' : 'Y'
}

function removeEditImage(id: string): void {
  editImages.value = editImages.value.filter((item) => item.id !== id)
}

function confirmImages(): void {
  pendingImages.value = editImages.value.map((item) => ({ ...item }))
  imageDialogVisible.value = false
}

/** 生成报告图片（当前表单 + 可用图片，最多 4 张）；失败返回 null */
async function renderReportImage(): Promise<string | null> {
  const usable = displayImages.value
    .map((item) => ({ item, src: imageSrc(item) }))
    .filter((entry) => entry.src)
  const checked = usable.filter((entry) => entry.item.isCheck === 'Y')
  const pics = (checked.length ? checked : usable).slice(0, 4)
  if (!pics.length) {
    ElMessage.warning('没有可用的图片（本地文件可能已丢失）')
    return null
  }
  const pngs = await Promise.all(pics.map((entry) => toPngDataUrl(entry.src)))
  const docxUrl = await bScanApi.renderReport(
    buildBScanReportParams({
      title: config.reportTemplate.title || '社区卫生服务中心',
      form,
      images: pngs,
      doctorName: userStore.user.name
    })
  )
  return wordToImage(docxUrl)
}

/** 报告预览 */
async function handlePreview(): Promise<void> {
  previewLoading.value = true
  try {
    const imageUrl = await renderReportImage()
    if (imageUrl) {
      previewSrcList.value = [imageUrl]
      showViewer.value = true
    }
  } catch (error) {
    ElMessageBox.alert(`报告预览失败：${(error as Error).message}`, '报告预览失败', {
      confirmButtonText: '我知道了'
    })
  } finally {
    previewLoading.value = false
  }
}

/* 编辑 / 保存 */
function startEdit(): void {
  loadForm(detail.value)
  editing.value = true
}

function cancelEdit(): void {
  loadForm(detail.value)
  pendingImages.value = null
  editing.value = false
}

async function saveEdit(upload = false): Promise<void> {
  if (!detail.value) return
  const oldBarcode = detail.value.barcode
  const newBarcode = form.barcode.trim()
  if (!newBarcode) {
    ElMessage.warning('条码号不能为空')
    return
  }

  saving.value = true
  try {
    // 1) 本地保存：条码 / 记录 / 图片
    if (newBarcode !== oldBarcode) {
      const renamed = await bScanApi.changeBarcode(oldBarcode, newBarcode)
      if (!renamed.ok) throw new Error(renamed.message || '修改条码失败')
    }

    const sourceImages = pendingImages.value ?? detailImages.value
    const images = sourceImages.map((image, index) => ({
      id: image.id,
      barcode: newBarcode,
      isUpload: image.isUpload ?? 'N',
      isCheck: image.isCheck ?? 'N',
      sortNum: index + 1,
      localPath: image.localPath,
      base64Path: image.base64Path
    }))

    const result = await bScanApi.save({
      record: plainRecord(detail.value, {
        barcode: newBarcode,
        name: form.name,
        idCard: form.idCard,
        gender: form.gender,
        birthday: form.birthday,
        bodyParts: form.bodyParts,
        isNormal: form.isNormal,
        diagnosis: form.diagnosis,
        diagnosisDetails: form.diagnosisDetails,
        localRemark: form.localRemark
      }),
      images: [],
      isUpload: detail.value.isUpload ?? 'N'
    })
    if (!result.ok) throw new Error(result.message || '保存失败')

    const imagesResult = await persistBScanImages(newBarcode, images)
    if (!imagesResult.ok) throw new Error(imagesResult.message || '图片保存失败')

    // 2) 上传：本地保存成功后再执行；本地与线上都结束才提示一次
    if (upload) {
      try {
        const reportImage = await renderReportImage()
        if (!reportImage) throw new Error('没有可用的报告图片')
        const uploaded = await bScanApi.upload({
          barcode: newBarcode,
          reportImageBase64: reportImage
        })
        if (!uploaded.ok) throw new Error(uploaded.message || '上传失败')
        ElMessage.success('保存并上传成功')
      } catch (error) {
        // 本地已保存，仅上传失败：稍后可在列表中重新上传
        ElNotification({
          title: '已保存到本地，上传失败',
          message: `${(error as Error).message}，可稍后重新上传`,
          type: 'warning',
          duration: 8000
        })
      }
    } else {
      ElMessage.success('保存成功')
    }

    // 全部结束后退出编辑并刷新
    editing.value = false
    pendingImages.value = null
    await getList(true)
    detail.value = await bScanApi.get(newBarcode)
  } catch (error) {
    // 本地保存失败：保持编辑态，便于修正后重试
    ElMessage.error((error as Error).message)
  } finally {
    saving.value = false
  }
}

/* 列表 */
async function getList(keepCurrent = false): Promise<void> {
  listLoading.value = true
  try {
    const result = await bScanApi.pageList({
      pageNum: query.value.pageNum,
      pageSize: query.value.pageSize,
      keyword: query.value.keyword || undefined,
      isUpload: query.value.isUpload,
      checkType: query.value.checkType,
      beginDate: dateRange.value?.[0],
      endDate: dateRange.value?.[1]
    })
    rows.value = result.rows
    total.value = result.total
    if (!keepCurrent) {
      const first = rows.value[0]
      if (first) {
        await nextTick()
        // 默认选中第一条（setCurrentRow 会触发 current-change → 加载详情）
        tableRef.value?.setCurrentRow(first)
      } else {
        tableRef.value?.setCurrentRow()
        await handleCurrentChange(null)
      }
    }
  } finally {
    listLoading.value = false
  }
}

async function handleCurrentChange(row: BScanRecord | null): Promise<void> {
  editing.value = false
  pendingImages.value = null
  if (!row) {
    detail.value = null
    loadForm(null)
    return
  }
  detailLoading.value = true
  try {
    detail.value = await bScanApi.get(row.barcode)
    loadForm(detail.value)
  } finally {
    detailLoading.value = false
  }
}

function handleQuery(): void {
  query.value.pageNum = 1
  void getList()
}

function handleReset(): void {
  query.value = { pageNum: 1, pageSize: 30, keyword: '', isUpload: undefined, checkType: undefined }
  dateRange.value = defaultDateRange()
  void getList()
}

function handlePageChange(page: number): void {
  query.value.pageNum = page
  void getList()
}

function handleSizeChange(size: number): void {
  query.value.pageSize = size
  query.value.pageNum = 1
  void getList()
}

function handleSelectionChange(value: BScanRecord[]): void {
  selection.value = value
}

/** 批量上传（并发 3，带进度弹框） */
async function handleBatchUpload(): Promise<void> {
  if (!selection.value.length) {
    ElMessage.warning('请先选择要上传的记录')
    return
  }
  await ElMessageBox.confirm(`确认上传所选 ${selection.value.length} 条记录吗？`, '提示', {
    type: 'warning'
  })
  uploadLoading.value = true
  batch.total = selection.value.length
  batch.done = 0
  batch.success = 0
  batch.failed = []
  batch.running = true
  batchVisible.value = true
  try {
    await runLimited(selection.value, 3, async (row) => {
      try {
        const result = await bScanApi.upload({ barcode: row.barcode })
        if (result.ok) batch.success += 1
        else batch.failed.push(`${row.barcode}：${result.message || '上传失败'}`)
      } catch (error) {
        batch.failed.push(`${row.barcode}：${(error as Error).message}`)
      } finally {
        batch.done += 1
      }
    })
    await getList(true)
  } finally {
    batch.running = false
    uploadLoading.value = false
  }
}

/** 批量删除 */
async function handleBatchDelete(): Promise<void> {
  if (!selection.value.length) {
    ElMessage.warning('请先选择要删除的记录')
    return
  }
  await ElMessageBox.confirm(`确认删除所选 ${selection.value.length} 条记录吗？`, '提示', {
    type: 'warning'
  })
  const result = await bScanApi.remove(selection.value.map((row) => row.barcode))
  if (result.ok) {
    ElMessage.success('删除成功')
    detail.value = null
    await getList()
  } else {
    ElMessage.error(result.message || '删除失败')
  }
}

async function handleDelete(): Promise<void> {
  if (!detail.value) return
  await ElMessageBox.confirm('确认删除该条记录吗？', '提示', { type: 'warning' })
  const result = await bScanApi.remove([detail.value.barcode])
  if (result.ok) {
    ElMessage.success('删除成功')
    detail.value = null
    await getList()
  } else {
    ElMessage.error(result.message || '删除失败')
  }
}

async function handleUpload(): Promise<void> {
  if (!detail.value) return
  uploadLoading.value = true
  try {
    const reportImage = await renderReportImage()
    const result = await bScanApi.upload({
      barcode: detail.value.barcode,
      reportImageBase64: reportImage
    })
    if (result.ok) {
      ElMessage.success('上传成功')
      await getList(true)
      detail.value = await bScanApi.get(detail.value.barcode)
    } else {
      ElMessageBox.alert(`上传失败：${result.message ?? ''}`, '错误', { type: 'error' })
    }
  } finally {
    uploadLoading.value = false
  }
}

/** 同步服务器数据到本地（会覆盖本地记录与图片，需二次确认） */
async function handleSync(): Promise<void> {
  if (!detail.value) return
  const confirmed = await ElMessageBox.confirm(
    '将按条码从服务器拉取数据，并【覆盖本地记录与图片】。本地未上传的修改将丢失，是否继续？',
    '同步数据（覆盖本地）',
    {
      type: 'warning',
      confirmButtonText: '覆盖并同步',
      cancelButtonText: '取消'
    }
  ).catch(() => false)
  if (!confirmed) return

  uploadLoading.value = true
  try {
    const online = await bScanApi.onlineLookup(detail.value.barcode, detail.value.checkType)
    if (!online) {
      ElMessage.warning('未找到服务器数据')
      return
    }
    const result = await bScanApi.save({
      record: plainRecord(detail.value, {
        name: online.name ?? detail.value.name,
        idCard: online.idCard ?? detail.value.idCard,
        gender: online.gender ?? detail.value.gender,
        birthday: online.birthday ?? detail.value.birthday,
        diagnosis: online.diagnosis ?? detail.value.diagnosis,
        diagnosisDetails: online.diagnosisDetails ?? detail.value.diagnosisDetails,
        isUpload: 'Y'
      }),
      images: online.images,
      isUpload: 'Y'
    })
    if (result.ok) {
      ElMessage.success('同步成功')
      await getList(true)
      detail.value = await bScanApi.get(detail.value.barcode)
      loadForm(detail.value)
    } else {
      ElMessage.error(result.message || '同步失败')
    }
  } catch (error) {
    ElMessage.error((error as Error).message)
  } finally {
    uploadLoading.value = false
  }
}

watch(detail, (value) => {
  if (!editing.value) loadForm(value)
})

onMounted(() => {
  void getList()
})

onActivated(() => {
  void getList(true)
})

// ── 快捷键（作用域：bscan-history） ────────────────────
useHotkey(
  'bscanEdit',
  () => {
    if (!editing.value && detail.value) startEdit()
  },
  'bscan-history'
)
useHotkey(
  'bscanSave',
  () => {
    if (editing.value) void saveEdit(false)
  },
  'bscan-history'
)
useHotkey(
  'bscanSaveUpload',
  () => {
    if (editing.value) void saveEdit(true)
  },
  'bscan-history'
)
useHotkey(
  'bscanPreview',
  () => {
    if (detail.value) void handlePreview()
  },
  'bscan-history'
)
useHotkey(
  'bscanBatchUpload',
  () => {
    if (selection.value.length) void handleBatchUpload()
  },
  'bscan-history'
)
</script>

<style scoped>
.bscan-history {
  display: flex;
  flex-direction: column;
  gap: var(--s-card);
  height: 100%;
}

.query-bar {
  display: flex;
  align-items: center;
  gap: var(--s2);
  padding: 6px var(--s3);
}
.query-bar__actions {
  display: flex;
  gap: var(--s-card);
  margin-left: auto;
}
.query-bar__input {
  width: 240px;
}
.query-bar__select {
  width: 110px;
}
.query-bar__date {
  flex: 0 0 260px;
  width: 260px;
}
.query-bar__date :deep(.el-date-editor.el-input__wrapper) {
  width: 100% !important;
}

.history-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 400px minmax(0, 1fr);
  gap: var(--s-card);
}

.history-list {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: var(--s3);
}
.history-list :deep(.el-table__body tr) {
  cursor: pointer;
}

.list-toolbar {
  display: flex;
  align-items: center;
  gap: var(--s2);
  margin-bottom: var(--s2);
}
.list-toolbar__info {
  margin-right: auto;
  color: var(--t3);
  font-size: var(--fs-sm);
}

.pagination {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--s2);
  padding-top: var(--s2);
}

.history-detail {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0;
}

.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  padding: var(--s3) var(--s4);
  border-bottom: 1px solid var(--line);
}

.history-detail__scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--s4);
}

.history-detail__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: var(--s4);
  color: var(--t3);
  font-size: var(--fs-md);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 var(--s3);
  width: 100%;
}
.detail-grid--pics {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--s2);
}

.pics-item :deep(.el-form-item__label) {
  width: 100%;
}
.pics-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s2);
  width: 100%;
}

.history-detail__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--s-card);
  padding: var(--s3) var(--s4);
  border-top: 1px solid var(--line);
}

/* 图片编辑弹框 */
.img-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--s4);
  height: 440px;
}
.img-editor__video {
  display: flex;
  min-height: 0;
}
.img-editor__gallery {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.img-editor__grid {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scrollbar-gutter: stable;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: var(--s2);
  align-content: start;
  padding: var(--s2);
  border: 1px solid var(--line);
  background: var(--surface-2);
}
.img-editor__empty {
  grid-column: 1 / -1;
  padding: var(--s6) 0;
  text-align: center;
  color: var(--t3);
  font-size: var(--fs-md);
}

:deep(.full-width) {
  width: 100%;
}
</style>
