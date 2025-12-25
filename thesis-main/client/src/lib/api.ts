import axios from 'axios'
import { useAuth } from '../store/auth'
import { logger } from './logger'

const AUTH_KEY = 'spellwise-auth'

function readStoredAuth() {
  if (typeof window === 'undefined') return {}
  const raw = sessionStorage.getItem(AUTH_KEY) || localStorage.getItem(AUTH_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    // Zustand persist stores { state, version }
    const state = parsed?.state || parsed
    return state || {}
  } catch {
    return {}
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',
  withCredentials: true,
  timeout: 90000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(
  (config) => {
    const state = useAuth.getState?.() || {}
    const stored = readStoredAuth() as any
    const token = state.accessToken || stored.accessToken || localStorage.getItem('accessToken')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    const refresh = state.refreshToken || stored.refreshToken || localStorage.getItem('refreshToken')
    if (refresh && config.url?.includes('/api/auth/refresh')) {
      config.headers['x-refresh'] = refresh
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.code === 'ECONNABORTED') {
      error.message = 'Request timeout. Please try again.'
    } else if (error.code === 'ERR_NETWORK') {
      error.message = 'Network error. Check your connection.'
    }

    const originalRequest = error.config || {}
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const state = useAuth.getState?.()
        const stored = readStoredAuth() as any
        const refresh = state?.refreshToken || stored.refreshToken || localStorage.getItem('refreshToken')
        const { data } = await api.post('/api/auth/refresh', undefined, {
          headers: refresh ? { 'x-refresh': refresh } : undefined,
        })
        if (data?.accessToken) {
          if (state?.setAuth && state.role && state.email) {
            state.setAuth({
              accessToken: data.accessToken,
              refreshToken: data.refreshToken || state.refreshToken || refresh || null,
              role: state.role as any,
              email: state.email,
              demo: state.demo,
            })
          } else {
            localStorage.setItem('accessToken', data.accessToken)
            if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken)
          }
          originalRequest.headers = originalRequest.headers || {}
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`
          return api(originalRequest)
        }
      } catch (refreshError) {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('role')
        localStorage.removeItem('email')
        localStorage.removeItem('demo')
        localStorage.removeItem('refreshToken')
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      }
    }

    if (!error.response) {
      logger.error('Network error - check your connection', error)
    }

    return Promise.reject(error)
  }
)

export default api
