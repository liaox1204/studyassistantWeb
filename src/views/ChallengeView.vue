<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import {
  getSubjects,
  getOralQuestions,
  submitChallenge,
  getLevels,
  getLevelQuestions,
  getDailyTasks,
  claimTask,
  submitPractice,
  checkLevelAnswer,
} from '@/api'

const userStore = useUserStore()

const activeTab = ref('timed')
const grade = ref(userStore.grade || 1)
const mathSubjectId = ref(1)

// ================= 限时挑战 =================
const TIME_LIMIT = 60
const challengeState = ref('idle') // idle | doing | done
const timeLeft = ref(TIME_LIMIT)
const questions = ref([])
const answers = reactive([])
const currentIndex = ref(0)
const correctCount = ref(0)
const wrongCount = ref(0)
const challengeResult = ref(null)
const timer = ref(null)
const submitting = ref(false)

// ================= 闯关 =================
const levelState = ref('idle') // idle | selecting | doing | done
const levels = ref([])
const levelSubject = ref(null)
const currentLevelData = ref(null)
const levelAnswers = reactive([])
const levelResult = ref(null)
// 逐题校验结果：{ [题目下标]: 'correct' | 'wrong' | 'checking' }
const levelCheck = reactive({})
const checkingIndex = ref(-1)

// ================= 每日任务 =================
const tasks = ref([])
const taskLoading = ref(false)
const claimingId = ref(null)

const timerPercent = computed(() => (timeLeft.value / TIME_LIMIT) * 100)

const currentQuestion = computed(() => questions.value[currentIndex.value] || null)

async function loadSubjects() {
  try {
    const list = await getSubjects()
    const math = (list || []).find((s) => s.code === 'math')
    mathSubjectId.value = math?.id || 1
    levelSubject.value = mathSubjectId.value
  } catch {
    mathSubjectId.value = 1
    levelSubject.value = 1
  }
}

// ---------------- 限时挑战 ----------------
async function startChallenge() {
  try {
    const data = await getOralQuestions({ grade: grade.value, count: 50 })
    questions.value = data.questions || []
    answers.length = 0
    questions.value.forEach(() => answers.push(''))
    currentIndex.value = 0
    correctCount.value = 0
    wrongCount.value = 0
    challengeResult.value = null
    timeLeft.value = TIME_LIMIT
    challengeState.value = 'doing'

    timer.value = setInterval(() => {
      timeLeft.value -= 1
      if (timeLeft.value <= 0) {
        finishChallenge(true)
      }
    }, 1000)
  } catch {
    // 拦截器已提示
  }
}

function clearTimer() {
  if (timer.value) {
    clearInterval(timer.value)
    timer.value = null
  }
}

async function submitAnswer() {
  const q = currentQuestion.value
  if (!q) return
  const ans = String(answers[currentIndex.value] ?? '').trim()
  if (!ans) {
    ElMessage.warning('请先输入答案')
    return
  }

  const right = String(ans) === String(q.answer)
  if (right) {
    correctCount.value += 1
  } else {
    wrongCount.value += 1
  }

  // 移动到下一题（时间未结束）
  if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value += 1
  } else {
    finishChallenge(false)
  }
}

async function finishChallenge(timeUp) {
  clearTimer()
  if (challengeState.value !== 'doing') return
  challengeState.value = 'done'
  submitting.value = true

  try {
    const total = correctCount.value + wrongCount.value
    if (total === 0) {
      ElMessage.info('还没有作答哦，下次再来挑战吧！')
      challengeState.value = 'idle'
      return
    }

    const used = TIME_LIMIT - Math.max(0, timeLeft.value)
    const data = await submitChallenge({
      subject_id: mathSubjectId.value,
      correct_count: correctCount.value,
      total_count: total,
      duration: used > 0 ? used : TIME_LIMIT,
    })
    challengeResult.value = data
    if (data.unlocked_badges?.length) {
      data.unlocked_badges.forEach((b) => ElMessage.success(`🎉 解锁新徽章：${b.name}`))
    }
    if (timeUp) ElMessage.info('时间到！')
    loadTasks()
  } catch {
    challengeState.value = 'idle'
  } finally {
    submitting.value = false
  }
}

function exitChallenge() {
  clearTimer()
  challengeState.value = 'idle'
}

