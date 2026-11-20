<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { getOralQuestions, getMathQuestions, submitPractice, getSubjects } from '@/api'

const userStore = useUserStore()

const activeTab = ref('oral')
const grade = ref(userStore.grade || 1)
const mathSubjectId = ref(null)

// ---------------- 口算练习 ----------------
const oralConfig = reactive({ count: 20 })
const oralState = ref('idle') // idle | doing | done
const oralQuestions = ref([])
const oralAnswers = ref([])
const oralResult = ref(null)
const startTime = ref(0)
const itemStartTime = ref(0)

// ---------------- 题库练习 ----------------
const bankList = ref([])
const bankTotal = ref(0)
const bankPage = ref(1)
const bankPageSize = ref(10)
const bankLoading = ref(false)
const bankState = ref('idle') // idle | doing | done
const bankQuestions = ref([])
const bankAnswers = ref([])
const bankResult = ref(null)

const submitting = ref(false)

const gradeOptions = [
  { value: 1, label: '一年级', tip: '20 以内加减法' },
  { value: 2, label: '二年级', tip: '100 以内加减、乘法口诀' },
  { value: 3, label: '三年级', tip: '三位数加减、两位数乘一位数、除法' },
]

const gradeTip = computed(
  () => gradeOptions.find((g) => g.value === grade.value)?.tip || '',
)

async function loadSubjects() {
  try {
    const list = await getSubjects()
    const math = (list || []).find((s) => s.code === 'math')
    mathSubjectId.value = math?.id || 1
  } catch {
    mathSubjectId.value = 1
  }
}

// ---------------- 口算 ----------------
async function startOral() {
  try {
    const data = await getOralQuestions({ grade: grade.value, count: oralConfig.count })
    oralQuestions.value = data.questions || []
    oralAnswers.value = oralQuestions.value.map(() => '')
    oralResult.value = null
    oralState.value = 'doing'
    startTime.value = Date.now()
    itemStartTime.value = Date.now()
  } catch {
    // 拦截器已提示
  }
}

const oralFilledCount = computed(
  () => oralAnswers.value.filter((a) => String(a ?? '').trim() !== '').length,
)

function focusNext(index) {
  const next = document.querySelector(`[data-oral-index="${index + 1}"] input`)
  const target = next || document.querySelector(`[data-oral-index="${index}"] input`)
  if (target) target.focus()
}

async function submitOral() {
  if (oralFilledCount.value === 0) {
    ElMessage.warning('请至少作答一道题')
    return
  }
  submitting.value = true
  try {
    const duration = Math.max(1, Math.round((Date.now() - startTime.value) / 1000))
    const payload = {
      subject_id: mathSubjectId.value || 1,
      mode: '口算',
      grade: grade.value,
      duration,
      questions: oralQuestions.value.map((q, i) => ({
        content: q.content,
        answer: String(q.answer),
        user_answer: String(oralAnswers.value[i] ?? '').trim(),
        time_cost: 0,
      })),
    }
    const data = await submitPractice(payload)
    oralResult.value = data
    oralState.value = 'done'
    ElMessage.success(`判分完成，正确率 ${data.accuracy}%`)
  } catch {
    // 拦截器已提示
  } finally {
    submitting.value = false
  }
}

// ---------------- 题库 ----------------
async function loadBank() {
  bankLoading.value = true
  try {
    const data = await getMathQuestions({
      grade: grade.value,
      page: bankPage.value,
      page_size: bankPageSize.value,
    })
    bankList.value = data.items || []
    bankTotal.value = data.total || 0
  } catch {
    // 拦截器已提示
  } finally {
    bankLoading.value = false
  }
}

function startBankPractice() {
  if (!bankList.value.length) {
    ElMessage.warning('当前年级暂无题库题目')
    return
  }
  bankQuestions.value = bankList.value
  bankAnswers.value = bankList.value.map(() => '')
  bankResult.value = null
  bankState.value = 'doing'
  startTime.value = Date.now()
}

const bankFilledCount = computed(
  () => bankAnswers.value.filter((a) => String(a ?? '').trim() !== '').length,
)

