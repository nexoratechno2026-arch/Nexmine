import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Mail, Lock, ArrowRight, CheckCircle2 } from 'lucide-react'
import { AuthShell } from './Login'
import client from '../../api/client'
import toast from 'react-hot-toast'

export default function ForgotPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  return token ? <ResetPasswordForm token={token} /> : <ForgotForm />
}

function ForgotForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(ev) {
    ev.preventDefault()
    if (!email) { toast.error('Enter your email'); return }
    setLoading(true)
    try {
      await client.post('/auth/forgot-password', { email })
      setSent(true)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthShell>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <CheckCircle2 size={52} color="var(--color-accent)" style={{ margin: '0 auto 20px' }} />
          <h2 style={{ marginBottom: 12 }}>Check your email</h2>
          <p style={{ color: 'var(--color-text-3)', fontSize: 14, lineHeight: 1.7, marginBottom: 32 }}>
            If <strong style={{ color: 'var(--color-text)' }}>{email}</strong> is registered, we've sent a password reset link. It expires in 1 hour.
          </p>
          <Link to="/login" className="btn btn-outline" id="forgot-back-to-login" style={{ width: '100%', height: 44 }}>
            Back to Sign In
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h2 style={{ textAlign: 'center', marginBottom: 8 }}>Forgot password?</h2>
      <p style={{ textAlign: 'center', color: 'var(--color-text-3)', marginBottom: 32, fontSize: 14 }}>
        Enter your email and we'll send a reset link
      </p>

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="form-group">
          <label className="form-label" htmlFor="forgot-email">Email</label>
          <div style={{ position: 'relative' }}>
            <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              id="forgot-email"
              type="email"
              className="form-input"
              style={{ paddingLeft: 38 }}
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          id="forgot-submit-btn"
          style={{ height: 44, fontSize: 15 }}
        >
          {loading ? <div className="spinner" /> : <>Send Reset Link <ArrowRight size={16} /></>}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--color-text-muted)' }}>
        <Link to="/login" style={{ color: 'var(--color-primary-l)', fontWeight: 600 }}>← Back to Sign In</Link>
      </p>
    </AuthShell>
  )
}

function ResetPasswordForm({ token }) {
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(ev) {
    ev.preventDefault()
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    setError('')
    setLoading(true)
    try {
      await client.post('/auth/reset-password', { token, new_password: form.password })
      setDone(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Reset failed. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AuthShell>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <CheckCircle2 size={52} color="var(--color-accent)" style={{ margin: '0 auto 20px' }} />
          <h2 style={{ marginBottom: 12 }}>Password updated!</h2>
          <p style={{ color: 'var(--color-text-3)', fontSize: 14, marginBottom: 32 }}>You can now sign in with your new password.</p>
          <Link to="/login" className="btn btn-primary" id="reset-done-login-btn" style={{ width: '100%', height: 44 }}>
            Sign In
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h2 style={{ textAlign: 'center', marginBottom: 8 }}>Set new password</h2>
      <p style={{ textAlign: 'center', color: 'var(--color-text-3)', marginBottom: 32, fontSize: 14 }}>
        Choose a strong password for your account
      </p>

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="form-group">
          <label className="form-label" htmlFor="reset-password">New Password</label>
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              id="reset-password"
              type="password"
              className="form-input"
              style={{ paddingLeft: 38 }}
              placeholder="Min. 8 characters"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="reset-confirm">Confirm Password</label>
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              id="reset-confirm"
              type="password"
              className="form-input"
              style={{ paddingLeft: 38 }}
              placeholder="Repeat password"
              value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
            />
          </div>
        </div>
        {error && <p className="form-error">{error}</p>}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          id="reset-submit-btn"
          style={{ height: 44 }}
        >
          {loading ? <div className="spinner" /> : <>Update Password <ArrowRight size={16} /></>}
        </button>
      </form>
    </AuthShell>
  )
}
