<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getParentStudents,
  bindStudent,
  getParentStudentReports,
  getParentStudentMastery,
} from '@/api'

const students = ref([])
const currentStudent = ref(null)
const reports = ref([])
const mastery = ref([])
const loading = ref(false)
const bindVisible = ref(false)
const bindUsername = ref('')
const binding = ref(false)

const levelTag = {
  1: { text: '薄弱', type: 'danger' },
  2: { text: '巩固', type: 'warning' },
  3: { text: '掌握', type: 'success' },
}

async function loadStudents() {
  loading.value = true
  try {
    students.value = (await getParentStudents()) || []
    if (students.value.length && !currentStudent.value) {
      await selectStudent(students.value[0])
    }
  } catch {
    students.value = []
  } finally {
    loading.value = false
  }
}

async function selectStudent(s) {
  currentStudent.value = s
  await Promise.all([loadReports(s.student_id), loadMastery(s.student_id)])
}

async function loadReports(studentId) {
  try {
    reports.value = (await getParentStudentReports(studentId)) || []
  } catch {
    reports.value = []
  }
}

async function loadMastery(studentId) {
  try {
    mastery.value = (await getParentStudentMastery(studentId)) || []
  } catch {
    mastery.value = []
  }
}

async function handleBind() {
  const name = bindUsername.value.trim()
  if (!name) {
    ElMessage.warning('请输入孩子的用户名')
    return
  }
  binding.value = true
  try {
    await bindStudent({ student_username: name })
    ElMessage.success('绑定成功')
    bindVisible.value = false
    bindUsername.value = ''
    await loadStudents()
  } catch {
    // 拦截器已提示
  } finally {
    binding.value = false
  }
}

function formatTime(v) {
  return v ? v.replace('T', ' ').slice(0, 16) : '-'
}

onMounted(loadStudents)
</script>

<template>
  <div class="page-wrap">
    <h2 class="page-title">👨‍👩‍👧 孩子学情</h2>
    <p class="page-sub">家长可只读查看孩子的学习报告与掌握情况，不能修改任何学习数据。</p>

    <div class="soft-card toolbar" v-loading="loading">
      <div class="student-tabs">
        <span class="bar-label">我的孩子：</span>
        <el-radio-group
          v-if="students.length"
          :model-value="currentStudent?.student_id"
          @update:model-value="(id) => selectStudent(students.find((s) => s.student_id === id))"
        >
          <el-radio-button v-for="s in students" :key="s.student_id" :value="s.student_id">
            {{ s.nickname }}（{{ s.grade ?? '-' }}年级）
          </el-radio-button>
        </el-radio-group>
        <el-tag v-else type="info" effect="plain">尚未绑定孩子</el-tag>
      </div>
      <el-button type="primary" round @click="bindVisible = true">
        <el-icon><Plus /></el-icon> 绑定孩子
      </el-button>
    </div>

    <el-empty
      v-if="!students.length && !loading"
      description="还没有绑定孩子，点击右上角「绑定孩子」输入孩子的用户名即可"
    />

    <template v-else-if="currentStudent">
      <!-- 概览 -->
      <div class="result-grid" style="margin-top: 16px">
        <div class="stat-block">
          <div class="num">{{ reports.length }}</div>
          <div class="label">学情报告</div>
        </div>
        <div class="stat-block">
          <div class="num">{{ mastery.length }}</div>
          <div class="label">学习知识点</div>
        </div>
        <div class="stat-block">
          <div class="num" style="color: #43c59e">
            {{ mastery.filter((m) => m.level === 3).length }}
          </div>
          <div class="label">已掌握</div>
        </div>
        <div class="stat-block">
          <div class="num" style="color: #ff6b6b">
            {{ mastery.filter((m) => m.level === 1).length }}
          </div>
          <div class="label">需加强</div>
        </div>
      </div>

      <!-- 报告 -->
      <div class="soft-card" style="margin-top: 16px">
        <h3 class="section-title">学情报告</h3>
        <el-empty v-if="!reports.length" description="孩子还没有生成学情报告" />
        <div v-else class="report-list">
          <div v-for="r in reports" :key="r.id" class="report-item">
            <div class="report-top">
              <el-tag effect="plain">{{ r.period_label }}</el-tag>
              <span class="report-range">{{ r.period_start }} ~ {{ r.period_end }}</span>
              <span class="report-acc">{{ r.avg_accuracy }}%</span>
            </div>
            <div class="report-meta">
              练习 {{ r.practice_count }} 次 · 作答 {{ r.total_questions }} 题 ·
              用时 {{ Math.round((r.total_duration || 0) / 60) }} 分钟
            </div>
            <p v-if="r.summary" class="report-summary">{{ r.summary }}</p>
          </div>
        </div>
      </div>

      <!-- 掌握度 -->
      <div class="soft-card" style="margin-top: 16px">
        <h3 class="section-title">知识点掌握情况</h3>
        <el-empty v-if="!mastery.length" description="孩子还没有练习数据" />
        <el-table v-else :data="mastery" stripe>
          <el-table-column prop="subject" label="学科" width="90" />
          <el-table-column prop="knowledge_point" label="知识点" min-width="150" />
          <el-table-column label="答对/作答" width="120">
            <template #default="{ row }">{{ row.correct_count }} / {{ row.total_count }}</template>
          </el-table-column>
          <el-table-column label="正确率" width="170">
            <template #default="{ row }">
              <el-progress
                :percentage="Number(row.accuracy) || 0"
                :stroke-width="10"
                :color="row.level === 3 ? '#43c59e' : row.level === 1 ? '#ff6b6b' : '#ffb020'"
              />
            </template>
          </el-table-column>
          <el-table-column label="掌握度" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.level" :type="levelTag[row.level].type" effect="light">
                {{ levelTag[row.level].text }}
              </el-tag>
              <el-tag v-else type="info" effect="plain">测评中</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="最近练习" width="160">
            <template #default="{ row }">{{ formatTime(row.last_practiced_at) }}</template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <!-- 绑定弹窗 -->
    <el-dialog v-model="bindVisible" title="绑定孩子账号" width="420px">
      <el-form label-position="top">
        <el-form-item label="孩子的用户名">
          <el-input
            v-model="bindUsername"
            placeholder="请输入孩子登录用的用户名"
            clearable
            @keyup.enter="handleBind"
          />
        </el-form-item>
      </el-form>
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="请确认是您孩子本人的账号，绑定后可只读查看学情。"
      />
      <template #footer>
        <el-button @click="bindVisible = false">取消</el-button>
        <el-button type="primary" :loading="binding" @click="handleBind">确定绑定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  padding: 16px 20px;
}

.student-tabs {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.bar-label {
  font-weight: 700;
  font-size: 14px;
}

.report-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.report-item {
  padding: 16px 18px;
  border-radius: 14px;
  background: #f8faff;
  border: 1px solid rgba(79, 140, 255, 0.12);
}

.report-top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.report-range {
  flex: 1;
  font-size: 13.5px;
  color: var(--text-main);
}

.report-acc {
  font-size: 18px;
  font-weight: 800;
  color: var(--brand-primary);
}

.report-meta {
  font-size: 12.5px;
  color: var(--text-sub);
}

.report-summary {
  margin: 8px 0 0;
  font-size: 13.5px;
  line-height: 1.8;
  color: #4b5470;
}
</style>
