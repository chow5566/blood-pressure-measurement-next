<template>
  <div class="login">
    <!-- 顶部拖拽栏 + 窗口控件（无边框窗口） -->
    <header class="login__bar">
      <div class="no-drag">
        <WindowControls />
      </div>
    </header>

    <main class="login__center">
      <div class="login__panel no-drag">
        <div class="login__head">
          <UiLogo :size="44" />
          <h1 class="login__title">血压及B超检测</h1>
          <p class="login__subtitle">社区体检工作站</p>
        </div>

        <div class="login__sep"></div>

        <form class="login__form" @submit.prevent="handleLogin">
          <div class="field">
            <label class="label-cap">账号</label>
            <UiInput v-model="form.username" size="lg" placeholder="请输入账号" />
          </div>

          <div class="field">
            <label class="label-cap">密码</label>
            <UiInput v-model="form.password" size="lg" type="password" placeholder="请输入密码" />
          </div>

          <div class="field">
            <label class="label-cap">验证码</label>
            <div class="captcha">
              <UiInput v-model="form.captcha" size="lg" placeholder="请输入验证码" />
              <button
                class="captcha__img"
                type="button"
                title="点击刷新验证码"
                @click="refreshCaptcha"
              >
                <img v-if="captchaImg" :src="captchaImg" alt="验证码" />
                <span v-else>{{ captchaLoading ? '加载中…' : '点击刷新' }}</span>
              </button>
            </div>
          </div>

          <div class="login__row">
            <label class="remember">
              <input v-model="form.rememberMe" type="checkbox" />
              <span>记住账号</span>
            </label>
          </div>

          <UiButton variant="primary" size="lg" block :loading="loading" native-type="submit">
            登录
          </UiButton>
        </form>

        <div v-if="error" class="login__error">{{ error }}</div>

        <div class="login__links">
          <button class="link" type="button" @click="handleOffline">离线使用</button>
          <span class="links__sep"></span>
          <button class="link" type="button" @click="showServer = !showServer">服务器设置</button>
        </div>

        <div v-if="showServer" class="login__server">
          <div class="field">
            <label class="label-cap">接口地址</label>
            <UiInput v-model="serverForm.baseApi" placeholder="http://…/health-display-local/" />
          </div>
          <div class="field">
            <label class="label-cap">静态资源地址</label>
            <UiInput v-model="serverForm.staticApi" placeholder="http://…/local-data-display/" />
          </div>
          <div class="server__actions">
            <span class="hint">保存后即可用该地址登录</span>
            <UiButton variant="secondary" size="sm" @click="saveServer">保存</UiButton>
          </div>
        </div>
      </div>
    </main>

    <footer class="login__foot">
      <span>v{{ config.version }}</span>
      <span class="links__sep"></span>
      <span>离线可使用本地功能</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import UiLogo from '@r/components/ui/UiLogo.vue'
import UiInput from '@r/components/ui/UiInput.vue'
import UiButton from '@r/components/ui/UiButton.vue'
import WindowControls from '@r/components/WindowControls.vue'
import { authApi } from '@r/api/auth'
import { useConfigStore } from '@r/stores/config'
import { useUserStore } from '@r/stores/user'
import { toast } from '@r/utils/toast'
import { uuid } from '@shared/utils/uuid'
import type { LoginResult } from '@shared/domain/app'

/** 登录页：账号登录 / 离线使用 / 服务地址设置 */
const emit = defineEmits<{ enter: []; offline: [] }>()

const config = useConfigStore()
const userStore = useUserStore()

const loading = ref(false)
const error = ref('')
const form = reactive({ username: '', password: '', captcha: '', rememberMe: true })

/* 图形验证码 */
const captchaImg = ref('')
const captchaUuid = ref('')
const captchaLoading = ref(false)

async function refreshCaptcha(): Promise<void> {
  captchaUuid.value = uuid()
  form.captcha = ''
  captchaLoading.value = true
  try {
    captchaImg.value = await authApi.captcha(captchaUuid.value)
  } catch {
    captchaImg.value = ''
  } finally {
    captchaLoading.value = false
  }
}

const showServer = ref(false)
const serverForm = reactive({ baseApi: config.baseApi, staticApi: config.staticApi })

const REMEMBER_KEY = 'bpm.remember.username'

onMounted(() => {
  const saved = localStorage.getItem(REMEMBER_KEY)
  if (saved) form.username = saved
  void refreshCaptcha()
})

async function saveServer(): Promise<void> {
  try {
    await config.update({ baseApi: serverForm.baseApi, staticApi: serverForm.staticApi })
    toast('服务地址已保存', 'success')
    showServer.value = false
    void refreshCaptcha()
  } catch (e) {
    toast((e as Error).message, 'error')
  }
}

