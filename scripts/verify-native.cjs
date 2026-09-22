/* eslint-disable @typescript-eslint/no-var-requires */
// 原生模块在 Electron 22 运行时下的加载验证脚本（开发用）
// 运行：node_modules\electron\dist\electron.exe scripts/verify-native.cjs
const { app } = require('electron')

app.whenReady().then(async () => {
  const result = {
    electron: process.versions.electron,
    node: process.versions.node,
    modules: process.versions.modules,
    arch: process.arch
  }

  try {
    const Database = require('better-sqlite3')
    const db = new Database(':memory:')
    db.exec('CREATE TABLE t (a INTEGER)')
    db.prepare('INSERT INTO t (a) VALUES (?)').run(1)
    const row = db.prepare('SELECT a FROM t').get()
    db.close()
    result.betterSqlite3 = `ok v${require('better-sqlite3/package.json').version} (row=${row.a})`
  } catch (e) {
    result.betterSqlite3 = `FAIL: ${e.message}`
  }

  try {
    const { SerialPort } = require('serialport')
    result.serialport = `ok v${require('serialport/package.json').version}`
    try {
      const ports = await SerialPort.list()
      result.serialportList = `ok (${ports.length} ports)`
    } catch (e) {
      result.serialportList = `FAIL: ${e.message}`
    }
  } catch (e) {
    result.serialport = `FAIL: ${e.message}`
  }

  process.stdout.write('\nVERIFY_RESULT ' + JSON.stringify(result) + '\n')
  app.exit(0)
})
