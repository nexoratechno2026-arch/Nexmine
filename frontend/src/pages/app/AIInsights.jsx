import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Brain, Sparkles, RefreshCw, ArrowRight, ShieldAlert, Target, Lightbulb,
  ShoppingBag, Users, AlertTriangle, TrendingUp, TrendingDown,
  Copy, Check, MessageSquare, HelpCircle, ChevronDown, ChevronUp, Zap, Gift
} from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../../api/client'

// Translates technical / academic labels into everyday shopkeeper language
function getFriendlyMetricLabel(label) {
  if (/churn/i.test(label)) return 'Customers Slipping Away'
  if (/anomal/i.test(label)) return 'Unusual Sales Days'
  if (/analyzed/i.test(label)) return 'Total Customers'
  if (/total revenue/i.test(label)) return 'Total Store Sales'
  return label
}

function getMetricHelpText(label) {
  if (/churn|slipping/i.test(label)) {
    return 'Customers who purchased before but haven’t visited in a while. Contact them before they switch to another store!'
  }
  if (/anomal|unusual/i.test(label)) {
    return 'Days where sales spiked exceptionally high (surges) or dropped far below average (slow days).'
  }
  if (/customer/i.test(label)) {
    return 'The total number of individual shoppers recognized across your sales history.'
  }
  if (/revenue|sales/i.test(label)) {
    return 'The grand total of all sales recorded in your uploaded transactions.'
  }
  return 'Grounded directly in your store data.'
}

