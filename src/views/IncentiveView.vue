<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import {
  getCheckInStatus,
  doCheckIn,
  getPoints,
  getBadges,
  getLeaderboard,
} from '@/api'

const userStore = useUserStore()

const activeTab = ref('checkin')
const loading = ref(false)

// 签到
const checkStatus = ref({
  checked_in_today: false,
  streak_days: 0,
  total_days: 0,
  point_balance: 0,
  total_points: 0,
  sign_in_points: 5,
  streak_7_bonus: 10,
})
const signing = ref(false)

// 徽章
const badges = ref([])

// 积分明细
const points = ref([])
const pointTotal = ref(0)
const pointPage = ref(1)

// 排行榜
const leaderboard = ref([])
const leaderGrade = ref(userStore.grade || 1)

const earnedBadgeCount = computed(() => badges.value.filter((b) => b.earned).length)
const weekDots = computed(() => {
  // 展示连续签到进度（7 天为一轮）
  const streak = checkStatus.value.streak_days || 0
  const inCycle = streak % 7 === 0 && streak > 0 ? 7 : streak % 7
  return Array.from({ length: 7 }, (_, i) => i < inCycle)
})

const sourceLabels = {
  sign_in: '每日签到',
  sign_in_bonus: '连续签到奖励',
  practice: '练习答对',
  practice_bonus: '正确率奖励',
  wrong_graduation: '错题毕业',
  task: '每日任务',
  challenge: '限时挑战',
  badge: '徽章奖励',
}

async function loadStatus() {
  try {
    checkStatus.value = await getCheckInStatus()
    userStore.updatePoints(checkStatus.value.point_balance)
  } catch {
    // 拦截器已提示
  }
}

async function handleCheckIn() {
  if (checkStatus.value.checked_in_today) {
    ElMessage.info('今天已经签到过啦，明天再来～')
    return
  }
  signing.value = true
  try {
    const data = await doCheckIn()
    ElMessage.success(
      `签到成功！连续 ${data.streak_days} 天，获得 ${data.point_earned} 积分` +
        (data.bonus ? `（含 ${data.bonus} 连签奖励）` : '')
    )
    if (data.unlocked_badges?.length) {
      data.unlocked_badges.forEach((b) => {
        ElMessage.success(`🎉 解锁新徽章：${b.name}`)
      })
    }
    await Promise.all([loadStatus(), loadBadges(), loadPoints()])
  } catch {
    // 拦截器已提示
  } finally {
    signing.value = false
  }
}

async function loadBadges() {
  try {
    badges.value = (await getBadges()) || []
  } catch {
    badges.value = []
  }
}

async function loadPoints() {
  try {
    const data = await getPoints({ page: pointPage.value, page_size: 20 })
    points.value = data.items || []
    pointTotal.value = data.total || 0
  } catch {
    points.value = []
  }
}

async function loadLeaderboard() {
  loading.value = true
  try {
    const data = await getLeaderboard({ grade: leaderGrade.value, limit: 20 })
    leaderboard.value = data.items || []
  } catch {
    leaderboard.value = []
  } finally {
    loading.value = false
  }
}

function formatTime(v) {
  return v ? v.replace('T', ' ').slice(0, 16) : '-'
}

onMounted(async () => {
  await Promise.all([loadStatus(), loadBadges(), loadPoints()])
  loadLeaderboard()
})
</script>