async function submitBank() {
  if (bankFilledCount.value === 0) {
    ElMessage.warning('请至少作答一道题')
    return
  }
  submitting.value = true
  try {
    const duration = Math.max(1, Math.round((Date.now() - startTime.value) / 1000))
    const payload = {
      subject_id: mathSubjectId.value || 1,
      mode: '题库',
      grade: grade.value,
      duration,
      questions: bankQuestions.value.map((q, i) => ({
        question_id: q.id,
        content: q.content,
        answer: String(q.answer ?? ''),
        user_answer: String(bankAnswers.value[i] ?? '').trim(),
        time_cost: 0,
      })),
    }
    const data = await submitPractice(payload)
    bankResult.value = data
    bankState.value = 'done'
    ElMessage.success(`判分完成，正确率 ${data.accuracy}%`)
  } catch {
    // 拦截器已提示
  } finally {
    submitting.value = false
  }
}

function resetBank() {
  bankState.value = 'idle'
  bankResult.value = null
  loadBank()
}

// 切换年级时重置
function onGradeChange() {
  oralState.value = 'idle'
  oralQuestions.value = []
  oralAnswers.value = []
  oralResult.value = null
  bankState.value = 'idle'
  bankPage.value = 1
  loadBank()
}

function onTabChange(tab) {
  if (tab === 'bank' && !bankList.value.length) {
    loadBank()
  }
}

onMounted(async () => {
  await loadSubjects()
  loadBank()
})
</script>

