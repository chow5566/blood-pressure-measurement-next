import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

/**
 * 应用内路由（单窗口 + hash 模式）。
 * 单窗口架构下 Vue 只加载一次，页面切换为组件级切换（见 ADR-013）。
 *
 * 业务按域聚合为父子结构：血压（测量/历史）、B超（采集/历史/模板维护）。
 */
const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/blood-pressure' },
  {
    path: '/blood-pressure',
    component: () => import('@r/views/blood-pressure/index.vue'),
    meta: { title: '血压检测', subtitle: '连接血压计后扫码启动测量' },
    children: [
      {
        path: '',
        name: 'blood-pressure',
        component: () => import('@r/views/blood-pressure/measure.vue'),
        meta: { title: '血压检测', subtitle: '连接血压计后扫码启动测量' }
      },
      {
        path: 'history',
        name: 'blood-pressure-history',
        component: () => import('@r/views/blood-pressure/history.vue'),
        meta: { title: '血压历史', subtitle: '本地记录查询、删除与补传' }
      }
    ]
  },
  {
    path: '/b-scan',
    component: () => import('@r/views/b-scan/index.vue'),
    meta: { title: 'B超检测', subtitle: '采集影像、历史与模板' },
    children: [
      {
        path: '',
        name: 'b-scan',
        component: () => import('@r/views/b-scan/collect.vue'),
        meta: { title: 'B超采集', subtitle: '采集影像并填写检查报告' }
      },
      {
        path: 'history',
        name: 'b-scan-history',
        component: () => import('@r/views/b-scan/history.vue'),
        meta: { title: 'B超历史', subtitle: '查询记录、补传与同步' }
      },
      {
        path: 'template',
        name: 'b-scan-template',
        component: () => import('@r/views/b-scan/template.vue'),
        meta: { title: '模板维护', subtitle: '维护报告模板与类型分组' }
      }
    ]
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@r/views/SettingsView.vue'),
    meta: { title: '设置', subtitle: '服务、外观、存储、驱动与快捷键' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
