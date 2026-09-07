import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Users, Target, Zap, TrendingUp, AlertCircle, ShoppingCart, ArrowRight, Award, ShieldAlert, HeartHandshake } from 'lucide-react'
import client from '../../api/client'

function StatCard({ title, value, subtitle, icon: Icon, color }) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: `${color}18`, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0
      }}>
        <Icon size={22} />
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase' }}>
          {title}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
          {value}
        </div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  )
}

export default function CustomerIntel() {
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
        <h3 style={{ marginTop: 12 }}>Analyzing Customer Patterns...</h3>
        <p>Grouping customers by purchase frequency, spending habits, and loyalty.</p>
      </div>
    )
  }

  if (!datasetId) {
    return (
      <div className="card empty-state" style={{ minHeight: 360 }}>
        <div className="empty-state-icon"><Users size={28} /></div>
        <h3>No Customer Data Loaded</h3>
        <p style={{ maxWidth: 420 }}>
          Upload your sales dataset to automatically uncover your most valuable customers, frequent buyers, and churn risks.
        </p>
        <Link to="/app/upload" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
          Upload Store Data <ArrowRight size={14} />
        </Link>
      </div>
    )
  }

  const { rfm_segments, customer_clusters } = data || {}
  
  if (!rfm_segments && !customer_clusters) {
    return (
      <div className="card empty-state" style={{ minHeight: 360 }}>
        <div className="empty-state-icon" style={{ color: 'var(--color-warning)' }}><AlertCircle size={28} /></div>
        <h3>No Customer Segments Yet</h3>
        <p style={{ maxWidth: 440 }}>
          Make sure your uploaded dataset has Customer ID, Date, and Revenue columns mapped. You can run the analysis now or review your column mapping.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => fetchMiningResults(true)} className="btn btn-primary btn-sm">
            <Zap size={14} /> Run Analysis Now
          </button>
          <Link to="/app/upload" className="btn btn-secondary btn-sm">
            Check Column Mapping <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    )
  }

  // Calculate RFM Summaries
  const segmentCounts = rfm_segments?.reduce((acc, curr) => {
    acc[curr.Segment] = (acc[curr.Segment] || 0) + 1
    return acc
  }, {}) || {}
  
  const totalRfm = rfm_segments?.length || 0
  const champions = segmentCounts['Champions'] || 0
  const atRisk = (segmentCounts['At Risk'] || 0) + (segmentCounts['Lost'] || 0)
  const loyal = segmentCounts['Loyal Customers'] || 0

  return (
    <div className="animate-fade-up">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Customer Intelligence</h1>
          <p style={{ marginTop: 4 }}>Understand who your best customers are, who is slipping away, and how to increase repeat sales.</p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => fetchMiningResults(true)}
          disabled={loading}
          style={{ gap: 6 }}
        >
          <Zap size={14} /> Re-analyze
        </button>
      </div>

      {/* Guide Banner */}
      <div className="guide-banner" style={{ marginBottom: 'var(--space-6)' }}>
        <HeartHandshake size={20} color="var(--color-primary-light)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong>Why customer groups matter:</strong> Not all customers are the same. By knowing who your top spenders are (Champions) versus who hasn't shopped recently (At Risk), you can send targeted offers that bring them back without wasting discount coupons.
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid-3" style={{ marginBottom: 'var(--space-6)' }}>
        <StatCard
          title="Total Customers"
          value={totalRfm.toLocaleString()}
          subtitle="Individual shoppers in your records"
          icon={Users}
          color="#4f46e5"
        />
        <StatCard
          title="Loyal Regulars"
          value={(champions + loyal).toLocaleString()}
          subtitle={`${Math.round(((champions + loyal) / (totalRfm || 1)) * 100)}% of shoppers visit & spend most`}
          icon={Award}
          color="#10b981"
        />
        <StatCard
          title="Customers Slipping Away"
          value={atRisk.toLocaleString()}
          subtitle="Haven't bought recently — reach out to win them back"
          icon={ShieldAlert}
          color="#ef4444"
        />
      </div>

      {/* Main Content Grid: Responsive 1 col on mobile, 2 col on large screens */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))',
          gap: 'var(--space-5)',
        }}
      >
        {/* Customer Groups (K-Means Clusters) */}
        {customer_clusters?.clusters && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Target size={18} color="var(--color-primary-light)" /> 
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Customer Behavioral Profiles</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {customer_clusters.clusters.map((c, i) => (
                <div
                  key={i}
                  style={{
                    padding: 16,
                    background: 'var(--color-surface-2)',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: '4px solid var(--color-primary)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 14 }}>{c.name}</div>
                    <span className="badge badge-primary">{c.size?.toLocaleString()} shoppers</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--color-text-2)', marginBottom: 10, lineHeight: 1.5 }}>
                    {c.description}
                  </p>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, flexWrap: 'wrap', color: 'var(--color-text-3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <ShoppingCart size={13} /> {c.avg_purchases} orders on avg
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loyalty Breakdown Table */}
        {rfm_segments && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Zap size={18} color="#10b981" /> 
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Loyalty & Retention Action Plan</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                {
                  segment: 'Champions',
                  count: champions,
                  color: '#10b981',
                  action: 'Reward them: Exclusive VIP access, early product previews, or a thank-you perk.',
                },
                {
                  segment: 'Loyal Customers',
                  count: loyal,
                  color: '#4f46e5',
                  action: 'Upsell & Cross-sell: Recommend complementary product bundles to raise basket value.',
                },
                {
                  segment: 'At Risk / Inactive',
                  count: atRisk,
                  color: '#ef4444',
                  action: 'Win-back campaign: Send a limited-time reactivation discount to re-engage them.',
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 14,
                    background: 'var(--color-surface-2)',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: `4px solid ${item.color}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--color-text)' }}>
                      {item.segment}
                    </span>
                    <span className="badge" style={{ background: 'var(--color-surface-3)', color: item.color }}>
                      {item.count.toLocaleString()} shoppers
                    </span>
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--color-text-3)', margin: 0, lineHeight: 1.45 }}>
                    <strong style={{ color: 'var(--color-text-2)' }}>Recommendation:</strong> {item.action}
                  </p>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 16 }}>
              <Link to="/app/reports" className="btn btn-outline btn-sm" style={{ width: '100%' }}>
                Export At-Risk Shopper List (CSV) <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
