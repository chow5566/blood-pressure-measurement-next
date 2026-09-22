<template>
  <div class="login">
    <div class="login__card no-drag">
      <div class="login__head">
        <UiLogo :size="22" />
        <div class="login__titles">
          <span class="login__name">血压及B超检测</span>
          <span class="label-cap">社区体检工作站</span>
        </div>
      </div>

      <div class="login__body">
        <div class="field">
          <label class="label-cap">账号</label>
          <UiInput v-model="form.username" placeholder="请输入账号" @keydown.enter="handleLogin" />
        </div>

        <div class="field">
          <label class="label-cap">密码</label>
          <UiInput
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            @keydown.enter="handleLogin"
          />
        </div>

        <div class="field">
          <label class="label-cap">验证码</label>
          <div class="captcha">
            <UiInput
              v-model="form.captcha"
              placeholder="请输入验证码"
              @keydown.enter="handleLogin"
            />
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

        <label class="remember">
          <input v-model="form.rememberMe" type="checkbox" />
          <span>记住账号</span>
        </label>

        <UiButton variant="primary" size="lg" block :loading="loading" @click="handleLogin">
          登录
        </UiButton>

        <div class="links">
          <button class="link" type="button" @click="handleOffline">离线使用</button>
          <span class="links__sep"></span>
          <button class="link" type="button" @click="showServer = !showServer">服务器设置</button>
        </div>

        <div v-if="showServer" class="server">
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

        <div v-if="error" class="error">{{ error }}</div>
      </div>

      <div class="login__foot">
        <span class="label-cap">v{{ config.version }}</span>
        <span class="label-cap">离线可使用本地功能</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import UiLogo from '@r/components/ui/UiLogo.vue'
import UiInput from '@r/components/ui/UiInput.vue'
import UiButton from '@r/components/ui/UiButton.vue'
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
  align-items: center;
  justify-content: center;
  height: 100%;
  background: var(--bg);
  -webkit-app-region: drag;
}

.login__card {
  width: 360px;
  background: var(--surface);
  border: 1px solid var(--line-strong);
  -webkit-app-region: no-drag;
}

.login__head {
  display: flex;
  align-items: center;
  gap: var(--s3);
  padding: var(--s5) var(--s5) var(--s4);
  border-bottom: 1px solid var(--line);
}
.login__titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.login__name {
  font-size: var(--fs-lg);
  font-weight: 600;
  letter-spacing: var(--ls-label);
}

.login__body {
  padding: var(--s5);
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
  width: 104px;
  height: var(--ctrl-h);
  padding: 0;
  border: 1px solid var(--line-strong);
  background: var(--surface-2);
  color: var(--t3);
  font-family: inherit;
  font-size: var(--fs-xs);
  cursor: pointer;
  overflow: hidden;
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

.remember {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0 var(--s4);
  font-size: var(--fs-md);
  color: var(--t2);
  cursor: pointer;
}
.remember input {
  width: 14px;
  height: 14px;
  accent-color: var(--accent);
}

.links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--s3);
  margin-top: var(--s3);
}
.links__sep {
  width: 1px;
  height: 12px;
  background: var(--line-strong);
}
.link {
  border: none;
  background: transparent;
  padding: 0;
  color: var(--accent-ink);
  font-family: inherit;
  font-size: var(--fs-md);
  cursor: pointer;
}
.link:hover {
  text-decoration: underline;
}

.server {
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

.error {
  margin-top: var(--s4);
  padding: var(--s2) var(--s3);
  border-left: 3px solid var(--danger);
  background: var(--danger-weak);
  color: var(--danger);
  font-size: var(--fs-md);
  line-height: 1.5;
}

.login__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--s2) var(--s5);
  border-top: 1px solid var(--line);
  background: var(--surface-2);
}
</style>
