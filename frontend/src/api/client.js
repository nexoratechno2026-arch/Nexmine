import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
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

// Handle 401 globally — clear token and redirect to login
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('nexmine_token')
      localStorage.removeItem('nexmine_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client
