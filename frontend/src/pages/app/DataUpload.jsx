import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, FileSpreadsheet, X, CheckCircle2, AlertCircle,
  ChevronDown, ArrowRight, Info, Loader2, Lock, Unlock
} from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../../api/client'

// The 11 NexMine canonical fields with labels and descriptions
const NEXMINE_FIELDS = [
  { key: 'transaction_id', label: 'Transaction ID',  desc: 'Unique identifier for each order/invoice', required: false },
  { key: 'date',           label: 'Date',             desc: 'Transaction date or timestamp',           required: true  },
  { key: 'customer_id',   label: 'Customer ID',      desc: 'Unique identifier for each customer',     required: false },
  { key: 'product',        label: 'Product',          desc: 'Product name or SKU',                     required: false },
  { key: 'category',       label: 'Category',         desc: 'Product or item category/department',    required: false },
  { key: 'quantity',       label: 'Quantity',         desc: 'Number of units sold',                    required: false },
  { key: 'unit_price',     label: 'Unit Price',       desc: 'Price per single unit',                   required: false },
  { key: 'total_amount',   label: 'Total Amount',     desc: 'Total revenue for this line/transaction', required: false },
  { key: 'discount',       label: 'Discount',         desc: 'Discount applied (value or %)',           required: false },
  { key: 'location',       label: 'Location',         desc: 'Store, branch, region, or city',         required: false },
  { key: 'payment_method', label: 'Payment Method',   desc: 'Card, cash, online, etc.',               required: false },
]

const ANALYSIS_LABELS = {
  rfm:               { label: 'RFM Analysis',           icon: '👥' },
  clustering:        { label: 'Customer Clustering',    icon: '🔵' },
  association_rules: { label: 'Association Rules',      icon: '🔗' },
  sales_patterns:    { label: 'Sales Patterns',         icon: '📈' },
  anomaly_detection: { label: 'Anomaly Detection',      icon: '⚠️' },
  what_if:           { label: 'What-If Analysis',       icon: '🔮' },
}

const CONFIDENCE_COLORS = {
  high:   { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)', text: 'var(--color-accent-l)' },
  medium: { bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)', text: '#FCD34D' },
  low:    { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)',  text: '#FCA5A5' },
  none:   { bg: 'var(--color-surface-2)', border: 'var(--color-border-2)', text: 'var(--color-text-muted)' },
}

function getConfidenceLevel(conf) {
  if (conf >= 0.85) return 'high'
  if (conf >= 0.65) return 'medium'
  if (conf > 0)     return 'low'
  return 'none'
}

