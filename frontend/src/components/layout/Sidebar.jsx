import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, Upload, ShieldCheck, Users, Package,
  Sparkles, Brain, MessageSquare, TrendingUp, FileBarChart,
  LogOut, X
} from 'lucide-react'

const navSections = [
  {
    label: 'Overview',
    items: [
      { to: '/app/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
    ]
  },
  {
    label: 'Data',
    items: [
      { to: '/app/upload',     icon: Upload,           label: 'Data Upload' },
      { to: '/app/quality',    icon: ShieldCheck,      label: 'Data Quality' },
    ]
  },
  {
    label: 'Analytics',
    items: [
      { to: '/app/customers',  icon: Users,            label: 'Customer Intelligence' },
      { to: '/app/products',   icon: Package,          label: 'Product Intelligence' },
      { to: '/app/patterns',   icon: Sparkles,         label: 'Pattern Discovery' },
    ]
  },
  {
    label: 'Tools',
    items: [
      { to: '/app/insights',   icon: Brain,            label: 'AI Insights' },
      { to: '/app/whatif',     icon: TrendingUp,       label: 'What-If Analysis' },
      { to: '/app/ask',        icon: MessageSquare,    label: 'Ask Nex Mine' },
    ]
  },
  {
    label: 'Exports',
    items: [
      { to: '/app/reports',    icon: FileBarChart,     label: 'Reports' },
    ]
  },
]

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      {/* Logo & Mobile Close Button */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">⬡</div>
        <span style={{ color: 'var(--color-text)' }}>Nex Mine</span>
        <button
          className="sidebar-close-btn"
          onClick={onClose}
          aria-label="Close menu"
          id="sidebar-close-btn"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navSections.map((section) => (
          <div key={section.label}>
            <div className="sidebar-section-label">{section.label}</div>
            {section.items.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <Icon className="sidebar-icon" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div style={{
        padding: '14px 16px',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        background: 'var(--color-bg-2)'
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: 'var(--color-text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {user?.full_name || 'My Account'}
          </div>
          <div style={{
            fontSize: 11, color: 'var(--color-text-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            {user?.email}
          </div>
        </div>
        <button
          onClick={handleLogout}
          title="Sign out"
          id="sidebar-logout-btn"
          className="btn btn-ghost btn-sm"
          style={{ padding: 6, color: 'var(--color-text-muted)' }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  )
}