<template>
  <div class="page-wrap">
    <h2 class="page-title">🏆 学习激励</h2>
    <p class="page-sub">签到、积分、徽章和排行榜，让每一次坚持都有收获。</p>

    <!-- 顶部数据卡 -->
    <div class="hero-row">
      <div class="hero-card balance-card">
        <div class="hero-label">当前积分</div>
        <div class="hero-value">{{ userStore.pointBalance }} <span class="unit">分</span></div>
        <div class="hero-sub">累计获得 {{ userStore.user?.total_points ?? 0 }} 分</div>
      </div>
      <div class="hero-card streak-card">
        <div class="hero-label">连续签到</div>
        <div class="hero-value">{{ checkStatus.streak_days }} <span class="unit">天</span></div>
        <div class="week-dots">
          <span
            v-for="(on, i) in weekDots"
            :key="i"
            class="dot"
            :class="{ on }"
          >{{ i + 1 }}</span>
        </div>
      </div>
      <div class="hero-card badge-card">
        <div class="hero-label">已获徽章</div>
        <div class="hero-value">{{ earnedBadgeCount }} <span class="unit">/ {{ badges.length }}</span></div>
        <div class="hero-sub">连续签到 7 天可得额外奖励</div>
      </div>
      <div class="hero-card action-card">
        <el-button
          type="primary"
          size="large"
          round
          class="signin-btn"
          :loading="signing"
          :disabled="checkStatus.checked_in_today"
          @click="handleCheckIn"
        >
          <el-icon><Calendar /></el-icon>
          {{ checkStatus.checked_in_today ? '今日已签到' : '立即签到' }}
        </el-button>
        <div class="hero-sub">签到 +{{ checkStatus.sign_in_points }} 分 / 连签 7 天 +{{ checkStatus.streak_7_bonus }} 分</div>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="inc-tabs">
      <!-- 徽章 -->
      <el-tab-pane label="我的徽章" name="checkin">
        <div class="soft-card">
          <el-empty v-if="!badges.length" description="暂无徽章配置" />
          <div v-else class="badge-grid">
            <div
              v-for="b in badges"
              :key="b.id"
              class="badge-item"
              :class="{ locked: !b.earned }"
            >
              <div class="badge-icon">{{ b.earned ? b.icon || '🏅' : '🔒' }}</div>
              <div class="badge-name">{{ b.name }}</div>
              <div class="badge-desc">{{ b.description }}</div>
              <el-tag v-if="b.earned" type="success" effect="light" size="small" round>
                已获得 · {{ formatTime(b.earned_at) }}
              </el-tag>
              <el-tag v-else type="info" effect="plain" size="small" round>
                奖励 {{ b.points }} 积分
              </el-tag>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 积分明细 -->
      <el-tab-pane label="积分明细" name="points">
        <div class="soft-card">
          <el-empty v-if="!points.length" description="还没有积分记录，去签到或练习吧！" />
          <el-table v-else :data="points" stripe>
            <el-table-column label="来源" width="150">
              <template #default="{ row }">
                <el-tag effect="light">{{ sourceLabels[row.source] || row.source }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="remark" label="说明" />
            <el-table-column label="积分" width="110">
              <template #default="{ row }">
                <span :class="row.points >= 0 ? 'plus' : 'minus'">
                  {{ row.points >= 0 ? '+' : '' }}{{ row.points }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="余额" width="100">
              <template #default="{ row }">{{ row.balance }}</template>
            </el-table-column>
            <el-table-column label="时间" width="160">
              <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-if="pointTotal > 20"
            v-model:current-page="pointPage"
            :page-size="20"
            :total="pointTotal"
            layout="prev, pager, next"
            style="margin-top: 14px; justify-content: center"
            @current-change="loadPoints"
          />
        </div>
      </el-tab-pane>

      <!-- 排行榜 -->
      <el-tab-pane label="排行榜" name="leaderboard">
        <div class="soft-card" v-loading="loading">
          <div class="lb-head">
            <span class="lb-title">同年级积分榜</span>
            <el-radio-group v-model="leaderGrade" size="small" @change="loadLeaderboard">
              <el-radio-button :value="1">一年级</el-radio-button>
              <el-radio-button :value="2">二年级</el-radio-button>
              <el-radio-button :value="3">三年级</el-radio-button>
            </el-radio-group>
          </div>

          <el-empty v-if="!leaderboard.length" description="该年级暂无上榜同学" />
          <div v-else class="lb-list">
            <div
              v-for="item in leaderboard"
              :key="item.rank"
              class="lb-row"
              :class="`rank-${item.rank}`"
            >
              <span class="lb-rank">
                <template v-if="item.rank === 1">🥇</template>
                <template v-else-if="item.rank === 2">🥈</template>
                <template v-else-if="item.rank === 3">🥉</template>
                <template v-else>{{ item.rank }}</template>
              </span>
              <span class="lb-name">{{ item.nickname }}</span>
              <span class="lb-grade">{{ item.grade }} 年级</span>
              <span class="lb-points">{{ item.total_points }} 分</span>
            </div>
          </div>
          <div class="lb-tip">排行榜仅展示昵称、年级与积分，保护同学隐私～</div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.hero-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.hero-card {
  border-radius: 18px;
  padding: 18px 20px;
  box-shadow: var(--shadow-card);
  background: #fff;
}

.balance-card {
  background: linear-gradient(135deg, #fff4d6, #ffe6b8);
}

.streak-card {
  background: linear-gradient(135deg, #eaf1ff, #dbe8ff);
}

.badge-card {
  background: linear-gradient(135deg, #f3ecff, #e8dcff);
}

.action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.hero-label {
  font-size: 13px;
  color: var(--text-sub);
  font-weight: 600;
}

.hero-value {
  font-size: 30px;
  font-weight: 800;
  color: var(--text-main);
  line-height: 1.3;
}

.hero-value .unit {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-sub);
}

.hero-sub {
  font-size: 12.5px;
  color: var(--text-sub);
}

.signin-btn {
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-purple));
  border: none;
  font-weight: 700;
  padding: 0 26px;
}

.week-dots {
  display: flex;
  gap: 5px;
  margin-top: 8px;
}

.dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  color: var(--text-sub);
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dot.on {
  background: var(--brand-primary);
  color: #fff;
}

.inc-tabs :deep(.el-tabs__item) {
  font-size: 15px;
  font-weight: 700;
}

/* 徽章 */
.badge-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.badge-item {
  border-radius: 16px;
  padding: 20px 16px;
  text-align: center;
  background: linear-gradient(160deg, #fffdf5, #fff6e0);
  border: 1px solid rgba(255, 176, 32, 0.32);
  transition: transform 0.18s ease;
}

.badge-item:hover {
  transform: translateY(-3px);
}

.badge-item.locked {
  background: #f7f8fc;
  border-color: rgba(123, 132, 156, 0.18);
  opacity: 0.78;
}

.badge-icon {
  font-size: 40px;
  line-height: 1.2;
}

.badge-name {
  font-size: 16px;
  font-weight: 800;
  margin: 6px 0 4px;
}

.badge-desc {
  font-size: 12.5px;
  color: var(--text-sub);
  min-height: 34px;
  margin-bottom: 8px;
  line-height: 1.5;
}

/* 积分明细 */
.plus {
  color: var(--brand-success);
  font-weight: 800;
}

.minus {
  color: var(--brand-danger);
  font-weight: 800;
}

/* 排行榜 */
.lb-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 10px;
}

.lb-title {
  font-size: 16px;
  font-weight: 800;
}

.lb-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lb-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  background: #f8faff;
}

.lb-row.rank-1 {
  background: linear-gradient(135deg, #fff4d6, #ffe9b8);
}

.lb-row.rank-2 {
  background: linear-gradient(135deg, #f2f4f8, #e6eaf2);
}

.lb-row.rank-3 {
  background: linear-gradient(135deg, #fdf1e6, #f8e3ce);
}

.lb-rank {
  width: 30px;
  font-size: 17px;
  font-weight: 800;
  text-align: center;
  flex-shrink: 0;
}

.lb-name {
  flex: 1;
  font-weight: 700;
}

.lb-grade {
  font-size: 12.5px;
  color: var(--text-sub);
}

.lb-points {
  font-weight: 800;
  color: var(--brand-primary);
  min-width: 70px;
  text-align: right;
}

.lb-tip {
  margin-top: 14px;
  font-size: 12px;
  color: #a4acc4;
  text-align: center;
}
</style>
