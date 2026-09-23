<template>
  <div class="login">
    <!-- 顶部拖拽栏 + 窗口控件（无边框窗口；登录窗不可最大化） -->
    <header class="login__bar">
      <div class="no-drag">
        <WindowControls :show-maximize="false" />
      </div>
    </header>

    <main class="login__center">
      <div class="login__panel no-drag">
        <div class="flip" :class="{ 'is-flipped': showServer }">
          <div class="flip__inner">
            <!-- 正面：登录 -->
            <div class="flip__face flip__face--front">
              <div class="brand">
                <UiLogo :size="44" />
                <div class="brand__name">血压及B超检测</div>
                <div class="brand__sub">社区体检工作站</div>
              </div>

              <el-form
                ref="loginFormRef"
                :model="form"
                :rules="loginRules"
                class="form"
                hide-required-asterisk
                @submit.prevent="handleLogin"
              >
                <el-form-item prop="username">
                  <el-input
                    v-model="form.username"
                    size="large"
                    :prefix-icon="User"
                    placeholder="请输入账号"
                  />
                </el-form-item>

                <el-form-item prop="password">
                  <el-input
                    v-model="form.password"
                    size="large"
                    type="password"
                    show-password
                    :prefix-icon="Lock"
                    placeholder="请输入密码"
                  />
                </el-form-item>

                <el-form-item prop="captcha">
                  <div class="captcha">
                    <el-input
                      v-model="form.captcha"
                      size="large"
                      :prefix-icon="Key"
                      placeholder="请输入验证码"
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
                </el-form-item>

                <label class="remember">
                  <input v-model="form.rememberMe" type="checkbox" />
                  <span>记住账号</span>
                </label>

                <UiButton variant="primary" size="lg" block :loading="loading" native-type="submit">
                  登录
                </UiButton>

                <div class="form-error">{{ error }}</div>
              </el-form>

              <div class="links">
                <button class="link" type="button" @click="handleOffline">离线使用</button>
                <span class="links__sep"></span>
                <button class="link" type="button" @click="showServer = true">服务器设置</button>
              </div>
            </div>

            <!-- 背面：服务器设置（翻转展示） -->
            <div class="flip__face flip__face--back">
              <div class="brand brand--compact">
                <div class="brand__name">服务器设置</div>
                <div class="brand__sub">配置后端接口与静态资源地址</div>
              </div>

              <el-form
                ref="serverFormRef"
                :model="serverForm"
                :rules="serverRules"
                class="form"
                hide-required-asterisk
              >
                <el-form-item prop="baseApi">
                  <el-input
                    v-model="serverForm.baseApi"
                    size="large"
                    placeholder="接口地址 http://…/health-display-local/"
                  />
                </el-form-item>

                <el-form-item prop="staticApi">
                  <el-input
                    v-model="serverForm.staticApi"
                    size="large"
                    placeholder="静态资源地址 http://…/local-data-display/"
                  />
                </el-form-item>

                <div class="actions">
                  <UiButton variant="secondary" size="lg" @click="showServer = false">
                    返回
                  </UiButton>
                  <UiButton variant="primary" size="lg" @click="saveServer">保存</UiButton>
                </div>
              </el-form>
            </div>
          </div>
        </div>
      </div>
    </main>

    <footer class="login__foot">v{{ config.version }}</footer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { Key, Lock, User } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import UiLogo from '@r/components/ui/UiLogo.vue'
import UiButton from '@r/components/ui/UiButton.vue'
import WindowControls from '@r/components/WindowControls.vue'
import { authApi } from '@r/api/auth'
import { useConfigStore } from '@r/stores/config'
import { useUserStore } from '@r/stores/user'
import { toast } from '@r/utils/toast'
import { uuid } from '@shared/utils/uuid'
import type { LoginResult } from '@shared/domain/app'

/** 登录页：账号登录 / 离线使用 / 服务地址设置（翻转卡片 + el-form 校验） */
const emit = defineEmits<{ enter: []; offline: [] }>()

const config = useConfigStore()
const userStore = useUserStore()

const loading = ref(false)
const error = ref('')
const form = reactive({ username: '', password: '', captcha: '', rememberMe: true })
const loginFormRef = ref<FormInstance>()

