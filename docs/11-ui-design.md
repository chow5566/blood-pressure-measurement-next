# 11 · 界面布局重构与视觉规范

> 需求：**重构优化整个布局**，但**原血压测量界面与字体很好看，必须保留**。
> 结论：血压测量页作为「视觉基准」冻结；其余页面统一到同一套设计系统。

## 1. 原则

1. **血压测量页原样保留**：布局、比例、配色、数字字体、交互均不改变（仅将其内部 IPC
   调用替换为新 API，视觉零回归）。
2. 其余页面在**同一设计语言**下重构布局，去掉硬编码、统一间距与组件。
3. Element Plus 继续使用（便于保证观感一致、Win7/Chromium 108 兼容），只做主题变量统一。
4. 所有尺寸使用相对单位（`vw`/`rem`）或统一样式 token，禁止散落魔法值。

## 2. 必须保留的资产（冻结）

### 2.1 数字字体 DSEG7

| 资产 | 路径 | 用途 |
| --- | --- | --- |
| DSEG7 Classic Bold | `assets/font/modern/DSEG7Classic-Bold.ttf` | 血压数字大屏显示 |
| DSEG7 Modern | `assets/font/modern/DSEG7Modern-*.ttf` | 备用 |
| `ModernFontView.vue` | `components/ModernFontView.vue` | 数字显示组件（伪 ghost 占位实现） |

**现状问题（需修正，不影响视觉）**：`base.scss:5` 中

```scss
@font-face {
  font-family: 'Source Han Sans CN';
  src: url('../font/modern/DSEG7Classic-Bold.ttf') format('opentype');
}
.modern-font { font-family: 'Source Han Sans CN', sans-serif; }
```

字体族名称写成了「思源黑体」但实际加载的是 DSEG7 数字字体，命名与用途错位。
重构时应改为语义化名称（如 `DSEG7`），**但字形与渲染必须保持不变**。

### 2.2 血压页视觉规格（记录，禁止改动）

来源：`components/BloodPressureView.vue`（462 行）。

| 元素 | 规格 |
| --- | --- |
| 外壳 | `width:30vw; aspect-ratio:1/1.44; border-radius:6vw; border:0.6vw solid #fff;` 背景 `#d7d7d9`，`box-shadow:0 0 1vw rgba(#000,.2)` |
| 屏幕 | `width:18vw; aspect-ratio:1/1.44;` 背景 `#868f8e` |
| 状态色 | running `#f68f32` / error `#ff5722` / success `#4caf50` |
| 数字色 | running `#fb9c46` / error `#fb6232` / success `#54b558` / 默认 `#8f958f` |
| 数字字号 | 收缩压/舒张压 `3.5vw`，脉搏 `2.5vw`，标签 `1.2vw`/`1vw` |
| 标题 | "maibobo" `1.8vw`，设备名 `1vw`，均 `text-gray-400` |
| 输入框 | 高 `4vw`，字号 `1.4vw`，圆角 `1vw`，背景 `rgba(#fff,.8)` |
| 圆形按钮 | `4.6vw × 4.6vw`，圆形 |
| 页面结构 | `views/blood-pressure/index.vue`：最多 2 个血压计并排，底部提示 + 重新识别 |

### 2.3 主色

Element Plus 主题主色 `#5340ff`（`assets/styles/element-plus.scss`），保留。

## 3. 设计系统（新增，用于其他页面）

### 3.1 设计 Token（CSS 变量）

```scss
:root {
  /* 色彩 */
  --app-color-primary: #5340ff;   // 与 Element Plus 一致，保留
  --app-color-success: var(--el-color-success);
  --app-color-warning: var(--el-color-warning);
  --app-color-danger:  var(--el-color-danger);

  /* 中性色 */
  --app-bg-page:    #f5f6f8;
  --app-bg-card:    #ffffff;
  --app-border:     #e6e8eb;
  --app-text-1:     #1f2329;
  --app-text-2:     #606266;
  --app-text-3:     #909399;

  /* 间距（4px 基准） */
  --app-space-1: 4px;
  --app-space-2: 8px;
  --app-space-3: 12px;
  --app-space-4: 16px;
  --app-space-6: 24px;

  /* 圆角 / 阴影 */
  --app-radius-sm: 4px;
  --app-radius-md: 8px;
  --app-radius-lg: 12px;
  --app-shadow-1: 0 1px 4px rgba(0, 0, 0, 0.06);
  --app-shadow-2: 0 4px 16px rgba(0, 0, 0, 0.10);

  /* 字体 */
  --app-font-ui: 'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;
  --app-font-number: 'DSEG7', monospace;  // 仅血压数字使用
}
```

### 3.2 布局骨架

```
┌────────────────────────────────────────────────┐
│ AppHeader (自定义标题栏 + 导航 + 用户)          │  高 56px
├──────┬─────────────────────────────────────────┤
│ Sider│  PageHeader (标题 + 操作区)              │  可选
│ 导航 │─────────────────────────────────────────│
│      │  Content (卡片化内容区, 唯一滚动容器)     │
│      │                                          │
├──────┴─────────────────────────────────────────┤
│ (可选) StatusBar：设备状态 / 存储空间 / 版本     │
└────────────────────────────────────────────────┘
```

- 顶部窗口自定义标题栏沿用现有 `drag`/`no-drag` 方案（文件已提供样式类）。
- 内容区统一卡片与 `u-tips` 区块标题（沿用现有 `.u-tips` 风格）。
- 弹窗类页面（设置/更新/模板选择）继续走 `ModalView`，但统一内边距与页头。

