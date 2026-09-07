import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts'
import { Activity, AlertTriangle, AlertCircle, TrendingUp, Calendar, ArrowRight, Info } from 'lucide-react'
import client from '../../api/client'
import { formatINR } from '../../utils/currency'

export default function PatternDiscovery() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [datasetId, setDatasetId] = useState(localStorage.getItem('active_dataset_id') || '')

  useEffect(() => {
    function onDatasetChanged() {
      const current = localStorage.getItem('active_dataset_id') || ''
      setDatasetId(current)
    }
    window.addEventListener('active_dataset_changed', onDatasetChanged)
    return () => window.removeEventListener('active_dataset_changed', onDatasetChanged)
  }, [])

  useEffect(() => {
    if (datasetId) fetchMiningResults()
  }, [datasetId])

  async function fetchMiningResults(forceRun = false) {
    try {
      setLoading(true)
      if (forceRun) {
        await client.post(`/mining/${datasetId}/run`)
      }
      let res
      try {
        res = await client.get(`/mining/${datasetId}`)
      } catch (err) {
        if (err.response?.status === 404) {
          await client.post(`/mining/${datasetId}/run`)
          res = await client.get(`/mining/${datasetId}`)
        } else {
          throw err
        }
      }
      if (res?.data) {
        setData(res.data)
      }
    } catch (err) {
      console.error(err)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="empty-state" style={{ minHeight: 300 }}>
        <div className="spinner" style={{ width: 28, height: 28 }} />
        <h3 style={{ marginTop: 12 }}>Analyzing Sales Trends...</h3>
        <p>Plotting timeline and detecting unusual spikes or sudden drops.</p>
      </div>
    )
  }

  if (!datasetId) {
    return (
      <div className="card empty-state" style={{ minHeight: 360 }}>
        <div className="empty-state-icon"><Activity size={28} /></div>
        <h3>No Sales Trend Data Loaded</h3>
        <p style={{ maxWidth: 420 }}>
          Upload your sales records to view your revenue trend over time and pinpoint unexpected surges or revenue drops.
        </p>
        <Link to="/app/upload" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
          Upload Store Data <ArrowRight size={14} />
        </Link>
      </div>
    )
  }

  const { sales_patterns, anomalies } = data || {}
  
  if (!sales_patterns || sales_patterns.length === 0) {
    return (
      <div className="card empty-state" style={{ minHeight: 360 }}>
        <div className="empty-state-icon" style={{ color: 'var(--color-warning)' }}><AlertCircle size={28} /></div>
        <h3>No Sales Patterns Yet</h3>
        <p style={{ maxWidth: 440 }}>
          Pattern Discovery requires both <strong>Date</strong> and <strong>Revenue / Quantity</strong> columns mapped. You can run the analysis now or review your column mapping.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => fetchMiningResults(true)} className="btn btn-primary btn-sm">
            Run Analysis Now
          </button>
          <Link to="/app/upload" className="btn btn-secondary btn-sm">
            Review Column Mapping <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    )
  }

  // Format dates for charting
  const chartData = sales_patterns.map(d => ({
    ...d,
    displayDate: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }))

  return (
    <div className="animate-fade-up">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Pattern Discovery</h1>
          <p style={{ marginTop: 4 }}>Monitor your daily sales trajectory and spot sudden revenue peaks or unexpected dips.</p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => fetchMiningResults(true)}
          disabled={loading}
          style={{ gap: 6 }}
        >
          Re-analyze
        </button>
      </div>

      {/* Guide Banner */}
      <div className="guide-banner" style={{ marginBottom: 'var(--space-6)' }}>
        <Info size={20} color="var(--color-primary-light)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong>How to read this chart:</strong> The line shows your daily sales revenue. Unusual outlier days are flagged so you can check what drove that day's performance (like a viral marketing campaign or holiday surge).
        </div>
      </div>

      {/* Sales Trend Chart Card */}
      <div className="card" style={{ marginBottom: 'var(--space-6)', padding: '20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '0 8px', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={18} color="var(--color-primary-light)" /> 
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Daily Sales Timeline</h3>
          </div>
          <span className="badge badge-primary">
            {sales_patterns.length} Active Days
          </span>
        </div>

        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="displayDate"
                stroke="var(--color-text-muted)"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                stroke="var(--color-text-muted)"
                fontSize={11}
                tickLine={false}
                tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text)',
                  fontSize: 12
                }}
                formatter={(value) => [formatINR(value), 'Revenue']}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-primary-light)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: 'var(--color-primary)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Unusual Days (Anomalies) */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <AlertTriangle size={18} color="var(--color-warning)" />
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Flagged Unusual Sales Days</h3>
        </div>

        {anomalies && anomalies.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 12 }}>
            {anomalies.map((a, idx) => (
              <div
                key={idx}
                style={{
                  padding: 14,
                  background: 'var(--color-surface-2)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: '4px solid var(--color-warning)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text)' }}>
                    {new Date(a.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="badge badge-warning" style={{ fontSize: 11 }}>
                    Unusual Spike
                  </span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginTop: 4 }}>
                  {formatINR(a.revenue || a.value)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>
                  Significant surge compared to daily median average.
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--color-text-3)', fontSize: 13, margin: 0 }}>
            No extreme revenue outliers detected. Your store sales are running within normal historical patterns.
          </p>
        )}
      </div>
    </div>
  )
}
