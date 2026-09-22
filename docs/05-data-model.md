# 05 · 数据模型与本地存储

## 1. 本地存储三部分

| 用途 | 技术 | 位置（建议） |
| --- | --- | --- |
| 结构化业务数据 | SQLite（TypeORM） | `<dataDir>/database/index.db`（`dataDir` 可选、可迁移） |
| 应用配置 | electron-store（v8，CJS） | `%APPDATA%\<appName>\config.json`（含 `dataDir` 指针） |
| 图片/报告等文件 | 文件系统 | `<dataDir>/images/`、`<dataDir>/reports/` 等 |

> **目录选择与迁移详见 [10-storage-and-migration.md](10-storage-and-migration.md)。**

> **路径问题（修正 P4）**：现状把数据库写在 `app.getAppPath()/../../../<appName>-data`，
> 依赖安装目录可写，且 `..` 层级随打包结构变化。重构改为：
> - 以配置中的 `dataDir` 为唯一真相（安装时可选，应用内可更换）；
> - 未设置时默认 `%ProgramData%\<appName>\data`；
> - 保证 32 位/64 位、安装目录只读、盘满换盘时均可用。

## 2. 实体（现状）

### 2.1 BloodPressureEntity → `blood_pressure`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | PK auto | 主键 |
| `codeBar` | string | 条码号 |
| `status` | number | 保存状态：0 未保存 / 1 已保存 |
| `dataType` | string | 推送类型 |
| `createTime` | datetime | 创建时间（默认 CURRENT_TIMESTAMP） |
| `updateTime` | datetime | 更新时间 |
| `collectTime` | datetime | 采集时间 |
| `userNum` | number | 用户类型：左右血压 |
| `leftDbp` | number? | 左侧舒张压 |
| `leftSbp` | number? | 左侧收缩压 |
| `rightDbp` | number? | 右侧舒张压 |
| `rightSbp` | number? | 右侧收缩压 |
| `pulse` | number | 脉率 |

### 2.2 BScanEntity → `b_scan_entity`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `barcode` | PK string | 条码号 |
| `checkType` | string? | 类型：`GW` 公卫 / `BS` 商业 |
| `name` | string? | 姓名（索引） |
| `idCard` | string? | 身份证号（索引） |
| `gender` | string? | 性别 |
| `birthday` | string? | 出生日期 |
| `isUpload` | string | 是否已上传：`Y`/`N` |
| `isNormal` | string | 检查结果 |
| `diagnosis` | string | 诊断结果 |
| `bodyParts` | string? | 检测部位 |
| `diagnosisDetails` | string | 诊断描述 |
| `localRemark` | string? | 备注 |
| `bScanImages` | 1:N | 图片集合（关系**现状未用装饰器声明，仅字段占位**） |
| `createTime` / `updateTime` | datetime | 时间戳 |

### 2.3 BScanImagesEntity → `b_scan_images_entity`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | PK uuid | 主键 |
| `barcode` | string? | 对应条码号（索引） |
| `isUpload` | string | `Y`/`N` |
| `isCheck` | string? | 是否选中（入库后可省略，仅 UI 用） |
| `sortNum` | number? | 图片序号 |
| `localPath` | string? | 本地图片路径 |
| `uploadUrl` | string? | 上传后的路径 |
| `createTime` / `updateTime` | datetime | |
| `base64Path` | 非持久化 | 仅传参使用，不进库 |

### 2.4 BScanTemplateEntity → `b_scan_template`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | PK uuid | 主键 |
| `parentId` | string | 父级 ID，默认 `'00'` |
| `dataType` | enum | `TEMPLATE` 模板 / `TYPE` 类型 |
| `typeName` / `typeDesc` | string? | 类型名称/描述 |
| `title` | string? | 模板标题 |
| `diagnosis` / `diagnosisDetails` | string? | 诊断/描述 |
| `sortNum` | number? | 排序 |
| `isPublic` | boolean? | 是否公共模板 |
| `createTime` / `updateTime` | datetime | |
| `query` | 非持久化 | 查询条件 |

## 3. 重构实现（better-sqlite3 + migration，见 ADR-012）

