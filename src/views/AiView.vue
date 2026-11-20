<script setup>
import { nextTick, onMounted, reactive, ref } from 'vue'
import { aiChat, getConversations, getConversationMessages } from '@/api'

const scenes = [
  { value: 'qa', label: '自由答疑', icon: '💬', tip: '有任何学习问题都可以问我' },
  { value: 'solve', label: 'AI 解题', icon: '🧮', tip: '输入题目，我会分步骤讲解' },
  { value: 'explain', label: '知识点讲解', icon: '💡', tip: '输入知识点，我来详细讲解' },
]

const quickAsks = {
  qa: ['什么是乘法？', '蝴蝶为什么会飞？', '怎样才能写好字？'],
  solve: ['25 + 17 = ?', '7 × 8 = ?', '96 ÷ 8 = ?'],
  explain: ['20以内加减法', '乘法口诀', '什么是比喻句'],
}

const scene = ref('qa')
const input = ref('')
const sending = ref(false)
const messages = ref([])
const conversationId = ref('')
const chatBoxRef = ref()
const conversations = ref([])

const inputPlaceholder = reactive({
  get text() {
    if (scene.value === 'solve') return '输入题目，例如：25 + 17 = ?'
    if (scene.value === 'explain') return '输入想了解的知识点，例如：乘法口诀'
    return '有什么学习上的问题，尽管问我吧～'
  },
})

function scrollToBottom() {
  nextTick(() => {
    const el = chatBoxRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

async function send(text) {
  const content = (text ?? input.value).trim()
  if (!content || sending.value) return

  messages.value.push({ role: 'user', content })
  input.value = ''
  sending.value = true
  scrollToBottom()

  // 占位消息（打字效果）
  const placeholder = { role: 'assistant', content: '', pending: true }
  messages.value.push(placeholder)
  scrollToBottom()

  try {
    const data = await aiChat({
      message: content,
      scene: scene.value,
      conversation_id: conversationId.value || null,
    })
    conversationId.value = data.conversation_id
    const idx = messages.value.indexOf(placeholder)
    if (idx !== -1) {
      messages.value[idx] = { role: 'assistant', content: data.reply }
    }
    loadConversations()
  } catch {
    const idx = messages.value.indexOf(placeholder)
    if (idx !== -1) {
      messages.value[idx] = {
        role: 'assistant',
        content: '抱歉，我暂时无法回答，请稍后再试～',
      }
    }
  } finally {
    sending.value = false
    scrollToBottom()
  }
}

function newChat() {
  messages.value = []
  conversationId.value = ''
}

async function loadConversations() {
  try {
    conversations.value = (await getConversations()) || []
  } catch {
    conversations.value = []
  }
}

async function openConversation(id) {
  if (id === conversationId.value) return
  try {
    const list = await getConversationMessages(id)
    messages.value = (list || []).map((m) => ({ role: m.role, content: m.content }))
    conversationId.value = id
    scrollToBottom()
  } catch {
    // 拦截器已提示
  }
}

function switchScene(value) {
  scene.value = value
}

onMounted(() => {
  loadConversations()
  messages.value = [
    {
      role: 'assistant',
      content:
        '你好呀！我是你的 AI 学习老师 👩‍🏫\n可以帮你解题、讲知识点、回答学习问题。\n想从哪里开始呢？',
    },
  ]
})
</script>

<template>
  <div class="page-wrap">
    <h2 class="page-title">🤖 AI 智能老师</h2>
    <p class="page-sub">分步解题、知识点讲解、自由答疑，用小朋友听得懂的语言回答。</p>

    <div class="ai-layout">
      <!-- 会话列表 -->
      <aside class="conv-sidebar soft-card">
        <el-button type="primary" round style="width: 100%" @click="newChat">
          <el-icon><Plus /></el-icon> 新对话
        </el-button>
        <div class="conv-title">历史会话</div>
        <div class="conv-list">
          <div
            v-for="c in conversations"
            :key="c.conversation_id"
            class="conv-item"
            :class="{ active: c.conversation_id === conversationId }"
            @click="openConversation(c.conversation_id)"
          >
            <el-icon><ChatLineRound /></el-icon>
            <span class="conv-preview">{{ c.preview || '（无内容）' }}</span>
          </div>
          <el-empty
            v-if="!conversations.length"
            description="还没有历史会话"
            :image-size="60"
          />
        </div>
      </aside>

      <!-- 聊天主区 -->
      <section class="chat-main soft-card">
        <!-- 场景选择 -->
        <div class="scene-bar">
          <div
            v-for="s in scenes"
            :key="s.value"
            class="scene-chip"
            :class="{ active: scene === s.value }"
            @click="switchScene(s.value)"
          >
            <span class="scene-icon">{{ s.icon }}</span>
            <span>{{ s.label }}</span>
          </div>
        </div>

        <!-- 消息区 -->
        <div ref="chatBoxRef" class="chat-box">
          <div
            v-for="(m, i) in messages"
            :key="i"
            class="msg-row"
            :class="m.role === 'user' ? 'from-user' : 'from-ai'"
          >
            <el-avatar
              :size="34"
              class="msg-avatar"
              :class="m.role === 'user' ? 'user-avatar' : 'ai-avatar'"
            >
              {{ m.role === 'user' ? '我' : '🤖' }}
            </el-avatar>
            <div class="bubble" :class="{ pending: m.pending }">
              <span v-if="m.pending" class="typing">
                <i></i><i></i><i></i>
              </span>
              <template v-else>{{ m.content }}</template>
            </div>
          </div>
        </div>

        <!-- 快捷提问 -->
        <div class="quick-bar">
          <span class="quick-label">试试问：</span>
          <el-tag
            v-for="q in quickAsks[scene]"
            :key="q"
            class="quick-tag"
            effect="plain"
            round
            @click="send(q)"
          >
            {{ q }}
          </el-tag>
        </div>

        <!-- 输入区 -->
        <div class="input-bar">
          <el-input
            v-model="input"
            type="textarea"
            :rows="2"
            resize="none"
            :placeholder="inputPlaceholder.text"
            :disabled="sending"
            @keydown.enter.exact.prevent="send()"
          />
          <el-button
            type="primary"
            circle
            size="large"
            :loading="sending"
            :disabled="!input.trim()"
            @click="send()"
          >
            <el-icon v-if="!sending"><Promotion /></el-icon>
          </el-button>
        </div>
        <div class="hint-line">按 Enter 发送 · Shift + Enter 换行 · AI 回答仅供学习参考</div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.ai-layout {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 16px;
  align-items: start;
}

/* 侧边会话 */
.conv-sidebar {
  padding: 16px;
  height: calc(100vh - 210px);
  min-height: 480px;
  display: flex;
  flex-direction: column;
}

.conv-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-sub);
  margin: 16px 0 8px;
}

.conv-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.conv-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border-radius: 10px;
  font-size: 13.5px;
  color: #4b5470;
  cursor: pointer;
  transition: background 0.16s;
}

