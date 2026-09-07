import { useState, useEffect } from 'react'
import {
  Printer, Download, ShieldCheck, FileText, Users, ShoppingBag,
  TrendingUp, AlertTriangle, ArrowUpRight, CheckCircle2, Building, Sparkles
} from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../../api/client'
import { formatINR } from '../../utils/currency'

export default function Reports() {
  const [datasetId, setDatasetId] = useState(localStorage.getItem('active_dataset_id') || '')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState(null)

  useEffect(() => {
    function onDatasetChanged() {
      const current = localStorage.getItem('active_dataset_id') || ''
      setDatasetId(current)
    }
    window.addEventListener('active_dataset_changed', onDatasetChanged)
    return () => window.removeEventListener('active_dataset_changed', onDatasetChanged)
  }, [])

  useEffect(() => {
    if (datasetId) {
      fetchReportSummary()
    } else {
      setReport(null)
    }
  }, [datasetId])

  async function fetchReportSummary() {
    try {
      setLoading(true)
      const res = await client.get(`/reports/${datasetId}/summary`)
      setReport(res.data)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to load report summary.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleDownloadCsv(endpoint, defaultFilename) {
    try {
      const res = await client.get(`/reports/${datasetId}/export/${endpoint}`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', defaultFilename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success(`Exported ${defaultFilename} successfully!`)
    } catch {
      toast.error('Failed to export CSV.')
    }
  }

  function handlePrint() {
    window.print()
  }

  if (!datasetId) {
    return (
      <div className="card empty-state" style={{ minHeight: 400 }}>
        <div className="empty-state-icon"><FileText size={32} /></div>
        <h3>No Active Dataset</h3>
        <p>Upload a sales dataset in Data Upload first to generate executive reports.</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-up">
      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            background: #FFFFFF !important;
            color: #000000 !important;
            font-size: 12pt;
          }
          .no-print, .sidebar, .app-header {
            display: none !important;
          }
          .main-content {
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-card {
            border: 1px solid #D1D5DB !important;
            box-shadow: none !important;
            background: #FFFFFF !important;
            color: #000000 !important;
            page-break-inside: avoid;
            margin-bottom: 20px !important;
          }
          .print-badge {
            border: 1px solid #9CA3AF !important;
            background: #F3F4F6 !important;
            color: #000000 !important;
          }
          a {
            text-decoration: none !important;
            color: inherit !important;
          }
        }
      `}</style>

      {/* Action Header (Hidden in Print) */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Reports</h1>
            <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
              <FileText size={12} /> Ready for PDF Export
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--color-text-3)' }}>
            One-click executive summaries, PDF exports, and customer target CSV lists.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => handleDownloadCsv('at-risk-customers', 'at_risk_customers.csv')}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title="Download CSV of customers at risk of churn"
          >
            <Download size={14} /> At-Risk CSV
          </button>

          <button
            onClick={() => handleDownloadCsv('association-rules', 'product_bundles.csv')}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title="Download CSV of market basket affinity rules"
          >
            <Download size={14} /> Bundles CSV
          </button>

          <button
            onClick={handlePrint}
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={14} /> Print / Save PDF
          </button>
        </div>
      </div>

      {loading && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-3)' }}>
          <span className="spinner" style={{ margin: '0 auto 12px' }} />
          <div>Compiling executive findings...</div>
        </div>
      )}

      {/* Printable Document Container */}
      {report && (
        <div id="printable-report" style={{ maxWidth: 960, margin: '0 auto' }}>
          {/* Document Header */}
          <div
            className="card print-card"
            style={{
              borderTop: '6px solid var(--color-primary)',
              padding: '28px 32px',
              marginBottom: 20
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>
                    N
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>NexMine Intelligence</span>
                </div>
                <h2 style={{ fontSize: 20, margin: '6px 0 2px', fontWeight: 800 }}>EXECUTIVE COMMERCE AUDIT</h2>
                <div style={{ fontSize: 13, color: 'var(--color-text-3)' }}>
                  Dataset: <strong>{report.dataset_meta?.filename}</strong> • {report.dataset_meta?.total_transactions?.toLocaleString()} transactions analyzed
                </div>
              </div>

              <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--color-text-muted)' }}>
                <div>Report ID: <code style={{ fontWeight: 600 }}>{report.report_id}</code></div>
                <div style={{ marginTop: 4 }}>Generated: {report.generated_at}</div>
                <div style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, color: '#10B981', fontWeight: 600 }}>
                  <ShieldCheck size={14} /> Verified Ground Truth
                </div>
              </div>
            </div>
          </div>

          {/* KPI Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
            <div className="card print-card">
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Total Revenue</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-primary)', marginTop: 4 }}>
                {formatINR(report.kpis?.total_revenue)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>Over {report.dataset_meta?.recorded_days} recorded periods</div>
            </div>

            <div className="card print-card">
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Total Customers</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                {report.kpis?.total_customers?.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>Individual shoppers in records</div>
            </div>

            <div className="card print-card">
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Average Daily Sales</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                {formatINR(report.kpis?.avg_daily_revenue)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>Average sales volume per active day</div>
            </div>

            <div className="card print-card" style={{ borderLeft: `4px solid ${report.kpis?.churn_risk_pct > 30 ? '#EF4444' : '#10B981'}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Customers Slipping Away</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: report.kpis?.churn_risk_pct > 30 ? '#EF4444' : '#10B981', marginTop: 4 }}>
                {report.kpis?.churn_risk_pct}%
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginTop: 2 }}>Shoppers who haven't bought recently</div>
            </div>
          </div>

          {/* Executive Summary */}
          {report.executive_summary && (
            <div className="card print-card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Executive Overview</h3>
                <span
                  className="badge print-badge"
                  style={{
                    background: `${report.executive_summary.status_color}20`,
                    color: report.executive_summary.status_color,
                    fontWeight: 700,
                    fontSize: 12
                  }}
                >
                  {report.executive_summary.status}
                </span>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 10px' }}>
                {report.executive_summary.headline}
              </p>
              {report.executive_summary.narrative?.map((para, i) => (
                <p key={i} style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-2)', margin: '0 0 8px' }}>
                  {para}
                </p>
              ))}
            </div>
          )}

          {/* Customer RFM & Personas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div className="card print-card">
              <h4 style={{ margin: '0 0 12px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={16} color="var(--color-primary)" /> RFM Cohort Distribution
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(report.rfm_counts || {}).map(([seg, count]) => (
                  <div key={seg} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{seg}</span>
                    <span className="badge badge-primary">{count} accounts</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card print-card">
              <h4 style={{ margin: '0 0 12px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={16} color="#8B5CF6" /> Behavioral Personas
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {report.personas?.map((p, idx) => (
                  <div key={idx} style={{ padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 13 }}>
                      <span>{p.name}</span>
                      <span style={{ color: 'var(--color-primary)' }}>{formatINR(p.avg_spend)} avg</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>{p.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Product Association Bundles */}
          {report.association_rules && report.association_rules.length > 0 && (
            <div className="card print-card" style={{ marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShoppingBag size={16} color="#10B981" /> High-Affinity Product Bundles
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left', color: 'var(--color-text-muted)' }}>
                      <th style={{ padding: '8px 10px' }}>Primary Product</th>
                      <th style={{ padding: '8px 10px' }}>Frequently Added With</th>
                      <th style={{ padding: '8px 10px' }}>Confidence</th>
                      <th style={{ padding: '8px 10px' }}>Lift Multiplier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.association_rules.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border-2)' }}>
                        <td style={{ padding: '10px', fontWeight: 600 }}>{r.antecedent}</td>
                        <td style={{ padding: '10px', color: 'var(--color-primary)', fontWeight: 600 }}>{r.consequent}</td>
                        <td style={{ padding: '10px' }}>{Math.round(r.confidence * 100)}%</td>
                        <td style={{ padding: '10px' }}>
                          <span className="badge badge-primary">{r.lift}x Lift</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Strategic Priorities */}
          {report.recommendations && report.recommendations.length > 0 && (
            <div className="card print-card" style={{ marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 14px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={16} color="var(--color-primary)" /> Prioritized Strategic Roadmap
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {report.recommendations.map((rec, i) => (
                  <div key={i} style={{ padding: 14, background: 'var(--color-surface-2)', borderRadius: 8, borderLeft: '3px solid var(--color-primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{rec.title}</span>
                      <span className="badge" style={{ fontSize: 11, background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-primary)' }}>
                        {rec.category} • {rec.impact} Impact
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--color-text-2)', margin: '0 0 6px', lineHeight: 1.5 }}>
                      {rec.rationale}
                    </p>
                    <div style={{ fontSize: 12, color: 'var(--color-text-3)', fontWeight: 500 }}>
                      <strong>Action:</strong> {rec.suggested_action}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document Footer */}
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-text-muted)', padding: '16px 0 32px' }}>
            CONFIDENTIAL • Prepared by NexMine AI Data Intelligence Platform • All metrics verified from recorded transactional history
          </div>
        </div>
      )}
    </div>
  )
}
