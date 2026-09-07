import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, Sliders, IndianRupee, ArrowRight, Layers, Tag, UserCheck, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../../api/client'
import { formatINR } from '../../utils/currency'

export default function WhatIf() {
  const [datasetId, setDatasetId] = useState(localStorage.getItem('active_dataset_id') || '')
  const [loading, setLoading] = useState(false)
  const [scenarioType, setScenarioType] = useState('price_change')

  // Scenario parameters
  const [priceChangePct, setPriceChangePct] = useState(5)
  const [elasticity, setElasticity] = useState(-1.2)
  const [discountPct, setDiscountPct] = useState(10)
  const [volumeBoostPct, setVolumeBoostPct] = useState(18)
  const [churnRecoveryPct, setChurnRecoveryPct] = useState(25)
  const [bundleDiscountPct, setBundleDiscountPct] = useState(8)
  const [bundleUptakePct, setBundleUptakePct] = useState(15)

  // Simulation result
  const [result, setResult] = useState(null)

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
      runSimulation()
    }
  }, [scenarioType, datasetId])

  async function runSimulation() {
    if (!datasetId) return
    try {
      setLoading(true)
      const payload = {
        type: scenarioType,
        price_change_pct: Number(priceChangePct),
        elasticity: Number(elasticity),
        discount_pct: Number(discountPct),
        volume_boost_pct: Number(volumeBoostPct),
        churn_recovery_pct: Number(churnRecoveryPct),
        bundle_discount_pct: Number(bundleDiscountPct),
        bundle_uptake_pct: Number(bundleUptakePct),
      }

      const res = await client.post(`/whatif/${datasetId}/simulate`, payload)
      setResult(res.data)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to run scenario simulation. Ensure data mining was run first.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const scenarios = [
    { id: 'price_change', name: 'Price Adjustment', icon: IndianRupee, desc: 'Test price hikes or reductions' },
    { id: 'discount_campaign', name: 'Discount Promotion', icon: Tag, desc: 'Model discount vs extra sales' },
    { id: 'customer_retention', name: 'Reactivate Shoppers', icon: UserCheck, desc: 'Win back inactive customers' },
    { id: 'bundle_offer', name: 'Product Bundles', icon: Layers, desc: 'Cross-sell complementary pairs' },
  ]

  if (!datasetId) {
    return (
      <div className="card empty-state" style={{ minHeight: 360 }}>
        <div className="empty-state-icon"><TrendingUp size={28} /></div>
        <h3>No Store Data Loaded</h3>
        <p style={{ maxWidth: 420 }}>
          Upload your sales records to test what happens if you change prices, run discounts, or win back churned shoppers.
        </p>
        <Link to="/app/upload" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
          Upload Store Data <ArrowRight size={14} />
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>What-If Analysis</h1>
          <p>Test commercial pricing, promotions, and customer win-back decisions before risking real money.</p>
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={runSimulation}
          disabled={loading || !datasetId}
        >
          {loading ? 'Simulating...' : 'Recalculate'}
        </button>
      </div>

      {/* Scenario Selector Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
          gap: 12,
          marginBottom: 'var(--space-6)'
        }}
      >
        {scenarios.map(s => {
          const Icon = s.icon
          const active = scenarioType === s.id
          return (
            <div
              key={s.id}
              onClick={() => setScenarioType(s.id)}
              className="card card-interactive"
              style={{
                padding: '14px 16px',
                border: active ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: active ? 'var(--color-surface-2)' : 'var(--color-surface)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: active ? 'var(--color-primary)' : 'var(--color-surface-3)',
                  color: active ? '#fff' : 'var(--color-text-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Icon size={16} />
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, color: active ? 'var(--color-text)' : 'var(--color-text-2)' }}>
                  {s.name}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{s.desc}</div>
            </div>
          )
        })}
      </div>

      {/* Main Grid: Responsive 1 col on mobile, 2 col on tablet/desktop */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
          gap: 'var(--space-5)',
        }}
      >
        {/* Controls Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
            <Sliders size={17} color="var(--color-primary-light)" />
            Simulation Controls
          </h3>

          {/* Price Change Controls */}
          {scenarioType === 'price_change' && (
            <>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                  <span>Price Change:</span>
                  <span style={{ color: 'var(--color-primary-light)' }}>{priceChangePct > 0 ? `+${priceChangePct}` : priceChangePct}%</span>
                </div>
                <input
                  type="range" min="-25" max="25" step="1"
                  value={priceChangePct}
                  onChange={e => setPriceChangePct(e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  <span>-25% (Discount)</span>
                  <span>+25% (Price Hike)</span>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                  <span>Customer Sensitivity (Elasticity):</span>
                  <span style={{ color: 'var(--color-accent)' }}>{elasticity}</span>
                </div>
                <input
                  type="range" min="-2.5" max="-0.4" step="0.1"
                  value={elasticity}
                  onChange={e => setElasticity(e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--color-accent)' }}
                />
                <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 8, lineHeight: 1.45 }}>
                  A value of -1.2 is standard for retail. Higher negative numbers mean customers drop off faster when prices rise.
                </p>
              </div>
            </>
          )}

          {/* Discount Campaign Controls */}
          {scenarioType === 'discount_campaign' && (
            <>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                  <span>Discount Percentage:</span>
                  <span style={{ color: 'var(--color-primary-light)' }}>{discountPct}% OFF</span>
                </div>
                <input
                  type="range" min="5" max="35" step="1"
                  value={discountPct}
                  onChange={e => setDiscountPct(e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                  <span>Expected Extra Volume:</span>
                  <span style={{ color: '#10b981' }}>+{volumeBoostPct}%</span>
                </div>
                <input
                  type="range" min="5" max="60" step="1"
                  value={volumeBoostPct}
                  onChange={e => setVolumeBoostPct(e.target.value)}
                  style={{ width: '100%', accentColor: '#10b981' }}
                />
              </div>
            </>
          )}

          {/* Customer Retention Controls */}
          {scenarioType === 'customer_retention' && (
            <>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                  <span>Target Customer Win-Back Rate:</span>
                  <span style={{ color: '#10b981' }}>{churnRecoveryPct}%</span>
                </div>
                <input
                  type="range" min="5" max="50" step="5"
                  value={churnRecoveryPct}
                  onChange={e => setChurnRecoveryPct(e.target.value)}
                  style={{ width: '100%', accentColor: '#10b981' }}
                />
                <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 8, lineHeight: 1.45 }}>
                  Simulates how much revenue you gain if a reactivation campaign wins back {churnRecoveryPct}% of inactive shoppers.
                </p>
              </div>
            </>
          )}

          {/* Bundle Offer Controls */}
          {scenarioType === 'bundle_offer' && (
            <>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                  <span>Bundle Incentive Discount:</span>
                  <span style={{ color: 'var(--color-primary-light)' }}>{bundleDiscountPct}%</span>
                </div>
                <input
                  type="range" min="3" max="25" step="1"
                  value={bundleDiscountPct}
                  onChange={e => setBundleDiscountPct(e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                  <span>Shoppers Who Accept the Bundle:</span>
                  <span style={{ color: '#10b981' }}>{bundleUptakePct}%</span>
                </div>
                <input
                  type="range" min="5" max="40" step="5"
                  value={bundleUptakePct}
                  onChange={e => setBundleUptakePct(e.target.value)}
                  style={{ width: '100%', accentColor: '#10b981' }}
                />
              </div>
            </>
          )}
        </div>

        {/* Results Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, color: 'var(--color-text)' }}>
              Projected Commercial Outcome
            </h3>

            {result ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Revenue Outcome Stat */}
                <div style={{
                  padding: 18,
                  background: 'var(--color-surface-2)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: `4px solid ${result.revenue_delta >= 0 ? '#10b981' : '#ef4444'}`
                }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Net Revenue Impact
                  </div>
                  <div style={{
                    fontSize: 24,
                    fontWeight: 700,
                    fontFamily: 'var(--font-heading)',
                    color: result.revenue_delta >= 0 ? '#10b981' : '#ef4444',
                    marginTop: 4
                  }}>
                    {result.revenue_delta >= 0 ? `+${formatINR(result.revenue_delta)}` : `-${formatINR(Math.abs(result.revenue_delta))}`}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginTop: 4 }}>
                    {result.revenue_delta >= 0 ? 'Projected revenue gain' : 'Projected revenue contraction'}
                  </div>
                </div>

                {/* Summary narrative */}
                <div style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.55 }}>
                  {result.summary || 'Based on your parameters and historical order patterns, this scenario indicates positive revenue growth.'}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--color-text-muted)' }}>
                Adjust the sliders on the left to simulate revenue changes.
              </div>
            )}
          </div>

          <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--color-border)', fontSize: 12, color: 'var(--color-text-muted)' }}>
            Empirical statistical projection based on your store's recorded order history.
          </div>
        </div>
      </div>
    </div>
  )
}