// ---------------- 每日任务 ----------------
async function loadTasks() {
  taskLoading.value = true
  try {
    tasks.value = (await getDailyTasks()) || []
  } catch {
    tasks.value = []
  } finally {
    taskLoading.value = false
  }
}

async function handleClaim(task) {
  claimingId.value = task.id
  try {
    const data = await claimTask(task.id)
    ElMessage.success(`领取成功，获得 ${data.points_earned} 积分！`)
    if (data.unlocked_badges?.length) {
      data.unlocked_badges.forEach((b) => ElMessage.success(`🎉 解锁新徽章：${b.name}`))
    }
    await loadTasks()
  } catch {
    // 拦截器已提示
  } finally {
    claimingId.value = null
  }
}

// ---------------- 闯关 ----------------
// 关卡按学生年级展示：不同年级的学生看到的关卡不同
const levelGrade = ref(userStore.grade || 1)
const showAllGrades = ref(false)

async function loadLevels() {
  try {
    const params = { subject_id: levelSubject.value }
    if (showAllGrades.value) {
      params.all_grades = true
    } else {
      params.grade = levelGrade.value
    }
    levels.value = (await getLevels(params)) || []
  } catch {
    levels.value = []
  }
}

function changeLevelGrade() {
  showAllGrades.value = false
  loadLevels()
}

function openLevels() {
  levelState.value = 'selecting'
  levelResult.value = null
  loadLevels()
}

async function enterLevel(item, level) {
  try {
    const data = await getLevelQuestions(item.knowledge_point_id, level)
    currentLevelData.value = data
    levelAnswers.length = 0
    ;(data.questions || []).forEach(() => levelAnswers.push(''))
    // 清空逐题校验状态
    Object.keys(levelCheck).forEach((k) => delete levelCheck[k])
    levelResult.value = null
    levelState.value = 'doing'
  } catch {
    // 拦截器已提示（如 3004 未解锁）
  }
}

/** 已答对的题数 */
const levelCorrectCount = computed(
  () => Object.values(levelCheck).filter((v) => v === 'correct').length
)

/** 是否所有题都已答对（满足提交条件） */
const levelAllCorrect = computed(() => {
  const total = currentLevelData.value?.questions?.length || 0
  return total > 0 && levelCorrectCount.value === total
})

/** 单题即时校验：输入框失焦或按回车时触发 */
async function checkAnswer(index) {
  const qs = currentLevelData.value?.questions || []
  const q = qs[index]
  if (!q) return

  const ans = String(levelAnswers[index] ?? '').trim()
  if (!ans) {
    delete levelCheck[index]
    return
  }
  // 已判定正确的不再重复校验
  if (levelCheck[index] === 'correct') return

  levelCheck[index] = 'checking'
  checkingIndex.value = index
  try {
    const data = await checkLevelAnswer({
      knowledge_point_id: currentLevelData.value.knowledge_point_id,
      level: currentLevelData.value.level,
      question_id: q.id,
      user_answer: ans,
    })
    if (data.is_correct) {
      levelCheck[index] = 'correct'
      // 答对后自动跳到下一题，提升做题流畅度
      const next = qs[index + 1]
      if (next) {
        document.querySelector(`[data-lv-input="${index + 1}"] input`)?.focus()
      }
    } else {
      levelCheck[index] = 'wrong'
      ElMessage.error(data.analysis ? `答错啦：${data.analysis}` : '答错啦，再想一想～')
    }
  } catch {
    delete levelCheck[index]
  } finally {
    checkingIndex.value = -1
  }
}

/** 重新作答某道错题 */
function retryAnswer(index) {
  levelAnswers[index] = ''
  delete levelCheck[index]
  document.querySelector(`[data-lv-input="${index}"] input`)?.focus()
}

