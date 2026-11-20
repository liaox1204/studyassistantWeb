<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { getWords, getDictation, submitDictation, getSubjects } from '@/api'

const userStore = useUserStore()

const activeTab = ref('words')
const grade = ref(userStore.grade || 1)
const englishSubjectId = ref(3)
const loading = ref(false)

const gradeOptions = [
  { value: 1, label: '一年级' },
  { value: 2, label: '二年级' },
  { value: 3, label: '三年级' },
]

const words = ref([])

// 听写状态
const dictationState = ref('idle') // idle | doing | done
const dictationConfig = ref(10)
const dictationList = ref([])
const dictationAnswers = ref([])
const dictationResult = ref(null)
const startTime = ref(0)
const submitting = ref(false)

const filledCount = computed(
  () => dictationAnswers.value.filter((a) => String(a ?? '').trim() !== '').length,
)

async function loadSubjects() {
  try {
    const list = await getSubjects()
    const en = (list || []).find((s) => s.code === 'english')
    englishSubjectId.value = en?.id || 3
  } catch {
    englishSubjectId.value = 3
  }
}

async function loadWords() {
  loading.value = true
  try {
    const data = await getWords({ grade: grade.value, page: 1, page_size: 100 })
    words.value = data.items || []
  } catch {
    // 拦截器已提示
  } finally {
    loading.value = false
  }
}

// 朗读英文单词（Web Speech API）
function speak(text, lang = 'en-US') {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = lang
  utter.rate = 0.85
  window.speechSynthesis.speak(utter)
}

async function startDictation() {
  try {
    const data = await getDictation({
      grade: grade.value,
      count: dictationConfig.value,
    })
    if (!data.words?.length) {
      ElMessage.warning('该年级暂无单词数据')
      return
    }
    dictationList.value = data.words
    dictationAnswers.value = data.words.map(() => '')
    dictationResult.value = null
    dictationState.value = 'doing'
    startTime.value = Date.now()
  } catch {
    // 拦截器已提示
  }
}

function focusNext(index) {
  const next = document.querySelector(`[data-dict-index="${index + 1}"] input`)
  const target = next || document.querySelector(`[data-dict-index="${index}"] input`)
  if (target) target.focus()
}

async function submitDictationAnswers() {
  if (filledCount.value === 0) {
    ElMessage.warning('请至少拼写一个单词')
    return
  }
  submitting.value = true
  try {
    const duration = Math.max(1, Math.round((Date.now() - startTime.value) / 1000))
    const data = await submitDictation({
      subject_id: englishSubjectId.value,
      grade: grade.value,
      duration,
      words: dictationList.value.map((w, i) => ({
        word_id: w.word_id,
        user_answer: String(dictationAnswers.value[i] ?? '').trim(),
        time_cost: 0,
      })),
    })
    dictationResult.value = data
    dictationState.value = 'done'
    ElMessage.success(`判分完成，正确率 ${data.accuracy}%`)
  } catch {
    // 拦截器已提示
  } finally {
    submitting.value = false
  }
}

watch(grade, () => {
  loadWords()
  dictationState.value = 'idle'
})

onMounted(async () => {
  await loadSubjects()
  loadWords()
})
</script>