<template>
  <div class="page-wrap">
    <h2 class="page-title">🧮 数学学习</h2>
    <p class="page-sub">口算练习与题库练习，提交后即时判分，答错的题目会自动进入错题本。</p>

    <!-- 年级选择 -->
    <div class="soft-card grade-bar">
      <span class="bar-label">选择年级：</span>
      <el-radio-group v-model="grade" @change="onGradeChange">
        <el-radio-button v-for="g in gradeOptions" :key="g.value" :value="g.value">
          {{ g.label }}
        </el-radio-button>
      </el-radio-group>
      <el-tag type="info" effect="plain" round>{{ gradeTip }}</el-tag>
    </div>

    <el-tabs v-model="activeTab" class="math-tabs" @tab-change="onTabChange">
      <!-- ========== 口算练习 ========== -->
      <el-tab-pane label="口算练习" name="oral">
        <!-- 配置 -->
        <div v-if="oralState === 'idle'" class="soft-card start-panel">
          <div class="start-icon">✏️</div>
          <h3>准备好啦？开始口算吧！</h3>
          <p class="start-desc">当前年级：{{ grade }} 年级 · {{ gradeTip }}</p>
          <el-form inline class="count-form">
            <el-form-item label="题目数量">
              <el-input-number v-model="oralConfig.count" :min="5" :max="50" :step="5" />
            </el-form-item>
          </el-form>
          <el-button type="primary" size="large" round @click="startOral">
            <el-icon><VideoPlay /></el-icon> 开始练习
          </el-button>
        </div>

        <!-- 答题 -->
        <div v-else-if="oralState === 'doing'" class="soft-card">
          <div class="do-header">
            <span class="do-progress">
              已作答 <b>{{ oralFilledCount }}</b> / {{ oralQuestions.length }}
            </span>
            <el-progress
              :percentage="Math.round((oralFilledCount / oralQuestions.length) * 100)"
              :show-text="false"
              :stroke-width="10"
              style="flex: 1; margin: 0 14px"
            />
            <el-button size="small" @click="oralState = 'idle'">退出</el-button>
          </div>

          <div class="oral-grid">
            <div v-for="(q, i) in oralQuestions" :key="i" class="oral-item">
              <span class="oral-index">{{ i + 1 }}</span>
              <span class="oral-content">{{ q.content.replace(' = ?', '') }}</span>
              <span class="oral-eq">=</span>
              <el-input
                v-model="oralAnswers[i]"
                :data-oral-index="i"
                class="oral-input"
                placeholder="?"
                @keyup.enter="focusNext(i)"
              />
            </div>
          </div>

          <div class="do-footer">
            <el-button type="primary" size="large" round :loading="submitting" @click="submitOral">
              提交判分
            </el-button>
          </div>
        </div>

        <!-- 结果 -->
        <div v-else class="soft-card">
          <div class="result-head">
            <div class="result-emoji">
              {{ Number(oralResult?.accuracy) >= 80 ? '🎉' : '💪' }}
            </div>
            <div>
              <h3 style="margin: 0">
                {{
                  Number(oralResult?.accuracy) >= 80
                    ? '太棒了，继续保持！'
                    : '继续加油，错题已进入错题本'
                }}
              </h3>
              <p class="page-sub" style="margin: 4px 0 0">
                用时 {{ oralResult?.duration }} 秒
              </p>
            </div>
          </div>

          <div class="result-grid">
            <div class="stat-block">
              <div class="num">{{ oralResult?.total }}</div>
              <div class="label">总题数</div>
            </div>
            <div class="stat-block">
              <div class="num" style="color: #43c59e">{{ oralResult?.correct }}</div>
              <div class="label">答对</div>
            </div>
            <div class="stat-block">
              <div class="num" style="color: #ff6b6b">{{ oralResult?.wrong }}</div>
              <div class="label">答错</div>
            </div>
            <div class="stat-block">
              <div class="num">{{ oralResult?.accuracy }}%</div>
              <div class="label">正确率</div>
            </div>
          </div>

          <el-table :data="oralResult?.details || []" stripe max-height="420">
            <el-table-column type="index" label="#" width="55" />
            <el-table-column prop="content" label="题目" />
            <el-table-column prop="user_answer" label="你的答案" width="120" />
            <el-table-column prop="answer" label="正确答案" width="120" />
            <el-table-column label="结果" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.is_correct" type="success" effect="light">✓ 正确</el-tag>
                <el-tag v-else type="danger" effect="light">✗ 错误</el-tag>
              </template>
            </el-table-column>
          </el-table>

          <div class="do-footer">
            <el-button type="primary" round @click="startOral">再练一次</el-button>
            <el-button round @click="oralState = 'idle'">返回</el-button>
          </div>
        </div>
      </el-tab-pane>

      <!-- ========== 题库练习 ========== -->
      <el-tab-pane label="题库练习" name="bank">
        <div v-if="bankState === 'idle'" class="soft-card" v-loading="bankLoading">
          <div class="bank-head">
            <h3 style="margin: 0">题库练习（{{ grade }} 年级）</h3>
            <el-button type="primary" round :disabled="!bankList.length" @click="startBankPractice">
              <el-icon><VideoPlay /></el-icon> 开始本页练习
            </el-button>
          </div>

          <el-empty v-if="!bankList.length && !bankLoading" description="当前年级暂无题库题目" />

          <div v-else class="bank-list">
            <div v-for="q in bankList" :key="q.id" class="bank-item">
              <span class="bank-idx">#{{ q.id }}</span>
              <span class="bank-content">{{ q.content }}</span>
              <el-tag size="small" effect="plain" type="info">
                难度 {{ q.difficulty }}
              </el-tag>
            </div>
          </div>

          <el-pagination
            v-if="bankTotal > bankPageSize"
            v-model:current-page="bankPage"
            :page-size="bankPageSize"
            :total="bankTotal"
            layout="prev, pager, next"
            style="margin-top: 16px; justify-content: center"
            @current-change="loadBank"
          />
        </div>

        <!-- 答题 -->
        <div v-else-if="bankState === 'doing'" class="soft-card">
          <div class="do-header">
            <span class="do-progress">
              已作答 <b>{{ bankFilledCount }}</b> / {{ bankQuestions.length }}
            </span>
            <el-button size="small" @click="bankState = 'idle'">退出</el-button>
          </div>

          <div class="bank-answer-list">
            <div v-for="(q, i) in bankQuestions" :key="q.id" class="bank-answer-item">
              <div class="bank-q">
                <span class="bank-idx">{{ i + 1 }}</span>
                <span class="bank-content">{{ q.content }}</span>
              </div>
              <el-radio-group v-if="q.options && q.options.length" v-model="bankAnswers[i]">
                <el-radio v-for="(opt, oi) in q.options" :key="oi" :value="opt" border>
                  {{ opt }}
                </el-radio>
              </el-radio-group>
              <el-input v-else v-model="bankAnswers[i]" placeholder="请输入答案" style="max-width: 260px" />
            </div>
          </div>

          <div class="do-footer">
            <el-button type="primary" size="large" round :loading="submitting" @click="submitBank">
              提交判分
            </el-button>
          </div>
        </div>

        <!-- 结果 -->
        <div v-else class="soft-card">
          <div class="result-head">
            <div class="result-emoji">
              {{ Number(bankResult?.accuracy) >= 80 ? '🎉' : '💪' }}
            </div>
            <div>
              <h3 style="margin: 0">本次成绩</h3>
              <p class="page-sub" style="margin: 4px 0 0">用时 {{ bankResult?.duration }} 秒</p>
            </div>
          </div>

          <div class="result-grid">
            <div class="stat-block">
              <div class="num">{{ bankResult?.total }}</div>
              <div class="label">总题数</div>
            </div>
            <div class="stat-block">
              <div class="num" style="color: #43c59e">{{ bankResult?.correct }}</div>
              <div class="label">答对</div>
            </div>
            <div class="stat-block">
              <div class="num" style="color: #ff6b6b">{{ bankResult?.wrong }}</div>
              <div class="label">答错</div>
            </div>
            <div class="stat-block">
              <div class="num">{{ bankResult?.accuracy }}%</div>
              <div class="label">正确率</div>
            </div>
          </div>

          <el-table :data="bankResult?.details || []" stripe max-height="420">
            <el-table-column type="index" label="#" width="55" />
            <el-table-column prop="content" label="题目" />
            <el-table-column prop="user_answer" label="你的答案" width="120" />
            <el-table-column prop="answer" label="正确答案" width="120" />
            <el-table-column label="结果" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.is_correct" type="success" effect="light">✓ 正确</el-tag>
                <el-tag v-else type="danger" effect="light">✗ 错误</el-tag>
              </template>
            </el-table-column>
          </el-table>

          <div class="do-footer">
            <el-button type="primary" round @click="startBankPractice">再练一次</el-button>
            <el-button round @click="resetBank">返回题库</el-button>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.grade-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
  padding: 16px 20px;
  flex-wrap: wrap;
}