async function submitLevel() {
  const qs = currentLevelData.value?.questions || []
  if (!qs.length) {
    ElMessage.warning('本关暂无题目')
    return
  }
  if (!levelAllCorrect.value) {
    const wrong = qs.length - levelCorrectCount.value
    ElMessage.warning(`还有 ${wrong} 道题没有答对，全部答对才能通关哦`)
    return
  }

  submitting.value = true
  try {
    const data = await submitChallenge({
      subject_id: levelSubject.value,
      correct_count: qs.length,
      total_count: qs.length,
      duration: 60,
      knowledge_point_id: currentLevelData.value.knowledge_point_id,
      level: currentLevelData.value.level,
    })
    levelResult.value = { ...data, correct: qs.length, total: qs.length }

    if (data.unlocked_badges?.length) {
      data.unlocked_badges.forEach((b) => ElMessage.success(`🎉 解锁新徽章：${b.name}`))
    }
    loadTasks()
    await loadLevels()

    if (data.all_cleared) {
      // 该知识点所有关卡已全部通关 -> 弹窗
      showFinalWin()
    } else if (data.passed && data.next_level) {
      // 通关后自动进入下一关
      ElMessage.success(`🎉 第 ${currentLevelData.value.level} 关通关！即将进入第 ${data.next_level} 关`)
      const kpId = currentLevelData.value.knowledge_point_id
      const nextItem = levels.value.find((x) => x.knowledge_point_id === kpId)
      setTimeout(() => {
        if (nextItem) {
          enterLevel(nextItem, data.next_level)
        } else {
          backToLevels()
        }
      }, 900)
    } else {
      ElMessage.info('还差一点，全部答对才能过关')
    }
  } catch {
    // 拦截器已提示
  } finally {
    submitting.value = false
  }
}

/** 全部通关弹窗 */
const finalWinVisible = ref(false)
const finalWinData = ref(null)

function showFinalWin() {
  finalWinData.value = {
    knowledge_point: currentLevelData.value?.knowledge_point,
    max_level: levelResult.value?.max_level || 10,
    points: levelResult.value?.points_earned || 0,
  }
  finalWinVisible.value = true
}

function closeFinalWin() {
  finalWinVisible.value = false
  backToLevels()
}

function backToLevels() {
  levelState.value = 'selecting'
  loadLevels()
}

onMounted(async () => {
  await loadSubjects()
  loadTasks()
})

onBeforeUnmount(clearTimer)
</script>

