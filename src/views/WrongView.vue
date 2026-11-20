<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getWrongQuestions,
  removeWrongQuestion,
  submitWrongPractice,
  getSubjects,
} from '@/api'

const subjects = ref([])
const currentSubjectId = ref(null)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)

// 重练状态
const practiceState = ref('idle') // idle | doing | done
const practiceItems = ref([])
const answers = ref([])
const practiceResult = ref(null)
const startTime = ref(0)
const submitting = ref(false)

const subjectName = computed(() => {
  const map = {}
  subjects.value.forEach((s) => (map[s.id] = s.name))
  return map
})

const filledCount = computed(
  () => answers.value.filter((a) => String(a ?? '').trim() !== '').length,
)

async function loadSubjects() {
  try {
    subjects.value = (await getSubjects()) || []
    const math = subjects.value.find((s) => s.code === 'math')
    currentSubjectId.value = math?.id || subjects.value[0]?.id || 1
  } catch {
    currentSubjectId.value = 1
  }
}

async function loadWrong() {
  if (!currentSubjectId.value) return
  loading.value = true
  try {
    const data = await getWrongQuestions({
      subject_id: currentSubjectId.value,
      page: page.value,
      page_size: pageSize.value,
    })
    list.value = data.items || []
    total.value = data.total || 0
  } catch {
    // 拦截器已提示
  } finally {
    loading.value = false
  }
}

function onSubjectChange() {
  page.value = 1
  practiceState.value = 'idle'
  loadWrong()
}

