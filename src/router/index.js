import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, title: '登录' },
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/views/HomeView.vue'),
        meta: { title: '首页' },
      },
      // ---- v2.0 基础模块 ----
      {
        path: 'math',
        name: 'math',
        component: () => import('@/views/MathView.vue'),
        meta: { title: '数学学习', roles: [1] },
      },
      {
        path: 'chinese',
        name: 'chinese',
        component: () => import('@/views/ChineseView.vue'),
        meta: { title: '语文学习', roles: [1] },
      },
      {
        path: 'english',
        name: 'english',
        component: () => import('@/views/EnglishView.vue'),
        meta: { title: '英语学习', roles: [1] },
      },
      {
        path: 'ai',
        name: 'ai',
        component: () => import('@/views/AiView.vue'),
        meta: { title: 'AI 智能老师', roles: [1] },
      },
      {
        path: 'wrong',
        name: 'wrong',
        component: () => import('@/views/WrongView.vue'),
        meta: { title: '错题本', roles: [1] },
      },
      // ---- v3.0 新增模块 ----
      {
        path: 'incentive',
        name: 'incentive',
        component: () => import('@/views/IncentiveView.vue'),
        meta: { title: '学习激励', roles: [1] },
      },
      {
        path: 'analytics',
        name: 'analytics',
        component: () => import('@/views/AnalyticsView.vue'),
        meta: { title: '学情分析', roles: [1] },
      },
      {
        path: 'challenge',
        name: 'challenge',
        component: () => import('@/views/ChallengeView.vue'),
        meta: { title: '趣味练习', roles: [1] },
      },
      {
        path: 'parent',
        name: 'parent',
        component: () => import('@/views/ParentView.vue'),
        meta: { title: '孩子学情', roles: [3] },
      },
      {
        path: 'admin',
        name: 'admin',
        component: () => import('@/views/AdminView.vue'),
        meta: { title: '内容管理', roles: [2] },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// 全局前置守卫：未登录跳登录页；角色不匹配跳首页
router.beforeEach((to) => {
  const token = localStorage.getItem('token')
  if (!to.meta.public && !token) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.public && token) {
    return { name: 'home' }
  }

  // 角色校验（roles 未声明则不限制）
  const roles = to.meta.roles
  if (roles && token) {
    let user = null
    try {
      user = JSON.parse(localStorage.getItem('user') || 'null')
    } catch {
      user = null
    }
    if (user && !roles.includes(user.role)) {
      return { name: 'home' }
    }
  }
  return true
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · AI 小学学习助手` : 'AI 小学学习助手'
})

export default router
