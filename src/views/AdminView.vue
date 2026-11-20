<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getSubjects,
  adminListQuestions,
  adminCreateQuestion,
  adminUpdateQuestion,
  adminDeleteQuestion,
  adminListContent,
  adminCreateContent,
  adminUpdateContent,
  adminDeleteContent,
  adminListUsers,
  adminUpdateUser,
  adminListBadges,
  adminCreateBadge,
  adminUpdateBadge,
  adminLogs,
} from '@/api'

const activeTab = ref('questions')
const subjects = ref([])

// ================= 题库 =================
const questions = ref([])
const qTotal = ref(0)
const qPage = ref(1)
const qGrade = ref(null)
const qSubject = ref(null)
const qLoading = ref(false)

const qDialog = ref(false)
const qEditing = ref(null)
const qForm = reactive({
  subject_id: 1,
  knowledge_point_id: null,
  grade: 1,
  type: 2,
  difficulty: 1,
  content: '',
  options: '',
  answer: '',
  analysis: '',
})

// ================= 内容库 =================
const contentModule = ref('character')
const contentItems = ref([])
const contentTotal = ref(0)
const contentPage = ref(1)
const contentGrade = ref(null)
const contentLoading = ref(false)
const contentDialog = ref(false)
const contentEditing = ref(null)
const contentForm = reactive({})

const contentFields = {
  character: [
    { key: 'char', label: '汉字', required: true },
    { key: 'pinyin', label: '拼音', required: true },
    { key: 'radical', label: '部首' },
    { key: 'strokes', label: '笔画数', number: true },
    { key: 'stroke_order', label: '笔顺' },
    { key: 'words', label: '组词' },
    { key: 'sentence', label: '例句' },
  ],
  idiom: [
    { key: 'name', label: '成语', required: true },
    { key: 'pinyin', label: '拼音', required: true },
    { key: 'meaning', label: '释义', required: true, textarea: true },
    { key: 'source', label: '出处', textarea: true },
    { key: 'example', label: '造句', textarea: true },
    { key: 'synonym', label: '近义词' },
    { key: 'antonym', label: '反义词' },
  ],
  poem: [
    { key: 'title', label: '标题', required: true },
    { key: 'author', label: '作者', required: true },
    { key: 'dynasty', label: '朝代' },
    { key: 'content', label: '原文', required: true, textarea: true },
    { key: 'translation', label: '译文', textarea: true },
    { key: 'appreciation', label: '赏析', textarea: true },
  ],
  word: [
    { key: 'word', label: '单词', required: true },
    { key: 'phonetic', label: '音标' },
    { key: 'pos', label: '词性' },
    { key: 'meaning', label: '中文释义', required: true },
    { key: 'example', label: '例句' },
    { key: 'unit', label: '单元' },
  ],
}

// ================= 用户 =================
const users = ref([])
const uTotal = ref(0)
const uPage = ref(1)
const uRole = ref(null)
const uKeyword = ref('')
const uLoading = ref(false)

// ================= 徽章 =================
const badges = ref([])
const badgeDialog = ref(false)
const badgeEditing = ref(null)
const badgeForm = reactive({
  code: '',
  name: '',
  icon: '',
  description: '',
  condition_type: 'streak',
  condition_value: 7,
  points: 10,
  status: 1,
})

// ================= 日志 =================
const logs = ref([])
const logTotal = ref(0)
const logPage = ref(1)

const moduleLabels = {
  question: '题库',
  character: '汉字',
  idiom: '成语',
  poem: '古诗',
  word: '单词',
  config: '配置',
}
const actionLabels = { create: '新增', update: '修改', delete: '删除' }

async function loadSubjects() {
  try {
    subjects.value = (await getSubjects()) || []
  } catch {
    subjects.value = []
  }
}

// ---------------- 题库 ----------------
async function loadQuestions() {
  qLoading.value = true
  try {
    const data = await adminListQuestions({
      grade: qGrade.value || undefined,
      subject_id: qSubject.value || undefined,
      page: qPage.value,
      page_size: 10,
    })
    questions.value = data.items || []
    qTotal.value = data.total || 0
  } catch {
    questions.value = []
  } finally {
    qLoading.value = false
  }
}

