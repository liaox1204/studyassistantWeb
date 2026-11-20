<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const allMenus = [
  { name: 'home', path: '/', label: '首页', icon: 'HomeFilled', roles: [1, 2, 3] },
  { name: 'math', path: '/math', label: '数学学习', icon: 'Coin', roles: [1] },
  { name: 'chinese', path: '/chinese', label: '语文学习', icon: 'Reading', roles: [1] },
  { name: 'english', path: '/english', label: '英语学习', icon: 'ChatDotRound', roles: [1] },
  { name: 'ai', path: '/ai', label: 'AI 智能老师', icon: 'MagicStick', roles: [1] },
  { name: 'wrong', path: '/wrong', label: '错题本', icon: 'Notebook', roles: [1] },
  // v3.0 新增
  { name: 'incentive', path: '/incentive', label: '学习激励', icon: 'Trophy', roles: [1] },
  { name: 'analytics', path: '/analytics', label: '学情分析', icon: 'DataLine', roles: [1] },
  { name: 'challenge', path: '/challenge', label: '趣味练习', icon: 'Timer', roles: [1] },
  { name: 'parent', path: '/parent', label: '孩子学情', icon: 'User', roles: [3] },
  { name: 'admin', path: '/admin', label: '内容管理', icon: 'Setting', roles: [2] },
]

// 按当前用户角色过滤菜单
const menus = computed(() => {
  const r = userStore.role
  return allMenus.filter((m) => m.roles.includes(r))
})

const activeMenu = computed(() => {
  const matched = allMenus.find((m) => m.name === route.name)
  return matched ? matched.path : '/'
})

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning',
    })
    userStore.logout()
    router.push('/login')
  } catch {
    // 用户取消
  }
}
</script>

<template>
  <el-container class="app-shell">
    <!-- 顶部导航 -->
    <el-header class="app-header">
      <div class="header-inner">
        <div class="brand" @click="router.push('/')">
          <span class="brand-logo">🎓</span>
          <span class="brand-text">AI 小学学习助手</span>
        </div>

        <el-menu
          :default-active="activeMenu"
          mode="horizontal"
          :ellipsis="false"
          router
          class="header-menu"
        >
          <el-menu-item v-for="m in menus" :key="m.path" :index="m.path">
            <el-icon><component :is="m.icon" /></el-icon>
            <span>{{ m.label }}</span>
          </el-menu-item>
        </el-menu>

        <div class="header-right">
          <!-- v3.0：积分余额入口 -->
          <el-tooltip v-if="userStore.isStudent" content="我的积分" placement="bottom">
            <span class="point-chip" @click="router.push('/incentive')">
              💎 {{ userStore.pointBalance }}
            </span>
          </el-tooltip>
          <el-tag v-if="userStore.isStudent && userStore.user?.grade" type="success" effect="light" round>
            {{ userStore.grade }} 年级
          </el-tag>
          <el-tag v-else-if="userStore.isParent" type="warning" effect="light" round>
            家长
          </el-tag>
          <el-tag v-else-if="userStore.isAdmin" type="danger" effect="light" round>
            管理员
          </el-tag>
          <el-dropdown trigger="click">
            <span class="user-chip">
              <el-avatar :size="28" class="avatar">{{ userStore.displayName.charAt(0) }}</el-avatar>
              <span class="user-name">{{ userStore.displayName }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>
                  用户：{{ userStore.user?.username }}
                </el-dropdown-item>
                <el-dropdown-item v-if="userStore.isStudent" disabled>
                  年级：{{ userStore.user?.grade ?? '-' }} 年级
                </el-dropdown-item>
                <el-dropdown-item v-if="userStore.isStudent" disabled>
                  积分：{{ userStore.pointBalance }} / 累计 {{ userStore.user?.total_points ?? 0 }}
                </el-dropdown-item>
                <el-dropdown-item divided @click="handleLogout">
                  <el-icon><SwitchButton /></el-icon> 退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </el-header>

    <!-- 内容区 -->
    <el-main class="app-main">
      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </el-main>
  </el-container>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
}

.app-header {
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  box-shadow: 0 2px 16px rgba(79, 140, 255, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
  padding: 0;
  height: 62px;
}

.header-inner {
  max-width: 1180px;
  margin: 0 auto;
  height: 62px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 12px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  flex-shrink: 0;
}

.brand-logo {
  font-size: 24px;
}

.brand-text {
  font-size: 17px;
  font-weight: 800;
  background: linear-gradient(90deg, var(--brand-primary), var(--brand-purple));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  white-space: nowrap;
}

.header-menu {
  flex: 1;
  border-bottom: none !important;
  background: transparent;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  flex-wrap: nowrap;
}

.header-menu :deep(.el-menu-item) {
  font-size: 13.5px;
  font-weight: 600;
  border-radius: 10px;
  height: 40px;
  margin: 11px 1px;
  padding: 0 10px;
  white-space: nowrap;
}

.header-menu :deep(.el-menu-item.is-active) {
  background: linear-gradient(135deg, rgba(79, 140, 255, 0.12), rgba(155, 123, 255, 0.12));
  color: var(--brand-primary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

/* v3.0 积分角标 */
.point-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: 999px;
  background: linear-gradient(135deg, #fff4d6, #ffe6b8);
  color: #b47600;
  font-size: 13.5px;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease;
  white-space: nowrap;
}

.point-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 176, 32, 0.32);
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 999px;
  transition: background 0.18s;
  outline: none;
}

.user-chip:hover {
  background: rgba(79, 140, 255, 0.08);
}

.avatar {
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-purple));
  font-weight: 700;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-main {
  padding: 22px 16px;
  background: transparent;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.fade-leave-to {
  opacity: 0;
}

@media (max-width: 900px) {
  .brand-text {
    display: none;
  }
  .header-menu :deep(.el-menu-item) {
    padding: 0 9px;
    font-size: 13px;
  }
}
</style>
