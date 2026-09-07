import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import client from '../api/client'

const AuthContext = createContext(null)

function parseUser() {
  try {
    const raw = localStorage.getItem('nexmine_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(parseUser)
  const [token, setToken] = useState(() => localStorage.getItem('nexmine_token'))
  const [loading, setLoading] = useState(false)

  const isAuthenticated = Boolean(token && user)

  const saveSession = useCallback((tokenResp) => {
    const userData = {
      id: tokenResp.user_id,
      email: tokenResp.email,
      full_name: tokenResp.full_name,
    }
    localStorage.setItem('nexmine_token', tokenResp.access_token)
    localStorage.setItem('nexmine_user', JSON.stringify(userData))
    setToken(tokenResp.access_token)
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('nexmine_token')
    localStorage.removeItem('nexmine_user')
    setToken(null)
    setUser(null)
  }, [])

  const login = useCallback(async (email, password) => {
    setLoading(true)
    try {
      const { data } = await client.post('/auth/login', { email, password })
      saveSession(data)
      return { success: true }
    } catch (err) {
      return { success: false, message: err.response?.data?.detail || 'Login failed' }
    } finally {
      setLoading(false)
    }
  }, [saveSession])

  const register = useCallback(async (email, password, full_name) => {
    setLoading(true)
    try {
      const { data } = await client.post('/auth/register', { email, password, full_name })
      saveSession(data)
      return { success: true }
    } catch (err) {
      return { success: false, message: err.response?.data?.detail || 'Registration failed' }
    } finally {
      setLoading(false)
    }
  }, [saveSession])

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