.conv-item:hover {
  background: rgba(79, 140, 255, 0.08);
}

.conv-item.active {
  background: linear-gradient(135deg, rgba(79, 140, 255, 0.14), rgba(155, 123, 255, 0.14));
  color: var(--brand-primary);
  font-weight: 700;
}

.conv-preview {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 聊天主区 */
.chat-main {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 210px);
  min-height: 480px;
  padding: 16px;
}

.scene-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.scene-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 13.5px;
  font-weight: 600;
  background: #f4f7ff;
  color: var(--text-sub);
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.16s;
}

.scene-chip.active {
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-purple));
  color: #fff;
  box-shadow: 0 4px 14px rgba(79, 140, 255, 0.28);
}

.scene-icon {
  font-size: 15px;
}

/* 消息区 */
.chat-box {
  flex: 1;
  overflow-y: auto;
  padding: 10px 4px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: #fafbff;
  border-radius: 14px;
}

.msg-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.from-user {
  flex-direction: row-reverse;
}

.msg-avatar {
  flex-shrink: 0;
  font-size: 15px;
}

.user-avatar {
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-purple));
  color: #fff;
  font-weight: 700;
}

.ai-avatar {
  background: #eef4ff;
}

.bubble {
  max-width: 72%;
  padding: 11px 15px;
  border-radius: 14px;
  font-size: 14.5px;
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}

.from-ai .bubble {
  background: #fff;
  border: 1px solid rgba(79, 140, 255, 0.14);
  border-top-left-radius: 4px;
  color: var(--text-main);
}

.from-user .bubble {
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-purple));
  color: #fff;
  border-top-right-radius: 4px;
}

/* 打字动画 */
.typing {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  height: 18px;
}

.typing i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--brand-primary);
  opacity: 0.55;
  animation: blink 1.2s infinite ease-in-out;
}

.typing i:nth-child(2) {
  animation-delay: 0.2s;
}

.typing i:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes blink {
  0%,
  80%,
  100% {
    transform: scale(0.7);
    opacity: 0.35;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 快捷提问 */
.quick-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin: 12px 0 8px;
}

.quick-label {
  font-size: 12.5px;
  color: var(--text-sub);
}

.quick-tag {
  cursor: pointer;
}

.quick-tag:hover {
  color: var(--brand-primary);
  border-color: var(--brand-primary);
}

/* 输入区 */
.input-bar {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

.input-bar :deep(.el-textarea__inner) {
  border-radius: 12px;
  font-size: 14.5px;
  padding: 10px 14px;
}

.hint-line {
  font-size: 11.5px;
  color: #a4acc4;
  margin-top: 6px;
  text-align: right;
}

@media (max-width: 900px) {
  .ai-layout {
    grid-template-columns: 1fr;
  }
  .conv-sidebar {
    display: none;
  }
  .bubble {
    max-width: 84%;
  }
}
</style>