function openQuestionDialog(row) {
  qEditing.value = row
  if (row) {
    qForm.subject_id = row.subject_id
    qForm.knowledge_point_id = row.knowledge_point_id
    qForm.grade = row.grade
    qForm.type = row.type
    qForm.difficulty = row.difficulty
    qForm.content = row.content
    qForm.options = row.options ? row.options.join(',') : ''
    qForm.answer = row.answer
    qForm.analysis = row.analysis || ''
  } else {
    qForm.subject_id = subjects.value.find((s) => s.code === 'math')?.id || 1
    qForm.knowledge_point_id = null
    qForm.grade = 1
    qForm.type = 2
    qForm.difficulty = 1
    qForm.content = ''
    qForm.options = ''
    qForm.answer = ''
    qForm.analysis = ''
  }
  qDialog.value = true
}

async function saveQuestion() {
  if (!qForm.content.trim() || !String(qForm.answer).trim()) {
    ElMessage.warning('题干和答案不能为空')
    return
  }
  const payload = {
    subject_id: qForm.subject_id,
    knowledge_point_id: qForm.knowledge_point_id || null,
    grade: qForm.grade,
    type: qForm.type,
    difficulty: qForm.difficulty,
    content: qForm.content.trim(),
    options: qForm.options
      ? qForm.options.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
      : null,
    answer: String(qForm.answer).trim(),
    analysis: qForm.analysis.trim() || null,
  }
  try {
    if (qEditing.value) {
      await adminUpdateQuestion(qEditing.value.id, payload)
      ElMessage.success('已修改')
    } else {
      await adminCreateQuestion(payload)
      ElMessage.success('已新增')
    }
    qDialog.value = false
    loadQuestions()
  } catch {
    // 拦截器已提示
  }
}

