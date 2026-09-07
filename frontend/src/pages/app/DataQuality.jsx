import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Info,
  Upload, BarChart3, Clock,
  X, ChevronDown, ChevronRight, TrendingDown
} from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../../api/client'

// ─── Score ring (SVG) ────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const progress = circ * (1 - score / 100)

  const color =
    score >= 80 ? '#10B981' :
    score >= 60 ? '#F59E0B' :
    score >= 40 ? '#F97316' : '#EF4444'

  const label =
    score >= 80 ? 'Excellent' :
    score >= 60 ? 'Good' :
    score >= 40 ? 'Fair' : 'Poor'

  return (
    <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
      <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        {/* Progress */}
        <circle
          cx="70" cy="70" r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={progress}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-heading)', color }}>{score}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
    </div>
  )
}

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, subtitle, color = 'var(--color-primary)', warn = false }) {
  return (
    <div className="card kpi-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="kpi-label" style={{ marginBottom: 8 }}>{label}</div>
          <div style={{
            fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 700,
            color: warn && value > 0 ? 'var(--color-warning)' : 'var(--color-text)',
          }}>{value.toLocaleString()}</div>
          {subtitle && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>{subtitle}</div>}
        </div>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0,
        }}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  )
}

// ─── Severity badge ───────────────────────────────────────────────────────────
function SeverityBadge({ severity }) {
  return severity === 'auto'
    ? <span className="badge badge-accent" style={{ fontSize: 10 }}><CheckCircle2 size={10} /> Auto-fixed</span>
    : <span className="badge badge-warning" style={{ fontSize: 10 }}><AlertTriangle size={10} /> Needs attention</span>
}

