<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { register } from '@/api'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const activeTab = ref('login')
const loading = ref(false)
const loginFormRef = ref()
const registerFormRef = ref()

const loginForm = reactive({ username: '', password: '' })
const registerForm = reactive({
  username: '',
  password: '',
  confirm: '',
  nickname: '',
  grade: 1,
  role: 1,
})

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 50, message: '长度为 3-50 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 64, message: '长度为 6-64 个字符', trigger: 'blur' },
  ],
}

const registerRules = {
  ...rules,
  confirm: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== registerForm.password) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
}

async function handleLogin() {
  if (!loginFormRef.value) return
  try {
    await loginFormRef.value.validate()
  } catch {
    return
  }
  loading.value = true
  try {
    await userStore.login(loginForm.username, loginForm.password)
    ElMessage.success('登录成功，开始学习吧！')
    const redirect = route.query.redirect || '/'
    router.replace(redirect)
  } catch {
    // 错误提示已由拦截器处理
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  if (!registerFormRef.value) return
  try {
    await registerFormRef.value.validate()
  } catch {
    return
  }
  loading.value = true
  try {
    await register({
      username: registerForm.username,
      password: registerForm.password,
      nickname: registerForm.nickname || registerForm.username,
      grade: registerForm.role === 1 ? registerForm.grade : undefined,
      role: registerForm.role,
    })
    ElMessage.success('注册成功，请登录')
    loginForm.username = registerForm.username
    loginForm.password = ''
    activeTab.value = 'login'
  } catch {
    // 错误提示已由拦截器处理
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <!-- 左侧介绍 -->
    <div class="intro">
      <div class="intro-inner">
        <div class="logo-row">
          <span class="logo-emoji">🎓</span>
          <h1>AI 小学学习助手</h1>
        </div>
        <p class="slogan">让 1–3 年级的语文、数学、英语学习更有趣</p>
        <ul class="feature-list">
          <li><span class="feat-icon">🧮</span> 口算练习，即时判分，错题自动收录</li>
          <li><span class="feat-icon">📖</span> 汉字 · 成语 · 古诗，一页掌握</li>
          <li><span class="feat-icon">🔤</span> 英语单词听写，自动判分</li>
          <li><span class="feat-icon">🤖</span> AI 智能老师，分步解题、通俗讲解</li>
          <li><span class="feat-icon">📕</span> 错题本，连续答对 3 次自动毕业</li>
        </ul>
      </div>
    </div>

    <!-- 右侧表单 -->
    <div class="form-side">
      <div class="form-card">
        <el-tabs v-model="activeTab" class="auth-tabs">
          <el-tab-pane label="登录" name="login">
            <el-form
              ref="loginFormRef"
              :model="loginForm"
              :rules="rules"
              size="large"
              label-position="top"
              @keyup.enter="handleLogin"
            >
              <el-form-item label="用户名" prop="username">
                <el-input
                  v-model="loginForm.username"
                  placeholder="请输入用户名"
                  :prefix-icon="'User'"
                  clearable
                />
              </el-form-item>
              <el-form-item label="密码" prop="password">
                <el-input
                  v-model="loginForm.password"
                  type="password"
                  placeholder="请输入密码"
                  :prefix-icon="'Lock'"
                  show-password
                />
              </el-form-item>
              <el-button
                type="primary"
                class="submit-btn"
                :loading="loading"
                @click="handleLogin"
              >
                开始学习
              </el-button>
            </el-form>
            <div class="tip-line">
              演示账号：student / 123456
            </div>
          </el-tab-pane>

          <el-tab-pane label="注册" name="register">
            <el-form
              ref="registerFormRef"
              :model="registerForm"
              :rules="registerRules"
              size="large"
              label-position="top"
            >
              <el-form-item label="用户名" prop="username">
                <el-input v-model="registerForm.username" placeholder="3-50 个字符" clearable />
              </el-form-item>
              <el-form-item label="密码" prop="password">
                <el-input
                  v-model="registerForm.password"
                  type="password"
                  placeholder="至少 6 位"
                  show-password
                />
              </el-form-item>
              <el-form-item label="确认密码" prop="confirm">
                <el-input
                  v-model="registerForm.confirm"
                  type="password"
                  placeholder="再次输入密码"
                  show-password
                />
              </el-form-item>
              <el-form-item label="注册身份">
                <el-radio-group v-model="registerForm.role">
                  <el-radio-button :value="1">我是学生</el-radio-button>
                  <el-radio-button :value="3">我是家长</el-radio-button>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="昵称">
                <el-input v-model="registerForm.nickname" placeholder="选填，例如：小明" clearable />
              </el-form-item>
              <el-form-item v-if="registerForm.role === 1" label="年级">
                <el-radio-group v-model="registerForm.grade">
                  <el-radio-button :value="1">一年级</el-radio-button>
                  <el-radio-button :value="2">二年级</el-radio-button>
                  <el-radio-button :value="3">三年级</el-radio-button>
                </el-radio-group>
              </el-form-item>
              <el-alert
                v-else
                type="info"
                :closable="false"
                show-icon
                title="家长账号注册后，需在「孩子学情」页绑定孩子账号才能查看学情。"
                style="margin-bottom: 14px"
              />
              <el-button
                type="primary"
                class="submit-btn"
                :loading="loading"
                @click="handleRegister"
              >
                注册账号
              </el-button>
            </el-form>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  background: linear-gradient(135deg, #eaf1ff 0%, #f6f0ff 50%, #eafaf5 100%);
}

.intro {
  flex: 1.1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.intro-inner {
  max-width: 460px;
}

.logo-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-emoji {
  font-size: 44px;
}

.logo-row h1 {
  font-size: 30px;
  font-weight: 800;
  margin: 0;
  background: linear-gradient(90deg, var(--brand-primary), var(--brand-purple));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.slogan {
  font-size: 15px;
  color: var(--text-sub);
  margin: 12px 0 28px;
}

.feature-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.feature-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.72);
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 14.5px;
  color: var(--text-main);
  box-shadow: 0 3px 12px rgba(79, 140, 255, 0.08);
}

.feat-icon {
  font-size: 20px;
}

.form-side {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.form-card {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 22px;
  padding: 30px 32px 26px;
  box-shadow: 0 18px 50px rgba(79, 140, 255, 0.18);
}

.auth-tabs :deep(.el-tabs__item) {
  font-size: 16px;
  font-weight: 700;
}

.submit-btn {
  width: 100%;
  height: 44px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
  margin-top: 6px;
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-purple));
  border: none;
}

.tip-line {
  margin-top: 14px;
  text-align: center;
  font-size: 12.5px;
  color: var(--text-sub);
}

@media (max-width: 860px) {
  .login-page {
    flex-direction: column;
  }
  .intro {
    padding: 28px 24px 0;
    flex: none;
  }
  .feature-list {
    display: none;
  }
  .slogan {
    margin-bottom: 16px;
  }
  .form-side {
    padding: 20px 16px 40px;
    flex: 1;
  }
}
</style>