async function removeQuestion(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除题目「${row.content.slice(0, 20)}」吗？`,
      '删除题目',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
    await adminDeleteQuestion(row.id)
    ElMessage.success('已删除')
    loadQuestions()
  } catch {
    // 取消或已被引用
  }
}

// ---------------- 内容库 ----------------
async function loadContent() {
  contentLoading.value = true
  try {
    const data = await adminListContent(contentModule.value, {
      grade: contentGrade.value || undefined,
      page: contentPage.value,
      page_size: 10,
    })
    contentItems.value = data.items || []
    contentTotal.value = data.total || 0
  } catch {
    contentItems.value = []
  } finally {
    contentLoading.value = false
  }
}

function openContentDialog(row) {
  contentEditing.value = row
  Object.keys(contentForm).forEach((k) => delete contentForm[k])
  const fields = contentFields[contentModule.value] || []
  fields.forEach((f) => {
    contentForm[f.key] = row ? (row[f.key] ?? '') : ''
  })
  contentForm.grade = row ? row.grade : 1
  contentDialog.value = true
}

async function saveContent() {
  const fields = contentFields[contentModule.value] || []
  const payload = { grade: contentForm.grade }
  for (const f of fields) {
    const v = contentForm[f.key]
    if (f.required && (v === '' || v === null || v === undefined)) {
      ElMessage.warning(`${f.label}不能为空`)
      return
    }
    if (v !== '' && v !== null && v !== undefined) {
      payload[f.key] = f.number ? Number(v) : v
    }
  }
  try {
    if (contentEditing.value) {
      await adminUpdateContent(contentModule.value, contentEditing.value.id, payload)
      ElMessage.success('已修改')
    } else {
      await adminCreateContent(contentModule.value, payload)
      ElMessage.success('已新增')
    }
    contentDialog.value = false
    loadContent()
  } catch {
    // 拦截器已提示
  }
}

async function removeContent(row) {
  try {
    await ElMessageBox.confirm('确定删除该条内容吗？', '删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await adminDeleteContent(contentModule.value, row.id)
    ElMessage.success('已删除')
    loadContent()
  } catch {
    // 取消
  }
}

function switchModule(mod) {
  contentModule.value = mod
  contentPage.value = 1
  loadContent()
}

// ---------------- 用户 ----------------
async function loadUsers() {
  uLoading.value = true
  try {
    const data = await adminListUsers({
      role: uRole.value || undefined,
      keyword: uKeyword.value || undefined,
      page: uPage.value,
      page_size: 10,
    })
    users.value = data.items || []
    uTotal.value = data.total || 0
  } catch {
    users.value = []
  } finally {
    uLoading.value = false
  }
}

async function toggleUserStatus(row) {
  const next = row.status === 1 ? 0 : 1
  try {
    await adminUpdateUser(row.id, { status: next })
    ElMessage.success(next === 0 ? '已禁用' : '已启用')
    loadUsers()
  } catch {
    // 拦截器已提示
  }
}

async function changeUserGrade(row, grade) {
  try {
    await adminUpdateUser(row.id, { grade })
    ElMessage.success('年级已更新')
    loadUsers()
  } catch {
    // 拦截器已提示
  }
}

// ---------------- 徽章 ----------------
async function loadBadges() {
  try {
    badges.value = (await adminListBadges()) || []
  } catch {
    badges.value = []
  }
}

function openBadgeDialog(row) {
  badgeEditing.value = row
  if (row) {
    badgeForm.code = row.code
    badgeForm.name = row.name
    badgeForm.icon = row.icon || ''
    badgeForm.description = row.description || ''
    badgeForm.condition_type = row.condition_json?.type || 'streak'
    badgeForm.condition_value =
      row.condition_json?.days ?? row.condition_json?.count ?? row.condition_json?.points ?? 7
    badgeForm.points = row.points
    badgeForm.status = row.status
  } else {
    badgeForm.code = ''
    badgeForm.name = ''
    badgeForm.icon = '🏅'
    badgeForm.description = ''
    badgeForm.condition_type = 'streak'
    badgeForm.condition_value = 7
    badgeForm.points = 10
    badgeForm.status = 1
  }
  badgeDialog.value = true
}

function buildCondition() {
  const v = Number(badgeForm.condition_value) || 1
  if (badgeForm.condition_type === 'streak') return { type: 'streak', days: v }
  if (badgeForm.condition_type === 'point_total') return { type: 'point_total', points: v }
  return { type: badgeForm.condition_type, count: v }
}

async function saveBadge() {
  if (!badgeForm.code.trim() || !badgeForm.name.trim()) {
    ElMessage.warning('编码和名称不能为空')
    return
  }
  const payload = {
    code: badgeForm.code.trim(),
    name: badgeForm.name.trim(),
    icon: badgeForm.icon || null,
    description: badgeForm.description || null,
    condition_json: buildCondition(),
    points: Number(badgeForm.points) || 0,
    status: badgeForm.status,
  }
  try {
    if (badgeEditing.value) {
      await adminUpdateBadge(badgeEditing.value.id, payload)
      ElMessage.success('已修改')
    } else {
      await adminCreateBadge(payload)
      ElMessage.success('已新增')
    }
    badgeDialog.value = false
    loadBadges()
  } catch {
    // 拦截器已提示
  }
}

// ---------------- 日志 ----------------
async function loadLogs() {
  try {
    const data = await adminLogs({ page: logPage.value, page_size: 20 })
    logs.value = data.items || []
    logTotal.value = data.total || 0
  } catch {
    logs.value = []
  }
}

function formatTime(v) {
  return v ? v.replace('T', ' ').slice(0, 19) : '-'
}

function onTabChange(tab) {
  if (tab === 'questions') loadQuestions()
  else if (tab === 'content') loadContent()
  else if (tab === 'users') loadUsers()
  else if (tab === 'badges') loadBadges()
  else if (tab === 'logs') loadLogs()
}

onMounted(async () => {
  await loadSubjects()
  loadQuestions()
})
</script>

<template>
  <div class="page-wrap">
    <h2 class="page-title">⚙️ 内容管理</h2>
    <p class="page-sub">仅管理员可见：维护题库、内容库、用户与激励配置，所有变更都会记录操作日志。</p>

    <el-tabs v-model="activeTab" class="adm-tabs" @tab-change="onTabChange">
      <!-- ============ 题库管理 ============ -->
      <el-tab-pane label="题库管理" name="questions">
        <div class="soft-card">
          <div class="toolbar">
            <div class="filters">
              <el-select v-model="qGrade" placeholder="全部年级" clearable style="width: 130px" @change="qPage = 1; loadQuestions()">
                <el-option :value="1" label="一年级" />
                <el-option :value="2" label="二年级" />
                <el-option :value="3" label="三年级" />
              </el-select>
              <el-select v-model="qSubject" placeholder="全部学科" clearable style="width: 130px" @change="qPage = 1; loadQuestions()">
                <el-option v-for="s in subjects" :key="s.id" :value="s.id" :label="s.name" />
              </el-select>
            </div>
            <el-button type="primary" round @click="openQuestionDialog(null)">
              <el-icon><Plus /></el-icon> 新增题目
            </el-button>
          </div>

          <el-table :data="questions" stripe v-loading="qLoading">
            <el-table-column prop="id" label="ID" width="70" />
            <el-table-column prop="content" label="题干" min-width="180" />
            <el-table-column prop="answer" label="答案" width="100" />
            <el-table-column label="年级" width="90">
              <template #default="{ row }">{{ row.grade }} 年级</template>
            </el-table-column>
            <el-table-column label="难度" width="80">
              <template #default="{ row }">{{ row.difficulty }}</template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openQuestionDialog(row)">编辑</el-button>
                <el-button link type="danger" @click="removeQuestion(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-pagination
            v-if="qTotal > 10"
            v-model:current-page="qPage"
            :page-size="10"
            :total="qTotal"
            layout="prev, pager, next"
            style="margin-top: 14px; justify-content: center"
            @current-change="loadQuestions"
          />
        </div>
      </el-tab-pane>

      <!-- ============ 内容库 ============ -->
      <el-tab-pane label="内容库管理" name="content">
        <div class="soft-card">
          <div class="toolbar">
            <div class="filters">
              <el-radio-group :model-value="contentModule" @update:model-value="switchModule">
                <el-radio-button value="character">汉字</el-radio-button>
                <el-radio-button value="idiom">成语</el-radio-button>
                <el-radio-button value="poem">古诗</el-radio-button>
                <el-radio-button value="word">单词</el-radio-button>
              </el-radio-group>
              <el-select v-model="contentGrade" placeholder="全部年级" clearable style="width: 120px" @change="contentPage = 1; loadContent()">
                <el-option :value="1" label="一年级" />
                <el-option :value="2" label="二年级" />
                <el-option :value="3" label="三年级" />
              </el-select>
            </div>
            <el-button type="primary" round @click="openContentDialog(null)">
              <el-icon><Plus /></el-icon> 新增
            </el-button>
          </div>

          <el-table :data="contentItems" stripe v-loading="contentLoading" max-height="520">
            <el-table-column prop="id" label="ID" width="70" />
            <el-table-column
              v-for="f in contentFields[contentModule]"
              :key="f.key"
              :prop="f.key"
              :label="f.label"
              :min-width="f.textarea ? 180 : 100"
              show-overflow-tooltip
            />
            <el-table-column label="年级" width="85">
              <template #default="{ row }">{{ row.grade }}</template>
            </el-table-column>
            <el-table-column label="操作" width="130" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openContentDialog(row)">编辑</el-button>
                <el-button link type="danger" @click="removeContent(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-pagination
            v-if="contentTotal > 10"
            v-model:current-page="contentPage"
            :page-size="10"
            :total="contentTotal"
            layout="prev, pager, next"
            style="margin-top: 14px; justify-content: center"
            @current-change="loadContent"
          />
        </div>
      </el-tab-pane>

      <!-- ============ 用户管理 ============ -->
      <el-tab-pane label="用户管理" name="users">
        <div class="soft-card">
          <div class="toolbar">
            <div class="filters">
              <el-select v-model="uRole" placeholder="全部角色" clearable style="width: 130px" @change="uPage = 1; loadUsers()">
                <el-option :value="1" label="学生" />
                <el-option :value="2" label="管理员" />
                <el-option :value="3" label="家长" />
              </el-select>
              <el-input
                v-model="uKeyword"
                placeholder="搜索用户名/昵称"
                clearable
                style="width: 200px"
                @keyup.enter="uPage = 1; loadUsers()"
                @clear="uPage = 1; loadUsers()"
              />
              <el-button @click="uPage = 1; loadUsers()">搜索</el-button>
            </div>
          </div>

          <el-table :data="users" stripe v-loading="uLoading">
            <el-table-column prop="id" label="ID" width="70" />
            <el-table-column prop="username" label="用户名" width="130" />
            <el-table-column prop="nickname" label="昵称" width="120" />
            <el-table-column label="角色" width="90">
              <template #default="{ row }">
                <el-tag v-if="row.role === 1" type="success" effect="light">学生</el-tag>
                <el-tag v-else-if="row.role === 2" type="danger" effect="light">管理员</el-tag>
                <el-tag v-else type="warning" effect="light">家长</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="年级" width="120">
              <template #default="{ row }">
                <el-select
                  v-if="row.role === 1"
                  :model-value="row.grade"
                  size="small"
                  style="width: 100px"
                  @update:model-value="(v) => changeUserGrade(row, v)"
                >
                  <el-option :value="1" label="一年级" />
                  <el-option :value="2" label="二年级" />
                  <el-option :value="3" label="三年级" />
                </el-select>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="积分" width="100">
              <template #default="{ row }">{{ row.point_balance }}</template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="row.status === 1 ? 'success' : 'info'" effect="plain">
                  {{ row.status === 1 ? '正常' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="110" fixed="right">
              <template #default="{ row }">
                <el-button
                  link
                  :type="row.status === 1 ? 'danger' : 'primary'"
                  @click="toggleUserStatus(row)"
                >
                  {{ row.status === 1 ? '禁用' : '启用' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-pagination
            v-if="uTotal > 10"
            v-model:current-page="uPage"
            :page-size="10"
            :total="uTotal"
            layout="prev, pager, next"
            style="margin-top: 14px; justify-content: center"
            @current-change="loadUsers"
          />
        </div>
      </el-tab-pane>

      <!-- ============ 配置管理 ============ -->
      <el-tab-pane label="配置管理" name="badges">
        <div class="soft-card">
          <div class="toolbar">
            <h3 class="section-title" style="margin: 0">徽章条件配置</h3>
            <el-button type="primary" round @click="openBadgeDialog(null)">
              <el-icon><Plus /></el-icon> 新增徽章
            </el-button>
          </div>

          <el-table :data="badges" stripe>
            <el-table-column label="图标" width="80">
              <template #default="{ row }">
                <span style="font-size: 22px">{{ row.icon || '🏅' }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="name" label="名称" width="130" />
            <el-table-column prop="code" label="编码" width="140" />
            <el-table-column prop="description" label="描述" min-width="150" />
            <el-table-column label="解锁条件" width="180">
              <template #default="{ row }">
                <code class="cond-code">{{ JSON.stringify(row.condition_json) }}</code>
              </template>
            </el-table-column>
            <el-table-column label="奖励" width="90">
              <template #default="{ row }">{{ row.points }} 分</template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="row.status === 1 ? 'success' : 'info'" effect="plain">
                  {{ row.status === 1 ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openBadgeDialog(row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- ============ 操作日志 ============ -->
      <el-tab-pane label="操作日志" name="logs">
        <div class="soft-card">
          <el-table :data="logs" stripe>
            <el-table-column prop="id" label="ID" width="70" />
            <el-table-column label="模块" width="100">
              <template #default="{ row }">
                <el-tag effect="plain">{{ moduleLabels[row.module] || row.module }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="90">
              <template #default="{ row }">{{ actionLabels[row.action] || row.action }}</template>
            </el-table-column>
            <el-table-column prop="target_id" label="目标ID" width="90" />
            <el-table-column prop="detail" label="变更摘要" min-width="200" show-overflow-tooltip />
            <el-table-column prop="admin_id" label="管理员" width="90" />
            <el-table-column prop="ip" label="IP" width="120" />
            <el-table-column label="时间" width="170">
              <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
            </el-table-column>
          </el-table>

          <el-pagination
            v-if="logTotal > 20"
            v-model:current-page="logPage"
            :page-size="20"
            :total="logTotal"
            layout="prev, pager, next"
            style="margin-top: 14px; justify-content: center"
            @current-change="loadLogs"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 题目弹窗 -->
    <el-dialog v-model="qDialog" :title="qEditing ? '编辑题目' : '新增题目'" width="560px">
      <el-form label-width="90px">
        <el-form-item label="学科">
          <el-select v-model="qForm.subject_id" style="width: 100%">
            <el-option v-for="s in subjects" :key="s.id" :value="s.id" :label="s.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="年级">
          <el-radio-group v-model="qForm.grade">
            <el-radio-button :value="1">一年级</el-radio-button>
            <el-radio-button :value="2">二年级</el-radio-button>
            <el-radio-button :value="3">三年级</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="题型">
          <el-radio-group v-model="qForm.type">
            <el-radio-button :value="1">口算</el-radio-button>
            <el-radio-button :value="2">选择</el-radio-button>
            <el-radio-button :value="3">填空</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="难度">
          <el-radio-group v-model="qForm.difficulty">
            <el-radio-button :value="1">简单</el-radio-button>
            <el-radio-button :value="2">中等</el-radio-button>
            <el-radio-button :value="3">困难</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="题干">
          <el-input v-model="qForm.content" type="textarea" :rows="2" placeholder="例如：3 + 5 = ?" />
        </el-form-item>
        <el-form-item label="选项">
          <el-input v-model="qForm.options" placeholder="选择题填写，用逗号分隔，如：6,7,8,9" />
        </el-form-item>
        <el-form-item label="答案">
          <el-input v-model="qForm.answer" placeholder="标准答案" />
        </el-form-item>
        <el-form-item label="解析">
          <el-input v-model="qForm.analysis" type="textarea" :rows="2" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="qDialog = false">取消</el-button>
        <el-button type="primary" @click="saveQuestion">保存</el-button>
      </template>
    </el-dialog>

    <!-- 内容弹窗 -->
    <el-dialog
      v-model="contentDialog"
      :title="contentEditing ? '编辑内容' : '新增内容'"
      width="520px"
    >
      <el-form label-width="80px">
        <el-form-item label="年级">
          <el-radio-group v-model="contentForm.grade">
            <el-radio-button :value="1">一年级</el-radio-button>
            <el-radio-button :value="2">二年级</el-radio-button>
            <el-radio-button :value="3">三年级</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item
          v-for="f in contentFields[contentModule]"
          :key="f.key"
          :label="f.label"
          :required="f.required"
        >
          <el-input
            v-model="contentForm[f.key]"
            :type="f.textarea ? 'textarea' : 'text'"
            :rows="f.textarea ? 3 : undefined"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="contentDialog = false">取消</el-button>
        <el-button type="primary" @click="saveContent">保存</el-button>
      </template>
    </el-dialog>

    <!-- 徽章弹窗 -->
    <el-dialog v-model="badgeDialog" :title="badgeEditing ? '编辑徽章' : '新增徽章'" width="520px">
      <el-form label-width="90px">
        <el-form-item label="徽章编码" required>
          <el-input v-model="badgeForm.code" placeholder="唯一编码，如 streak_7" />
        </el-form-item>
        <el-form-item label="徽章名称" required>
          <el-input v-model="badgeForm.name" placeholder="如：坚持之星" />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="badgeForm.icon" placeholder="emoji 或图片地址" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="badgeForm.description" placeholder="解锁条件描述" />
        </el-form-item>
        <el-form-item label="条件类型">
          <el-select v-model="badgeForm.condition_type" style="width: 100%">
            <el-option value="streak" label="连续签到天数" />
            <el-option value="practice_count" label="累计练习次数" />
            <el-option value="perfect_practice" label="满分练习次数" />
            <el-option value="wrong_fixed" label="错题毕业数量" />
            <el-option value="point_total" label="累计积分" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标值">
          <el-input-number v-model="badgeForm.condition_value" :min="1" />
        </el-form-item>
        <el-form-item label="奖励积分">
          <el-input-number v-model="badgeForm.points" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="badgeForm.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="badgeDialog = false">取消</el-button>
        <el-button type="primary" @click="saveBadge">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.adm-tabs :deep(.el-tabs__item) {
  font-size: 15px;
  font-weight: 700;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.cond-code {
  font-size: 11.5px;
  color: #6b7590;
  background: #f4f7ff;
  padding: 2px 6px;
  border-radius: 5px;
  word-break: break-all;
}
</style>
