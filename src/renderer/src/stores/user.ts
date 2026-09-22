import { defineStore } from 'pinia'

/**
 * 用户/登录态（M4 离线优先；登录在 M5 接入）。
 * isOnline='N' 时不做服务端查询，仅使用本地数据。
 */
export const useUserStore = defineStore('user', {
  state: () => ({
    token: null as string | null,
    isOnline: 'N' as 'Y' | 'N',
    user: { name: '' } as { name?: string; orgCode?: string }
  })
})
