# 10 · 数据存储目录与迁移

> 需求：**安装时可选数据存储目录**；**支持本地重要数据（SQLite + 图片 + 报告）迁移**；
> 原实现固定在单一位置，用户某个盘可能写满，需要能换盘。

## 1. 现状问题（基线）

现状数据库路径（`src/main/database/index.ts:25`）：

```
join(app.getAppPath(), `../../../${app.getName()}-data`)
```

- 打包后 `app.getAppPath()` = `<安装目录>/resources/app.asar`，
  `../../../` 最终落在**安装目录的上一级**，即类似 `C:\Program Files\血压及B超检测-data`。
- 在 `perMachine` + `requireAdministrator` 下，该位置写入依赖管理员权限，且不符合
  Windows 规范（Program Files 不应存业务数据）。
- 路径里用 `..` 拼接，随打包结构变化而失效（P4）。
- 无法换盘，盘满即不可用。

## 2. 目标

| 编号 | 目标 |
| --- | --- |
| S1 | 安装时可选择数据存储目录（NSIS 自定义页面） |
| S2 | 安装后可在「设置」中查看/更换数据目录 |
| S3 | 更换目录时自动迁移 SQLite + 图片 + 报告，**不丢数据** |
| S4 | 迁移可中断回滚，失败不破坏原数据 |
| S5 | 磁盘空间不足时提前预警并引导迁移 |
| S6 | 兼容旧版本已产生的数据（自动发现并迁移） |
| S7 | 迁移成功后**删除旧数据**并**自动重启**应用 |
| S8 | **禁止**使用可移动盘/网络盘；图片可压缩以控制空间 |

## 已确认决策（2026-09）

| 事项 | 结论 |
| --- | --- |
| 选目录时机 | **安装时 + 应用内设置**（两者都要） |
| 迁移后旧数据 | **迁移成功后删除**（不再保留备份） |
| 迁移后重启 | **自动重启** |
| 存储介质 | **禁止 U 盘/移动硬盘/网络盘**，仅本地固定磁盘 |
| 数据加密 | 不需要 |
| 数据量 | 每天 ≤ 500 条；每条 3~7 张图；单图大小未知，**允许适度压缩** |

## 3. 目录布局

### 3.1 数据目录（可迁移）

```
<dataDir>/
├─ database/
│  └─ index.db                # SQLite 主库
├─ images/
│  └─ <barcode>/<uuid>.jpg    # B超原始采集图
├─ reports/
│  └─ <barcode>/<uuid>.jpeg   # 生成的报告图（如落盘）
├─ exports/                   # 导出/临时导出
└─ meta.json                  # 数据目录标识（magic + 版本 + instanceId）
```

### 3.2 应用目录（不迁移，体积小）

| 内容 | 位置 | 说明 |
| --- | --- | --- |
| 应用配置 | `%APPDATA%\<appName>\config.json` | electron-store（含 `dataDir`） |
| 日志 | `%APPDATA%\<appName>\logs` | 保留在用户目录，避免迁移时占用 |
| 模板/驱动资源 | 安装目录 `resources/` | 只读资源 |

> 配置里保存 `dataDir` 指针；**真实数据全部在 `<dataDir>` 下**，迁移只需搬目录 + 改指针。

### 3.3 默认数据目录

1. 安装时用户所选目录（写入安装配置，见 §4）。
2. 未选择时：`%ProgramData%\<appName>\data`（机器级，符合多用户/管理员安装）。
3. 若 `%ProgramData%` 不可写（极端情况），回退 `app.getPath('userData')/data`。

> 不建议默认放 `Program Files` 下，避免权限问题（修正现状）。

## 4. 安装时选择目录（NSIS）

electron-builder 的 NSIS 支持自定义脚本（`nsis.include`）。方案：

```yaml
# electron-builder.yml
nsis:
  include: build/installer.nsh
```

`build/installer.nsh` 要点：

