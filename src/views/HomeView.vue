<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import {
  getSubjects,
  getPracticeRecords,
  getWrongQuestions,
  getBadges,
  getCheckInStatus,
  doCheckIn,
  getDailyTasks,
} from '@/api'

const router = useRouter()
const userStore = useUserStore()

const subjects = ref([])
const records = ref([])
const wrongCount = ref(0)
const loading = ref(false)

// v3.0 激励相关
const badgeCount = ref(0)
const badgeTotal = ref(0)
const checkedIn = ref(false)
const streakDays = ref(0)
const taskDone = ref(0)
const taskTotal = ref(0)
const signing = ref(false)

const modules = [
  {
    path: '/math',
    title: '数学学习',
    desc: '口算练习 · 题库练习 · 即时判分',
    icon: '🧮',
    color: 'linear-gradient(135deg, #4f8cff, #6ba8ff)',
    roles: [1],
  },
  {
    path: '/chinese',
    title: '语文学习',
    desc: '汉字 · 成语 · 古诗',
    icon: '📖',
    color: 'linear-gradient(135deg, #ff9f6b, #ffb020)',
    roles: [1],
  },
  {
    path: '/english',
    title: '英语学习',
    desc: '单词学习 · 听写判分',
    icon: '🔤',
    color: 'linear-gradient(135deg, #43c59e, #6fe0bb)',
    roles: [1],
  },
  {
    path: '/ai',
    title: 'AI 智能老师',
    desc: '解题 · 知识点讲解 · 答疑',
    icon: '🤖',
    color: 'linear-gradient(135deg, #9b7bff, #b9a1ff)',
    roles: [1],
  },
  {
    path: '/wrong',
    title: '错题本',
    desc: '自动收录 · 重练 · 连对毕业',
    icon: '📕',
    color: 'linear-gradient(135deg, #ff6b6b, #ff9a8b)',
    roles: [1],
  },
  // ---- v3.0 新增模块 ----
  {
    path: '/incentive',
    title: '学习激励',
    desc: '签到 · 积分 · 徽章 · 排行榜',
    icon: '🏆',
    color: 'linear-gradient(135deg, #ffb020, #ffd166)',
    roles: [1],
  },
  {
    path: '/analytics',
    title: '学情分析',
    desc: '掌握度 · 学情报告 · 可视化',
    icon: '📊',
    color: 'linear-gradient(135deg, #20b2aa, #5fd3c4)',
    roles: [1],
  },
  {
    path: '/challenge',
    title: '趣味练习',
    desc: '限时挑战 · 关卡闯关 · 每日任务',
    icon: '⏱️',
    color: 'linear-gradient(135deg, #ff7b54, #ffa07a)',
    roles: [1],
  },
  {
    path: '/parent',
    title: '孩子学情',
    desc: '查看孩子的学情报告',
    icon: '👨‍👩‍👧',
    color: 'linear-gradient(135deg, #4f8cff, #9b7bff)',
    roles: [3],
  },
  {
    path: '/admin',
    title: '内容管理',
    desc: '题库 · 内容库 · 用户 · 配置',
    icon: '⚙️',
    color: 'linear-gradient(135deg, #5b6480, #8b95b0)',
    roles: [2],
  },
]

const visibleModules = computed(() =>
  modules.filter((m) => m.roles.includes(userStore.role))
)

const subjectName = computed(() => {
  const map = {}
  subjects.value.forEach((s) => (map[s.id] = s.name))
  return map
})

const avgAccuracy = computed(() => {
  if (!records.value.length) return 0
  const sum = records.value.reduce((acc, r) => acc + (r.accuracy || 0), 0)
  return (sum / records.value.length).toFixed(1)
})

const totalCorrect = computed(() =>
  records.value.reduce((acc, r) => acc + (r.correct_count || 0), 0),
)

async function loadData() {
  loading.value = true
  try {
    const [subjectList, recordPage, wrongPage] = await Promise.all([
      getSubjects(),
      getPracticeRecords({ page: 1, page_size: 5 }),
      getWrongQuestions({ page: 1, page_size: 1 }),
    ])
    subjects.value = subjectList || []
    records.value = recordPage?.items || []
    wrongCount.value = wrongPage?.total || 0

    // v3.0 激励数据（仅学生对接口可用）
    if (userStore.isStudent) {
      try {
        const [badgeList, status, taskList] = await Promise.all([
          getBadges(),
          getCheckInStatus(),
          getDailyTasks(),
        ])
        badgeTotal.value = badgeList?.length || 0
        badgeCount.value = (badgeList || []).filter((b) => b.earned).length
        checkedIn.value = !!status?.checked_in_today
        streakDays.value = status?.streak_days || 0
        if (status) userStore.updatePoints(status.point_balance)
        taskTotal.value = taskList?.length || 0
        taskDone.value = (taskList || []).filter((t) => t.completed).length
      } catch {
        // 忽略激励数据失败，不影响首页主体
      }
    }
  } catch {
    // 拦截器已提示
  } finally {
    loading.value = false
  }
}

