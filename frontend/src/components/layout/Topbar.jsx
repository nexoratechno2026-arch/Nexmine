import { useState, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { Menu, Database, Sun, Moon } from 'lucide-react'
import client from '../../api/client'

const pageTitles = {
  '/app/dashboard':  'Dashboard',
  '/app/upload':     'Data Upload',
  '/app/quality':    'Data Quality',
  '/app/customers':  'Customer Intelligence',
  '/app/products':   'Product Intelligence',
  '/app/patterns':   'Pattern Discovery',
  '/app/insights':   'AI Insights',
  '/app/whatif':     'What-If Analysis',
  '/app/ask':        'Ask Nex Mine',
  '/app/reports':    'Reports',
}

export default function Topbar({ onMenuClick }) {
  const { pathname } = useLocation()
  const title = pageTitles[pathname] || 'Nex Mine'

  const [datasets, setDatasets] = useState([])
  const [activeDatasetId, setActiveDatasetId] = useState(localStorage.getItem('active_dataset_id') || '')
  const [theme, setTheme] = useState(localStorage.getItem('nexmine_theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('nexmine_theme', theme)
  }, [theme])

  useEffect(() => {
    fetchDatasets()

    function onDatasetChanged() {
      const current = localStorage.getItem('active_dataset_id') || ''
      setActiveDatasetId(current)
      fetchDatasets()
    }

    window.addEventListener('active_dataset_changed', onDatasetChanged)
    return () => window.removeEventListener('active_dataset_changed', onDatasetChanged)
  }, [])

  async function fetchDatasets() {
    try {
      const res = await client.get('/datasets/me')
      if (Array.isArray(res.data) && res.data.length > 0) {
        setDatasets(res.data)
        const currentActive = localStorage.getItem('active_dataset_id')
        if (!currentActive || !res.data.some(d => d.id === currentActive)) {
          const firstId = res.data[0].id
          localStorage.setItem('active_dataset_id', firstId)
          setActiveDatasetId(firstId)
          window.dispatchEvent(new Event('active_dataset_changed'))
        }
      }
    } catch {
      // Ignore on error
    }
  }

  function handleDatasetChange(e) {
    const newId = e.target.value
    localStorage.setItem('active_dataset_id', newId)
    setActiveDatasetId(newId)
    window.dispatchEvent(new Event('active_dataset_changed'))
  }

  function toggleTheme() {
    setTheme(t => (t === 'light' ? 'dark' : 'light'))
  }

  return (
    <header className="topbar">
      {/* Mobile hamburger & title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <button
          className="topbar-hamburger"
          onClick={onMenuClick}
          id="topbar-menu-btn"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
        <h1 className="topbar-title">{title}</h1>
      </div>

      <div className="topbar-right">
        {/* Theme toggle */}
        <button
          className="btn btn-ghost btn-sm"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          style={{ padding: '6px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
        >
          {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
        </button>

        {/* Dataset Switcher Dropdown */}
        {datasets.length > 0 ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              fontSize: 12,
              maxWidth: 'min(220px, 45vw)'
            }}
          >
            <Database size={13} style={{ color: 'var(--color-text-2)', flexShrink: 0 }} />
            <select
              value={activeDatasetId}
              onChange={handleDatasetChange}
              aria-label="Active store dataset"
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--color-text)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                width: '100%',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap'
              }}
            >
              {datasets.map(ds => (
                <option key={ds.id} value={ds.id} style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>
                  {ds.original_filename} ({ds.row_count?.toLocaleString()} rows)
                </option>
              ))}
            </select>
          </div>
        ) : (
          <Link
            to="/app/upload"
            className="btn btn-primary btn-sm"
            title="Upload your first dataset to start"
            id="dataset-indicator"
            style={{ gap: 6, padding: '5px 12px', fontSize: 12 }}
          >
            <Database size={13} />
            <span>Upload Data</span>
          </Link>
        )}
      </div>
    </header>
  )
}
