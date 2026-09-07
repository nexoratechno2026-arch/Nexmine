import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!form.email)    e.email    = 'Email is required'
    if (!form.password) e.password = 'Password is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    if (!validate()) return
    setLoading(true)
    const result = await login(form.email, form.password)
    setLoading(false)
    if (result.success) {
      toast.success('Welcome back!')
      navigate('/app/dashboard')
    } else {
      toast.error(result.message)
    }
  }

  return (
    <AuthShell>
      <h2 style={{ textAlign: 'center', marginBottom: 8 }}>Welcome back</h2>
      <p style={{ textAlign: 'center', color: 'var(--color-text-3)', marginBottom: 32, fontSize: 14 }}>
        Sign in to your Nex Mine account
      </p>

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="form-group">
          <label className="form-label" htmlFor="login-email">Email</label>
          <div style={{ position: 'relative' }}>
            <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              id="login-email"
              type="email"
              className={`form-input ${errors.email ? 'error' : ''}`}
              style={{ paddingLeft: 38 }}
              placeholder="you@company.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              autoComplete="email"
            />
          </div>
          {errors.email && <span className="form-error">{errors.email}</span>}
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <label className="form-label" htmlFor="login-password">Password</label>
            <Link to="/forgot-password" style={{ fontSize: 12, color: 'var(--color-primary-l)' }}>
              Forgot password?
            </Link>
          </div>
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              id="login-password"
              type={showPass ? 'text' : 'password'}
              className={`form-input ${errors.password ? 'error' : ''}`}
              style={{ paddingLeft: 38, paddingRight: 42 }}
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPass(s => !s)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}
              aria-label="Toggle password visibility"
              id="login-toggle-password"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <span className="form-error">{errors.password}</span>}
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          id="login-submit-btn"
          style={{ marginTop: 4, height: 44, fontSize: 15 }}
        >
          {loading ? <div className="spinner" /> : (
            <>Sign In <ArrowRight size={16} /></>
          )}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--color-text-muted)' }}>
        Don't have an account?{' '}
        <Link to="/signup" style={{ color: 'var(--color-primary-l)', fontWeight: 600 }}>Sign up free</Link>
      </p>
    </AuthShell>
  )
}

export function AuthShell({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'clamp(16px, 4vw, 32px)',
      position: 'relative',
      background: 'var(--color-bg)',
    }}>
      {/* Logo */}
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: '#fff'
        }}>⬡</div>
        <span style={{ color: 'var(--color-text)' }}>Nex Mine</span>
      </Link>

      {/* Card */}
      <div className="card" style={{
        width: '100%',
        maxWidth: 420,
        padding: 'clamp(22px, 5vw, 36px)',
        position: 'relative',
        zIndex: 1,
      }}>
        {children}
      </div>
    </div>
  )
}
