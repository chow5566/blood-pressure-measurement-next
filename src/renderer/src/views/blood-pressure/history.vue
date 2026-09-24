<template>
  <div class="bp-history app-scope">
    <!-- 查询区 -->
    <div class="query-bar app-card">
      <el-input
        v-model="query.keyword"
        class="query-bar__input"
        placeholder="条码号"
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
        <span v-if="!network.online" class="app-hint app-hint--warn">网络未连接，暂不可补传</span>
        <el-button type="primary" :icon="Search" @click="handleQuery">查询</el-button>
        <el-button :icon="RefreshLeft" @click="handleReset">重置</el-button>
        <HotkeyTooltip id="bpUpload">
          <el-button
            plain
            :icon="Upload"
            :loading="uploading"
            :disabled="!selection.length || !network.online"
            @click="handleUpload(selection)"
          >
            批量上传
          </el-button>
        </HotkeyTooltip>
      </div>
    </div>

    <!-- 列表 -->
    <div class="history-list app-card">
      <el-table
        v-loading="loading"
        :data="rows"
        height="100%"
        border
        stripe
        size="small"
        highlight-current-row
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <el-table-column type="selection" width="44" align="center" fixed="left" />
        <el-table-column prop="codeBar" label="条码号" min-width="130" show-overflow-tooltip />
        <el-table-column label="类型" width="64" align="center">
          <template #default="{ row }">{{ row.userNum === 2 ? '右侧' : '左侧' }}</template>
        </el-table-column>
        <el-table-column label="收缩压" width="76" align="center">
          <template #default="{ row }">{{ valueOf(toRecord(row), 'sbp') }}</template>
        </el-table-column>
        <el-table-column label="舒张压" width="76" align="center">
          <template #default="{ row }">{{ valueOf(toRecord(row), 'dbp') }}</template>
        </el-table-column>
        <el-table-column label="脉率" width="72" align="center">
          <template #default="{ row }">{{ row.pulse ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="保存状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === 1 ? 'success' : 'warning'">
              {{ row.status === 1 ? '已上传' : '未上传' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="collectTime"
          label="采集时间"
          min-width="150"
          sortable="custom"
          show-overflow-tooltip
        />
        <el-table-column label="操作" width="140" align="center" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              plain
              :disabled="!network.online"
              @click="handleUpload([toRecord(row)])"
            >
              上传
            </el-button>
            <el-button size="small" type="danger" plain @click="handleDelete(toRecord(row))">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          size="small"
          background
          layout="total, sizes, prev, pager, next"
          :current-page="query.pageNum"
          :page-size="query.pageSize"
          :page-sizes="[10, 30, 50, 100, 200]"
          :total="total"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </div>

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
import { onActivated, onMounted, reactive, ref } from 'vue'
import { RefreshLeft, Search, Upload } from '@element-plus/icons-vue'
import BatchUploadProgress from '@r/components/BatchUploadProgress.vue'
import HotkeyTooltip from '@r/components/HotkeyTooltip.vue'
import { bloodPressureApi } from '@r/api/blood-pressure'
import { runLimited } from '@r/utils/async'
import { useNetworkStore } from '@r/stores/network'
import { useHotkey } from '@r/hotkeys/useHotkey'
import type { BloodPressureRecord } from '@shared/domain/blood-pressure'

/**
 * 血压历史：本地记录查询 / 分页 / 删除 / 单条与批量补传。
 */
const query = ref({
  pageNum: 1,
  pageSize: 30,
  keyword: '',
  isUpload: undefined as 'Y' | 'N' | undefined,
  sortName: '',
  sortOrder: ''
})
const dateRange = ref<[string, string] | null>(null)
const rows = ref<BloodPressureRecord[]>([])
const total = ref(0)
const loading = ref(false)
const uploading = ref(false)
const selection = ref<BloodPressureRecord[]>([])
const network = useNetworkStore()

/** el-table 行类型收窄 */
function toRecord(row: unknown): BloodPressureRecord {
  return row as BloodPressureRecord
}

/** 收缩压/舒张压按左右侧取值 */
function valueOf(row: BloodPressureRecord, field: 'sbp' | 'dbp'): number | string {
  const value =
    field === 'sbp'
      ? row.userNum === 2
        ? row.rightSbp
        : row.leftSbp
      : row.userNum === 2
        ? row.rightDbp
        : row.leftDbp
  return value ?? '-'
}

async function getList(): Promise<void> {
  loading.value = true
  try {
    const result = await bloodPressureApi.page({
      pageNum: query.value.pageNum,
      pageSize: query.value.pageSize,
      keyword: query.value.keyword || undefined,
      isUpload: query.value.isUpload,
      beginDate: dateRange.value?.[0],
      endDate: dateRange.value?.[1],
      sortName: query.value.sortName || undefined,
      sortOrder: query.value.sortOrder || undefined
    })
    rows.value = result.rows
    total.value = result.total
  } catch (error) {
    ElMessage.error(`查询失败：${(error as Error).message}`)
  } finally {
    loading.value = false
  }
}

function handleQuery(): void {
  query.value.pageNum = 1
  void getList()
}

function handleReset(): void {
  query.value = {
    pageNum: 1,
    pageSize: 30,
    keyword: '',
    isUpload: undefined,
    sortName: '',
    sortOrder: ''
  }
  dateRange.value = null
  void getList()
}

function handleSortChange(payload: { prop: string | null; order: string | null }): void {
  query.value.sortName = payload.order && payload.prop ? payload.prop : ''
  query.value.sortOrder = payload.order ?? ''
  query.value.pageNum = 1
  void getList()
}

function handleSizeChange(size: number): void {
  query.value.pageSize = size
  query.value.pageNum = 1
  void getList()
}

function handlePageChange(page: number): void {
  query.value.pageNum = page
  void getList()
}

function handleSelectionChange(value: BloodPressureRecord[]): void {
  selection.value = value
}

/* 批量上传进度 */
const batchVisible = ref(false)
const batch = reactive({ total: 0, done: 0, success: 0, failed: [] as string[], running: false })

/** 单条/批量补传（并发 3，带进度弹框） */
async function handleUpload(targets: BloodPressureRecord[]): Promise<void> {
  if (!network.online) {
    ElMessage.warning('网络未连接，暂不可上传')
    return
  }
  const ids = targets.map((item) => item.id).filter((id): id is number => typeof id === 'number')
  if (!ids.length) {
    ElMessage.error('请选择要上传的数据')
    return
  }
  uploading.value = true
  batch.total = ids.length
  batch.done = 0
  batch.success = 0
  batch.failed = []
  batch.running = true
  batchVisible.value = true
  try {
    await runLimited(ids, 3, async (id) => {
      const codeBar = rows.value.find((row) => row.id === id)?.codeBar ?? String(id)
      try {
        const result = await bloodPressureApi.upload([id])
        if (result.failed.length === 0) batch.success += 1
        else batch.failed.push(`${codeBar}：${result.failed[0]?.message || '上传失败'}`)
      } catch (error) {
        batch.failed.push(`${codeBar}：${(error as Error).message}`)
      } finally {
        batch.done += 1
      }
    })
    await getList()
  } finally {
    batch.running = false
    uploading.value = false
  }
}

async function handleDelete(row: BloodPressureRecord): Promise<void> {
  await ElMessageBox.confirm('确定要删除该条数据吗？', '提示', { type: 'warning' })
  try {
    await bloodPressureApi.remove([row.id as number])
    ElMessage.success('删除成功')
    await getList()
  } catch (error) {
    ElMessage.error(`删除失败：${(error as Error).message}`)
  }
}

onMounted(() => {
  void getList()
})

onActivated(() => {
  void getList()
})

// ── 快捷键（作用域：bp-history） ───────────────────────
useHotkey(
  'bpUpload',
  () => {
    if (selection.value.length) void handleUpload(selection.value)
  },
  'bp-history'
)
</script>

<style scoped>
.bp-history {
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
  width: 120px;
}
.query-bar__date {
  flex: 0 0 260px;
  width: 260px;
}
.query-bar__date :deep(.el-date-editor.el-input__wrapper) {
  width: 100% !important;
}

.history-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: var(--s3);
}
.panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  margin-bottom: var(--s2);
}
.panel__ops {
  display: flex;
  align-items: center;
  gap: var(--s3);
}

.pagination {
  display: flex;
  justify-content: center;
  padding-top: var(--s2);
}
</style>
