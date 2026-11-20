import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi, getMe } from '@/api'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))

  const isLoggedIn = computed(() => !!token.value)
  const grade = computed(() => user.value?.grade ?? 1)
  const role = computed(() => user.value?.role ?? 1)
  const isStudent = computed(() => role.value === 1)
  const isAdmin = computed(() => role.value === 2)
  const isParent = computed(() => role.value === 3)
  const displayName = computed(() => user.value?.nickname || user.value?.username || '同学')
  const pointBalance = computed(() => user.value?.point_balance ?? 0)

  function setAuth(newToken, newUser) {
    token.value = newToken
    user.value = newUser
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(newUser))
  }

  async function login(username, password) {
    const data = await loginApi({ username, password })
    setAuth(data.access_token, data.user)
    return data
  }

  async function refresh() {
    if (!token.value) return null
    const data = await getMe()
    user.value = data
    localStorage.setItem('user', JSON.stringify(data))
    return data
  }

  /** 本地更新积分（避免频繁请求 /auth/me） */
  function updatePoints(balance) {
    if (user.value) {
      user.value = { ...user.value, point_balance: balance }
      localStorage.setItem('user', JSON.stringify(user.value))
    }
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  return {
    token,
    user,
    isLoggedIn,
    grade,
    role,
    isStudent,
    isAdmin,
    isParent,
    displayName,
    pointBalance,
    setAuth,
    login,
    refresh,
    updatePoints,
    logout,
  }
})