<template>
  <div class="page-wrap">
    <h2 class="page-title">⏱️ 趣味练习</h2>
    <p class="page-sub">限时挑战、关卡闯关和每日任务，让练习更有趣！</p>

    <el-tabs v-model="activeTab" class="cha-tabs">
      <!-- ============ 限时挑战 ============ -->
      <el-tab-pane label="限时挑战" name="timed">
        <!-- 开始 -->
        <div v-if="challengeState === 'idle'" class="soft-card start-panel">
          <div class="start-icon">⚡</div>
          <h3>60 秒口算挑战</h3>
          <p class="start-desc">在 60 秒内尽可能多答对题，答得越多积分越多！</p>
          <el-form inline class="count-form">
            <el-form-item label="年级">
              <el-radio-group v-model="grade">
                <el-radio-button :value="1">一年级</el-radio-button>
                <el-radio-button :value="2">二年级</el-radio-button>
                <el-radio-button :value="3">三年级</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-form>
          <el-button type="primary" size="large" round @click="startChallenge">
            <el-icon><Timer /></el-icon> 开始挑战
          </el-button>
        </div>

        <!-- 挑战中 -->
        <div v-else-if="challengeState === 'doing'" class="soft-card">
          <div class="timer-bar">
            <div class="timer-info">
              <span class="timer-num" :class="{ urgent: timeLeft <= 10 }">{{ timeLeft }}s</span>
              <span class="score-info">
                答对 <b class="ok">{{ correctCount }}</b> · 答错 <b class="no">{{ wrongCount }}</b>
              </span>
            </div>
            <el-progress
              :percentage="timerPercent"
              :show-text="false"
              :stroke-width="12"
              :color="timeLeft <= 10 ? '#ff6b6b' : '#4f8cff'"
            />
          </div>

          <div v-if="currentQuestion" class="challenge-question">
            <div class="question-big">{{ currentQuestion.content.replace(' = ?', '') }} = ?</div>
            <el-input
              v-model="answers[currentIndex]"
              size="large"
              class="challenge-input"
              placeholder="输入答案"
              autofocus
              @keyup.enter="submitAnswer"
            />
            <el-button type="primary" size="large" round @click="submitAnswer">
              确定
            </el-button>
            <div class="progress-hint">
              第 {{ currentIndex + 1 }} / {{ questions.length }} 题
            </div>
          </div>

          <div class="do-footer">
            <el-button size="small" @click="finishChallenge(false)">提前结束</el-button>
            <el-button size="small" plain @click="exitChallenge">退出</el-button>
          </div>
        </div>

        <!-- 结果 -->
        <div v-else class="soft-card">
          <div class="result-head">
            <div class="result-emoji">{{ (challengeResult?.accuracy ?? 0) >= 80 ? '🎉' : '💪' }}</div>
            <div>
              <h3 style="margin: 0">挑战结束</h3>
              <p class="page-sub" style="margin: 4px 0 0">
                获得 {{ challengeResult?.points_earned ?? 0 }} 积分
              </p>
            </div>
          </div>

          <div class="result-grid">
            <div class="stat-block">
              <div class="num" style="color: #43c59e">{{ challengeResult?.correct_count }}</div>
              <div class="label">答对题数</div>
            </div>
            <div class="stat-block">
              <div class="num">{{ challengeResult?.total_count }}</div>
              <div class="label">作答题数</div>
            </div>
            <div class="stat-block">
              <div class="num">{{ challengeResult?.accuracy }}%</div>
              <div class="label">正确率</div>
            </div>
            <div class="stat-block">
              <div class="num" style="color: #ffb020">{{ challengeResult?.points_earned }}</div>
              <div class="label">获得积分</div>
            </div>
          </div>

          <div class="do-footer">
            <el-button type="primary" round @click="startChallenge">再挑战一次</el-button>
            <el-button round @click="challengeState = 'idle'">返回</el-button>
          </div>
        </div>
      </el-tab-pane>

      <!-- ============ 关卡闯关 ============ -->
      <el-tab-pane label="关卡闯关" name="levels">
        <!-- 关卡列表 -->
        <div v-if="levelState === 'idle' || levelState === 'selecting'" class="soft-card">
          <div class="bank-head">
            <h3 style="margin: 0">选择知识点开始闯关</h3>
            <div class="level-head-actions">
              <el-radio-group v-model="levelGrade" size="small" @change="changeLevelGrade">
                <el-radio-button :value="1">一年级</el-radio-button>
                <el-radio-button :value="2">二年级</el-radio-button>
                <el-radio-button :value="3">三年级</el-radio-button>
              </el-radio-group>
              <el-button v-if="levelState === 'idle'" type="primary" round @click="openLevels">
                查看关卡
              </el-button>
            </div>
          </div>

          <el-empty
            v-if="!levels.length"
            :description="`${levelGrade} 年级暂无可用关卡，可切换其他年级看看`"
          />
          <div v-else class="level-list">
            <div v-for="item in levels" :key="item.knowledge_point_id" class="level-card">
              <div class="level-info">
                <div class="level-name">
                  {{ item.knowledge_point }}
                  <el-tag
                    v-if="item.all_cleared"
                    type="success"
                    effect="dark"
                    size="small"
                    round
                    style="margin-left: 8px"
                  >
                    已通关 🏆
                  </el-tag>
                </div>
                <div class="level-meta">
                  {{ item.grade }} 年级 · 共 {{ item.total_levels }} 关 ·
                  已解锁 {{ item.max_unlocked }} 关 · {{ item.question_count }} 道题
                </div>
                <el-progress
                  :percentage="Math.round((item.max_unlocked / item.total_levels) * 100)"
                  :stroke-width="8"
                  :show-text="false"
                  :status="item.all_cleared ? 'success' : undefined"
                  style="margin-top: 8px"
                />
              </div>
              <div class="level-buttons">
                <el-button
                  v-for="lv in Math.min(item.max_unlocked, 5)"
                  :key="lv"
                  size="small"
                  round
                  :type="lv === item.max_unlocked ? 'primary' : 'default'"
                  @click="enterLevel(item, lv)"
                >
                  第{{ lv }}关
                </el-button>
              </div>
            </div>
          </div>
          <div class="rule-tip">
            每关 {{ 10 }} 题。填完一题按 <b>回车</b> 或点击别处即可立即判断对错；
            <b>全部答对</b>才能提交通关并解锁下一关。
          </div>
        </div>

        <!-- 闯关中 -->
        <div v-else-if="levelState === 'doing'" class="soft-card">
          <div class="do-header">
            <span class="do-progress">
              {{ currentLevelData?.knowledge_point }} · 第 {{ currentLevelData?.level }} 关
            </span>
            <span class="level-score">
              已答对 <b class="ok">{{ levelCorrectCount }}</b> / {{ currentLevelData?.questions?.length || 0 }}
            </span>
            <el-button size="small" @click="backToLevels">退出</el-button>
          </div>

          <div class="level-questions">
            <div
              v-for="(q, i) in currentLevelData?.questions || []"
              :key="q.id"
              class="level-question"
              :class="{
                'is-correct': levelCheck[i] === 'correct',
                'is-wrong': levelCheck[i] === 'wrong',
              }"
            >
              <span class="q-index" :class="levelCheck[i]">{{ i + 1 }}</span>
              <span class="q-content">{{ q.content }}</span>

              <el-input
                v-model="levelAnswers[i]"
                :data-lv-input="i"
                placeholder="输入答案后按回车"
                class="level-input"
                :class="{ correct: levelCheck[i] === 'correct', wrong: levelCheck[i] === 'wrong' }"
                :disabled="levelCheck[i] === 'correct'"
                :loading="levelCheck[i] === 'checking'"
                @blur="checkAnswer(i)"
                @keyup.enter="checkAnswer(i)"
              />

              <!-- 判定结果 -->
              <span class="level-flag">
                <template v-if="levelCheck[i] === 'correct'">
                  <el-tag type="success" effect="dark" round size="small">✓ 正确</el-tag>
                </template>
                <template v-else-if="levelCheck[i] === 'wrong'">
                  <el-tag type="danger" effect="dark" round size="small">✗ 错误</el-tag>
                  <el-button link type="primary" size="small" @click="retryAnswer(i)">
                    重做
                  </el-button>
                </template>
                <template v-else-if="levelCheck[i] === 'checking'">
                  <span class="checking-text">判断中…</span>
                </template>
              </span>
            </div>
          </div>

          <div class="do-footer level-footer">
            <el-tooltip
              :disabled="levelAllCorrect"
              content="全部答对后才能提交通关"
              placement="top"
            >
              <span>
                <el-button
                  type="primary"
                  size="large"
                  round
                  :loading="submitting"
                  :disabled="!levelAllCorrect"
                  @click="submitLevel"
                >
                  提交闯关
                </el-button>
              </span>
            </el-tooltip>
            <span v-if="!levelAllCorrect" class="footer-hint">
              还有 {{ (currentLevelData?.questions?.length || 0) - levelCorrectCount }} 道题需要答对
            </span>
            <span v-else class="footer-hint done">全部答对啦，可以提交通关 🎉</span>
          </div>
        </div>

        <!-- 闯关结果 -->
        <div v-else class="soft-card">
          <div class="result-head">
            <div class="result-emoji">{{ levelResult?.passed ? '🏆' : '💪' }}</div>
            <div>
              <h3 style="margin: 0">
                {{ levelResult?.passed ? '闯关成功！' : '差一点点～' }}
              </h3>
              <p class="page-sub" style="margin: 4px 0 0">
                {{ levelResult?.passed ? `已解锁第 ${levelResult?.next_level} 关` : '正确率达到 100% 才能过关' }}
              </p>
            </div>
          </div>

          <div class="result-grid">
            <div class="stat-block">
              <div class="num" style="color: #43c59e">{{ levelResult?.correct }}</div>
              <div class="label">答对</div>
            </div>
            <div class="stat-block">
              <div class="num">{{ levelResult?.total }}</div>
              <div class="label">总题数</div>
            </div>
            <div class="stat-block">
              <div class="num">{{ levelResult?.accuracy }}%</div>
              <div class="label">正确率</div>
            </div>
            <div class="stat-block">
              <div class="num" style="color: #ffb020">{{ levelResult?.points_earned }}</div>
              <div class="label">获得积分</div>
            </div>
          </div>

          <div class="do-footer">
            <el-button type="primary" round @click="backToLevels">返回关卡</el-button>
          </div>
        </div>
      </el-tab-pane>

      <!-- ============ 每日任务 ============ -->
      <el-tab-pane label="每日任务" name="tasks">
        <div class="soft-card" v-loading="taskLoading">
          <div class="bank-head">
            <h3 style="margin: 0">今日任务（每天 0 点刷新）</h3>
            <el-button size="small" @click="loadTasks">刷新</el-button>
          </div>

          <el-empty v-if="!tasks.length && !taskLoading" description="暂无每日任务" />
          <div v-else class="task-list">
            <div v-for="t in tasks" :key="t.id" class="task-item" :class="{ done: t.completed }">
              <div class="task-icon">{{ t.completed ? '✅' : '🎯' }}</div>
              <div class="task-main">
                <div class="task-title">{{ t.title }}</div>
                <div class="task-progress">
                  进度 {{ t.progress }} / {{ t.target }} · 奖励 {{ t.points }} 积分
                </div>
                <el-progress
                  :percentage="Math.round((t.progress / t.target) * 100)"
                  :stroke-width="8"
                  :show-text="false"
                  :color="t.completed ? '#43c59e' : '#ffb020'"
                  style="margin-top: 6px"
                />
              </div>
              <div class="task-action">
                <el-button
                  v-if="t.point_claimed"
                  size="small"
                  round
                  disabled
                >
                  已领取
                </el-button>
                <el-button
                  v-else
                  size="small"
                  round
                  type="primary"
                  :disabled="!t.completed"
                  :loading="claimingId === t.id"
                  @click="handleClaim(t)"
                >
                  领取奖励
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 全部关卡通关弹窗 -->
    <el-dialog
      v-model="finalWinVisible"
      width="420px"
      :show-close="false"
      :close-on-click-modal="false"
      align-center
      class="final-win-dialog"
    >
      <div class="final-win">
        <div class="final-emoji">🏆</div>
        <h2 class="final-title">闯关成功！</h2>
        <p class="final-sub">
          你已经完成了「{{ finalWinData?.knowledge_point }}」<br />
          全部 {{ finalWinData?.max_level }} 关的挑战！
        </p>
        <div class="final-badges">
          <span class="final-star">⭐</span>
          <span class="final-star">⭐</span>
          <span class="final-star">⭐</span>
        </div>
        <p v-if="finalWinData?.points" class="final-points">
          本次获得 <b>{{ finalWinData.points }}</b> 积分
        </p>
        <el-button type="primary" size="large" round class="final-btn" @click="closeFinalWin">
          太棒了，返回关卡
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.cha-tabs :deep(.el-tabs__item) {
  font-size: 15px;
  font-weight: 700;
}

