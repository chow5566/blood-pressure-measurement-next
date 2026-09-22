# 01 · 现状功能模块与代码结构梳理

> 来源：对 `blood-pressure-measurement`（Electron 31）的实际代码走查。
> 本文档用于重构前的「现状基线」，重构时逐项对照验收。

## 1. 进程与目录结构

```
src/
├─ main/                     # Electron 主进程
│  ├─ index.ts               # 入口：单实例锁、初始化 DB/服务/IPC/更新、创建登录窗
│  ├─ common/
│  │  ├─ constants/          # 常量（ChannelWay 等）
│  │  └─ interface/          # 全局 TS 接口
│  ├─ database/
│  │  ├─ index.ts            # TypeORM DataSource 初始化（sqlite，synchronize: true）
│  │  └─ entities/           # 实体定义
│  ├─ decorators/services/   # service-IPC 桥（initMainBridge）
│  ├─ ipc/                   # IPC 注册
│  │  ├─ index.ts            # 汇总注册
│  │  ├─ serialport.ts       # 血压计串口
│  │  ├─ b-scan.ts           # B超报告/驱动
│  │  ├─ store.ts            # electron-store IPC
│  │  ├─ window-create.ts    # 创建窗口
│  │  ├─ window-status.ts    # 窗口状态（最小化/关闭等）
│  │  └─ common.ts
│  ├─ updater/index.ts       # electron-updater 自动更新
│  └─ utils/
│     ├─ driver/             # VGA2USB 驱动检查/安装/卸载（msiexec）
│     ├─ file/               # 文件读取 + bscan-word-template 报告生成
│     ├─ log/                # electron-log 封装
│     ├─ result/             # AjaxResult / TableDataInfo
│     ├─ store/              # electron-store 封装
│     └─ windows/            # ViewWindow 窗口封装
├─ preload/                  # contextBridge 暴露 API
└─ renderer/                 # Vue3 渲染进程
   └─ src/
      ├─ apis/               # 服务端接口封装
      ├─ components/         # 通用组件（VideoView 等）
      ├─ compositions/
      ├─ layouts/            # DefaultView / ModalView
      ├─ router/             # 路由（hash 模式）
      ├─ store/modules/      # Pinia（user / settings / b-scan / ...）
      ├─ utils/              # request 封装、pdf(word→image) 等
      └─ views/              # 页面
```

## 2. 功能模块清单

| 模块 | 路由/入口 | 关键实现 | 说明 |
| --- | --- | --- | --- |
| 登录 | `/login` `views/login.vue` | `apis/SysLogin.js`、`store/modules/user` | token 登录，token 存入 store |
| 血压测量 | `/index` `views/blood-pressure/index.vue` | `ipc/serialport.ts`、`apis/SingleHealthDataAdd.js` | 串口读血压计，左右臂 SBP/DBP 脉率 |
| 血压历史 | `/blood-pressure-history` | `views/blood-pressure/history.vue` | 本地历史查询/补传 |
| B超采集 | `/b-scan` | `components/VideoView`、`views/b-scan/modules/*` | 选设备→预览→采集截图→填表→保存/上传 |
| B超历史 | `/b-scan-history` | `views/b-scan/history.vue` | 本地历史 |
| B超模板 | `/b-scan-template` `/modal/choose-template` | `apis/CfBscanTemplate.js` | 模板列表/选择 |
| 设置 | `/modal/settings` | `views/settings/*` | 服务地址、本地存储路径、视频滤镜、快捷键 |
| 应用更新 | `/modal/app-update` | `updater/index.ts`、`views/app-update` | 检查/下载/安装 |
| 驱动安装 | B超页触发 | `ipc/b-scan.ts`、`utils/driver` | VGA2USB 驱动检查/安装/卸载 |
| 报告生成 | B超「报告预览」 | `utils/file/bscan-word-template.ts` | docxtemplater 填充 4 图 + 字段 |
| 报告转图 | 渲染进程 | `utils/pdf.js` | docx-preview 渲染 → html2canvas 转 jpeg |

## 3. 关键流程

### 3.1 血压测量流程