<template>
  <div class="page-wrap">
    <h2 class="page-title">🔤 英语学习</h2>
    <p class="page-sub">单词学习与听写练习，听写拼错的单词会自动进入错题本。</p>

    <div class="soft-card grade-bar">
      <span class="bar-label">选择年级：</span>
      <el-radio-group v-model="grade">
        <el-radio-button v-for="g in gradeOptions" :key="g.value" :value="g.value">
          {{ g.label }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <el-tabs v-model="activeTab" class="eng-tabs">
      <!-- ============ 单词学习 ============ -->
      <el-tab-pane label="单词学习" name="words">
        <div v-loading="loading" class="content-area">
          <el-empty v-if="!words.length && !loading" description="该年级暂无单词数据" />
          <div v-else class="grid-cards">
            <div v-for="w in words" :key="w.id" class="item-card word-card">
              <div class="word-row">
                <span class="word-text">{{ w.word }}</span>
                <el-button
                  circle
                  size="small"
                  type="primary"
                  plain
                  @click="speak(w.word)"
                >
                  <el-icon><Microphone /></el-icon>
                </el-button>
              </div>
              <div class="phonetic">{{ w.phonetic || '' }}</div>
              <div class="word-meaning">
                <el-tag v-if="w.pos" size="small" effect="plain">{{ w.pos }}</el-tag>
                {{ w.meaning }}
              </div>
              <div class="meta-line example">{{ w.example || '' }}</div>
              <div class="meta-line unit-line">
                <el-tag size="small" type="info" effect="plain">{{ w.unit || '未分单元' }}</el-tag>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- ============ 单词听写 ============ -->
      <el-tab-pane label="单词听写" name="dictation">
        <!-- 配置 -->
        <div v-if="dictationState === 'idle'" class="soft-card start-panel">
          <div class="start-icon">🎧</div>
          <h3>单词听写小测试</h3>
          <p class="start-desc">
            系统给出中文释义和音标（可点击发音），请拼写出英文单词。
          </p>
          <el-form inline class="count-form">
            <el-form-item label="单词数量">
              <el-input-number v-model="dictationConfig" :min="5" :max="30" :step="5" />
            </el-form-item>
          </el-form>
          <el-button type="primary" size="large" round @click="startDictation">
            <el-icon><VideoPlay /></el-icon> 开始听写
          </el-button>
        </div>

        <!-- 听写中 -->
        <div v-else-if="dictationState === 'doing'" class="soft-card">
          <div class="do-header">
            <span class="do-progress">
              已拼写 <b>{{ filledCount }}</b> / {{ dictationList.length }}
            </span>
            <el-progress
              :percentage="Math.round((filledCount / dictationList.length) * 100)"
              :show-text="false"
              :stroke-width="10"
              style="flex: 1; margin: 0 14px"
            />
            <el-button size="small" @click="dictationState = 'idle'">退出</el-button>
          </div>

          <div class="dict-list">
            <div v-for="(w, i) in dictationList" :key="w.word_id" class="dict-item">
              <span class="dict-index">{{ i + 1 }}</span>
              <div class="dict-prompt">
                <div class="dict-meaning">{{ w.meaning }}</div>
                <div class="dict-phonetic">
                  {{ w.phonetic || '' }}
                  <el-button
                    link
                    type="primary"
                    size="small"
                    @click="speak(w.meaning, 'zh-CN')"
                  >
                    🔊 听中文
                  </el-button>
                </div>
              </div>
              <el-input
                v-model="dictationAnswers[i]"
                :data-dict-index="i"
                placeholder="请输入英文单词"
                class="dict-input"
                @keyup.enter="focusNext(i)"
              />
            </div>
          </div>

          <div class="do-footer">
            <el-button
              type="primary"
              size="large"
              round
              :loading="submitting"
              @click="submitDictationAnswers"
            >
              提交判分
            </el-button>
          </div>
        </div>

        <!-- 结果 -->
        <div v-else class="soft-card">
          <div class="result-head">
            <div class="result-emoji">
              {{ Number(dictationResult?.accuracy) >= 80 ? '🎉' : '💪' }}
            </div>
            <div>
              <h3 style="margin: 0">本次听写成绩</h3>
              <p class="page-sub" style="margin: 4px 0 0">
                用时 {{ dictationResult?.duration }} 秒
              </p>
            </div>
          </div>

          <div class="result-grid">
            <div class="stat-block">
              <div class="num">{{ dictationResult?.total }}</div>
              <div class="label">总词数</div>
            </div>
            <div class="stat-block">
              <div class="num" style="color: #43c59e">{{ dictationResult?.correct }}</div>
              <div class="label">拼对</div>
            </div>
            <div class="stat-block">
              <div class="num" style="color: #ff6b6b">{{ dictationResult?.wrong }}</div>
              <div class="label">拼错</div>
            </div>
            <div class="stat-block">
              <div class="num">{{ dictationResult?.accuracy }}%</div>
              <div class="label">正确率</div>
            </div>
          </div>

          <el-table :data="dictationResult?.details || []" stripe max-height="420">
            <el-table-column type="index" label="#" width="55" />
            <el-table-column prop="meaning" label="中文释义" />
            <el-table-column prop="user_answer" label="你的拼写" width="150" />
            <el-table-column prop="answer" label="正确答案" width="150" />
            <el-table-column label="结果" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.is_correct" type="success" effect="light">✓ 正确</el-tag>
                <el-tag v-else type="danger" effect="light">✗ 错误</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="发音" width="80">
              <template #default="{ row }">
                <el-button circle size="small" plain @click="speak(row.answer)">
                  <el-icon><Microphone /></el-icon>
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="do-footer">
            <el-button type="primary" round @click="startDictation">再听写一次</el-button>
            <el-button round @click="dictationState = 'idle'">返回</el-button>
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

.eng-tabs :deep(.el-tabs__item) {
  font-size: 15px;
  font-weight: 700;
}

.content-area {
  min-height: 200px;
}

/* 单词卡片 */
.word-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.word-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.word-text {
  font-size: 24px;
  font-weight: 800;
  color: var(--brand-primary);
}

.phonetic {
  color: var(--text-sub);
  font-size: 14px;
  min-height: 20px;
}

.word-meaning {
  font-size: 15px;
  font-weight: 600;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.example {
  font-style: italic;
}

.unit-line {
  margin-top: 6px;
}

/* 配置面板 */
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

/* 听写列表 */
.dict-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dict-item {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #f8faff;
  border: 1px solid rgba(79, 140, 255, 0.14);
  border-radius: 12px;
  padding: 12px 14px;
}

.dict-index {
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

.dict-prompt {
  flex: 1;
  min-width: 0;
}

.dict-meaning {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
}

.dict-phonetic {
  font-size: 13px;
  color: var(--text-sub);
  display: flex;
  align-items: center;
  gap: 6px;
}

.dict-input {
  width: 200px;
  flex-shrink: 0;
}

/* 结果 */
.result-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 12px;
}

.result-emoji {
  font-size: 40px;
}

@media (max-width: 700px) {
  .dict-item {
    flex-wrap: wrap;
  }
  .dict-input {
    width: 100%;
  }
}
</style>
