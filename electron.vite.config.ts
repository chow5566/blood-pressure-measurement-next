import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin, swcPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), swcPlugin()],
    build: {
      target: 'node16',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      target: 'node16',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@r': resolve(__dirname, 'src/renderer/src'),
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    css: {
      // 使用 Sass 现代 JS API，消除 Dart Sass legacy-js-api 弃用警告
      preprocessorOptions: {
        scss: {
          api: 'modern'
        }
      }
    },
    plugins: [
      vue(),
      // Element Plus 按需引入（组件 + ElMessage 等 API），显著减小首屏体积、加快挂载
      AutoImport({
        resolvers: [ElementPlusResolver()],
        dts: 'src/renderer/src/auto-imports.d.ts'
      }),
      Components({
        resolvers: [ElementPlusResolver()],
        dts: 'src/renderer/src/components.d.ts'
      })
    ],
    build: {
      target: 'chrome108',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') }
      }
    }
  }
})