.start-panel {
  text-align: center;
  padding: 40px 20px;
}

.start-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.start-panel h3 {
  margin: 0 0 8px;
  font-size: 20px;
}

.start-desc {
  color: var(--text-sub);
  font-size: 14px;
  margin-bottom: 16px;
}

.count-form {
  display: flex;
  justify-content: center;
  margin-bottom: 8px;
}

/* 计时条 */
.timer-bar {
  margin-bottom: 18px;
}

.timer-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.timer-num {
  font-size: 24px;
  font-weight: 800;
  color: var(--brand-primary);
}

.timer-num.urgent {
  color: var(--brand-danger);
  animation: pulse 0.8s infinite;
}

@keyframes pulse {
  50% {
    opacity: 0.45;
  }
}

.score-info {
  font-size: 14px;
  color: var(--text-sub);
}

.score-info .ok {
  color: var(--brand-success);
}

.score-info .no {
  color: var(--brand-danger);
}

/* 挑战题目 */
.challenge-question {
  text-align: center;
  padding: 10px 0 20px;
}

.challenge-input {
  max-width: 220px;
  margin: 16px auto;
  display: block;
}

.challenge-input :deep(input) {
  text-align: center;
  font-size: 22px;
  font-weight: 800;
}

.progress-hint {
  margin-top: 12px;
  font-size: 12.5px;
  color: var(--text-sub);
}

