import { BaseRepository } from './base.repository'
import type { BScanImage } from '../../../../shared/domain/b-scan'

/**
 * B超图片仓库（表 b_scan_images_entity）。
 * 注意：`base64Path` 为运行时字段，绝不写入数据库。
 */
export class BScanImagesRepository extends BaseRepository {
  /** 按条码查询图片（按序号升序） */
  listByBarcode(barcode: string): BScanImage[] {
    return this.db
      .prepare('SELECT * FROM b_scan_images_entity WHERE barcode = ? ORDER BY sortNum ASC')
      .all(barcode) as BScanImage[]
  }

  /** 新增单张图片 */
  insert(image: BScanImage): void {
    const now = this.now()
    this.db
      .prepare(
        `INSERT INTO b_scan_images_entity
           (id, barcode, isUpload, isCheck, sortNum, localPath, uploadUrl, createTime, updateTime)
         VALUES
           (@id, @barcode, @isUpload, @isCheck, @sortNum, @localPath, @uploadUrl, @createTime, @updateTime)`
      )
      .run({
        id: image.id ?? '',
        barcode: image.barcode ?? null,
        isUpload: image.isUpload ?? 'N',
        isCheck: image.isCheck ?? null,
        sortNum: image.sortNum ?? null,
        localPath: image.localPath ?? null,
        uploadUrl: image.uploadUrl ?? null,
        createTime: image.createTime ?? now,
        updateTime: now
      })
  }

  /**
   * 以条码为单位整体替换图片集合（先删后插），保证与前端提交一致。
   * 使用事务，避免中途失败留下半套数据。
   */
  replaceForBarcode(barcode: string, images: BScanImage[]): void {
    const now = this.now()
    const remove = this.db.prepare('DELETE FROM b_scan_images_entity WHERE barcode = ?')
    const insert = this.db.prepare(
      `INSERT INTO b_scan_images_entity
         (id, barcode, isUpload, isCheck, sortNum, localPath, uploadUrl, createTime, updateTime)
       VALUES
         (@id, @barcode, @isUpload, @isCheck, @sortNum, @localPath, @uploadUrl, @createTime, @updateTime)`
    )

    const tx = this.db.transaction((rows: BScanImage[]) => {
      remove.run(barcode)
      rows.forEach((image) => {
        insert.run({
          id: image.id ?? '',
          barcode,
          isUpload: image.isUpload ?? 'N',
          isCheck: image.isCheck ?? null,
          sortNum: image.sortNum ?? null,
          localPath: image.localPath ?? null,
          uploadUrl: image.uploadUrl ?? null,
          createTime: image.createTime ?? now,
          updateTime: now
        })
      })
    })

    tx(images)
  }

  /** 删除某条码下的全部图片 */
  deleteByBarcode(barcode: string): void {
    this.db.prepare('DELETE FROM b_scan_images_entity WHERE barcode = ?').run(barcode)
  }

  /** 批量 upsert（按 id 追加/更新，不删除其它） */
  upsertMany(images: BScanImage[]): void {
    if (!images.length) return
    const now = this.now()
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO b_scan_images_entity
         (id, barcode, isUpload, isCheck, sortNum, localPath, uploadUrl, createTime, updateTime)
       VALUES
         (@id, @barcode, @isUpload, @isCheck, @sortNum, @localPath, @uploadUrl, @createTime, @updateTime)`
    )
    const tx = this.db.transaction((rows: BScanImage[]) => {
      rows.forEach((image) => {
        stmt.run({
          id: image.id ?? '',
          barcode: image.barcode ?? null,
          isUpload: image.isUpload ?? 'N',
          isCheck: image.isCheck ?? null,
          sortNum: image.sortNum ?? null,
          localPath: image.localPath ?? null,
          uploadUrl: image.uploadUrl ?? null,
          createTime: image.createTime ?? now,
          updateTime: now
        })
      })
    })
    tx(images)
  }

  /** 标记指定图片为已上传 */
  markUploaded(ids: string[]): void {
    const valid = ids.filter(Boolean)
    if (!valid.length) return
    const placeholders = valid.map(() => '?').join(', ')
    this.db
      .prepare(
        `UPDATE b_scan_images_entity SET isUpload = 'Y', updateTime = ? WHERE id IN (${placeholders})`
      )
      .run(this.now(), ...valid)
  }

  /** 修改条码号，并同步替换 localPath 中的目录前缀 */
  changeBarcode(oldBarcode: string, newBarcode: string, oldDir: string, newDir: string): void {
    this.db
      .prepare(
        `UPDATE b_scan_images_entity
            SET barcode = @newBarcode,
                localPath = REPLACE(localPath, @oldDir, @newDir),
                updateTime = @now
          WHERE barcode = @oldBarcode`
      )
      .run({ oldBarcode, newBarcode, oldDir, newDir, now: this.now() })
  }

  /** 按条码统计图片数量 */
  countByBarcode(barcode: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS total FROM b_scan_images_entity WHERE barcode = ?')
      .get(barcode) as { total: number }
    return row.total
  }
}