async function quickCheckIn() {
  signing.value = true
  try {
    const data = await doCheckIn()
    checkedIn.value = true
    streakDays.value = data.streak_days
    userStore.updatePoints(data.point_balance)
    ElMessage.success(`签到成功！连续 ${data.streak_days} 天，+${data.point_earned} 积分`)
    if (data.unlocked_badges?.length) {
      data.unlocked_badges.forEach((b) => ElMessage.success(`🎉 解锁新徽章：${b.name}`))
    }
  } catch {
    // 拦截器已提示
  } finally {
    signing.value = false
  }
}

function formatTime(value) {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 16)
}

onMounted(loadData)
</script>

<template>
  <div class="page-wrap" v-loading="loading">
    <!-- 欢迎横幅 -->
    <div class="welcome-banner">
      <div class="welcome-text">
        <h2>
          你好，{{ userStore.displayName }}
          {{ userStore.isStudent ? ' 同学' : '' }}！👋
        </h2>
        <p v-if="userStore.isStudent">
          今天也来一起学习吧，坚持练习就会越来越棒～
        </p>
        <p v-else-if="userStore.isParent">
          在这里可以只读查看孩子的学情报告与知识点掌握情况。
        </p>
        <p v-else>管理题库与学习内容，所有变更都会记录操作日志。</p>
        <div class="banner-actions">
          <template v-if="userStore.isStudent">
            <el-button type="primary" size="large" round @click="router.push('/math')">
              <el-icon><Coin /></el-icon> 开始口算练习
            </el-button>
            <el-button size="large" round @click="router.push('/ai')">
              <el-icon><MagicStick /></el-icon> 问 AI 老师
            </el-button>
          </template>
          <template v-else-if="userStore.isParent">
            <el-button type="primary" size="large" round @click="router.push('/parent')">
              <el-icon><DataLine /></el-icon> 查看孩子学情
            </el-button>
          </template>
          <template v-else>
            <el-button type="primary" size="large" round @click="router.push('/admin')">
              <el-icon><Setting /></el-icon> 进入内容管理
            </el-button>
          </template>
        </div>
      </div>
      <div class="welcome-emoji">{{ userStore.isStudent ? '📚' : userStore.isParent ? '👨‍👩‍👧' : '⚙️' }}</div>
    </div>

    <!-- 学习概览（仅学生） -->
    <template v-if="userStore.isStudent">
      <div class="result-grid overview">
        <div class="stat-block">
          <div class="num">{{ userStore.pointBalance }}</div>
          <div class="label">我的积分</div>
        </div>
        <div class="stat-block">
          <div class="num">{{ streakDays }}</div>
          <div class="label">连续签到天数</div>
        </div>
        <div class="stat-block">
          <div class="num">{{ badgeCount }} / {{ badgeTotal }}</div>
          <div class="label">已获徽章</div>
        </div>
        <div class="stat-block">
          <div class="num">{{ taskDone }} / {{ taskTotal }}</div>
          <div class="label">今日任务</div>
        </div>
      </div>

      <!-- 签到提示 -->
      <div class="soft-card checkin-bar">
        <div class="checkin-left">
          <span class="checkin-icon">{{ checkedIn ? '✅' : '📅' }}</span>
          <div>
            <div class="checkin-title">
              {{ checkedIn ? '今天已签到，真棒！' : '今天还没签到哦' }}
            </div>
            <div class="checkin-sub">
              连续签到 {{ streakDays }} 天 · 连签 7 天有额外奖励
            </div>
          </div>
        </div>
        <el-button
          v-if="!checkedIn"
          type="primary"
          round
          :loading="signing"
          @click="quickCheckIn"
        >
          立即签到
        </el-button>
        <el-button v-else round @click="router.push('/incentive')">查看激励</el-button>
      </div>

      <div class="result-grid overview">
        <div class="stat-block">
          <div class="num">{{ records.length }}</div>
          <div class="label">最近练习次数</div>
        </div>
        <div class="stat-block">
          <div class="num">{{ avgAccuracy }}%</div>
          <div class="label">平均正确率</div>
        </div>
        <div class="stat-block">
          <div class="num">{{ totalCorrect }}</div>
          <div class="label">累计答对题数</div>
        </div>
        <div class="stat-block" :class="{ danger: wrongCount > 0 }">
          <div class="num">{{ wrongCount }}</div>
          <div class="label">错题本待复习</div>
        </div>
      </div>
    </template>

    <!-- 功能模块 -->
    <h3 class="section-title">功能模块</h3>
    <div class="module-grid">
      <div
        v-for="m in visibleModules"
        :key="m.path"
        class="module-card"
        :style="{ background: m.color }"
        @click="router.push(m.path)"
      >
        <div class="module-icon">{{ m.icon }}</div>
        <div class="module-info">
          <div class="module-title">{{ m.title }}</div>
          <div class="module-desc">{{ m.desc }}</div>
        </div>
        <el-icon class="module-arrow"><ArrowRight /></el-icon>
      </div>
    </div>

    <!-- 最近练习记录（仅学生） -->
    <template v-if="userStore.isStudent">
      <h3 class="section-title" style="margin-top: 26px">最近练习</h3>
      <div class="soft-card">
        <el-empty v-if="!records.length" description="还没有练习记录，去做一次口算练习吧！" />
        <el-table v-else :data="records" stripe style="width: 100%">
          <el-table-column label="学科" width="100">
            <template #default="{ row }">
              <el-tag effect="light">{{ subjectName[row.subject_id] || '数学' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="mode" label="模式" width="120" />
          <el-table-column label="成绩" width="150">
            <template #default="{ row }">
              <span class="score">{{ row.correct_count }} / {{ row.total_count }}</span>
            </template>
          </el-table-column>
          <el-table-column label="正确率" width="170">
            <template #default="{ row }">
              <el-progress
                :percentage="Number(row.accuracy) || 0"
                :color="Number(row.accuracy) >= 80 ? '#43c59e' : '#ffb020'"
                :stroke-width="10"
              />
            </template>
          </el-table-column>
          <el-table-column label="用时" width="100">
            <template #default="{ row }">{{ row.duration }} 秒</template>
          </el-table-column>
          <el-table-column label="时间">
            <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
          </el-table-column>
        </el-table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.welcome-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-radius: 22px;
  padding: 28px 32px;
  background: linear-gradient(135deg, #4f8cff 0%, #9b7bff 100%);
  color: #fff;
  box-shadow: 0 14px 34px rgba(79, 140, 255, 0.28);
  overflow: hidden;
}

/* v3.0 签到栏 */
.checkin-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 16px 0;
  padding: 16px 22px;
  flex-wrap: wrap;
}

.checkin-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.checkin-icon {
  font-size: 28px;
}

.checkin-title {
  font-size: 15.5px;
  font-weight: 800;
  color: var(--text-main);
}

.checkin-sub {
  font-size: 12.5px;
  color: var(--text-sub);
  margin-top: 2px;
}

.welcome-text h2 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 800;
}

