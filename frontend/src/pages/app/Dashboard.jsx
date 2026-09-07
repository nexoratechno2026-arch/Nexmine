import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  Upload, BarChart3, Users, Package, Sparkles,
  Brain, TrendingUp, ArrowRight, CheckCircle2,
  FileText, MessageSquare, ArrowUpRight
} from 'lucide-react'
import client from '../../api/client'
import { formatINR } from '../../utils/currency'

export default function Dashboard() {
  const { user } = useAuth()
  const [datasetId, setDatasetId] = useState(localStorage.getItem('active_dataset_id') || '')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

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
      fetchDashboardData()
    } else {
      setData(null)
    }
  }, [datasetId])

  async function fetchDashboardData() {
    try {
      setLoading(true)
      const res = await client.get(`/reports/${datasetId}/summary`)
      setData(res.data)
    } catch {
      // If error, ignore
    } finally {
      setLoading(false)
    }
  }

  const totalOrders = data?.dataset_meta?.total_transactions || 0
  const totalCustomers = data?.kpis?.total_customers || 0
  const avgVisits = totalCustomers > 0 ? (totalOrders / totalCustomers).toFixed(1) : null

  const kpis = [
    {
      label: 'Total Revenue',
      value: data?.kpis?.total_revenue ? formatINR(data.kpis.total_revenue) : '—',
      icon: BarChart3,
      color: '#4f46e5',
      sub: data ? `Across ${data.dataset_meta?.recorded_days || 0} active sales days` : 'Upload data to see revenue'
    },
    {
      label: 'Total Orders',
      value: totalOrders ? totalOrders.toLocaleString() : '—',
      icon: TrendingUp,
      color: '#0284c7',
      sub: data ? `${totalOrders} total bills across ${totalCustomers} customers` : 'Upload data to see orders'
    },
    {
      label: 'Total Customers',
      value: totalCustomers ? totalCustomers.toLocaleString() : '—',
      icon: Users,
      color: '#10b981',
      sub: avgVisits ? `Customers return ~${avgVisits} times on average` : 'Individual shoppers in records'
    },
    {
      label: 'Avg Daily Sales',
      value: data?.kpis?.avg_daily_revenue ? formatINR(data.kpis.avg_daily_revenue) : '—',
      icon: Package,
      color: '#f59e0b',
      sub: data ? 'Average revenue per active day' : 'Upload data to see daily volume'
    },
  ]

  const modules = [
    {
      icon: Users,
      title: 'Customers & Loyalty',
      desc: 'Understand who your top shoppers are, who is at risk of leaving, and how to win them back.',
      to: '/app/customers',
      badge: data ? `${data.personas?.length || 0} Groups Found` : 'Ready to Analyze',
      color: '#4f46e5'
    },
    {
      icon: Package,
      title: 'Product Bundles',
      desc: 'Discover which items are frequently bought together so you can create profitable deals.',
      to: '/app/products',
      badge: data ? `${data.association_rules?.length || 0} Pairs Found` : 'Ready to Analyze',
      color: '#10b981'
    },
    {
      icon: Sparkles,
      title: 'Sales Trends & Spikes',
      desc: 'Track daily revenue changes, detect unusual spikes or sudden drops automatically.',
      to: '/app/patterns',
      badge: data ? `${data.anomalies?.length || 0} Spikes Flagged` : 'Ready to Analyze',
      color: '#0284c7'
    },
    {
      icon: Brain,
      title: 'Executive Insights',
      desc: 'Clear, plain-language summaries of what is working well and what needs attention.',
      to: '/app/insights',
      badge: 'Action Plan',
      color: '#ec4899'
    },
    {
      icon: TrendingUp,
      title: 'Business Simulator',
      desc: 'Test what happens to your revenue if you raise prices, launch discounts, or retain shoppers.',
      to: '/app/whatif',
      badge: 'Interactive Tool',
      color: '#8b5cf6'
    },
    {
      icon: MessageSquare,
      title: 'Store Assistant',
      desc: 'Ask questions in plain English about your sales and get answers verified with real numbers.',
      to: '/app/ask',
      badge: 'Ask Questions',
      color: '#3b82f6'
    },
    {
      icon: FileText,
      title: 'Audit & Reports',
      desc: 'One-click executive PDF report to print or share, plus CSV customer download lists.',
      to: '/app/reports',
      badge: 'Print & Export',
      color: '#14b8a6'
    },
  ]

  return (
    <div className="animate-fade-up">
      {/* Page Header */}
      <div className="page-header">
        <h1>Welcome back, {user?.full_name?.split(' ')[0] || 'there'} 👋</h1>
        <p>Here is a clear summary of your store's performance and opportunities.</p>
      </div>

      {/* Dataset Status Banner */}
      {data ? (
        <div
          className="card"
          style={{
            marginBottom: 'var(--space-6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            background: 'var(--color-surface-2)',
            borderLeft: '4px solid var(--color-accent)',
          }}
        >
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-md)',
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1rem', margin: 0 }}>Active Store Data: {data.dataset_meta?.filename}</h3>
                <span className="badge badge-accent" style={{ fontSize: 11 }}>
                  Data Analyzed
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--color-text-3)', margin: '3px 0 0' }}>
                Based on {data.dataset_meta?.total_transactions?.toLocaleString()} total purchases across {data.kpis?.total_customers?.toLocaleString()} unique customers.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to="/app/insights" className="btn btn-secondary btn-sm" style={{ gap: 6 }}>
              <Brain size={14} /> View Insights
            </Link>
            <Link to="/app/reports" className="btn btn-primary btn-sm" style={{ gap: 6 }}>
              <FileText size={14} /> View Report
            </Link>
          </div>
        </div>
      ) : (
        <div
          className="card"
          style={{
            marginBottom: 'var(--space-6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 18,
            flexWrap: 'wrap',
            background: 'var(--color-surface-2)',
            borderLeft: '4px solid var(--color-primary)',
          }}
        >
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-md)',
                background: 'rgba(79, 70, 229, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary-light)',
                flexShrink: 0,
              }}
            >
              <Upload size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', margin: '0 0 4px' }}>No sales data loaded yet</h3>
              <p style={{ fontSize: 13, color: 'var(--color-text-3)', margin: 0 }}>
                Upload a simple sales spreadsheet (CSV or Excel) to see customer segments, product bundles, and insights.
              </p>
            </div>
          </div>
          <Link to="/app/upload" className="btn btn-primary btn-sm" id="dashboard-upload-cta">
            Upload Store Data
            <ArrowRight size={15} />
          </Link>
        </div>
      )}

      {/* KPI Cards Strip */}
      <div className="grid-4" style={{ marginBottom: 'var(--space-6)' }}>
        {kpis.map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="kpi-card card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div>
                <div className="kpi-label">{label}</div>
                <div className="kpi-value" style={{ marginTop: 6 }}>
                  {value}
                </div>
              </div>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: `${color}18`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color,
                  flexShrink: 0,
                }}
              >
                <Icon size={18} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 8 }}>
              {sub}
            </div>
          </div>
        ))}
      </div>

      {/* Store Modules Grid */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Store Intelligence Tools</h2>
            <p style={{ fontSize: 13, color: 'var(--color-text-3)', margin: '2px 0 0' }}>Explore findings organized by customer, product, and sales trends.</p>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          {modules.map(({ icon: Icon, title, desc, to, badge, color }) => (
            <Link key={title} to={to} style={{ textDecoration: 'none', display: 'flex' }}>
              <div
                className="card card-interactive"
                style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '18px 20px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: `${color}18`,
                        color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <span className="badge" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-3)', fontSize: 11 }}>
                      {badge}
                    </span>
                  </div>

                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text)', marginBottom: 5 }}>
                    {title}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--color-text-3)', lineHeight: 1.5, margin: 0 }}>
                    {desc}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color, fontSize: 12.5, fontWeight: 600, marginTop: 14 }}>
                  <span>Open Tool</span>
                  <ArrowUpRight size={14} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
