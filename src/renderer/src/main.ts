import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { rendererLog } from './utils/log'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './styles/index.scss'

// Element Plus 已配置按需引入（见 electron.vite.config.ts）。
const app = createApp(App)

// 全局错误兜底：避免渲染层异常静默丢失（同时汇聚到主进程日志）
app.config.errorHandler = (err, _instance, info) => {
  console.error('[renderer] vue error:', err, info)
  rendererLog('error', `vue error: ${String(err)} ${info}`)
}
window.addEventListener('unhandledrejection', (event) => {
  console.error('[renderer] unhandled rejection:', event.reason)
  rendererLog('error', `unhandled rejection: ${String(event.reason)}`)
})
window.addEventListener('error', (event) => {
  console.error('[renderer] window error:', event.error ?? event.message)
  rendererLog('error', `window error: ${String(event.error ?? event.message)}`)
})

app.use(createPinia())
app.use(router)
app.mount('#app')