.bar-label {
  font-weight: 700;
  font-size: 14px;
}

.math-tabs :deep(.el-tabs__item) {
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

.do-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}

.do-progress {
  font-size: 14px;
  color: var(--text-sub);
  white-space: nowrap;
}

.do-footer {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  gap: 12px;
}

/* 口算题网格 */
.oral-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
}

.oral-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f8faff;
  border: 1px solid rgba(79, 140, 255, 0.14);
  border-radius: 12px;
  padding: 10px 12px;
}

.oral-index {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(79, 140, 255, 0.14);
  color: var(--brand-primary);
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.oral-content {
  font-size: 17px;
  font-weight: 700;
  white-space: nowrap;
}

.oral-eq {
  color: var(--text-sub);
  font-weight: 700;
}

.oral-input {
  width: 82px;
  flex-shrink: 0;
}

.oral-input :deep(input) {
  text-align: center;
  font-weight: 700;
  font-size: 16px;
}

/* 结果头部 */
.result-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 12px;
}

.result-emoji {
  font-size: 40px;
}

/* 题库 */
.bank-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.bank-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bank-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #f8faff;
  border-radius: 12px;
  border: 1px solid rgba(79, 140, 255, 0.1);
}

.bank-idx {
  color: var(--brand-primary);
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}

.bank-content {
  font-size: 16px;
  font-weight: 600;
  flex: 1;
}

.bank-answer-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.bank-answer-item {
  padding: 14px 16px;
  background: #f8faff;
  border-radius: 12px;
  border: 1px solid rgba(79, 140, 255, 0.12);
}

.bank-q {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.bank-answer-item :deep(.el-radio) {
  margin-right: 10px;
  margin-bottom: 6px;
}
</style>
