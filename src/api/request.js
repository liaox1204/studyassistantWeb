import axios from 'axios'
import { ElMessage } from 'element-plus'

// 统一 axios 实例：自动附加 JWT、统一解包响应格式
const request = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
})

// 请求拦截：注入 Authorization
request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// 响应拦截：code=0 返回 data，其余抛出业务错误
request.interceptors.response.use(
  (response) => {
    const body = response.data
    // 非统一格式（如文件流）直接返回
    if (body == null || typeof body !== 'object' || !('code' in body)) {
      return body
    }
    if (body.code === 0) {
      return body.data
    }
    // 1002 未认证：清除登录态并跳转登录页
    if (body.code === 1002) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (!location.hash.includes('/login')) {
        location.href = '/login'
      }
    }
    ElMessage.error(body.message || '请求失败')
    return Promise.reject(new Error(body.message || '请求失败'))
  },
  (error) => {
    const status = error?.response?.status
    const message = error?.response?.data?.message || error.message || '网络异常'
    if (status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (!location.pathname.includes('/login')) {
        location.href = '/login'
      }
    }
    ElMessage.error(message)
    return Promise.reject(error)
  },
)

export default request