```nsis
!macro customPageAfterChangeDir
  !insertmacro MUI_HEADER_TEXT "选择数据存储目录" "请选择业务数据（图片、数据库）的保存位置。"
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 0 100% 24u "建议选择剩余空间充足的本地磁盘（如 D:\）。应用安装目录与数据目录分开，便于后续迁移。"
  Pop $1
  ${NSD_CreateDirRequest} 0 28u 100% 14u "$COMMONAPPDATA\血压及B超检测\data"
  Pop $2
  ${NSD_CreateBrowseButton} 0 46u 100% 14u "浏览..."
  Pop $3
  ; 绑定点击浏览事件 → nsDialogs::SelectFolderDialog
  nsDialogs::Show
!macroend

!macro customInstall
  ; 将所选目录写入注册表，供应用首次启动读取
  WriteRegStr SHCTX "Software\skzx\blood-pressure-measurement" "DataDir" "$DataDir"
!macroend
```

应用启动时：
1. 读注册表 `DataDir`（首次启动）。
2. 若不存在 → 用默认目录。
3. 写入配置 `settings.dataDir`，后续以配置为准（用户可在设置里改）。

> **待验证**：Win7 32 位下 NSIS 自定义页面与 UAC/`perMachine` 的交互；中文路径。
> 备选：安装页只做「提示」，真正选择放到应用首次启动向导（实现更简单、跨打包工具稳定）。
> 建议两者都做：安装页可选（可跳过），首启向导兜底。

## 5. 应用内「存储位置」设置

设置页新增「数据存储」区块：

- 显示当前数据目录、已用空间、所在磁盘剩余空间。
- 「更改目录」按钮 → 触发迁移向导。
- 「打开目录」按钮（`shell.openPath`）。
- 空间预警阈值（默认剩余 < 2GB 或 < 10% 时警告）。

## 6. 迁移流程（核心）

```
[用户选择新目录]
   ↓
① 预检
   - 新旧目录不相同、不互相包含
   - 新目录可写、所在盘为本地盘（见 §7）
   - 剩余空间 ≥ 数据量 × 1.15 + 余量
   - 无正在进行的采集/上传
   ↓
② 冻结写入
   - 主进程进入「维护模式」：拒绝新的保存/上传/采集写库
   - 等待进行中的事务完成（带超时）
   - 关闭 SQLite 连接（TypeORM destroy）
   ↓
③ 复制到目标（可显示进度）
   - 复制到 <newDir>/.migrate-<timestamp>/ （临时目录）
   - 逐文件复制并校验大小；DB 额外做 SHA-256 校验
   - 保留原目录不动
   ↓
④ 校验
   - 文件数、总大小一致
   - 新 DB 用只读方式打开并 `PRAGMA integrity_check` = ok
   ↓
⑤ 切换
   - 临时目录重命名为 <newDir> 正式结构
   - 原子写入配置 dataDir = 新目录
   ↓
⑥ 重开与收尾
   - 在新目录重新 initialize 数据库
   - 退出维护模式
   - **删除旧目录数据**（已确认：迁移成功后删除，不再保留备份）
   - 删除前做最后校验（新库可打开且 integrity_check 通过）才允许删除
   ↓
⑦ 结果反馈
   - 成功：提示后**自动重启**应用（`app.relaunch()` + `app.exit()`）
   - 失败：删除临时目录，配置回滚旧路径，原数据不变
```

### 6.1 关键约束

- **先复制后切换**：任何时刻原数据都完整，杜绝「搬一半」导致数据丢失。
- **配置最后写**：`dataDir` 指针是唯一真相；未切换前不改。
- **删除旧数据前必须二次校验**：新库可打开、`integrity_check` 通过、文件数一致，才删除。
- **删除采用「先改名再删」**：先将旧目录改名为 `<oldDir>.deleting-<ts>` 再异步删除，避免
  删除中途失败留下半删状态；失败可提示手动清理。
- **自动重启**：迁移成功后 `app.relaunch()` + `app.exit(0)`，确保所有句柄释放、配置生效。
- **维护模式**：迁移期间 UI 需遮罩，禁止操作。
- **DB 连接必须先关闭**：否则 Windows 文件锁会导致复制/改名失败。
- **跨盘迁移**：同盘可考虑 `rename` 快速完成，跨盘必须复制；统一走复制以保证一致。
- **中断恢复**：启动时发现 `<newDir>/.migrate-*` 残留 → 清理；发现配置指向不存在的目录 → 回退并提示。

### 6.2 迁移数据结构

