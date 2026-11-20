import request from './request'

// ---------------- 认证 ----------------
export const register = (data) => request.post('/auth/register', data)
export const login = (data) => request.post('/auth/login', data)
export const getMe = () => request.get('/auth/me')
export const getSubjects = () => request.get('/subjects')

// ---------------- 数学 ----------------
export const getOralQuestions = (params) => request.get('/math/oral', { params })
export const getMathQuestions = (params) => request.get('/math/questions', { params })
export const submitPractice = (data) => request.post('/math/practice/submit', data)
export const getPracticeRecords = (params) => request.get('/math/records', { params })

// ---------------- 语文 ----------------
export const getCharacters = (params) => request.get('/chinese/characters', { params })
export const getIdioms = (params) => request.get('/chinese/idioms', { params })
export const getPoems = (params) => request.get('/chinese/poems', { params })

// ---------------- 英语 ----------------
export const getWords = (params) => request.get('/english/words', { params })
export const getDictation = (params) => request.get('/english/dictation', { params })
export const submitDictation = (data) => request.post('/english/dictation/submit', data)

// ---------------- AI ----------------
export const aiChat = (data) => request.post('/ai/chat', data)
export const getConversations = () => request.get('/ai/conversations')
export const getConversationMessages = (id) => request.get(`/ai/conversations/${id}`)

// ---------------- 错题本 ----------------
export const getWrongQuestions = (params) => request.get('/wrong', { params })
export const removeWrongQuestion = (id) => request.delete(`/wrong/${id}`)
export const submitWrongPractice = (data) => request.post('/wrong/practice/submit', data)

// ================= v3.0 学习激励 =================
export const getCheckInStatus = () => request.get('/check-ins/status')
export const doCheckIn = () => request.post('/check-ins')
export const getPoints = (params) => request.get('/points', { params })
export const getPointBalance = () => request.get('/points/balance')
export const getBadges = () => request.get('/badges')
export const getLeaderboard = (params) => request.get('/leaderboard', { params })

// ================= v3.0 学情分析 =================
export const getMastery = (params) => request.get('/analytics/mastery', { params })
export const getWeakPoints = () => request.get('/analytics/weak-points')
export const createReport = (data) => request.post('/analytics/reports', data)
export const getReports = () => request.get('/analytics/reports')
// 家长
export const bindStudent = (data) => request.post('/analytics/parent/bind', data)
export const getParentStudents = () => request.get('/analytics/parent/students')
export const getParentStudentReports = (id) =>
  request.get(`/analytics/parent/students/${id}/reports`)
export const getParentStudentMastery = (id, params) =>
  request.get(`/analytics/parent/students/${id}/mastery`, { params })

// ================= v3.0 趣味练习 =================
export const submitChallenge = (data) => request.post('/challenges/submit', data)
export const getLevels = (params) => request.get('/challenges/levels', { params })
export const getLevelQuestions = (kpId, level) =>
  request.get(`/challenges/levels/${kpId}/${level}`)
export const getDailyTasks = () => request.get('/tasks')
export const claimTask = (userTaskId) => request.post(`/tasks/${userTaskId}/claim`)
// 闯关逐题即时校验：答完立刻返回对错
export const checkLevelAnswer = (data) => request.post('/challenges/levels/check', data)

// ================= v3.0 内容管理后台 =================
export const adminListQuestions = (params) => request.get('/admin/questions', { params })
export const adminCreateQuestion = (data) => request.post('/admin/questions', data)
export const adminBatchImport = (data) => request.post('/admin/questions/batch', data)
export const adminUpdateQuestion = (id, data) => request.put(`/admin/questions/${id}`, data)
export const adminDeleteQuestion = (id) => request.delete(`/admin/questions/${id}`)
export const adminListContent = (module, params) =>
  request.get(`/admin/content/${module}`, { params })
export const adminCreateContent = (module, data) => request.post(`/admin/content/${module}`, data)
export const adminUpdateContent = (module, id, data) =>
  request.put(`/admin/content/${module}/${id}`, data)
export const adminDeleteContent = (module, id) =>
  request.delete(`/admin/content/${module}/${id}`)
export const adminListUsers = (params) => request.get('/admin/users', { params })
export const adminUpdateUser = (id, data) => request.put(`/admin/users/${id}`, data)
export const adminListBadges = () => request.get('/admin/badges')
export const adminCreateBadge = (data) => request.post('/admin/badges', data)
export const adminUpdateBadge = (id, data) => request.put(`/admin/badges/${id}`, data)
export const adminKnowledgePoints = (params) =>
  request.get('/admin/knowledge-points', { params })
export const adminLogs = (params) => request.get('/admin/logs', { params })
