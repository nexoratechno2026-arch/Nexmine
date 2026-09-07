import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, ArrowRight, TrendingUp, TrendingDown, AlertCircle, PackagePlus, PackageMinus, HelpCircle, BarChart2 } from 'lucide-react'
import client from '../../api/client'
import { formatINR } from '../../utils/currency'

export default function ProductIntel() {
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
        <h3 style={{ marginTop: 12 }}>Finding Product Affinities...</h3>
        <p>Scanning order baskets to discover which products sell together.</p>
      </div>
    )
  }

  if (!datasetId) {
    return (
      <div className="card empty-state" style={{ minHeight: 360 }}>
        <div className="empty-state-icon"><ShoppingBag size={28} /></div>
        <h3>No Product Data Loaded</h3>
        <p style={{ maxWidth: 420 }}>
          Upload your sales records to discover which products customers frequently purchase together so you can create profitable bundle promotions.
        </p>
        <Link to="/app/upload" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
          Upload Store Data <ArrowRight size={14} />
        </Link>
      </div>
    )
  }

  const { association_rules, product_performance } = data || {}
  const hasRules = association_rules && association_rules.length > 0
  const hasPerf = product_performance && (product_performance.top_by_qty?.length > 0)
  
  if (!hasRules && !hasPerf) {
    return (
      <div className="card empty-state" style={{ minHeight: 360 }}>
        <div className="empty-state-icon" style={{ color: 'var(--color-warning)' }}><AlertCircle size={28} /></div>
        <h3>No Product Data Extracted</h3>
        <p style={{ maxWidth: 460 }}>
          Make sure your uploaded spreadsheet includes both <strong>Transaction ID</strong> and <strong>Product Name</strong> columns mapped. You can run the analysis now or review your column mapping.
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

  return (
    <div className="animate-fade-up">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Product Intelligence</h1>
          <p style={{ marginTop: 4 }}>Discover which items are frequently bought in the same basket so you can create winning bundles.</p>
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

      {hasPerf && (
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <BarChart2 size={20} color="var(--color-primary-light)" />
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Product Performance</h2>
          </div>
          <div className="grid-2">
            {/* Top Performers */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <TrendingUp size={18} color="var(--color-accent)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Best Sellers</h3>
              </div>
              <div style={{ padding: 12 }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: 'var(--color-text-3)', fontSize: 11, textTransform: 'uppercase' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 600 }}>Product</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Qty Sold</th>
                      {product_performance.top_by_revenue && <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Revenue</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {product_performance.top_by_qty.slice(0, 5).map((p, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--color-border-2)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 500, fontSize: 13.5 }}>{p.product}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--color-accent)' }}>{p.quantity}</td>
                        {p.revenue !== undefined && p.revenue > 0 && <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--color-text-2)' }}>{formatINR(p.revenue)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Slow Movers */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <TrendingDown size={18} color="var(--color-danger)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Slow Movers</h3>
              </div>
              <div style={{ padding: 12 }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: 'var(--color-text-3)', fontSize: 11, textTransform: 'uppercase' }}>
                      <th style={{ padding: '8px 12px', fontWeight: 600 }}>Product</th>
                      <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Qty Sold</th>
                      {product_performance.bottom_by_revenue && <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Revenue</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {product_performance.bottom_by_qty.slice(0, 5).map((p, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--color-border-2)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 500, fontSize: 13.5 }}>{p.product}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--color-danger)' }}>{p.quantity}</td>
                        {p.revenue !== undefined && p.revenue > 0 && <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--color-text-2)' }}>{formatINR(p.revenue)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {hasRules && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <PackagePlus size={20} color="var(--color-primary-light)" />
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Frequently Bought Together</h2>
          </div>



      {/* Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-6)' }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShoppingBag size={18} color="var(--color-primary-light)" />
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Top Product Combinations</h3>
          </div>
          <span className="badge badge-accent">
            {association_rules.length} Strong Pairings
          </span>
        </div>
        
        {/* Responsive Table Wrapper */}
        <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 540 }}>
            <thead>
              <tr style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-3)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '12px 18px', fontWeight: 600 }}>If customer buys...</th>
                <th style={{ padding: '12px 6px', fontWeight: 600, width: 24 }}></th>
                <th style={{ padding: '12px 18px', fontWeight: 600 }}>They also frequently buy...</th>
                <th style={{ padding: '12px 18px', fontWeight: 600, textAlign: 'right' }}>Likelihood</th>
                <th style={{ padding: '12px 18px', fontWeight: 600, textAlign: 'right' }}>Affinity Strength</th>
              </tr>
            </thead>
            <tbody>
              {association_rules.map((rule, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-2)' }}>
                  <td style={{ padding: '14px 18px', fontWeight: 500, color: 'var(--color-text)' }}>
                    <span className="badge badge-muted" style={{ fontSize: 12 }}>{rule.antecedent}</span>
                  </td>
                  <td style={{ padding: '14px 0', color: 'var(--color-text-muted)' }}>
                    <ArrowRight size={14} />
                  </td>
                  <td style={{ padding: '14px 18px', fontWeight: 500, color: 'var(--color-text)' }}>
                    <span className="badge badge-primary" style={{ fontSize: 12 }}>{rule.consequent}</span>
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right', color: 'var(--color-text)' }}>
                    <strong>{Math.round(rule.confidence * 100)}%</strong> of the time
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <span className="badge badge-accent" style={{ fontSize: 11 }}>
                      <TrendingUp size={11} /> {rule.lift}x more likely
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Simple Explanation Footer */}
        <div style={{
          padding: '14px 18px',
          background: 'var(--color-surface-2)',
          fontSize: 12.5,
          color: 'var(--color-text-3)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}>
          <div><strong>Likelihood (Confidence):</strong> The probability that a customer adds the second item when purchasing the first.</div>
          <div><strong>Affinity Strength (Lift):</strong> How much higher this combination is compared to pure chance (anything over 1.5x is a high-value bundle).</div>
        </div>
        </div>
        </div>
      )}
    </div>
  )
}
