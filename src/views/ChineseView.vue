<script setup>
import { onMounted, ref, watch } from 'vue'
import { useUserStore } from '@/stores/user'
import { getCharacters, getIdioms, getPoems } from '@/api'

const userStore = useUserStore()

const activeTab = ref('characters')
const grade = ref(userStore.grade || 1)
const loading = ref(false)

const gradeOptions = [
  { value: 1, label: '一年级' },
  { value: 2, label: '二年级' },
  { value: 3, label: '三年级' },
]

const characters = ref([])
const idioms = ref([])
const poems = ref([])

// 详情抽屉
const drawerVisible = ref(false)
const drawerType = ref('')
const current = ref(null)

async function loadCharacters() {
  loading.value = true
  try {
    const data = await getCharacters({ grade: grade.value, page: 1, page_size: 60 })
    characters.value = data.items || []
  } catch {
    // 拦截器已提示
  } finally {
    loading.value = false
  }
}

async function loadIdioms() {
  loading.value = true
  try {
    const data = await getIdioms({ grade: grade.value, page: 1, page_size: 60 })
    idioms.value = data.items || []
  } catch {
    // 拦截器已提示
  } finally {
    loading.value = false
  }
}

async function loadPoems() {
  loading.value = true
  try {
    const data = await getPoems({ grade: grade.value, page: 1, page_size: 60 })
    poems.value = data.items || []
  } catch {
    // 拦截器已提示
  } finally {
    loading.value = false
  }
}

function loadCurrent() {
  if (activeTab.value === 'characters') loadCharacters()
  else if (activeTab.value === 'idioms') loadIdioms()
  else loadPoems()
}

function openDetail(type, item) {
  drawerType.value = type
  current.value = item
  drawerVisible.value = true
}

// 朗读（Web Speech API，浏览器不支持时静默降级）
function speak(text) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'zh-CN'
  utter.rate = 0.9
  window.speechSynthesis.speak(utter)
}

watch(activeTab, loadCurrent)
watch(grade, loadCurrent)

onMounted(loadCharacters)
</script>

