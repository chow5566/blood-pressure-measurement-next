# 13 · 交付检查清单

> 每个交付版本逐项确认并留档（机器、系统、位数、结果）。

## 1. 构建产物

- [ ] `pnpm build` 通过（typecheck + 构建）
- [ ] `pnpm lint` 通过
- [ ] `pnpm build:win64` 产出 `血压及B超检测-<version>-x64-setup.exe`
- [ ] `pnpm build:win32` 产出 `血压及B超检测-<version>-ia32-setup.exe`
- [ ] 产物内原生模块已解包（`resources/app.asar.unpacked/**/*.node`）
- [ ] 体积在预期范围（已裁剪非 Windows 预编译/源码/测试）

> 注意：双架构需**分别 rebuild 后打包**（`build:win64`/`build:win32` 已内置），不可一次 `--ia32 --x64`。

## 2. 资源与依赖

- [ ] `resources/template/bscan-default.docx` 为正式报告模板
- [ ] `resources/drivers/vga2usb/*.msi` 为**真实**安装包（当前仓库为占位）
- [ ] VGA2USB 具备 x86 与 x64 两套安装包（按 OS 位数分发）
- [ ] 图标 `build/favicon.ico` 为正式图标

## 3. 安装与启动（Win7 32/64）

- [ ] 安装时可选数据目录（NSIS 自定义页），首启使用所选目录
- [ ] 未选择时默认 `%ProgramData%\blood-pressure-measurement\data`
- [ ] 应用以普通权限启动；安装驱动时按需 UAC
- [ ] 启动无白屏（闪屏 → 主界面）
- [ ] `renderMode=software` 可解决 GPU 兼容问题

## 4. 功能验证（对照 02 §9）

- [ ] V3 血压计：枚举/读取/上传
- [ ] V4 VGA2USB：枚举/预览/采集
- [ ] V5 报告生成/预览
- [ ] V6 本地 SQLite 读写
- [ ] V7 上传成功/失败降级
- [ ] V8 内存压测（连续采集 20 张、连续生成报告）
- [ ] V9 自动更新：检查/下载/安装
- [ ] V10 驱动安装：x86/x64 按 OS 位数
- [ ] 登录/离线使用
- [ ] 在线查询与同步（B超）

## 5. 存储与迁移（对照 10 §11）

- [ ] S-M1 安装选目录
- [ ] S-M2 默认目录正确
- [ ] S-M3 应用内更换目录
- [ ] S-M9 迁移后删旧数据并自动重启
- [ ] S-M7 跨盘迁移
- [ ] S-M10 禁止 U盘/网络盘
- [ ] 低空间预警 + 硬阈值阻止写入

## 6. 数据兼容

- [ ] 旧库（TypeORM）可直接读取，`integrity_check=ok`
- [ ] 旧图片（`bScanImages/`）可正常显示
- [ ] 旧数据目录可被自动发现/采纳

## 7. 交付物

- [ ] 安装包（ia32 + x64）
- [ ] 版本号与 CHANGELOG
- [ ] 排障手册（docs/12）
- [ ] 数据目录说明（docs/10）
- [ ] 代码签名（如具备证书）与更新源 `latest.yml`
