<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getMastery, getReports, createReport, getWeakPoints } from '@/api'

const activeTab = ref('mastery')
const loading = ref(false)

const mastery = ref([])
const weakList = ref([])
const reports = ref([])
const currentReport = ref(null)
const reportType = ref(1)
const generating = ref(false)

const levelTag = {
  1: { text: '薄弱', type: 'danger' },
  2: { text: '巩固', type: 'warning' },
  3: { text: '掌握', type: 'success' },
}

const evaluated = computed(() => mastery.value.filter((m) => m.level !== null))
const masteredCount = computed(() => mastery.value.filter((m) => m.level === 3).length)

/** 雷达图数据：取前 6 个已测评知识点 */
const radarPoints = computed(() => evaluated.value.slice(0, 6))

function radarPolygon(values, radius = 70, cx = 100, cy = 100) {
  if (!values.length) return ''
  const n = values.length
  return values
    .map((v, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2
      const r = (Math.max(0, Math.min(100, v)) / 100) * radius
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
    })
    .join(' ')
}

function radarAxisLabels(values, radius = 70, cx = 100, cy = 100) {
  const n = values.length
  return values.map((v, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    return {
      x: cx + (radius + 16) * Math.cos(angle),
      y: cy + (radius + 16) * Math.sin(angle),
      label: v.knowledge_point,
      value: v.accuracy,
    }
  })
}

const radarGrid = computed(() => {
  const n = Math.max(radarPoints.value.length, 3)
  return [0.25, 0.5, 0.75, 1].map((scale) =>
    Array.from({ length: n }, (_, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2
      return `${100 + 70 * scale * Math.cos(angle)},${100 + 70 * scale * Math.sin(angle)}`
    }).join(' ')
  )
})

