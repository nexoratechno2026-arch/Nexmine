import axios from 'axios'

const rawBaseUrl = import.meta.env.VITE_API_URL || '/api'
const baseURL = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl

const client = axios.create({
  baseURL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT on every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('nexmine_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 globally — clear token and redirect to login only on authenticated routes
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || ''
    const isAuthRoute = url.includes('/auth/login') ||
                        url.includes('/auth/register') ||
                        url.includes('/auth/forgot-password') ||
                        url.includes('/auth/reset-password')

    if (error.response?.status === 401 && !isAuthRoute) {
      localStorage.removeItem('nexmine_token')
      localStorage.removeItem('nexmine_user')
      if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default client