// ─── Collapsible section ──────────────────────────────────────────────────────
function Collapsible({ title, count, children, defaultOpen = false, badge }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-text)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
          {count !== undefined && (
            <span className="badge badge-muted" style={{ fontSize: 11 }}>{count}</span>
          )}
          {badge}
        </div>
        {open ? <ChevronDown size={16} color="var(--color-text-muted)" /> : <ChevronRight size={16} color="var(--color-text-muted)" />}
      </button>
      {open && <div style={{ borderTop: '1px solid var(--color-border-2)', padding: '16px 20px' }}>{children}</div>}
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function MiniBar({ pct, color = 'var(--color-primary)' }) {
  return (
    <div style={{ height: 4, background: 'var(--color-surface-2)', borderRadius: 2, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${Math.min(100, pct * 100).toFixed(1)}%`, background: color, borderRadius: 2, transition: 'width 0.8s ease' }} />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DataQuality() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [datasetId, setDatasetId] = useState(localStorage.getItem('active_dataset_id') || '')
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  const fetchExistingReport = useCallback(async (id) => {
    const targetId = id || datasetId
    if (!targetId?.trim()) return
    try {
      setLoading(true)
      const res = await client.get(`/quality/${targetId.trim()}`)
      if (res.data) {
        setReport(res.data)
      }
    } catch {
      // Not yet computed, allow user to run it
    } finally {
      setLoading(false)
    }
  }, [datasetId])

  useEffect(() => {
    function onDatasetChanged() {
      const current = localStorage.getItem('active_dataset_id') || ''
      setDatasetId(current)
      if (current) fetchExistingReport(current)
      else setReport(null)
    }
    window.addEventListener('active_dataset_changed', onDatasetChanged)
    return () => window.removeEventListener('active_dataset_changed', onDatasetChanged)
  }, [fetchExistingReport])

  useEffect(() => {
    if (datasetId) {
      fetchExistingReport(datasetId)
    }
  }, [datasetId, fetchExistingReport])

  async function runQuality() {
    if (!datasetId.trim()) { toast.error('Please upload or select a dataset first'); return }

    setLoading(true)
    const fd = new FormData()
    if (file) {
      fd.append('file', file)
    }

    try {
      const { data } = await client.post(`/quality/${datasetId.trim()}/run`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setReport(data)
      toast.success(`Quality Score: ${data.quality_score}/100`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Quality analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  if (!report) {
    return (
      <div className="animate-fade-up">
        <div className="page-header">
          <h1>Data Quality</h1>
          <p>Scan your sales data for duplicates, missing values, date format errors, and outliers.</p>
        </div>

        <div className="card" style={{ maxWidth: 640 }}>
          <h3 style={{ marginBottom: 16 }}>Run Data Quality Health Check</h3>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Active Dataset</label>
            <input
              id="quality-dataset-id"
              className="form-input"
              placeholder="Dataset ID will automatically appear once uploaded"
              value={datasetId}
              onChange={e => setDatasetId(e.target.value)}
            />
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Automatically synced with the active store dataset selected in the top bar.
            </span>
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            id="quality-dropzone"
            style={{
              border: `2px dashed ${dragOver || file ? 'var(--color-accent)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '32px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              cursor: 'pointer', textAlign: 'center', marginBottom: 20,
              background: file ? 'rgba(16,185,129,0.04)' : 'var(--color-surface-2)',
              transition: 'all 0.2s',
            }}
          >
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
              onChange={e => setFile(e.target.files[0])} />
            {file ? (
              <>
                <CheckCircle2 size={28} color="var(--color-accent)" />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{file.name}</span>
                <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setFile(null) }}>
                  <X size={12} /> Remove
                </button>
              </>
            ) : (
              <>
                <Upload size={28} color="var(--color-text-muted)" />
                <span style={{ fontSize: 14, color: 'var(--color-text-3)' }}>Re-upload your file</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  Drop here or click to browse (CSV, XLS, XLSX)
                </span>
              </>
            )}
          </div>

          <button
            className="btn btn-primary"
            onClick={runQuality}
            disabled={loading}
            id="run-quality-btn"
            style={{ width: '100%', height: 44 }}
          >
            {loading ? <div className="spinner" /> : (
              <><ShieldCheck size={16} /> Run Quality Analysis</>
            )}
          </button>
        </div>
      </div>
    )
  }

  // ── Report view ────────────────────────────────────────────────────────────
  const { total_rows, valid_rows, duplicate_rows, missing_values_count,
          invalid_date_count, invalid_quantity_count, invalid_price_count,
          outlier_count, quality_score, column_stats, cleaning_log,
          user_attention_items, score_formula } = report

  const autoFixes = cleaning_log.filter(c => c.severity === 'auto')
  const attentionItems = cleaning_log.filter(c => c.severity === 'attention')

  return (
    <div className="animate-fade-up">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Data Quality Report</h1>
          <p>All checks computed from your actual uploaded data — nothing estimated.</p>
        </div>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => { setReport(null); setFile(null) }}
          id="quality-rerun-btn"
        >
          <Upload size={14} /> Re-run Analysis
        </button>
      </div>

      {/* Score + summary */}
      <div className="card" style={{
        display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap',
        marginBottom: 'var(--space-6)',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(16,185,129,0.04) 100%)',
      }}>
        <ScoreRing score={quality_score} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <h2 style={{ fontSize: '1.3rem' }}>Data Quality Score</h2>
            <span className="badge badge-muted" style={{ fontSize: 10 }}>
              <Info size={10} /> Deterministic formula
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-text-3)', marginBottom: 16, lineHeight: 1.6 }}>
            {score_formula}
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Total rows:</span>{' '}
              <strong>{total_rows.toLocaleString()}</strong>
            </span>
            <span style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Valid rows:</span>{' '}
              <strong style={{ color: 'var(--color-accent)' }}>{valid_rows.toLocaleString()}</strong>
            </span>
            {autoFixes.length > 0 && (
              <span className="badge badge-accent" style={{ fontSize: 11 }}>
                <CheckCircle2 size={10} /> {autoFixes.length} auto-fixed
              </span>
            )}
            {attentionItems.length > 0 && (
              <span className="badge badge-warning" style={{ fontSize: 11 }}>
                <AlertTriangle size={10} /> {attentionItems.length} need attention
              </span>
            )}
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid-4" style={{ marginBottom: 'var(--space-6)' }}>
        <StatCard icon={X} label="Duplicate Rows" value={duplicate_rows}
          color="var(--color-danger)" warn={duplicate_rows > 0}
          subtitle={duplicate_rows > 0 ? 'Removed automatically' : 'None detected'} />
        <StatCard icon={TrendingDown} label="Missing Values" value={missing_values_count}
          color="var(--color-warning)" warn={missing_values_count > 0}
          subtitle="Across all mapped columns" />
        <StatCard icon={Clock} label="Invalid Dates" value={invalid_date_count}
          color="#8B5CF6" warn={invalid_date_count > 0}
          subtitle="Could not be parsed" />
        <StatCard icon={BarChart3} label="Outlier Rows" value={outlier_count}
          color="var(--color-primary)" warn={outlier_count > 0}
          subtitle="IQR×3 method, flagged" />
      </div>

      {/* User attention items */}
      {user_attention_items.length > 0 && (
        <Collapsible
          title="Issues Requiring Your Attention"
          count={user_attention_items.length}
          defaultOpen
          badge={<span className="badge badge-warning" style={{ fontSize: 10 }}>Action needed</span>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {user_attention_items.map((item, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                background: 'rgba(245,158,11,0.06)',
                border: '1px solid rgba(245,158,11,0.15)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
              }}>
                <AlertTriangle size={16} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: '#FCD34D' }}>
                    {item.issue}
                    {item.count && <span style={{ marginLeft: 8, color: 'var(--color-text-muted)', fontWeight: 400 }}>({item.count.toLocaleString()} rows)</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-3)', lineHeight: 1.6 }}>
                    {item.recommendation}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Collapsible>
      )}

      {/* Cleaning log */}
      <Collapsible title="Cleaning Log" count={cleaning_log.length} defaultOpen={cleaning_log.length > 0}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cleaning_log.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>No cleaning actions were required.</p>
          ) : (
            cleaning_log.map((entry, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '12px 0',
                borderBottom: i < cleaning_log.length - 1 ? '1px solid var(--color-border-2)' : 'none',
              }}>
                <SeverityBadge severity={entry.severity} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.55 }}>{entry.description}</div>
                  {entry.rows_affected > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                      {entry.rows_affected.toLocaleString()} rows affected
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Collapsible>

      {/* Column stats */}
      <Collapsible title="Column-by-Column Breakdown" count={column_stats.length}>
        <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 620, gap: 0 }}>
            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '180px 120px 1fr 80px 80px',
              gap: 16, padding: '8px 0',
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.07em', color: 'var(--color-text-muted)',
              borderBottom: '1px solid var(--color-border-2)', marginBottom: 8,
            }}>
              <span>Column</span>
              <span>NexMine Field</span>
              <span>Missing Rate</span>
              <span>Unique</span>
              <span>Issues</span>
            </div>
            {column_stats.map((cs, i) => {
              const pct = cs.pct_missing
              const barColor = pct > 0.2 ? 'var(--color-danger)' : pct > 0.05 ? 'var(--color-warning)' : 'var(--color-accent)'
              return (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '180px 120px 1fr 80px 80px',
                  gap: 16, padding: '10px 0', alignItems: 'center',
                  borderBottom: '1px solid var(--color-border-2)',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cs.column}>
                    {cs.column}
                  </span>
                  <span style={{ fontSize: 11 }}>
                    {cs.nexmine_field
                      ? <span className="badge badge-primary" style={{ fontSize: 10 }}>{cs.nexmine_field}</span>
                      : <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                    }
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <MiniBar pct={pct} color={barColor} />
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>{(pct * 100).toFixed(1)}%</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{cs.unique_count.toLocaleString()}</span>
                  <span style={{ fontSize: 12, color: cs.type_issues > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
                    {cs.type_issues > 0 ? cs.type_issues : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </Collapsible>
    </div>
  )
}
