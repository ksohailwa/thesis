import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')
  if (token) {
    // Use AxiosHeaders when available to satisfy types
    if (config.headers && typeof (config.headers as any).set === 'function') {
      (config.headers as any).set('Authorization', `Bearer ${token}`)
    } else {
      (config.headers as any) = { ...(config.headers || {}), Authorization: `Bearer ${token}` }
    }
  }
  return config
})

export default api
