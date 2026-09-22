/* eslint-disable @typescript-eslint/no-var-requires */
// 数据层验证脚本（开发用）：读取数据目录，输出表、迁移与行数。
// 运行：node_modules\electron\dist\electron.exe scripts/verify-db.cjs
const { app } = require('electron')
const path = require('node:path')
const Database = require('better-sqlite3')

app.whenReady().then(() => {
  const dbFile =
    process.argv[2] ||
    path.join(__dirname, '..', '..', '..', 'blood-pressure-measurement-data', 'database', 'index.db')
  const out = { dbFile, ok: false }
  try {
    const db = new Database(dbFile, { readonly: true, fileMustExist: true })
    out.tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r) => r.name)
    try {
      out.schemaMigrations = db
        .prepare('SELECT id, name FROM schema_migrations ORDER BY id')
        .all()
    } catch {
      out.schemaMigrations = []
    }
    out.counts = {}
    for (const t of ['blood_pressure', 'b_scan_entity', 'b_scan_images_entity', 'b_scan_template']) {
      if (out.tables.includes(t)) {
        out.counts[t] = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n
      }
    }
    out.integrity = db.pragma('integrity_check', { simple: true })
    db.close()
    out.ok = true
  } catch (e) {
    out.error = e.message
  }
  process.stdout.write('\nDB_VERIFY ' + JSON.stringify(out) + '\n')
  app.exit(0)
})