async function handleRemove(row) {
  try {
    await ElMessageBox.confirm(`确定要移除这道错题吗？`, '移除错题', {
      confirmButtonText: '移除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await removeWrongQuestion(row.id)
    ElMessage.success('已移除')
    loadWrong()
  } catch {
    // 取消或失败
  }
}

function startPractice(rows) {
  if (!rows.length) {
    ElMessage.warning('当前没有可重练的错题')
    return
  }
  practiceItems.value = rows
  answers.value = rows.map(() => '')
  practiceResult.value = null
  practiceState.value = 'doing'
  startTime.value = Date.now()
}

async function submitPracticeAnswers() {
  if (filledCount.value === 0) {
    ElMessage.warning('请至少作答一道题')
    return
  }
  submitting.value = true
  try {
    const duration = Math.max(1, Math.round((Date.now() - startTime.value) / 1000))
    const data = await submitWrongPractice({
      subject_id: currentSubjectId.value,
      duration,
      items: practiceItems.value.map((item, i) => ({
        wrong_id: item.id,
        user_answer: String(answers.value[i] ?? '').trim(),
        time_cost: 0,
      })),
    })
    practiceResult.value = data
    practiceState.value = 'done'
    const removedCount = (data.details || []).filter((d) => d.removed).length
    if (removedCount > 0) {
      ElMessage.success(`判分完成！有 ${removedCount} 道题连续答对 3 次，已自动移出错题本 🎉`)
    } else {
      ElMessage.success(`判分完成，正确率 ${data.accuracy}%`)
    }
  } catch {
    // 拦截器已提示
  } finally {
    submitting.value = false
  }
}

function backToList() {
  practiceState.value = 'idle'
  loadWrong()
}

function formatTime(value) {
  if (!value) return '-'
  return value.replace('T', ' ').slice(0, 16)
}

onMounted(async () => {
  await loadSubjects()
  loadWrong()
})
</script>

<template>
  <div class="page-wrap">
    <h2 class="page-title">📕 错题本</h2>
    <p class="page-sub">
      练习中答错的题目会自动收录。连续答对 3 次就会自动移出错题本，也可以手动移除。
    </p>

    <!-- 学科筛选 -->
    <div class="soft-card subject-bar">
      <span class="bar-label">选择学科：</span>
      <el-radio-group v-model="currentSubjectId" @change="onSubjectChange">
        <el-radio-button
          v-for="s in subjects"
          :key="s.id"
          :value="s.id"
        >
          {{ s.name }}
        </el-radio-button>
      </el-radio-group>
      <div class="bar-right">
        <el-tag type="info" effect="plain" round>共 {{ total }} 道错题</el-tag>
        <el-button
          type="primary"
          round
          :disabled="!list.length || practiceState !== 'idle'"
          @click="startPractice(list)"
        >
          <el-icon><RefreshRight /></el-icon> 重练本页错题
        </el-button>
      </div>
    </div>

    <!-- 错题列表 -->
    <template v-if="practiceState === 'idle'">
      <div class="soft-card" v-loading="loading">
        <el-empty
          v-if="!list.length && !loading"
          description="太棒了，这个学科还没有错题 🎉"
        />
        <div v-else class="wrong-list">
          <div v-for="row in list" :key="row.id" class="wrong-item">
            <div class="wrong-main">
              <div class="wrong-content">{{ row.content }}</div>
              <div class="wrong-answer">
                <span class="ans-label">正确答案：</span>
                <span class="ans-value">{{ row.answer }}</span>
              </div>
              <div v-if="row.analysis" class="wrong-analysis">
                <span class="ans-label">解析：</span>{{ row.analysis }}
              </div>
              <div class="wrong-meta">
                <el-tag size="small" type="danger" effect="light">
                  答错 {{ row.wrong_count }} 次
                </el-tag>
                <el-tag size="small" type="success" effect="light">
                  连续答对 {{ row.correct_streak }} / 3
                </el-tag>
                <span class="meta-time">最近答错：{{ formatTime(row.last_wrong_at) }}</span>
              </div>
              <!-- 连对进度 -->
              <el-progress
                :percentage="Math.min(100, Math.round(((row.correct_streak || 0) / 3) * 100))"
                :stroke-width="8"
                :show-text="false"
                :color="row.correct_streak >= 2 ? '#43c59e' : '#ffb020'"
                class="streak-progress"
              />
            </div>
            <div class="wrong-actions">
              <el-button size="small" round @click="startPractice([row])">重练</el-button>
              <el-button size="small" round type="danger" plain @click="handleRemove(row)">
                移除
              </el-button>
            </div>
          </div>
        </div>

        <el-pagination
          v-if="total > pageSize"
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          style="margin-top: 16px; justify-content: center"
          @current-change="loadWrong"
        />
      </div>
    </template>

    <!-- 重练中 -->
    <template v-else-if="practiceState === 'doing'">
      <div class="soft-card">
        <div class="do-header">
          <span class="do-progress">
            已作答 <b>{{ filledCount }}</b> / {{ practiceItems.length }}
          </span>
          <el-progress
            :percentage="Math.round((filledCount / practiceItems.length) * 100)"
            :show-text="false"
            :stroke-width="10"
            style="flex: 1; margin: 0 14px"
          />
          <el-button size="small" @click="backToList">退出</el-button>
        </div>

        <div class="practice-list">
          <div v-for="(item, i) in practiceItems" :key="item.id" class="practice-item">
            <div class="practice-q">
              <span class="practice-idx">{{ i + 1 }}</span>
              <span class="practice-content">{{ item.content }}</span>
            </div>
            <el-input
              v-model="answers[i]"
              placeholder="请输入你的答案"
              style="max-width: 280px"
              @keyup.enter="
                document.querySelector(`[data-wrong-index='${i + 1}'] input`)?.focus()
              "
              :data-wrong-index="i"
            />
          </div>
        </div>

        <div class="do-footer">
          <el-button
            type="primary"
            size="large"
            round
            :loading="submitting"
            @click="submitPracticeAnswers"
          >
            提交判分
          </el-button>
        </div>
      </div>
    </template>

    <!-- 重练结果 -->
    <template v-else>
      <div class="soft-card">
        <div class="result-head">
          <div class="result-emoji">
            {{ Number(practiceResult?.accuracy) >= 80 ? '🎉' : '💪' }}
          </div>
          <div>
            <h3 style="margin: 0">重练成绩</h3>
            <p class="page-sub" style="margin: 4px 0 0">坚持练习，错题终会变成会做的题！</p>
          </div>
        </div>

        <div class="result-grid">
          <div class="stat-block">
            <div class="num">{{ practiceResult?.total }}</div>
            <div class="label">总题数</div>
          </div>
          <div class="stat-block">
            <div class="num" style="color: #43c59e">{{ practiceResult?.correct }}</div>
            <div class="label">答对</div>
          </div>
          <div class="stat-block">
            <div class="num" style="color: #ff6b6b">{{ practiceResult?.wrong }}</div>
            <div class="label">答错</div>
          </div>
          <div class="stat-block">
            <div class="num">{{ practiceResult?.accuracy }}%</div>
            <div class="label">正确率</div>
          </div>
        </div>

        <el-table :data="practiceResult?.details || []" stripe>
          <el-table-column type="index" label="#" width="55" />
          <el-table-column prop="content" label="题目" />
          <el-table-column prop="user_answer" label="你的答案" width="130" />
          <el-table-column prop="answer" label="正确答案" width="130" />
          <el-table-column label="结果" width="110">
            <template #default="{ row }">
              <el-tag v-if="row.is_correct" type="success" effect="light">✓ 正确</el-tag>
              <el-tag v-else type="danger" effect="light">✗ 错误</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="错题状态" width="130">
            <template #default="{ row }">
              <el-tag v-if="row.removed" type="success" effect="dark">已自动移除 🎉</el-tag>
              <span v-else class="keep-tip">继续保留</span>
            </template>
          </el-table-column>
        </el-table>

        <div class="do-footer">
          <el-button type="primary" round @click="backToList">返回错题本</el-button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.subject-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
  padding: 16px 20px;
  flex-wrap: wrap;
}

.bar-label {
  font-weight: 700;
  font-size: 14px;
}

.bar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

/* 错题列表 */
.wrong-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.wrong-item {
  display: flex;
  gap: 16px;
  padding: 16px 18px;
  border-radius: 14px;
  background: #fffaf9;
  border: 1px solid rgba(255, 107, 107, 0.18);
  align-items: flex-start;
}

.wrong-main {
  flex: 1;
  min-width: 0;
}

.wrong-content {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 8px;
  word-break: break-word;
}

.wrong-answer {
  font-size: 14.5px;
  margin-bottom: 6px;
}

.ans-label {
  color: var(--text-sub);
  font-weight: 600;
}

.ans-value {
  color: var(--brand-success);
  font-weight: 800;
}

.wrong-analysis {
  font-size: 13.5px;
  color: #5b6480;
  line-height: 1.8;
  margin-bottom: 8px;
}

.wrong-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.meta-time {
  font-size: 12.5px;
  color: var(--text-sub);
}

.streak-progress {
  max-width: 260px;
}

.wrong-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

/* 重练 */
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

.practice-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.practice-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  background: #f8faff;
  border-radius: 12px;
  border: 1px solid rgba(79, 140, 255, 0.12);
  flex-wrap: wrap;
}

.practice-q {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 200px;
}

.practice-idx {
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
}

.practice-content {
  font-size: 16px;
  font-weight: 700;
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

.keep-tip {
  font-size: 13px;
  color: var(--text-sub);
}

@media (max-width: 700px) {
  .wrong-item {
    flex-direction: column;
  }
  .wrong-actions {
    flex-direction: row;
    width: 100%;
  }
}
</style>
