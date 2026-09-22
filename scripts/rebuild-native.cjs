/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * 原生模块重建脚本（better-sqlite3）。
 *
 * 优先使用 prebuild-install 拉取与 Electron 匹配的预编译二进制（无需 VS 编译环境），
 * 失败时回退到 electron-rebuild（需要本机具备 VS Build Tools）。
 *
 * 用法：node scripts/rebuild-native.cjs <ia32|x64>
 */
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const arch = process.argv[2] || 'x64'
const electronVersion = JSON.parse(
  fs.readFileSync(require.resolve('electron/package.json'), 'utf8')
).version

/** 解析某个包的 bin 脚本绝对路径 */
function resolveBin(pkgName, binName) {
  try {
    const pkgPath = require.resolve(`${pkgName}/package.json`)
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.[binName]
    if (!bin) return null
    return path.join(path.dirname(pkgPath), bin)
  } catch {
    return null
  }
}

function run(label, scriptPath, args, cwd, env) {
  console.log(`[rebuild] ${label}: node ${path.basename(scriptPath)} ${args.join(' ')}`)
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    stdio: 'inherit',
    env: env || process.env
  })
  return result.status === 0
}

const bsDir = path.dirname(require.resolve('better-sqlite3/package.json'))

// 1) 预编译优先：默认走国内镜像，避免 GitHub 超时回退源码编译（现场可能无 VS Build Tools）
const prebuildBin = resolveBin('prebuild-install', 'prebuild-install')
if (prebuildBin) {
  const prebuildArgs = [
    '--runtime',
    'electron',
    '--target',
    electronVersion,
    '--arch',
    arch,
    '--verbose'
  ]
  const mirror =
    process.env.npm_config_better_sqlite3_binary_host ||
    process.env.better_sqlite3_binary_host ||
    'https://registry.npmmirror.com/-/binary/better-sqlite3'

  const okMirror = run('prebuild-install (mirror)', prebuildBin, prebuildArgs, bsDir, {
    ...process.env,
    npm_config_better_sqlite3_binary_host: mirror
  })
  if (okMirror) {
    console.log(
      `[rebuild] better-sqlite3 预编译安装完成（electron ${electronVersion} ${arch}，${mirror}）`
    )
    process.exit(0)
  }

  // 镜像失败再回退官方 GitHub 源
  const okOfficial = run('prebuild-install (github)', prebuildBin, prebuildArgs, bsDir)
  if (okOfficial) {
    console.log(
      `[rebuild] better-sqlite3 预编译安装完成（electron ${electronVersion} ${arch}，github）`
    )
    process.exit(0)
  }
}

// 2) 回退：源码编译
console.error('[rebuild] 预编译失败，回退 electron-rebuild（需要 VS Build Tools）')
const rebuildBin = resolveBin('@electron/rebuild', 'electron-rebuild')
if (!rebuildBin) {
  console.error('[rebuild] 未找到 electron-rebuild')
  process.exit(1)
}
const ok = run('electron-rebuild', rebuildBin, ['-f', '-a', arch, '-w', 'better-sqlite3'], process.cwd())
process.exit(ok ? 0 : 1)
