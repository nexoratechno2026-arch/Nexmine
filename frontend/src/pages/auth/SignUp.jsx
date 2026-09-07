import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, User, ArrowRight } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { AuthShell } from './Login'
import toast from 'react-hot-toast'

export default function SignUp() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!form.full_name.trim()) e.full_name = 'Name is required'
    if (!form.email)            e.email     = 'Email is required'
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters'
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    if (!validate()) return
    setLoading(true)
    const result = await register(form.email, form.password, form.full_name.trim())
    setLoading(false)
    if (result.success) {
      toast.success('Account created! Welcome to Nex Mine 🎉')
      navigate('/app/dashboard')
    } else {
      toast.error(result.message)
    }
  }

  const field = (id, label, type, icon, placeholder, key, extra = {}) => (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>{label}</label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', display: 'flex' }}>
          {icon}
        </span>
        <input
          id={id}
          type={type}
          className={`form-input ${errors[key] ? 'error' : ''}`}
          style={{ paddingLeft: 38, ...extra }}
          placeholder={placeholder}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        />
        {(key === 'password' || key === 'confirm') && (
          <button
            type="button"
            onClick={() => setShowPass(s => !s)}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}
            id={`${id}-toggle`}
          >
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {errors[key] && <span className="form-error">{errors[key]}</span>}
    </div>
  )

  return (
    <AuthShell>
      <h2 style={{ textAlign: 'center', marginBottom: 8 }}>Create your account</h2>
      <p style={{ textAlign: 'center', color: 'var(--color-text-3)', marginBottom: 32, fontSize: 14 }}>
        Start mining your business data for free
      </p>

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {field('signup-name',     'Full Name', 'text',     <User size={16} />,  'Jane Smith',        'full_name')}
        {field('signup-email',    'Email',     'email',    <Mail size={16} />,  'you@company.com',   'email')}
        {field('signup-password', 'Password',  showPass ? 'text' : 'password', <Lock size={16} />, 'Min. 8 characters', 'password', { paddingRight: 42 })}
        {field('signup-confirm',  'Confirm Password', showPass ? 'text' : 'password', <Lock size={16} />, 'Repeat password', 'confirm', { paddingRight: 42 })}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          id="signup-submit-btn"
          style={{ marginTop: 4, height: 44, fontSize: 15 }}
        >
          {loading ? <div className="spinner" /> : (
            <>Create Account <ArrowRight size={16} /></>
          )}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--color-text-muted)' }}>
        Already have an account?{' '}
        <Link to="/login" style={{ color: 'var(--color-primary-l)', fontWeight: 600 }}>Sign in</Link>
      </p>
    </AuthShell>
  )
}