// ── Step indicators ───────────────────────────────────────────────────────────
function StepIndicator({ step, current }) {
  const done = current > step
  const active = current === step
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 14,
        background: done ? 'var(--color-accent)' : active ? 'var(--grad-primary)' : 'var(--color-surface-2)',
        color: done || active ? '#fff' : 'var(--color-text-muted)',
        transition: 'all 0.25s',
        flexShrink: 0,
      }}>
        {done ? <CheckCircle2 size={16} /> : step}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DataUpload() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)  // 1=upload, 2=mapping, 3=done
  const [uploading, setUploading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  // Upload result
  const [datasetId, setDatasetId] = useState(null)
  const [fileInfo, setFileInfo] = useState(null)   // { name, rows, cols }
  const [proposals, setProposals] = useState([])   // raw proposals from API

  // Mapping state: { nexmine_field: raw_column | null }
  const [mapping, setMapping] = useState({})

  // Gate result
  const [gate, setGate] = useState(null)

  const fileInputRef = useRef()

  // ── File processing ─────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      toast.error('Only CSV, XLS, and XLSX files are supported.')
      return
    }

    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)

    try {
      const { data } = await client.post('/datasets/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setDatasetId(data.dataset_id)
      setFileInfo({ name: data.original_filename, rows: data.row_count, cols: data.column_count })
      setProposals(data.proposals)

      // Pre-populate mapping from proposals
      const initialMapping = {}
      data.proposals.forEach(p => {
        if (p.proposed_field) {
          initialMapping[p.proposed_field] = p.raw_column
        }
      })
      setMapping(initialMapping)

      toast.success(`${data.row_count.toLocaleString()} rows detected — review the mapping below.`)
      setStep(2)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }, [handleFile])

  // ── Mapping helpers ─────────────────────────────────────────────────────────
  function setFieldMapping(nexField, rawCol) {
    setMapping(prev => {
      const next = { ...prev }
      // Remove this raw column from any other field that was using it
      for (const k of Object.keys(next)) {
        if (next[k] === rawCol && k !== nexField) delete next[k]
      }
      if (rawCol === '__none__') delete next[nexField]
      else next[nexField] = rawCol
      return next
    })
  }

  // ── Confirm mapping ─────────────────────────────────────────────────────────
  async function confirmMapping() {
    if (Object.keys(mapping).length === 0) {
      toast.error('Map at least one field before confirming.')
      return
    }
    setConfirming(true)
    try {
      const { data } = await client.post(`/datasets/${datasetId}/confirm-mapping`, { mapping })
      setGate(data.analyses_available)
      localStorage.setItem('active_dataset_id', data.dataset_id)
      if (fileInfo?.name) localStorage.setItem('active_dataset_name', fileInfo.name)
      window.dispatchEvent(new Event('active_dataset_changed'))
      toast.success('Column mapping confirmed! Analyses and models are now ready.')
      setStep(3)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not confirm mapping.')
    } finally {
      setConfirming(false)
    }
  }

  // ── Raw column options for a field's dropdown ───────────────────────────────
  function getDropdownOptions(nexField) {
    // All raw columns from proposals
    const all = proposals.map(p => p.raw_column)
    // Columns assigned to other fields
    const taken = new Set(
      Object.entries(mapping)
        .filter(([k]) => k !== nexField)
        .map(([, v]) => v)
    )
    return all.filter(col => !taken.has(col))
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-up">
      {/* Page header */}
      <div className="page-header">
        <h1>Data Upload</h1>
        <p>Upload your sales CSV or Excel file, then confirm the column mapping to begin analysis.</p>
      </div>

      {/* Step bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 'var(--space-6)',
        padding: '14px 18px',
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        flexWrap: 'wrap'
      }}>
        {[
          { n: 1, label: 'Upload File' },
          { n: 2, label: 'Map Columns' },
          { n: 3, label: 'Analyses Ready' },
        ].map(({ n, label }, i, arr) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: n < arr.length ? '1 1 180px' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StepIndicator step={n} current={step} />
              <span style={{
                fontSize: 13.5, fontWeight: step === n ? 600 : 400,
                color: step === n ? 'var(--color-text)' : step > n ? 'var(--color-accent)' : 'var(--color-text-muted)',
              }}>{label}</span>
            </div>
            {i < arr.length - 1 && (
              <div style={{ flex: 1, height: 1, background: step > n ? 'var(--color-accent)' : 'var(--color-border)', minWidth: 16 }} />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Drop Zone ───────────────────────────────────────────────── */}
      {step === 1 && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          id="upload-dropzone"
          style={{
            border: `2px dashed ${dragOver ? 'var(--color-primary)' : 'var(--color-border)'}`,
            borderRadius: 'var(--radius-xl)',
            padding: '80px 40px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
            cursor: uploading ? 'default' : 'pointer',
            transition: 'all 0.2s',
            background: dragOver ? 'rgba(99,102,241,0.05)' : 'var(--color-surface)',
            textAlign: 'center',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: 'none' }}
            id="file-input"
            onChange={e => handleFile(e.target.files[0])}
          />

          {uploading ? (
            <>
              <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
              <h3>Reading file…</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Detecting columns and proposing field mappings</p>
            </>
          ) : (
            <>
              <div style={{
                width: 72, height: 72, borderRadius: 20,
                background: dragOver ? 'rgba(99,102,241,0.15)' : 'var(--color-surface-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: dragOver ? 'var(--color-primary)' : 'var(--color-text-muted)',
                transition: 'all 0.2s',
              }}>
                <Upload size={32} />
              </div>
              <div>
                <h3 style={{ marginBottom: 8 }}>Drop your file here</h3>
                <p style={{ color: 'var(--color-text-3)', fontSize: 14 }}>
                  or <span style={{ color: 'var(--color-primary-l)', fontWeight: 600 }}>browse to upload</span>
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                {['CSV', 'XLS', 'XLSX'].map(ext => (
                  <span key={ext} className="badge badge-muted">
                    <FileSpreadsheet size={11} /> {ext}
                  </span>
                ))}
              </div>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                Maximum file size: 50 MB
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Step 2: Column Mapping ──────────────────────────────────────────── */}
      {step === 2 && fileInfo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* File summary */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'rgba(16,185,129,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-accent)', flexShrink: 0,
            }}>
              <FileSpreadsheet size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{fileInfo.name}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {fileInfo.rows.toLocaleString()} rows · {fileInfo.cols} columns detected
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setStep(1)}
              id="mapping-change-file"
              title="Upload a different file"
            >
              <X size={14} /> Change file
            </button>
          </div>

          {/* Mapping info banner */}
          <div style={{
            display: 'flex', gap: 12, alignItems: 'flex-start',
            background: 'rgba(99,102,241,0.07)',
            border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            fontSize: 13, color: 'var(--color-text-3)',
          }}>
            <Info size={16} color="var(--color-primary-l)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              Nex Mine has proposed a mapping based on your column names.
              {' '}<strong style={{ color: 'var(--color-text)' }}>Review and adjust</strong> before confirming.
              {' '}Fields you leave unmapped will disable the analyses that depend on them — each with an explanation.
            </div>
          </div>

          {/* Mapping table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ minWidth: 540 }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 140px',
                  background: 'var(--color-surface-2)',
                  borderBottom: '1px solid var(--color-border-2)',
                  padding: '12px 20px',
                  fontSize: 11, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: 'var(--color-text-muted)',
                }}>
                  <span>NexMine Field</span>
                  <span>Your Column</span>
                  <span>Confidence</span>
                </div>

            {NEXMINE_FIELDS.map(({ key, label, desc }) => {
              const selectedCol = mapping[key] || null
              const proposal = proposals.find(p => p.proposed_field === key)
              const confLevel = selectedCol
                ? (proposal?.raw_column === selectedCol ? getConfidenceLevel(proposal?.confidence ?? 0) : 'medium')
                : 'none'
              const style = CONFIDENCE_COLORS[confLevel]
              const opts = getDropdownOptions(key)

              return (
                <div
                  key={key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 140px',
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--color-border-2)',
                    alignItems: 'center',
                    gap: 16,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  {/* NexMine field label */}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{desc}</div>
                  </div>

                  {/* Column selector */}
                  <div style={{ position: 'relative' }}>
                    <select
                      id={`mapping-select-${key}`}
                      value={selectedCol || '__none__'}
                      onChange={e => setFieldMapping(key, e.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--color-surface-2)',
                        border: `1px solid ${selectedCol ? style.border : 'var(--color-border-2)'}`,
                        borderRadius: 'var(--radius-sm)',
                        padding: '8px 32px 8px 10px',
                        color: selectedCol ? 'var(--color-text)' : 'var(--color-text-muted)',
                        fontSize: 13,
                        outline: 'none',
                        cursor: 'pointer',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        transition: 'border-color 0.15s',
                      }}
                    >
                      <option value="__none__">— Not mapped —</option>
                      {opts.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                      {/* If selectedCol is set but no longer in opts (e.g. taken by another) */}
                      {selectedCol && !opts.includes(selectedCol) && (
                        <option value={selectedCol}>{selectedCol}</option>
                      )}
                    </select>
                    <ChevronDown size={14} style={{
                      position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--color-text-muted)', pointerEvents: 'none',
                    }} />
                  </div>

                  {/* Confidence badge */}
                  <div>
                    {selectedCol ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '4px 10px', borderRadius: 'var(--radius-full)',
                        fontSize: 11, fontWeight: 600,
                        background: style.bg,
                        border: `1px solid ${style.border}`,
                        color: style.text,
                      }}>
                        <CheckCircle2 size={11} />
                        {confLevel === 'high' ? 'High' : confLevel === 'medium' ? 'Medium' : 'Manual'}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Not mapped</span>
                    )}
                  </div>
                </div>
              )
            })}
              </div>
            </div>
          </div>

          {/* Confirm button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)', alignSelf: 'center' }}>
              {Object.keys(mapping).length} of 11 fields mapped
            </span>
            <button
              className="btn btn-primary"
              onClick={confirmMapping}
              disabled={confirming || Object.keys(mapping).length === 0}
              id="confirm-mapping-btn"
              style={{ height: 44, minWidth: 180 }}
            >
              {confirming ? <div className="spinner" /> : (
                <>Confirm Mapping <ArrowRight size={16} /></>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Analysis Gate Results ─────────────────────────────────── */}
      {step === 3 && gate && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Success header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '24px 28px',
            background: 'rgba(16,185,129,0.07)',
            border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: 'var(--radius-lg)',
          }}>
            <CheckCircle2 size={36} color="var(--color-accent)" />
            <div>
              <h3 style={{ marginBottom: 4, color: 'var(--color-accent)' }}>Dataset ready!</h3>
              <p style={{ fontSize: 14, color: 'var(--color-text-3)', margin: 0 }}>
                Column mapping confirmed. Here's what Nex Mine can analyse from your data.
              </p>
            </div>
          </div>

          {/* Analysis gate cards */}
          <div>
            <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-4)' }}>Analyses Available</h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 'var(--space-4)',
            }}>
              {Object.entries(gate).map(([key, status]) => {
                const meta = ANALYSIS_LABELS[key] || { label: key, icon: '📊' }
                return (
                  <div
                    key={key}
                    className="card"
                    style={{
                      borderColor: status.enabled
                        ? 'rgba(16,185,129,0.25)'
                        : 'var(--color-border-2)',
                      background: status.enabled
                        ? 'rgba(16,185,129,0.04)'
                        : 'var(--color-surface)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <span style={{ fontSize: 22, lineHeight: 1 }}>{meta.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{meta.label}</span>
                          {status.enabled
                            ? <Unlock size={13} color="var(--color-accent)" />
                            : <Lock size={13} color="var(--color-text-muted)" />
                          }
                        </div>
                        {status.enabled ? (
                          <span className="badge badge-accent" style={{ fontSize: 11 }}>
                            <CheckCircle2 size={10} /> Enabled
                          </span>
                        ) : (
                          <div>
                            <span className="badge badge-muted" style={{ fontSize: 11, marginBottom: 8 }}>
                              Disabled
                            </span>
                            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8, lineHeight: 1.55 }}>
                              {status.reason}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => navigate('/app/insights')}
              id="goto-insights-btn"
            >
              View AI Insights <ArrowRight size={18} />
            </button>
            <button
              className="btn btn-secondary btn-lg"
              onClick={() => navigate('/app/whatif')}
              id="goto-whatif-btn"
            >
              Run What-If Analysis <ArrowRight size={18} />
            </button>
            <button
              className="btn btn-outline"
              onClick={() => navigate('/app/dashboard')}
              id="goto-dashboard-btn"
            >
              Dashboard
            </button>
            <button
              className="btn btn-outline"
              onClick={() => { setStep(1); setDatasetId(null); setFileInfo(null); setProposals([]); setMapping({}); setGate(null) }}
              id="upload-another-btn"
            >
              Upload Another File
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