/** 趋势折线图坐标 */
const trendPath = computed(() => {
  const trend = currentReport.value?.trend || []
  if (trend.length < 2) return ''
  return trend
    .map((p, i) => {
      const x = (i / (trend.length - 1)) * 520 + 40
      const y = 160 - (Math.min(100, p.accuracy) / 100) * 130
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')
})

const trendDots = computed(() => {
  const trend = currentReport.value?.trend || []
  if (!trend.length) return []
  return trend.map((p, i) => ({
    cx: trend.length === 1 ? 300 : (i / (trend.length - 1)) * 520 + 40,
    cy: 160 - (Math.min(100, p.accuracy) / 100) * 130,
    label: p.date.slice(5),
    accuracy: p.accuracy,
  }))
})

const subjectBars = computed(() => currentReport.value?.subject_distribution || [])
const maxSubjectCount = computed(() =>
  Math.max(1, ...subjectBars.value.map((s) => s.count))
)

async function loadMastery() {
  loading.value = true
  try {
    mastery.value = (await getMastery()) || []
    weakList.value = (await getWeakPoints()) || []
  } catch {
    mastery.value = []
  } finally {
    loading.value = false
  }
}

async function loadReports() {
  try {
    reports.value = (await getReports()) || []
    if (reports.value.length && !currentReport.value) {
      await openReport(reports.value[0])
    }
  } catch {
    reports.value = []
  }
}

async function openReport(r) {
  // 列表接口不含图表数据，重新生成同一周期以获得完整数据
  try {
    const data = await createReport({ period_type: r.period_type })
    currentReport.value = data
  } catch {
    currentReport.value = null
  }
}

async function generateReport() {
  generating.value = true
  try {
    const data = await createReport({ period_type: reportType.value })
    currentReport.value = data
    ElMessage.success(`${data.period_label}已生成`)
    await loadReports()
  } catch {
    // 拦截器已提示
  } finally {
    generating.value = false
  }
}

function formatDuration(sec) {
  if (!sec) return '0 分钟'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`
}

onMounted(async () => {
  await loadMastery()
  loadReports()
})
</script>

<template>
  <div class="page-wrap">
    <h2 class="page-title">📊 学情分析</h2>
    <p class="page-sub">看看自己哪些知识点掌握得好，哪些还需要多加练习。</p>

    <!-- 概览 -->
    <div class="result-grid">
      <div class="stat-block">
        <div class="num">{{ mastery.length }}</div>
        <div class="label">已学习知识点</div>
      </div>
      <div class="stat-block">
        <div class="num" style="color: #43c59e">{{ masteredCount }}</div>
        <div class="label">已掌握</div>
      </div>
      <div class="stat-block">
        <div class="num" style="color: #ff6b6b">{{ weakList.length }}</div>
        <div class="label">薄弱知识点</div>
      </div>
      <div class="stat-block">
        <div class="num">{{ evaluated.length }}</div>
        <div class="label">已完成测评</div>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="ana-tabs">
      <!-- 掌握度 -->
      <el-tab-pane label="知识点掌握度" name="mastery">
        <div class="soft-card" v-loading="loading">
          <el-empty
            v-if="!mastery.length && !loading"
            description="还没有学习数据，先去做几次练习吧！"
          />
          <template v-else>
            <el-table :data="mastery" stripe>
              <el-table-column prop="subject" label="学科" width="90" />
              <el-table-column prop="knowledge_point" label="知识点" min-width="150" />
              <el-table-column label="作答/答对" width="120">
                <template #default="{ row }">
                  {{ row.correct_count }} / {{ row.total_count }}
                </template>
              </el-table-column>
              <el-table-column label="正确率" width="180">
                <template #default="{ row }">
                  <el-progress
                    :percentage="Number(row.accuracy) || 0"
                    :stroke-width="10"
                    :color="row.level === 3 ? '#43c59e' : row.level === 1 ? '#ff6b6b' : '#ffb020'"
                  />
                </template>
              </el-table-column>
              <el-table-column label="掌握度" width="110">
                <template #default="{ row }">
                  <el-tag
                    v-if="row.level"
                    :type="levelTag[row.level].type"
                    effect="light"
                  >
                    {{ levelTag[row.level].text }}
                  </el-tag>
                  <el-tag v-else type="info" effect="plain">测评中</el-tag>
                </template>
              </el-table-column>
            </el-table>
            <div class="rule-tip">
              判定规则：正确率 ≥85% 为「掌握」，60%–85% 为「巩固」，&lt;60% 为「薄弱」；
              作答少于 5 次暂不判定，避免偶然误差。
            </div>
          </template>
        </div>

        <!-- 雷达图 -->
        <div v-if="radarPoints.length >= 3" class="soft-card" style="margin-top: 16px">
          <h3 class="section-title">知识点掌握雷达图</h3>
          <div class="radar-wrap">
            <svg viewBox="0 0 200 200" class="radar-svg">
              <polygon
                v-for="(g, i) in radarGrid"
                :key="i"
                :points="g"
                fill="none"
                stroke="#e2e8f8"
                stroke-width="1"
              />
              <polygon
                :points="radarPolygon(radarPoints.map((r) => r.accuracy))"
                fill="rgba(79,140,255,0.28)"
                stroke="#4f8cff"
                stroke-width="2"
              />
              <circle
                v-for="(pt, i) in radarPoints"
                :key="`p${i}`"
                :cx="100 + (pt.accuracy / 100) * 70 * Math.cos((Math.PI * 2 * i) / radarPoints.length - Math.PI / 2)"
                :cy="100 + (pt.accuracy / 100) * 70 * Math.sin((Math.PI * 2 * i) / radarPoints.length - Math.PI / 2)"
                r="3"
                fill="#4f8cff"
              />
              <text
                v-for="(lbl, i) in radarAxisLabels(radarPoints)"
                :key="`t${i}`"
                :x="lbl.x"
                :y="lbl.y"
                font-size="7"
                fill="#7b849c"
                text-anchor="middle"
              >
                {{ lbl.label.slice(0, 6) }}
              </text>
            </svg>
          </div>
        </div>
      </el-tab-pane>

      <!-- 学情报告 -->
      <el-tab-pane label="学情报告" name="report">
        <div class="soft-card">
          <div class="report-head">
            <div>
              <span class="report-title">生成学情报告</span>
              <div class="report-sub">按周或按月汇总你的练习情况</div>
            </div>
            <div class="report-actions">
              <el-radio-group v-model="reportType" size="default">
                <el-radio-button :value="1">周报</el-radio-button>
                <el-radio-button :value="2">月报</el-radio-button>
              </el-radio-group>
              <el-button type="primary" round :loading="generating" @click="generateReport">
                生成报告
              </el-button>
            </div>
          </div>
        </div>

        <!-- 报告详情 -->
        <div v-if="currentReport" class="soft-card" style="margin-top: 16px">
          <div class="current-report-head">
            <h3 class="section-title" style="margin: 0">
              {{ currentReport.period_label }}
              <span class="period-range">
                {{ currentReport.period_start }} ~ {{ currentReport.period_end }}
              </span>
            </h3>
          </div>

          <div class="result-grid">
            <div class="stat-block">
              <div class="num">{{ currentReport.practice_count }}</div>
              <div class="label">练习次数</div>
            </div>
            <div class="stat-block">
              <div class="num">{{ currentReport.total_questions }}</div>
              <div class="label">作答总题数</div>
            </div>
            <div class="stat-block">
              <div class="num">{{ currentReport.avg_accuracy }}%</div>
              <div class="label">平均正确率</div>
            </div>
            <div class="stat-block">
              <div class="num" style="font-size: 20px">
                {{ formatDuration(currentReport.total_duration) }}
              </div>
              <div class="label">总用时</div>
            </div>
          </div>

          <!-- 文字小结 -->
          <div class="summary-box">
            <span class="summary-icon">📝</span>
            <p>{{ currentReport.summary }}</p>
          </div>

          <!-- 薄弱知识点 -->
          <div v-if="currentReport.weak_point_names?.length" class="weak-box">
            <span class="weak-label">需要加强：</span>
            <el-tag
              v-for="name in currentReport.weak_point_names"
              :key="name"
              type="danger"
              effect="light"
              round
              class="weak-tag"
            >
              {{ name }}
            </el-tag>
          </div>

          <!-- 趋势折线图 -->
          <div v-if="trendDots.length" class="chart-block">
            <h4>📈 正确率趋势</h4>
            <svg viewBox="0 0 600 200" class="line-chart">
              <line
                v-for="y in [30, 62.5, 95, 127.5, 160]"
                :key="y"
                x1="40"
                :y1="y"
                x2="560"
                :y2="y"
                stroke="#eef1f8"
                stroke-width="1"
              />
              <text x="34" y="33" font-size="9" fill="#a4acc4" text-anchor="end">100%</text>
              <text x="34" y="163" font-size="9" fill="#a4acc4" text-anchor="end">0%</text>
              <path :d="trendPath" fill="none" stroke="#4f8cff" stroke-width="2.5" />
              <circle
                v-for="(d, i) in trendDots"
                :key="i"
                :cx="d.cx"
                :cy="d.cy"
                r="4"
                fill="#4f8cff"
              />
              <text
                v-for="(d, i) in trendDots"
                :key="`l${i}`"
                :x="d.cx"
                y="185"
                font-size="9"
                fill="#7b849c"
                text-anchor="middle"
              >
                {{ d.label }}
              </text>
            </svg>
          </div>

          <!-- 学科分布柱状图 -->
          <div v-if="subjectBars.length" class="chart-block">
            <h4>📚 学科分布</h4>
            <div class="bar-chart">
              <div v-for="s in subjectBars" :key="s.subject" class="bar-row">
                <span class="bar-label">{{ s.subject }}</span>
                <div class="bar-track">
                  <div
                    class="bar-fill"
                    :style="{ width: `${(s.count / maxSubjectCount) * 100}%` }"
                  ></div>
                </div>
                <span class="bar-value">{{ s.count }} 次</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 历史报告 -->
        <div v-if="reports.length" class="soft-card" style="margin-top: 16px">
          <h3 class="section-title">历史报告</h3>
          <div class="history-list">
            <div
              v-for="r in reports"
              :key="r.id"
              class="history-item"
              @click="openReport(r)"
            >
              <el-tag effect="plain">{{ r.period_label }}</el-tag>
              <span class="history-range">{{ r.period_start }} ~ {{ r.period_end }}</span>
              <span class="history-acc">{{ r.avg_accuracy }}%</span>
              <span class="history-count">{{ r.practice_count }} 次练习</span>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.ana-tabs :deep(.el-tabs__item) {
  font-size: 15px;
  font-weight: 700;
}

.rule-tip {
  margin-top: 14px;
  font-size: 12.5px;
  color: var(--text-sub);
  background: #f7f9ff;
  border-radius: 10px;
  padding: 10px 14px;
  line-height: 1.7;
}

/* 雷达图 */
.radar-wrap {
  display: flex;
  justify-content: center;
}

.radar-svg {
  width: 100%;
  max-width: 360px;
  height: auto;
}

/* 报告 */
.report-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}

.report-title {
  font-size: 16px;
  font-weight: 800;
}

.report-sub {
  font-size: 12.5px;
  color: var(--text-sub);
  margin-top: 2px;
}

.report-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.current-report-head {
  margin-bottom: 14px;
}

.period-range {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-sub);
  margin-left: 8px;
}

.summary-box {
  display: flex;
  gap: 10px;
  background: linear-gradient(135deg, #f0f6ff, #f8f2ff);
  border-radius: 14px;
  padding: 14px 18px;
  margin: 14px 0;
}

.summary-icon {
  font-size: 20px;
}

.summary-box p {
  margin: 0;
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-main);
}

.weak-box {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.weak-label {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--brand-danger);
}

.weak-tag {
  margin: 0;
}

.chart-block {
  margin-top: 20px;
}

.chart-block h4 {
  font-size: 14.5px;
  font-weight: 800;
  margin: 0 0 10px;
}

.line-chart {
  width: 100%;
  height: auto;
  max-height: 220px;
}

/* 柱状图 */
.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bar-label {
  width: 50px;
  font-size: 13.5px;
  font-weight: 700;
  flex-shrink: 0;
}

.bar-track {
  flex: 1;
  height: 18px;
  background: #f0f4ff;
  border-radius: 9px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 9px;
  background: linear-gradient(90deg, var(--brand-primary), var(--brand-purple));
  transition: width 0.4s ease;
}

.bar-value {
  width: 60px;
  text-align: right;
  font-size: 13px;
  color: var(--text-sub);
  flex-shrink: 0;
}

/* 历史 */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border-radius: 12px;
  background: #f8faff;
  cursor: pointer;
  transition: background 0.16s;
}

.history-item:hover {
  background: #eef4ff;
}

.history-range {
  flex: 1;
  font-size: 13.5px;
  color: var(--text-main);
}

.history-acc {
  font-weight: 800;
  color: var(--brand-primary);
}

.history-count {
  font-size: 12.5px;
  color: var(--text-sub);
}
</style>