1. 主进程 `SerialPort.list()` 过滤 VID/PID（`1A86`/`7523`）得到血压计串口。
2. `port:init-bp-port` 打开串口（115200/8/1/none），监听 `data`。
3. 渲染进程发指令 `port:send-directives`，接收 `port:bp-data:<pnpId>` 数据并解析。
4. 组装记录写入 SQLite，联网时上传服务器。

> 注意：`ipc/serialport.ts:161-162` 存在 `setTimeout(...)` 与 `resolve('success')`
> 同时调用的逻辑缺陷（超时分支永远不会真正生效）。重构时需重新设计超时语义。

### 3.2 B超采集流程

1. `VideoView` 调用 `getUserMedia` 枚举/播放采集卡视频，支持亮度/对比度/灰度等 CSS 滤镜。
2. 采集：canvas `drawImage` → `toDataURL('image/jpeg')`，最多 20 张、最多选 4 张入报告。
3. 报告：主进程用 `bscan-default.docx` 模板填充字段与 4 张图，返回 docx base64。
4. 预览：渲染进程 `docx-preview.renderAsync` → `html2canvas` → jpeg。
5. 保存：先上传服务器（`otherReportStr` 为报告图片），失败则仅存本地并标记 `isUpload='N'`。

### 3.3 更新流程

`electron-updater` + generic provider（`electron-builder.yml` 中 publish.url）。
`autoDownload=false`，渲染进程触发检查/下载，`update-downloaded` 后 `quitAndInstall()`。

## 4. 现状问题（重构需解决）

| 编号 | 问题 | 影响 |
| --- | --- | --- |
| P1 | Electron 31 不支持 Win7 | 现场无法运行 |
| P2 | sqlite3 / usb / @pdftron 等原生模块 32 位与 Win7 支持不确定 | 打包/运行失败 |
| P3 | `@pdftron/pdfnet-node` 在 `src` 中无任何引用 | 无用重依赖、授权与体积风险 |
| P4 | 数据库路径写死为 `app.getAppPath()/../../..` | 安装目录只读时失败；32 位路径差异 |
| P5 | `synchronize: true` 自动同步表 | 生产数据安全隐患 |
| P6 | `requestedExecutionLevel: requireAdministrator` | 降低安全性/兼容性，仅驱动安装需要 |
| P7 | 串口超时逻辑缺陷（见 3.1） | 指令可能永不超时 |
| P8 | 报告生成依赖 `__dirname/resources/template` 相对路径 | 打包后路径易错 |
| P9 | 大量 JS + 少量 TS 混用，宏自动导入（`ElMessage` 等未显式引入） | 可维护性差 |
| P10 | 32 位进程 2GB 内存上限 + 多张 base64 图片 | 大图/多图易 OOM |

## 5. 现状依赖清单（业务相关）

**运行时**

- `@electron-toolkit/preload`、`@electron-toolkit/utils`
- `@element-plus/icons-vue`、`element-plus`
- `@pdftron/pdfnet-node`（**未被引用，建议移除**）
- `axios`、`qs`、`crypto-js`
- `docx-preview`、`docxtemplater`、`docxtemplater-image-module-free`、`pizzip`、`image-size`
- `driver.js`
- `electron-log`、`electron-store`、`electron-updater`
- `fontkit`
- `html2canvas`
- `lodash`、`moment`、`uuid`
- `pinia`、`pinia-plugin-persistedstate`、`vue-router`
- `reflect-metadata`、`typeorm`、`sqlite3`
- `serialport`、`usb`

**开发/构建**

- `electron` 31、`electron-vite` 2、`vite` 5、`vue` 3、`typescript` 5
- `@swc/core`、`@vitejs/plugin-vue`、`vue-tsc`
- `electron-builder` 25、`electron-icon-builder`
- `tailwindcss` 3、`sass`、`postcss`、`autoprefixer`
- `unplugin-auto-import`、`unplugin-vue-components`、`vite-plugin-svg-icons`
- eslint / prettier 相关

> 兼容性与替代方案见 [02-compatibility.md](02-compatibility.md)。