.do-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.do-progress {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
}

.do-footer {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  gap: 12px;
}

/* 关卡列表 */
.bank-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.level-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.level-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 18px;
  border-radius: 14px;
  background: #f8faff;
  border: 1px solid rgba(79, 140, 255, 0.12);
  flex-wrap: wrap;
}

.level-info {
  flex: 1;
  min-width: 200px;
}

.level-name {
  font-size: 16px;
  font-weight: 800;
}

.level-meta {
  font-size: 12.5px;
  color: var(--text-sub);
  margin-top: 2px;
}

.level-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.level-questions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.level-question {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #f8faff;
  border-radius: 12px;
  border: 1px solid rgba(79, 140, 255, 0.1);
  transition: background 0.2s ease, border-color 0.2s ease;
}

.level-question.is-correct {
  background: #f2fbf7;
  border-color: rgba(67, 197, 158, 0.45);
}

.level-question.is-wrong {
  background: #fff6f6;
  border-color: rgba(255, 107, 107, 0.45);
  animation: shake 0.32s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.q-index {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(79, 140, 255, 0.14);
  color: var(--brand-primary);
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.2s;
}

.q-index.correct {
  background: var(--brand-success);
  color: #fff;
}

.q-index.wrong {
  background: var(--brand-danger);
  color: #fff;
}

.q-content {
  flex: 1;
  font-size: 16px;
  font-weight: 700;
}

/* 闯关输入框与判定标记 */
.level-input {
  max-width: 180px;
  flex-shrink: 0;
}

.level-input.correct :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--brand-success) inset;
  background: #f2fbf7;
}