### 3.3 页面清单与改造范围

| 页面 | 保留血压视觉 | 改造内容 |
| --- | --- | --- |
| 血压测量 | ✅ 完全保留 | 仅替换 IPC 调用；样式不动 |
| 血压历史 | ❌ | 统一表格/筛选/分页样式，增加容量与补传状态 |
| B超采集 | ❌ | 左右分栏比例微调、表单分组、操作区固定底部 |
| B超历史 | ❌ | 统一列表 + 图片缩略图 + 上传状态 |
| 模板管理/选择 | ❌ | 统一弹窗与列表 |
| 设置 | ❌ | 新增「数据存储」区块（当前/更改/打开目录） |
| 登录 | ❌ | 保留品牌视觉，统一表单与背景 |
| 应用更新 | ❌ | 统一进度与结果反馈 |
| 首次启动向导（新增） | — | 选择数据目录、检测补丁/设备、初始配置 |
| 设备诊断（新增） | — | 串口/USB/视频设备枚举与驱动状态 |

## 4. 字体策略

| 用途 | 字体 | 说明 |
| --- | --- | --- |
| 血压数字 | **DSEG7**（内置） | 冻结 |
| 中文 UI | 系统字体 `Microsoft YaHei` | Win7/Win10 均自带，**不内置思源黑体**以控制体积 |
| 英文/数字 UI | `Helvetica Neue` / `Arial` | 系统字体回退 |
| 等宽（日志等） | `Consolas` | 系统字体 |

> **已确认**：UI 中文字体使用系统 `Microsoft YaHei`，**不内置**思源黑体
> （Win7/Win10 均自带，控制 32 位包体积）。

## 5. 适配与响应式

- 现场一体机分辨率差异大：以 `1280×1024`、`1366×768`、`1920×1080` 为基准测试。
- 血压页依赖 `vw`，窗口最小尺寸需保证其可读：登录窗 `800×500`，主窗建议
  `min-width: 1280`。
- 其余页面用 flex/grid + token 间距，避免绝对定位。
- 32 位内存敏感：图片列表使用虚拟滚动/懒加载，缩略图压缩。

## 6. 可访问性与一致性

- 交互状态（hover/active/disabled/loading）统一到 Element Plus 变量。
- 危险操作（删除、迁移、重置）统一二次确认。
- 全局通知/消息统一封装（`ElMessage`/`ElNotification` 包装），避免散落。
- 移除 auto-import 魔法或补齐类型声明，保证样式与类型可追溯。

## 8. 已选风格：A · 医疗清新

> **已确认（ADR-010）**。血压页冻结，本风格只作用于其余页面。

### 8.1 风格特征

| 维度 | 规范 |
| --- | --- |
| 背景 | 页面 `#f5f6f8`，卡片 `#ffffff` |
| 主色 | `#5340ff`（沿用 Element Plus 主题主色） |
| 辅助/点缀 | 青绿 `#32ccbc`、橙 `#fcbb56`、紫 `#cd99ff`、蓝 `#2c80d6`（沿用现有 `bg-color-1~4`） |
| 圆角 | 卡片 `12px`、控件 `8px`、标签 `4px` |
| 阴影 | 卡片 `0 1px 4px rgba(0,0,0,.06)`；悬浮 `0 4px 16px rgba(0,0,0,.10)` |
| 边框 | `1px solid #e6e8eb`，弱化分隔线 |
| 间距 | 4px 基准，页面内边距 `16/24px` |
| 文本 | 主 `#1f2329` / 次 `#606266` / 弱 `#909399` |
| 状态色 | Element Plus `success/warning/danger` |
| 图标 | `@element-plus/icons-vue` + 现有 svg 图标集 |

### 8.2 组件规范

- **卡片**：白底、圆角、统一内边距与可选标题（复用 `.u-tips` 区块标题风格）。
- **表单**：`el-form` label 右对齐，控件圆角 8px，错误态沿用 Element Plus。
- **表格**：`el-table` 斑马纹可选，表头浅灰；操作列固定右侧。
- **按钮**：主操作 `type=primary`；次操作 `plain`；危险操作 `type=danger` + 二次确认。
- **状态标签**：上传/采集状态用 `el-tag`（成功绿、待传橙、失败红）。
- **空态/加载**：统一 `el-empty` / `v-loading`。
- **B超预览区**：遵循本风格，浅色底 + 深色取景框（如需影像沉浸可后续评估 E 方案）。

### 8.3 性能约束（Win7 / 32 位）

- 禁用毛玻璃 `backdrop-filter`、大面积 `box-shadow` 动画、复杂渐变。
- 列表用虚拟滚动/懒加载，图片缩略图压缩。
- 动画限定 `transform`/`opacity`，时长 ≤200ms。

### 8.4 验收补充

| 编号 | 验证项 | 通过标准 |
| --- | --- | --- |
| U6 | 风格一致性 | 除血压页外页面均符合 A 风格 token |
| U7 | 低端机性能 | 滚动/切换无明显卡顿，帧率可接受 |

## 9. 验收

| 编号 | 验证项 | 通过标准 |
| --- | --- | --- |
| U1 | 血压页视觉回归 | 与旧版逐像素比对，差异可忽略 |
| U2 | 血压数字字体 | DSEG7 正常加载与显示 |
| U3 | 分辨率适配 | 3 种基准分辨率无溢出/重叠 |
| U4 | 主题一致 | 主色 `#5340ff`，组件风格统一 |
| U5 | 内存 | 图片列表滚动不显著增长内存 |
