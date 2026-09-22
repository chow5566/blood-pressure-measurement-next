import type { Migration } from './types'

/**
 * 初始 schema（基线）。
 *
 * 兼容性说明：
 * - 列名使用 camelCase，与旧项目 TypeORM 自动生成的列名一致，保证旧库可直接沿用。
 * - 全部使用 `IF NOT EXISTS`，对已存在的旧库执行不会破坏数据（相当于「采纳为基线」）。
 * - 旧表缺少的索引会补齐；旧表缺少的列不会在此迁移中新增（由后续迁移负责）。
 */
export const migration001: Migration = {
  id: 1,
  name: 'init-schema',
  up(db) {
    // 血压记录
    db.exec(`
      CREATE TABLE IF NOT EXISTS blood_pressure (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        codeBar     TEXT    NOT NULL,
        status      INTEGER NOT NULL DEFAULT 0,
        dataType    TEXT,
        createTime  TEXT,
        updateTime  TEXT,
        collectTime TEXT,
        userNum     INTEGER,
        leftDbp     INTEGER,
        leftSbp     INTEGER,
        rightDbp    INTEGER,
        rightSbp    INTEGER,
        pulse       INTEGER
      );
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_bp_codeBar ON blood_pressure (codeBar);`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_bp_status ON blood_pressure (status);`)

    // B超检查记录
    db.exec(`
      CREATE TABLE IF NOT EXISTS b_scan_entity (
        barcode          TEXT PRIMARY KEY,
        checkType        TEXT,
        name             TEXT,
        idCard           TEXT,
        gender           TEXT,
        birthday         TEXT,
        isUpload         TEXT DEFAULT 'N',
        isNormal         TEXT,
        diagnosis        TEXT,
        bodyParts        TEXT,
        diagnosisDetails TEXT,
        localRemark      TEXT,
        createTime       TEXT,
        updateTime       TEXT
      );
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_bscan_name ON b_scan_entity (name);`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_bscan_idCard ON b_scan_entity (idCard);`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_bscan_isUpload ON b_scan_entity (isUpload);`)

    // B超图片
    db.exec(`
      CREATE TABLE IF NOT EXISTS b_scan_images_entity (
        id         TEXT PRIMARY KEY,
        barcode    TEXT,
        isUpload   TEXT DEFAULT 'N',
        isCheck    TEXT,
        sortNum    INTEGER,
        localPath  TEXT,
        uploadUrl  TEXT,
        createTime TEXT,
        updateTime TEXT
      );
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_bscan_img_barcode ON b_scan_images_entity (barcode);`)

    // B超报告模板
    db.exec(`
      CREATE TABLE IF NOT EXISTS b_scan_template (
        id               TEXT PRIMARY KEY,
        parentId         TEXT DEFAULT '00',
        dataType         TEXT DEFAULT 'TEMPLATE',
        typeName         TEXT,
        typeDesc         TEXT,
        title            TEXT,
        diagnosis        TEXT,
        diagnosisDetails TEXT,
        sortNum          INTEGER,
        isPublic         INTEGER DEFAULT 0,
        createTime       TEXT,
        updateTime       TEXT
      );
    `)
  }
}