<template>
  <div class="page-wrap">
    <h2 class="page-title">📖 语文学习</h2>
    <p class="page-sub">汉字 · 成语 · 古诗，翻开卡片就能学习，点击卡片可查看完整内容。</p>

    <div class="soft-card grade-bar">
      <span class="bar-label">选择年级：</span>
      <el-radio-group v-model="grade">
        <el-radio-button v-for="g in gradeOptions" :key="g.value" :value="g.value">
          {{ g.label }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <el-tabs v-model="activeTab" class="chi-tabs">
      <!-- ============ 汉字 ============ -->
      <el-tab-pane label="汉字学习" name="characters">
        <div v-loading="loading" class="content-area">
          <el-empty v-if="!characters.length && !loading" description="该年级暂无汉字数据" />
          <div v-else class="grid-cards">
            <div
              v-for="c in characters"
              :key="c.id"
              class="item-card char-card"
              @click="openDetail('character', c)"
            >
              <div class="big-char">{{ c.char }}</div>
              <div class="pinyin">{{ c.pinyin }}</div>
              <div class="meta-line">
                部首：{{ c.radical || '-' }} · 笔画：{{ c.strokes ?? '-' }}
              </div>
              <div class="meta-line words-line">
                组词：{{ c.words || '-' }}
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- ============ 成语 ============ -->
      <el-tab-pane label="成语积累" name="idioms">
        <div v-loading="loading" class="content-area">
          <el-empty v-if="!idioms.length && !loading" description="该年级暂无成语数据" />
          <div v-else class="grid-cards">
            <div
              v-for="it in idioms"
              :key="it.id"
              class="item-card idiom-card"
              @click="openDetail('idiom', it)"
            >
              <div class="idiom-name">{{ it.name }}</div>
              <div class="pinyin">{{ it.pinyin }}</div>
              <div class="meta-line idiom-meaning">{{ it.meaning }}</div>
              <div class="meta-line">
                <el-tag size="small" type="success" effect="plain">近义</el-tag>
                {{ it.synonym || '-' }}
              </div>
              <div class="meta-line">
                <el-tag size="small" type="danger" effect="plain">反义</el-tag>
                {{ it.antonym || '-' }}
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- ============ 古诗 ============ -->
      <el-tab-pane label="古诗背诵" name="poems">
        <div v-loading="loading" class="content-area">
          <el-empty v-if="!poems.length && !loading" description="该年级暂无古诗数据" />
          <div v-else class="poem-grid">
            <div
              v-for="p in poems"
              :key="p.id"
              class="poem-card"
              @click="openDetail('poem', p)"
            >
              <div class="poem-head">
                <h3>{{ p.title }}</h3>
                <span class="poem-author">〔{{ p.dynasty }}〕{{ p.author }}</span>
              </div>
              <div class="poem-content">{{ p.content }}</div>
              <div class="poem-actions">
                <el-button size="small" round @click.stop="speak(`${p.title}。${p.content}`)">
                  <el-icon><Microphone /></el-icon> 跟读
                </el-button>
                <el-button size="small" round type="primary" plain @click.stop="openDetail('poem', p)">
                  查看译文
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 详情抽屉 -->
    <el-drawer v-model="drawerVisible" size="480px" :with-header="false">
      <div v-if="current" class="detail-body">
        <!-- 汉字详情 -->
        <template v-if="drawerType === 'character'">
          <div class="detail-char-hero">
            <div class="detail-char">{{ current.char }}</div>
            <div>
              <div class="detail-pinyin">{{ current.pinyin }}</div>
              <el-button size="small" round @click="speak(current.char)">
                <el-icon><Microphone /></el-icon> 听读音
              </el-button>
            </div>
          </div>
          <el-descriptions :column="1" border class="detail-desc">
            <el-descriptions-item label="部首">{{ current.radical || '-' }}</el-descriptions-item>
            <el-descriptions-item label="笔画数">{{ current.strokes ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="笔顺">
              {{ current.stroke_order || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="组词">{{ current.words || '-' }}</el-descriptions-item>
            <el-descriptions-item label="例句">{{ current.sentence || '-' }}</el-descriptions-item>
            <el-descriptions-item label="所属年级">{{ current.grade }} 年级</el-descriptions-item>
          </el-descriptions>
        </template>

        <!-- 成语详情 -->
        <template v-else-if="drawerType === 'idiom'">
          <h2 class="detail-title">{{ current.name }}</h2>
          <div class="detail-pinyin" style="margin-bottom: 16px">{{ current.pinyin }}</div>
          <el-descriptions :column="1" border class="detail-desc">
            <el-descriptions-item label="释义">{{ current.meaning }}</el-descriptions-item>
            <el-descriptions-item label="出处">{{ current.source || '-' }}</el-descriptions-item>
            <el-descriptions-item label="造句">{{ current.example || '-' }}</el-descriptions-item>
            <el-descriptions-item label="近义词">{{ current.synonym || '-' }}</el-descriptions-item>
            <el-descriptions-item label="反义词">{{ current.antonym || '-' }}</el-descriptions-item>
            <el-descriptions-item label="所属年级">{{ current.grade }} 年级</el-descriptions-item>
          </el-descriptions>
        </template>

        <!-- 古诗详情 -->
        <template v-else-if="drawerType === 'poem'">
          <h2 class="detail-title">{{ current.title }}</h2>
          <div class="detail-pinyin" style="margin-bottom: 16px">
            〔{{ current.dynasty }}〕{{ current.author }}
          </div>
          <div class="detail-poem">{{ current.content }}</div>
          <el-button size="small" round style="margin-bottom: 16px" @click="speak(current.content)">
            <el-icon><Microphone /></el-icon> 朗读全诗
          </el-button>
          <div class="detail-section">
            <h4>📝 译文</h4>
            <p>{{ current.translation || '-' }}</p>
          </div>
          <div class="detail-section">
            <h4>✨ 赏析</h4>
            <p>{{ current.appreciation || '-' }}</p>
          </div>
          <div class="detail-section">
            <h4>🏫 所属年级</h4>
            <p>{{ current.grade }} 年级</p>
          </div>
        </template>
      </div>
    </el-drawer>
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

.chi-tabs :deep(.el-tabs__item) {
  font-size: 15px;
  font-weight: 700;
}

.content-area {
  min-height: 200px;
}

.char-card {
  text-align: center;
  cursor: pointer;
}

.words-line {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.idiom-card {
  cursor: pointer;
}

.idiom-name {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-main);
}

.idiom-meaning {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 44px;
}

/* 古诗卡片 */
.poem-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.poem-card {
  background: linear-gradient(160deg, #fffdf7, #fff7e8);
  border: 1px solid rgba(255, 176, 32, 0.28);
  border-radius: 18px;
  padding: 20px;
  cursor: pointer;
  box-shadow: var(--shadow-card);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.poem-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 30px rgba(255, 176, 32, 0.22);
}

.poem-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.poem-head h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
}

.poem-author {
  font-size: 13px;
  color: var(--text-sub);
}

.poem-content {
  white-space: pre-line;
  font-size: 15.5px;
  line-height: 2;
  color: var(--text-main);
  margin-bottom: 12px;
  min-height: 96px;
}

.poem-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

/* 抽屉详情 */
.detail-body {
  padding: 8px 4px;
}

.detail-char-hero {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
}

.detail-char {
  font-size: 72px;
  font-weight: 800;
  line-height: 1;
  color: var(--brand-primary);
  background: linear-gradient(135deg, #eef4ff, #f7f0ff);
  border-radius: 20px;
  width: 110px;
  height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-pinyin {
  font-size: 18px;
  color: var(--brand-primary);
  font-weight: 700;
  margin-bottom: 10px;
}

.detail-title {
  font-size: 24px;
  font-weight: 800;
  margin: 0 0 6px;
}

.detail-desc :deep(.el-descriptions__label) {
  width: 88px;
  font-weight: 700;
}

.detail-poem {
  white-space: pre-line;
  font-size: 17px;
  line-height: 2.1;
  background: linear-gradient(160deg, #fffdf7, #fff7e8);
  border: 1px solid rgba(255, 176, 32, 0.28);
  border-radius: 14px;
  padding: 18px;
  margin-bottom: 14px;
}

.detail-section {
  margin-bottom: 16px;
}

.detail-section h4 {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 800;
  color: var(--text-main);
}

.detail-section p {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.9;
  color: #4b5470;
}
</style>