.level-input.wrong :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--brand-danger) inset;
  background: #fff6f6;
}

.level-flag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 84px;
  flex-shrink: 0;
}

.checking-text {
  font-size: 12.5px;
  color: var(--text-sub);
}

/* 闯关进度与底部提示 */
.level-score {
  margin-left: auto;
  margin-right: 10px;
  font-size: 13.5px;
  color: var(--text-sub);
}

.level-score .ok {
  color: var(--brand-success);
  font-size: 16px;
}

.level-footer {
  flex-direction: column;
  gap: 8px;
}

.footer-hint {
  font-size: 12.5px;
  color: var(--text-sub);
}

.footer-hint.done {
  color: var(--brand-success);
  font-weight: 700;
}

/* 任务 */
.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border-radius: 14px;
  background: #f8faff;
  border: 1px solid rgba(79, 140, 255, 0.12);
}

.task-item.done {
  background: #f3fbf7;
  border-color: rgba(67, 197, 158, 0.28);
}

.task-icon {
  font-size: 26px;
  flex-shrink: 0;
}

.task-main {
  flex: 1;
  min-width: 0;
}

.task-title {
  font-size: 15px;
  font-weight: 800;
}

.task-progress {
  font-size: 12.5px;
  color: var(--text-sub);
  margin-top: 2px;
}

.task-action {
  flex-shrink: 0;
}

.rule-tip {
  margin-top: 14px;
  font-size: 12.5px;
  color: var(--text-sub);
  background: #f7f9ff;
  border-radius: 10px;
  padding: 10px 14px;
}

.result-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 12px;
}

.result-emoji {
  font-size: 40px;
}

/* 全部通关弹窗 */
.final-win {
  text-align: center;
  padding: 10px 6px 6px;
}

.final-emoji {
  font-size: 64px;
  line-height: 1;
  animation: bounce 0.9s ease infinite alternate;
}

@keyframes bounce {
  from { transform: translateY(0); }
  to { transform: translateY(-10px); }
}

.final-title {
  margin: 12px 0 6px;
  font-size: 24px;
  font-weight: 900;
  background: linear-gradient(90deg, #ffb020, #ff7b54);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.final-sub {
  margin: 0 0 12px;
  font-size: 14.5px;
  line-height: 1.8;
  color: var(--text-sub);
}

.final-badges {
  display: flex;
  justify-content: center;
  gap: 8px;
  font-size: 26px;
  margin-bottom: 10px;
}

.final-star {
  animation: pop 1.2s ease infinite;
}

.final-star:nth-child(2) { animation-delay: 0.15s; }
.final-star:nth-child(3) { animation-delay: 0.3s; }

@keyframes pop {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.25); }
}

.final-points {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--text-main);
}

.final-points b {
  color: #ffb020;
  font-size: 18px;
}

.final-btn {
  width: 100%;
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-purple));
  border: none;
  font-weight: 700;
}

/* 关卡年级切换 */
.level-head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
