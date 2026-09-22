/* eslint-disable @typescript-eslint/no-var-requires */
// B超报告生成验证（开发用）：在 Electron 22 运行时下验证 docxtemplater 链路可用。
// 运行：node_modules\electron\dist\electron.exe scripts/verify-report.cjs
const { app } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const Docxtemplater = require('docxtemplater')
const ImageModule = require('docxtemplater-image-module-free')
const PizZip = require('pizzip')
const sizeOf = require('image-size')

const PNG_1x1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

app.whenReady().then(() => {
  const out = { ok: false }
  try {
    const templatePath = path.join(__dirname, '..', 'resources', 'template', 'bscan-default.docx')
    out.templateExists = fs.existsSync(templatePath)
    const content = fs.readFileSync(templatePath)
    const zip = new PizZip(content)

    const imgBuffer = Buffer.from(PNG_1x1, 'base64')
    const imageDict = { image1: imgBuffer.buffer.slice(imgBuffer.byteOffset, imgBuffer.byteOffset + imgBuffer.byteLength) }

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      modules: [
        new ImageModule({
          getImage: (_v, key) => imageDict[key],
          getSize: (buf) => {
            const dim = sizeOf(Buffer.from(buf))
            const w = 240
            return [w, w * ((dim.height || 1) / (dim.width || 1))]
          }
        })
      ]
    })

    doc.render({
      title: '测试标题',
      barcode: 'TEST-001',
      name: '张三',
      gender: '男',
      age: '30岁',
      diagnosis: '测试诊断',
      diagnosisDetails: '测试描述',
      doctorName: '医生',
      createTime: '2026-09-20 10:00:00',
      image1: 'image1'
    })

    const base64 = doc.getZip().generate({ type: 'base64', compression: 'DEFLATE' })
    out.bytes = base64.length
    out.ok = base64.length > 1000
  } catch (e) {
    out.error = e.message
  }
  process.stdout.write('\nREPORT_VERIFY ' + JSON.stringify(out) + '\n')
  app.exit(0)
})
