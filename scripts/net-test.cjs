/* eslint-disable @typescript-eslint/no-var-requires */
// 网络对比测试：Node http（主进程 axios 同栈） vs Electron net（Chromium）
// 运行：node_modules\electron\dist\electron.exe scripts/net-test.cjs
const { app, net } = require('electron')
const http = require('node:http')

const URL = process.argv[2] || 'http://www.chealth.cn/health-display-local/captcha.jpg?uuid=test'

app.whenReady().then(async () => {
  const result = { url: URL }

  await new Promise((resolve) => {
    const req = http.get(URL, { timeout: 8000 }, (res) => {
      result.nodeStatus = res.statusCode
      res.resume()
    })
    req.on('timeout', () => {
      result.nodeError = 'ETIMEDOUT'
      req.destroy()
      resolve()
    })
    req.on('error', (e) => {
      result.nodeError = e.code || e.message
      resolve()
    })
    req.on('close', resolve)
  })

  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      result.chromiumTimeout = true
      resolve()
    }, 12000)
    const req = net.request(URL)
    req.on('response', (res) => {
      result.chromiumStatus = res.statusCode
      res.on('data', () => {})
      res.on('end', () => {
        clearTimeout(timer)
        resolve()
      })
    })
    req.on('error', (e) => {
      clearTimeout(timer)
      result.chromiumError = e.message
      resolve()
    })
    req.end()
  })

  process.stdout.write('\nNETTEST ' + JSON.stringify(result) + '\n')
  app.exit(0)
})