.welcome-text p {
  margin: 0 0 18px;
  font-size: 14.5px;
  opacity: 0.92;
}

.banner-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.banner-actions :deep(.el-button--primary) {
  background: #fff;
  color: var(--brand-primary);
  border: none;
  font-weight: 700;
}

.welcome-emoji {
  font-size: 76px;
  line-height: 1;
  opacity: 0.9;
}

.overview {
  margin-top: 20px;
}

.overview .stat-block {
  background: #fff;
  box-shadow: var(--shadow-card);
}

.overview .stat-block.danger .num {
  color: var(--brand-danger);
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.module-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px;
  border-radius: 18px;
  color: #fff;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 8px 22px rgba(79, 140, 255, 0.18);
}

.module-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 14px 32px rgba(79, 140, 255, 0.28);
}

.module-icon {
  font-size: 32px;
  background: rgba(255, 255, 255, 0.22);
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.module-info {
  flex: 1;
  min-width: 0;
}

.module-title {
  font-size: 17px;
  font-weight: 800;
}

.module-desc {
  font-size: 13px;
  opacity: 0.9;
  margin-top: 3px;
}

.module-arrow {
  font-size: 18px;
  opacity: 0.85;
}

.score {
  font-weight: 700;
  color: var(--brand-primary);
}

@media (max-width: 700px) {
  .welcome-emoji {
    display: none;
  }
}
</style>