const loginRules: FormRules = {
  username: [{ required: true, whitespace: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  captcha: [{ required: true, whitespace: true, message: '请输入验证码', trigger: 'blur' }]
}

/* 图形验证码 */
const captchaImg = ref('')
const captchaUuid = ref('')
const captchaLoading = ref(false)

async function refreshCaptcha(): Promise<void> {
  captchaUuid.value = uuid()
  form.captcha = ''
  loginFormRef.value?.clearValidate('captcha')
  captchaLoading.value = true
  try {
    captchaImg.value = await authApi.captcha(captchaUuid.value)
  } catch {
    captchaImg.value = ''
  } finally {
    captchaLoading.value = false
  }
}

/** 是否翻转到「服务器设置」背面 */
const showServer = ref(false)
/** 服务器设置表单 + 校验（带出本地已保存地址） */
const serverForm = reactive({ baseApi: config.baseApi, staticApi: config.staticApi })
const serverFormRef = ref<FormInstance>()

const serverRules: FormRules = {
  baseApi: [{ required: true, whitespace: true, message: '请输入接口地址', trigger: 'blur' }],
  staticApi: [{ required: true, whitespace: true, message: '请输入静态资源地址', trigger: 'blur' }]
}

/** 用本地配置回填服务器设置 */
function syncServerForm(): void {
  serverForm.baseApi = config.baseApi
  serverForm.staticApi = config.staticApi
}

// 本地配置（异步）加载或变更后回填
watch(() => [config.baseApi, config.staticApi], syncServerForm)
// 每次打开服务器设置都回填一次最新值
watch(showServer, (value) => {
  if (value) syncServerForm()
})

const REMEMBER_KEY = 'bpm.remember.username'

onMounted(() => {
  const saved = localStorage.getItem(REMEMBER_KEY)
  if (saved) form.username = saved
  syncServerForm()
  void refreshCaptcha()
})

async function saveServer(): Promise<void> {
  const formEl = serverFormRef.value
  if (!formEl) return
  const valid = await formEl
    .validate()
    .then(() => true)
    .catch(() => false)
  if (!valid) return
  try {
    await config.update({
      baseApi: serverForm.baseApi.trim(),
      staticApi: serverForm.staticApi.trim()
    })
    toast('服务地址已保存', 'success')
    showServer.value = false
    void refreshCaptcha()
  } catch (e) {
    toast((e as Error).message, 'error')
  }
}

async function handleLogin(): Promise<void> {
  error.value = ''
  const formEl = loginFormRef.value
  if (!formEl) return
  const valid = await formEl
    .validate()
    .then(() => true)
    .catch(() => false)
  if (!valid) return
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
  flex: 0 0 36px;
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
  padding: 0 var(--s4) var(--s2);
}

.login__panel {
  width: 272px;
}

/* ── 翻转卡片 ─────────────────────────────── */
.flip {
  perspective: 1400px;
}
.flip__inner {
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.55s cubic-bezier(0.4, 0, 0.2, 1);
}
.flip.is-flipped .flip__inner {
  transform: rotateY(180deg);
}
/* 两面对调可见性时同步切换可点击性，避免背面按钮被正面挡住 */
.flip__face {
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}
.flip__face--front {
  pointer-events: auto;
}
.flip__face--back {
  position: absolute;
  inset: 0;
  transform: rotateY(180deg);
  pointer-events: none;
}
.flip.is-flipped .flip__face--front {
  pointer-events: none;
}
.flip.is-flipped .flip__face--back {
  pointer-events: auto;
}

/* 品牌区（头像居中） */
.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-bottom: var(--s5);
}
.brand--compact {
  margin-bottom: var(--s4);
}
.brand__name {
  font-size: var(--fs-base);
  font-weight: 600;
  letter-spacing: var(--ls-label);
}
.brand__sub {
  font-size: var(--fs-micro);
  color: var(--t3);
  letter-spacing: var(--ls-label);
}

/* 表单项：使用 Element Plus 默认间距（错误提示为绝对定位，默认间距即为预留高度） */

.captcha {
  display: flex;
  gap: var(--s2);
  width: 100%;
}
.captcha :deep(.el-input) {
  flex: 1;
  min-width: 0;
}
.captcha__img {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 88px;
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

.remember {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: var(--fs-sm);
  color: var(--t2);
  cursor: pointer;
}
.remember input {
  width: 14px;
  height: 14px;
  accent-color: var(--accent);
}

.actions {
  display: flex;
  gap: var(--s2);
}
.actions :deep(.ui-btn) {
  flex: 1;
}

/* 服务器返回的表单级错误（小字，位置预留） */
.form-error {
  min-height: 15px;
  font-size: var(--fs-xs);
  line-height: 15px;
  color: var(--danger);
  text-align: center;
}

.links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--s3);
  margin-top: var(--s5);
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
  font-size: var(--fs-sm);
  cursor: pointer;
}
.link:hover {
  text-decoration: underline;
}

.login__foot {
  flex: 0 0 auto;
  padding: var(--s3);
  text-align: center;
  font-size: var(--fs-micro);
  color: var(--t3);
}
</style>
