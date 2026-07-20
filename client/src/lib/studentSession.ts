import { useAuth } from '../store/auth'

export type StudentProgress = {
  currentParagraph: number
  blanksState: Record<string, any>
  storyIndex: number
  currentStoryLabel: string
  wordsInStreak: string[]
  streak: number
  maxStreak: number
  attemptsByWord: Record<string, number>
  timeByWordMs: Record<string, number>
}

export type StoredStudentSession = {
  assignmentId: string
  experimentId?: string
  condition?: string
  storyOrder?: 'A-first' | 'B-first'
  hintsEnabledByStory?: { A: boolean; B: boolean }
  breakUntil?: string
  breakStartTime?: number
  story1Complete?: boolean
  story2Complete?: boolean
  recallUnlockAt?: string
  delayedEffortSubmitted?: boolean
  offloadingSubmitted?: boolean
  story1?: any
  story2?: any
  tts1?: string
  tts2?: string
  tts1Segments?: string[]
  tts2Segments?: string[]
  cues1?: any[]
  cues2?: any[]
  schedule?: any
  progress?: StudentProgress
  // Auth tokens for API calls
  accessToken?: string
  refreshToken?: string
  username?: string
  savedAt: number
}

const KEY = 'spellwise-student-session'
const MAX_AGE_HOURS = 72

const isFresh = (savedAt: number) => Date.now() - savedAt < MAX_AGE_HOURS * 60 * 60 * 1000

export function persistStudentSession(data: Omit<StoredStudentSession, 'savedAt'>) {
  if (typeof window === 'undefined') return
  const payload: StoredStudentSession = { ...data, savedAt: Date.now() }
  localStorage.setItem(KEY, JSON.stringify(payload))
}

export function loadSavedStudentSession(): StoredStudentSession | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as StoredStudentSession
    if (!parsed.assignmentId) return null
    if (!isFresh(parsed.savedAt)) {
      localStorage.removeItem(KEY)
      return null
    }
    return parsed
  } catch {
    localStorage.removeItem(KEY)
    return null
  }
}

export function hydrateStudentSession(): boolean {
  if (typeof window === 'undefined') return false

  // Already have an active session in sessionStorage
  if (sessionStorage.getItem('assignmentId')) {
    ensureStudentSessionAuth()
    const saved = loadSavedStudentSession()
    if (saved) {
      if (saved.breakUntil) sessionStorage.setItem('exp.breakUntil', saved.breakUntil)
      if (typeof saved.breakStartTime === 'number') {
        sessionStorage.setItem('exp.breakStartTime', String(saved.breakStartTime))
      }
      if (saved.story1Complete) sessionStorage.setItem('exp.story1Complete', 'true')
      if (saved.story2Complete) sessionStorage.setItem('exp.story2Complete', 'true')
      if (saved.recallUnlockAt) sessionStorage.setItem('exp.recallUnlockAt', saved.recallUnlockAt)
      if (saved.delayedEffortSubmitted) sessionStorage.setItem('exp.delayedEffortSubmitted', 'true')
      if (saved.offloadingSubmitted) sessionStorage.setItem('exp.offloadingSubmitted', 'true')
    }
    return true
  }

  const saved = loadSavedStudentSession()
  if (!saved) return false

  // Restore session data to sessionStorage
  sessionStorage.setItem('assignmentId', saved.assignmentId || '')
  if (saved.experimentId) sessionStorage.setItem('exp.experimentId', saved.experimentId)
  if (saved.condition) sessionStorage.setItem('exp.condition', saved.condition)
  if (saved.storyOrder) sessionStorage.setItem('exp.storyOrder', saved.storyOrder)
  if (saved.hintsEnabledByStory) sessionStorage.setItem('exp.hintsEnabledByStory', JSON.stringify(saved.hintsEnabledByStory))
  if (saved.breakUntil) sessionStorage.setItem('exp.breakUntil', saved.breakUntil)
  if (typeof saved.breakStartTime === 'number') sessionStorage.setItem('exp.breakStartTime', String(saved.breakStartTime))
  if (saved.story1Complete) sessionStorage.setItem('exp.story1Complete', 'true')
  if (saved.story2Complete) sessionStorage.setItem('exp.story2Complete', 'true')
  if (saved.recallUnlockAt) sessionStorage.setItem('exp.recallUnlockAt', saved.recallUnlockAt)
  if (saved.delayedEffortSubmitted) sessionStorage.setItem('exp.delayedEffortSubmitted', 'true')
  if (saved.offloadingSubmitted) sessionStorage.setItem('exp.offloadingSubmitted', 'true')
  if (saved.story1) sessionStorage.setItem('exp.story1', JSON.stringify(saved.story1))
  if (saved.story2) sessionStorage.setItem('exp.story2', JSON.stringify(saved.story2))
  if (saved.tts1) sessionStorage.setItem('exp.tts1', saved.tts1)
  if (saved.tts2) sessionStorage.setItem('exp.tts2', saved.tts2)
  if (saved.tts1Segments) sessionStorage.setItem('exp.tts1Segments', JSON.stringify(saved.tts1Segments))
  if (saved.tts2Segments) sessionStorage.setItem('exp.tts2Segments', JSON.stringify(saved.tts2Segments))
  if (saved.cues1) sessionStorage.setItem('exp.cues1', JSON.stringify(saved.cues1))
  if (saved.cues2) sessionStorage.setItem('exp.cues2', JSON.stringify(saved.cues2))
  if (saved.schedule) sessionStorage.setItem('exp.schedule', JSON.stringify(saved.schedule))
  if (saved.progress) sessionStorage.setItem('exp.progress', JSON.stringify(saved.progress))

  // Restore auth with real tokens if available
  useAuth.getState().setAuth({
    accessToken: saved.accessToken || 'student-session',
    refreshToken: saved.refreshToken || null,
    role: 'student',
    username: saved.username || 'student',
  })

  return true
}

export function ensureStudentSessionAuth(): boolean {
  if (typeof window === 'undefined') return false

  const authState = useAuth.getState()
  const hasUsableToken =
    !!authState.accessToken &&
    authState.accessToken !== 'student-session' &&
    authState.role === 'student'

  if (hasUsableToken) {
    return true
  }

  const saved = loadSavedStudentSession()
  if (!saved?.accessToken) {
    return false
  }

  useAuth.getState().setAuth({
    accessToken: saved.accessToken,
    refreshToken: saved.refreshToken || null,
    role: 'student',
    username: saved.username || authState.username || 'student',
  })

  return true
}

export function updateStoredStudentSessionAuth(auth: {
  accessToken: string
  refreshToken?: string | null
  username?: string | null
}) {
  updateStoredStudentSession({
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken ?? undefined,
    username: auth.username ?? undefined,
  })
}

export function updateStoredStudentSession(
  patch: Partial<Omit<StoredStudentSession, 'savedAt'>>
) {
  if (typeof window === 'undefined') return
  const saved = loadSavedStudentSession()
  if (!saved) return

  persistStudentSession({
    ...saved,
    ...patch,
  })
}

export function clearStudentSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEY)
  sessionStorage.removeItem('assignmentId')
}