async function handleLogin(): Promise<void> {
  error.value = ''
  if (!form.captcha.trim()) {
    error.value = '请输入验证码'
    return
  }
  loading.value = true
  try {
    const result = await Promise.race<LoginResult>([
      authApi.login({
        username: form.username,
        password: form.password,
        captcha: form.captcha.trim(),
        uuid: captchaUuid.value,
        rememberMe: form.rememberMe
      }),
      new Promise<LoginResult>((resolve) =>
        setTimeout(() => resolve({ ok: false, message: '连接超时，请检查服务地址或网络' }), 20000)
      )
    ])
    if (!result.ok) {
      error.value = result.message || '登录失败'
      void refreshCaptcha()
      return
    }
    if (form.rememberMe) localStorage.setItem(REMEMBER_KEY, form.username)
    else localStorage.removeItem(REMEMBER_KEY)

    await config.load()
    userStore.isOnline = 'Y'
    if (result.user) userStore.user = result.user as { name?: string; orgCode?: string }
    await showAuthPopup(result.user)
    emit('enter')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

function handleOffline(): void {
  userStore.isOnline = 'N'
  emit('offline')
}

/** 登录后按机构授权配置弹窗提示（授权即将到期） */
async function showAuthPopup(user: Record<string, unknown> | undefined): Promise<void> {
  const orgCode = (user?.orgCode as string) || ''
  if (!orgCode) return
  try {
    const info = await authApi.authPopup(orgCode)
    if (!info || Number(info.isPopups) !== 1) return
    const msg = (info.warningMsg || '').replace(/\[expireTime\]/g, info.expireTime || '')
    const isManager =
      (user?.accountType as string) === 'MANAGER' && Number(info.managerExtendCount) === 1
    const content = isManager ? `${msg}\n如有需要可移步菜单【机构管理-授权管理】延期授权` : msg
    await ElMessageBox.alert(content, '授权即将到期', {
      type: 'warning',
      confirmButtonText: '继续登录',
      showClose: false
    })
  } catch {
    // 授权查询失败不阻塞登录
  }
}
</script>

<style scoped>
.login {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg);
  -webkit-app-region: drag;
}

/* 顶部拖拽栏：仅放窗口控件 */
.login__bar {
  flex: 0 0 40px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 2px;
}
.login__bar .no-drag {
  height: 100%;
}

.login__center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--s5);
}

.login__panel {
  width: 384px;
  padding: var(--s7) var(--s6) var(--s5);
  background: var(--surface);
  border: 1px solid var(--line-strong);
}

.login__head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}
.login__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: var(--ls-label);
}
.login__subtitle {
  margin: 0;
  font-size: var(--fs-xs);
  color: var(--t3);
  letter-spacing: var(--ls-label);
}

.login__sep {
  height: 1px;
  margin: var(--s5) 0;
  background: var(--line);
}

.field {
  margin-bottom: var(--s4);
}
.field .label-cap {
  display: block;
  margin-bottom: 6px;
}

.captcha {
  display: flex;
  align-items: stretch;
  gap: var(--s2);
}
.captcha :deep(.ui-input) {
  flex: 1;
  min-width: 0;
}
.captcha__img {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 108px;
  height: 40px;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--line-strong);
  background: var(--surface-2);
  color: var(--t3);
  font-family: inherit;
  font-size: var(--fs-xs);
  cursor: pointer;
}
.captcha__img:hover {
  border-color: var(--accent);
}
.captcha__img img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.login__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 2px 0 var(--s5);
}
.remember {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-md);
  color: var(--t2);
  cursor: pointer;
}
.remember input {
  width: 14px;
  height: 14px;
  accent-color: var(--accent);
}

.login__error {
  margin-top: var(--s4);
  padding: var(--s2) var(--s3);
  border-left: 3px solid var(--danger);
  background: var(--danger-weak);
  color: var(--danger);
  font-size: var(--fs-md);
  line-height: 1.5;
}

.login__links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--s3);
  margin-top: var(--s4);
}
.links__sep {
  width: 1px;
  height: 12px;
  background: var(--line-strong);
}
.link {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--accent-ink);
  font-family: inherit;
  font-size: var(--fs-md);
  cursor: pointer;
}
.link:hover {
  text-decoration: underline;
}

.login__server {
  margin-top: var(--s4);
  padding-top: var(--s4);
  border-top: 1px solid var(--line);
}
.server__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s2);
}
.hint {
  font-size: var(--fs-xs);
  color: var(--t3);
}

.login__foot {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--s3);
  padding: var(--s4);
  font-size: var(--fs-xs);
  color: var(--t3);
}
</style>