export default function AIInsights() {
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [datasetId, setDatasetId] = useState(localStorage.getItem('active_dataset_id') || '')
  const [data, setData] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [showGuide, setShowGuide] = useState(false)

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
      loadInsights(false)
    } else {
      client.get('/datasets/me').then(res => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          const firstId = res.data[0].id
          localStorage.setItem('active_dataset_id', firstId)
          setDatasetId(firstId)
          window.dispatchEvent(new Event('active_dataset_changed'))
        }
      }).catch(() => {})
    }
  }, [datasetId])

  async function loadInsights(forceRefresh = false) {
    if (!datasetId) return
    try {
      if (forceRefresh) setRefreshing(true)
      else setLoading(true)

      const res = await client.get(`/insights/${datasetId}${forceRefresh ? '?refresh=true' : ''}`)
      setData(res.data)
      if (forceRefresh) {
        toast.success('Store insights refreshed with latest data!')
      }
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to load Store Insights.'
      toast.error(msg)
      setData(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  function handleCopyMessage(text, id) {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    toast.success('WhatsApp/SMS message copied! Ready to send.')
    setTimeout(() => setCopiedId(null), 3000)
  }

  if (loading) {
    return (
      <div className="empty-state" style={{ minHeight: 340 }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
        <h3 style={{ marginTop: 14 }}>Analyzing Your Store Data...</h3>
        <p style={{ maxWidth: 460 }}>
          Finding top-selling combos, identifying loyal regulars, and spotting shoppers who need a friendly reminder.
        </p>
      </div>
    )
  }

  if (!datasetId) {
    return (
      <div className="card empty-state" style={{ minHeight: 360 }}>
        <div className="empty-state-icon"><Brain size={28} /></div>
        <h3>No Sales Data Selected</h3>
        <p style={{ maxWidth: 420 }}>
          Please upload your sales records to generate automated advice and recommendations.
        </p>
        <Link to="/app/upload" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
          Upload Sales Data <ArrowRight size={14} />
        </Link>
      </div>
    )
  }

  const execSummary = data?.executive_summary
  const recommendations = data?.recommendations || []
  const allWarnings = data?.early_warnings || data?.risks || []
  const keyMetrics = execSummary?.key_metrics || []

  // Ensure narrative is safely extracted as array of strings
  let narrativeParagraphs = []
  if (Array.isArray(execSummary?.narrative)) {
    narrativeParagraphs = execSummary.narrative.filter(p => typeof p === 'string')
  } else if (typeof execSummary?.narrative === 'string') {
    narrativeParagraphs = [execSummary.narrative]
  }

  // Separate warnings into Standout Days (Surges) and Things to Check (Dips & Risks)
  const surges = allWarnings.filter(w => {
    const title = (w.title || '').toLowerCase()
    const detail = (w.detail || '').toLowerCase()
    return w.type === 'surge' || title.includes('surge') || title.includes('spike') || detail.includes('higher than')
  })

  const risksAndDips = allWarnings.filter(w => !surges.includes(w))

  return (
    <div className="animate-fade-up" style={{ paddingBottom: 40 }}>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: '1.6rem' }}>AI Insights</h1>
            <span className="badge badge-primary" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={12} /> {data?.engine || 'Smart Store Advisor'}
            </span>
          </div>
          <p style={{ marginTop: 4, color: 'var(--color-text-2)', fontSize: 14 }}>
            Practical, plain-English recommendations and alerts grounded in your sales records.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setShowGuide(!showGuide)}
            style={{ gap: 6, fontSize: 12.5 }}
          >
            <HelpCircle size={14} />
            {showGuide ? 'Hide Beginner Guide' : 'Store Owner Guide'}
            {showGuide ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => loadInsights(true)}
            disabled={refreshing || !datasetId}
            style={{ gap: 6 }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Analyzing...' : 'Refresh Insights'}
          </button>
        </div>
      </div>

      {/* Expandable Beginner Store Owner Guide */}
      {showGuide && (
        <div
          className="card animate-fade-up"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-primary-light)',
            marginBottom: 20,
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Sparkles size={16} color="var(--color-primary)" />
            <strong style={{ fontSize: 14 }}>30-Second Guide for Store Owners</strong>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, fontSize: 12.5, color: 'var(--color-text-2)' }}>
            <div>
              <strong style={{ color: 'var(--color-text)' }}>👑 Regulars / VIPs:</strong>
              <p style={{ margin: '4px 0 0', lineHeight: 1.5 }}>Your most loyal customers. They visit most frequently and spend the most cash. Keep them feeling appreciated.</p>
            </div>
            <div>
              <strong style={{ color: 'var(--color-text)' }}>🏃 Slipping Away:</strong>
              <p style={{ margin: '4px 0 0', lineHeight: 1.5 }}>Shoppers who used to buy regularly but haven't visited lately. Send them a WhatsApp message with a small discount to bring them back.</p>
            </div>
            <div>
              <strong style={{ color: 'var(--color-text)' }}>🛒 Popular Combos:</strong>
              <p style={{ margin: '4px 0 0', lineHeight: 1.5 }}>Products often bought together (like Tea & Sugar). Place them side-by-side or offer a tiny combo discount to increase basket size.</p>
            </div>
            <div>
              <strong style={{ color: 'var(--color-text)' }}>📈 Surges vs Dips:</strong>
              <p style={{ margin: '4px 0 0', lineHeight: 1.5 }}>Surges are blockbuster sales days (celebrate!). Dips are unusually slow days (check if items were out of stock or store was closed).</p>
            </div>
          </div>
        </div>
      )}

      {!data ? (
        <div className="card empty-state" style={{ minHeight: 340 }}>
          <Brain size={36} color="var(--color-primary-light)" style={{ opacity: 0.8 }} />
          <h3>No Insights Generated Yet</h3>
          <p style={{ maxWidth: 460 }}>
            Click below to generate clear store recommendations from your data.
          </p>
          <button onClick={() => loadInsights(true)} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
            <Sparkles size={14} /> Generate Insights
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* 1. Key Metrics Strip (Plain English & Retail-Friendly) */}
          {keyMetrics.length > 0 && (
            <div className="grid-4" style={{ gap: 14 }}>
              {keyMetrics.map((km, i) => {
                const friendlyLabel = getFriendlyMetricLabel(km.label)
                const helpTip = getMetricHelpText(km.label)
                const isRisk = /slipping|churn/i.test(km.label)
                const isAnomaly = /unusual|anomal/i.test(km.label)

                let icon = <ShoppingBag size={18} color="var(--color-primary)" />
                if (/customer/i.test(km.label)) icon = <Users size={18} color="#3b82f6" />
                if (isRisk) icon = <AlertTriangle size={18} color="#f59e0b" />
                if (isAnomaly) icon = <TrendingUp size={18} color="#10b981" />

                return (
                  <div
                    key={i}
                    className="card kpi-card"
                    style={{
                      padding: '16px 18px',
                      background: 'var(--color-surface)',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-2)' }}>
                        {icon}
                        {friendlyLabel}
                      </div>
                      <span title={helpTip} style={{ cursor: 'help', color: 'var(--color-text-muted)' }}>
                        <HelpCircle size={13} />
                      </span>
                    </div>

                    <div className="kpi-value" style={{ fontSize: '1.5rem', fontWeight: 700, margin: '4px 0 2px' }}>
                      {km.value}
                    </div>

                    <div style={{ fontSize: 11.5, color: 'var(--color-text-3)', lineHeight: 1.4 }}>
                      {km.subtitle || helpTip}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 2. Executive Summary / Store Health Card */}
          <div
            className="card"
            style={{
              background: 'var(--color-surface)',
              borderLeft: `4px solid ${execSummary?.status_color || 'var(--color-primary)'}`,
              padding: '20px 24px',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lightbulb size={20} color="var(--color-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                  {execSummary?.headline || 'Store Performance Overview'}
                </h3>
              </div>
              {execSummary?.status && (
                <span
                  className="badge"
                  style={{
                    background: `${execSummary.status_color || '#10b981'}15`,
                    color: execSummary.status_color || '#10b981',
                    borderColor: `${execSummary.status_color || '#10b981'}40`,
                    fontWeight: 600,
                    padding: '4px 10px',
                    fontSize: 12
                  }}
                >
                  Status: {execSummary.status}
                </span>
              )}
            </div>

            {narrativeParagraphs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {narrativeParagraphs.map((p, idx) => (
                  <p key={idx} style={{ fontSize: 13.5, color: 'var(--color-text-2)', lineHeight: 1.65, margin: 0 }}>
                    {p}
                  </p>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13.5, color: 'var(--color-text-2)', lineHeight: 1.65, margin: 0 }}>
                Sales analysis complete. See the practical steps below to increase repeat visits and average bill size.
              </p>
            )}
          </div>

          {/* 3. Actionable Store Recommendations */}
          {recommendations.length > 0 && (
            <div className="card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Target size={19} color="#10b981" />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                    Action Steps to Grow Your Store
                  </h3>
                </div>
                <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                  Prioritized by revenue impact
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {recommendations.map((rec, i) => {
                  const title = typeof rec === 'string' ? rec : (rec.title || `Action ${i + 1}`)
                  const rationale = typeof rec === 'object' ? (rec.rationale || rec.description || rec.text || '') : ''
                  const action = typeof rec === 'object' ? rec.suggested_action : null
                  const impact = typeof rec === 'object' ? rec.impact : 'High'
                  const smsTemplate = typeof rec === 'object' ? rec.sms_template : null
                  const ctaLink = typeof rec === 'object' ? rec.cta_link : null
                  const ctaText = typeof rec === 'object' ? rec.cta_text : null

                  const isAtRisk = title.toLowerCase().includes('win back') || title.toLowerCase().includes('at-risk') || title.toLowerCase().includes('inactive')
                  const isCombo = title.toLowerCase().includes('place') || title.toLowerCase().includes('combo') || title.toLowerCase().includes('bundle')
                  const isVIP = title.toLowerCase().includes('vip') || title.toLowerCase().includes('big spenders')

                  // Fallback ready-to-use SMS template if none provided
                  let messageToCopy = smsTemplate
                  if (!messageToCopy && isAtRisk) {
                    messageToCopy = 'Hi! We noticed it has been a while since your last visit to our store. We’d love to welcome you back with a special 10% discount on your next purchase: WELCOME10!'
                  } else if (!messageToCopy && isVIP) {
                    messageToCopy = 'Hello! Thank you for being one of our best customers. Our newest stock just arrived today—feel free to message us if you would like us to reserve any items for you!'
                  }

                  // Fallback CTA destination if none provided
                  let targetLink = ctaLink
                  let targetText = ctaText
                  if (!targetLink) {
                    if (isAtRisk || isVIP) {
                      targetLink = '/app/customers'
                      targetText = isAtRisk ? 'View Inactive Customers' : 'View Top Customers'
                    } else if (isCombo) {
                      targetLink = '/app/products'
                      targetText = 'View Product Combos'
                    }
                  }

                  return (
                    <div
                      key={i}
                      style={{
                        padding: '18px 20px',
                        background: 'var(--color-surface-2)',
                        borderRadius: 'var(--radius-md)',
                        borderLeft: '4px solid #10b981',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                      }}
                    >
                      {/* Title & Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ fontWeight: 650, fontSize: 14.5, color: 'var(--color-text)' }}>
                          {title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {impact && (
                            <span className="badge badge-accent" style={{ fontSize: 10.5, padding: '3px 8px' }}>
                              {impact} Impact
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Plain English Reason */}
                      {rationale && (
                        <p style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.55, margin: '0 0 10px' }}>
                          <strong style={{ color: 'var(--color-text)' }}>Why this matters: </strong>
                          {rationale}
                        </p>
                      )}

                      {/* Action to Take */}
                      {action && (
                        <div style={{
                          fontSize: 13,
                          color: 'var(--color-text)',
                          background: 'var(--color-surface)',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          marginBottom: messageToCopy || targetLink ? 12 : 0
                        }}>
                          <strong style={{ color: 'var(--color-primary)' }}>💡 Recommended Action: </strong>
                          {action}
                        </div>
                      )}

                      {/* Ready-to-use SMS / WhatsApp Box (Shopkeeper superpower) */}
                      {messageToCopy && (
                        <div style={{
                          background: 'rgba(16, 185, 129, 0.05)',
                          border: '1px dashed rgba(16, 185, 129, 0.4)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 14px',
                          marginBottom: targetLink ? 12 : 0
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#059669', display: 'flex', alignItems: 'center', gap: 5 }}>
                              <MessageSquare size={13} />
                              Ready-to-Send WhatsApp / SMS Message:
                            </span>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => handleCopyMessage(messageToCopy, `rec-${i}`)}
                              style={{
                                padding: '3px 9px',
                                fontSize: 11,
                                height: 26,
                                background: copiedId === `rec-${i}` ? '#10b981' : 'var(--color-surface)',
                                color: copiedId === `rec-${i}` ? '#fff' : 'var(--color-text)',
                                border: '1px solid var(--color-border)',
                                gap: 4
                              }}
                            >
                              {copiedId === `rec-${i}` ? (
                                <>
                                  <Check size={12} /> Copied!
                                </>
                              ) : (
                                <>
                                  <Copy size={12} /> Copy Message
                                </>
                              )}
                            </button>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--color-text-2)', fontStyle: 'italic', lineHeight: 1.45 }}>
                            "{messageToCopy}"
                          </div>
                        </div>
                      )}

                      {/* Action Link Button */}
                      {targetLink && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                          <Link
                            to={targetLink}
                            className="btn btn-outline btn-sm"
                            style={{ fontSize: 12, gap: 5, padding: '4px 10px', height: 28 }}
                          >
                            {targetText || 'Take Action'} <ArrowRight size={12} />
                          </Link>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 4. Standout Sales Surges (Celebration & Learning) */}
          {surges.length > 0 && (
            <div className="card" style={{ padding: '20px 24px', borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <TrendingUp size={19} color="#10b981" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  🚀 Standout Sales Days (Surges & Records)
                </h3>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--color-text-3)', margin: '-8px 0 12px' }}>
                These days brought in significantly higher sales than usual. Check what was in high demand!
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {surges.map((surge, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '12px 16px',
                      background: 'rgba(16, 185, 129, 0.06)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(16, 185, 129, 0.2)'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: '#059669', marginBottom: 2 }}>
                      {surge.title || `Sales Surge on ${surge.date}`}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-text-2)', lineHeight: 1.45 }}>
                      {surge.detail || surge.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Things to Keep an Eye On (Dips & Inactivity Alerts) */}
          {risksAndDips.length > 0 && (
            <div className="card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <AlertTriangle size={19} color="var(--color-warning)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  ⚠️ Things to Keep an Eye On
                </h3>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--color-text-3)', margin: '-8px 0 12px' }}>
                Unusually slow sales days or customers who haven't visited in a while.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {risksAndDips.map((item, i) => {
                  const title = typeof item === 'string' ? item : (item.title || 'Attention Needed')
                  const detail = typeof item === 'object' ? (item.detail || item.description || item.reason || '') : ''
                  const isCritical = typeof item === 'object' && (item.level === 'critical' || item.severity === 'critical')

                  return (
                    <div
                      key={i}
                      style={{
                        padding: '12px 16px',
                        background: 'var(--color-surface-2)',
                        borderRadius: 'var(--radius-sm)',
                        borderLeft: `4px solid ${isCritical ? 'var(--color-danger)' : 'var(--color-warning)'}`
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13.5, color: isCritical ? 'var(--color-danger)' : 'var(--color-warning)', marginBottom: 2 }}>
                        {title}
                      </div>
                      {detail && (
                        <p style={{ fontSize: 12.5, color: 'var(--color-text-2)', lineHeight: 1.45, margin: 0 }}>
                          {detail}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