| 编号 | 改进 | 说明 |
| --- | --- | --- |
| D1 | 弃用 `synchronize`，使用 **migration runner** | `schema_migrations(id,name,appliedAt)`，事务执行（P5） |
| D2 | 不使用 TypeORM，直接 better-sqlite3 + 类型化仓库 | 去装饰器复杂度，SQL 可控 |
| D3 | 列名沿用旧库 camelCase | 旧数据可直接读取 |
| D4 | 图片 base64 不落库 | 只存 `localPath`/`uploadUrl`，base64 仅运行时 |
| D5 | 初始迁移全部 `IF NOT EXISTS` | 对旧库安全「采纳为基线」 |
| D6 | 保留旧库兼容读取 | 实测旧库直接可用（数据完整） |

**仓库层**：`src/main/infra/database/repositories/`
- `blood-pressure.repository.ts`
- `b-scan.repository.ts`
- `b-scan-images.repository.ts`
- `b-scan-template.repository.ts`
- 基类 `base.repository.ts`（统一连接与时间）

**迁移**：`src/main/infra/database/migrations/`
- `001-init.ts` 基线 schema
- `index.ts` 迁移执行器（读取已应用版本，逐版本事务执行）

### 3.1 图片存储路径

| 版本 | 路径 |
| --- | --- |
| 旧项目 | `<dataDir>/bScanImages/<barcode>/<timestamp>/<uuid>.<ext>` |
| 新项目 | `<dataDir>/images/<barcode>/<uuid>.<ext>` |

- 数据库 `b_scan_images_entity.localPath` 保存**绝对路径**，因此旧记录的图片仍可读取
  （`hydrateBScanImages` 直接按 `localPath` 读文件），无需搬迁旧图。
- 新采集图片写入 `images/`，`base64` 不入库。

## 4. 旧数据迁移策略

1. 启动时读取旧库路径（现状路径 + 新路径都探测）。
2. 若存在旧库且新库不存在，复制到新路径作为初始库。
3. 通过 migration 补齐新字段/索引。
4. 迁移失败保留原库并记录日志，不阻塞启动。

## 5. 应用配置项（electron-store）

| Key | 说明 |
| --- | --- |
| `settings.baseApi` | 服务端接口地址，默认 `http://www.chealth.cn/health-display-local/` |
| `settings.staticApi` | 静态资源地址，默认 `http://www.chealth.cn/local-data-display/` |
| `settings.localDataSavePath` | 本地数据保存目录（可空） |
| `settings.videoFilter` | B超视频滤镜（灰度/亮度/对比度/色相/饱和度） |
| `settings.hotkeys.takePhoto` | 拍照快捷键（key + ctrl/alt/shift） |
| `settings.renderMode` | `gpu` / `software`（Win7 排障用） |

> 现状配置由 Pinia `persist` 写入 electron-store（key 形如
> `__blood-pressure-measurement-pinia__settings`）。重构后建议配置读写统一走主进程 IPC，
> 渲染层只持有运行时副本，避免持久化细节泄漏到 UI 层。

## 6. 服务端接口（现状，需保持兼容）

| 接口 | 方法 | 路径 | 用途 |
| --- | --- | --- | --- |
| 登录 | POST | `/sys/login` | 获取 token |
| 用户信息 | GET | `/sys/user/info` | 当前用户 |
| 机构授权弹窗 | POST | `/bs/authOrgConfig/popups` | 授权提示 |
| 居民体检详情 | GET | `/gbuserhealth/getDetail` | 条码 → 居民/体检信息 |
| 体检历史 | GET | `/gbuserhealth/info` | 居民历史 |
| 机构体检信息 | GET | `/business/checkup/getCheckupByCode` | 按条码取体检 |
| 单条健康数据上传 | POST | `/healthdata/single/upload/data` | 血压/数据上传 |
| 公共模板列表 | GET | `/cfBscanTemplate/list` | B超模板 |

> 请求约定：baseURL 来自 `settings.baseApi`；header 携带 `token`；GET 追加时间戳 `t`；
> 响应 `code` 200 成功、401 重新登录、500 报错。重构应保留该约定，但集中到统一客户端。