```ts
interface MigratePlan {
  from: string
  to: string
  totalBytes: number
  files: number
  needRestart: boolean
}

interface MigrateProgress {
  phase: 'precheck' | 'freeze' | 'copy' | 'verify' | 'switch' | 'reopen' | 'done' | 'failed'
  percent: number
  copiedBytes: number
  totalBytes: number
  message?: string
}
```

## 7. 存储介质约束

| 介质 | 允许 | 说明 |
| --- | --- | --- |
| 本地固定磁盘（C/D/E…） | ✅ 仅此允许 | 默认与唯一合法选择 |
| 移动硬盘 / U盘 | ❌ **禁止** | 掉盘会导致 SQLite 损坏；选择时直接拒绝 |
| 网络映射盘 / UNC | ❌ **禁止** | SQLite 在 SMB 上锁不可靠，易损坏 |
| 压缩/加密卷 | ❌ 禁止 | 影响随机写性能与稳定性 |

启动时校验 `dataDir` 可用性：
- 目录不存在 → 提示重新定位或新建。
- 所在盘未就绪（可移动盘未插）→ 阻塞写操作并提示。
- 只读 → 提示换目录。

## 8. 旧数据自动发现（兼容升级）

启动时按以下顺序探测已有数据并纳入：

1. 配置中的 `dataDir`（若有且有效）。
2. 注册表 `DataDir`。
3. 旧版本默认路径：`<安装目录>/../<appName>-data`（现状位置）。
4. `%ProgramData%\<appName>\data`。
5. `app.getPath('userData')/data`。

若发现旧数据且当前指向空的默认目录，则：
- 提示用户「检测到历史数据，是否导入/迁移到当前目录」；
- 或直接以旧目录为 `dataDir`（无感，改动最小）。

> 旧库结构差异由 migration 处理（见 [05-data-model.md](05-data-model.md) §4）。

## 9. 磁盘空间策略

- 启动与每次写库前检查 `dataDir` 所在盘剩余空间。
- 低于阈值：顶部警示条 + 设置页红点。
- 低于硬阈值（如 500MB）：**禁止新采集入库**，引导迁移，避免写坏 DB。
- 定期（如每日）记录数据目录占用，便于现场运维。

## 10. 图片压缩与容量估算

### 10.1 数据量假设（已确认）

| 项 | 值 |
| --- | --- |
| 每日条码数 | ≤ 500 |
| 每条码图片数 | 3~7 张 |
| 图片原始大小 | 未知，允许适度压缩 |
| 保存期限 | 现场长期保留（按年计） |

### 10.2 压缩策略

- 采集即压缩：canvas 输出 `image/jpeg`，质量 `0.75~0.85`（可配置）。
- 分辨率限制：长边不超过 `1600px`（B超报告实际展示远小于此），按需缩放。
- 报告图（`otherReportStr`）单独压缩，质量 `0.8`，长边 `2000px`。
- 可选：历史图片批量转码（后续版本，谨慎）。

### 10.3 容量估算

按每日 500 条 × 5 张 × 压缩后约 150KB 计：

- 每日 ≈ 500 × 5 × 0.15MB ≈ **375MB/天**
- 每月 ≈ 11GB，每年 ≈ **135GB**（不含报告/日志）

> 结论：**必须支持换盘迁移**，且安装时默认提示选择空间充足的磁盘。
> 压缩参数与单图大小需在真机采集后实测校准（Q12 已由「可压缩」补充）。

## 11. 验收项

| 编号 | 验证项 | 通过标准 |
| --- | --- | --- |
| S-M1 | 安装选目录 | 安装时可选，应用首启使用所选目录 |
| S-M2 | 默认目录 | 未选时落到 `%ProgramData%`，非 Program Files |
| S-M3 | 应用内更换目录 | 迁移后新数据写新目录，历史数据完整 |
| S-M4 | 迁移中断 | 断电/杀进程后原数据完好，可重试 |
| S-M5 | 旧数据发现 | 升级后自动识别旧目录数据 |
| S-M6 | 盘满保护 | 低空间预警、硬阈值阻止写入 |
| S-M7 | 跨盘迁移 | C: → D: 迁移成功且校验通过 |
| S-M8 | 只读/掉盘 | 明确提示且不损坏数据 |
| S-M9 | 迁移后清理 | 成功后旧数据被删除，应用自动重启 |
| S-M10 | 介质限制 | 选择 U盘/网络盘被拒绝 |
