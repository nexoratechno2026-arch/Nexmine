import { Link } from 'react-router-dom'
import {
  BarChart3, Users, Lightbulb, ShieldAlert, TrendingUp,
  Sparkles, Upload, Search, Zap, ArrowRight, CheckCircle2,
  Brain, Package, MessageSquare
} from 'lucide-react'

const features = [
  {
    icon: Users,
    title: 'Customer Loyalty & Retention',
    desc: 'Automatically identify your VIP Champions, steady loyalists, and shoppers at risk of leaving so you can run targeted win-back campaigns.',
    color: 'var(--color-primary-light)',
  },
  {
    icon: Package,
    title: 'Product Bundles & Cross-Selling',
    desc: 'Discover which items customers frequently buy together in the same basket. Create high-margin product bundles that raise average order value.',
    color: 'var(--color-accent)',
  },
  {
    icon: TrendingUp,
    title: 'Sales Trends & Spikes',
    desc: 'Track daily sales performance, detect seasonal trends, and automatically catch unexpected revenue peaks or sudden dips.',
    color: '#F59E0B',
  },
  {
    icon: Brain,
    title: 'Plain-English Store Insights',
    desc: 'No confusing statistics or complicated formulas. Get clear, plain-language executive summaries with actionable steps you can take today.',
    color: '#38BDF8',
  },
  {
    icon: Sparkles,
    title: 'Business Simulator',
    desc: 'Simulate price changes, promotional discounts, and customer reactivation campaigns before risking real money in the market.',
    color: '#A855F7',
  },
  {
    icon: MessageSquare,
    title: 'Interactive Store Assistant',
    desc: 'Ask questions in plain English about your sales, products, and customer behavior, and receive answers verified by your store data.',
    color: '#EC4899',
  },
]

const steps = [
  { icon: Upload,  n: '01', title: 'Upload Store Data',     desc: 'Drag & drop a CSV or Excel spreadsheet of your orders. Columns are detected automatically.' },
  { icon: Search,  n: '02', title: 'Automatic Analysis',   desc: 'Customer segments, product pairings, and sales trends are computed directly from your numbers.' },
  { icon: Zap,     n: '03', title: 'Clear Executive Plan', desc: 'Review prioritized actions ranked by revenue impact and urgency in plain everyday language.' },
  { icon: Lightbulb, n: '04', title: 'Grow Your Business',  desc: 'Launch product bundles, win back inactive shoppers, test what-if scenarios, and download reports.' },
]

const guarantees = [
  'Grounded 100% in your actual store data',
  'No fabricated or hallucinated numbers',
  'Clear explanations for every insight',
  'Automatic data quality & health check',
  'Zero data science knowledge required',
]

export default function Landing() {
  return (
    <div data-theme="dark" style={{ overflowX: 'hidden', background: 'var(--color-bg)', color: 'var(--color-text)', minHeight: '100vh' }}>
      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--color-bg-transparent)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <div className="container" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 62,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: '#fff'
            }}>⬡</div>
            <span style={{ color: 'var(--color-text)' }}>Nex Mine</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/login" className="btn btn-ghost btn-sm" id="nav-login-btn">Sign In</Link>
            <Link to="/signup" className="btn btn-primary btn-sm" id="nav-signup-btn">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section style={{ position: 'relative', padding: 'clamp(54px, 8vw, 90px) 0 48px', overflow: 'hidden' }}>
        <div className="container" style={{ position: 'relative', textAlign: 'center' }}>
          {/* Pill badge */}
          <div className="animate-fade-up" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            <span className="badge badge-primary" style={{ fontSize: 12.5, padding: '5px 14px' }}>
              <Sparkles size={13} />
              Intelligent Commerce Analytics
            </span>
          </div>

          <h1 className="animate-fade-up" style={{ animationDelay: '0.1s', marginBottom: 20, maxWidth: 820, margin: '0 auto 20px' }}>
            Turn Your Sales Data Into{' '}
            <span className="text-gradient">Profitable Store Decisions</span>
          </h1>

          <p className="animate-fade-up" style={{
            animationDelay: '0.2s', fontSize: 17, color: 'var(--color-text-2)',
            maxWidth: 620, margin: '0 auto 36px', lineHeight: 1.6,
          }}>
            Nex Mine analyzes your store's sales records and explains what they mean in plain English. Discover high-value product bundles, win back inactive shoppers, and grow revenue — no data science background required.
          </p>

          <div className="animate-fade-up" style={{ animationDelay: '0.3s', display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/signup" className="btn btn-primary btn-lg" id="hero-cta-primary">
              Get Started Free
              <ArrowRight size={16} />
            </Link>
            <a href="#how-it-works" className="btn btn-outline btn-lg" id="hero-cta-secondary">
              See How It Works
            </a>
          </div>

          {/* Guarantee pills */}
          <div style={{ marginTop: 48, display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {guarantees.map((g, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, color: 'var(--color-text-2)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-full)',
                padding: '5px 12px',
              }}>
                <CheckCircle2 size={13} color="var(--color-accent)" />
                {g}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────── */}
      <section className="section" id="how-it-works" style={{ background: 'var(--color-bg-2)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span className="badge badge-accent" style={{ marginBottom: 16 }}>How It Works</span>
            <h2>From CSV to Clarity in 4 Steps</h2>
            <p style={{ marginTop: 16, maxWidth: 500, margin: '16px auto 0', color: 'var(--color-text-3)' }}>
              Data Mining discovers. AI explains. Nex Mine recommends.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 'var(--space-6)',
          }}>
            {steps.map((step, i) => (
              <div key={i} className="card" style={{ position: 'relative', textAlign: 'center', padding: '40px 28px' }}>
                {/* Step number */}
                <div style={{
                  position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--grad-primary)',
                  borderRadius: 'var(--radius-full)',
                  padding: '4px 14px',
                  fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.1em',
                }}>
                  {step.n}
                </div>

                <div style={{
                  width: 56, height: 56, margin: '16px auto 20px',
                  background: 'var(--color-surface-2)',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--color-primary)',
                }}>
                  <step.icon size={26} />
                </div>

                <h3 style={{ marginBottom: 12, fontSize: '1.1rem' }}>{step.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--color-text-3)', lineHeight: 1.65 }}>{step.desc}</p>

                {i < steps.length - 1 && (
                  <div style={{
                    position: 'absolute', right: -13, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--color-text-muted)', fontSize: 20, display: 'none',
                  }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature Highlights ───────────────────────────────── */}
      <section className="section" id="features">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <span className="badge badge-primary" style={{ marginBottom: 16 }}>Mining Capabilities</span>
            <h2>Six Algorithms. Unlimited Insights.</h2>
            <p style={{ marginTop: 16, maxWidth: 540, margin: '16px auto 0', color: 'var(--color-text-3)' }}>
              Every analysis runs real data-mining algorithms — not heuristics, not rule-of-thumb estimates.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 'var(--space-5)',
          }}>
            {features.map((f, i) => (
              <div key={i} className="card" style={{
                display: 'flex', flexDirection: 'column', gap: 14,
                transition: 'all 0.25s',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = f.color + '40'
                  e.currentTarget.style.boxShadow = `0 8px 32px ${f.glow}`
                  e.currentTarget.style.transform = 'translateY(-4px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = ''
                  e.currentTarget.style.boxShadow = ''
                  e.currentTarget.style.transform = ''
                }}
              >
                <div style={{
                  width: 48, height: 48,
                  background: f.glow,
                  borderRadius: 'var(--radius-md)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: f.color,
                  border: `1px solid ${f.color}30`,
                }}>
                  <f.icon size={22} />
                </div>
                <div>
                  <h4 style={{ marginBottom: 8, fontSize: '1rem' }}>{f.title}</h4>
                  <p style={{ fontSize: 14, color: 'var(--color-text-3)', lineHeight: 1.65 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Transparent AI promise ───────────────────────────── */}
      <section className="section" style={{ background: 'var(--color-bg-2)' }}>
        <div className="container">
          <div style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(16,185,129,0.05) 100%)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-2xl)',
            padding: 'clamp(32px, 5vw, 64px) clamp(24px, 4vw, 48px)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
            gap: 'clamp(32px, 5vw, 64px)',
            alignItems: 'center',
          }}>
            <div>
              <span className="badge badge-accent" style={{ marginBottom: 20 }}>The Hard Rule</span>
              <h2 style={{ marginBottom: 20 }}>AI That <span className="text-gradient">Never Lies</span></h2>
              <p style={{ color: 'var(--color-text-2)', lineHeight: 1.8, marginBottom: 32 }}>
                Every insight Nex Mine shows you is computed from your actual data. The AI layer explains and prioritizes — it never invents facts. If a required column is missing, that analysis is disabled with a plain-language explanation of why.
              </p>
              <Link to="/signup" className="btn btn-primary" id="honest-ai-cta">
                Try It With Your Data
                <ArrowRight size={16} />
              </Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Evidence-backed', desc: 'Every recommendation cites support, confidence, lift, or trend %' },
                { label: 'Hedged language', desc: '"Associated with" — never "causes" unless the method supports causation' },
                { label: 'Graceful failures', desc: 'Missing Customer ID? RFM is disabled — and we tell you exactly why' },
                { label: 'No raw data to LLM', desc: 'Only structured JSON summaries — your row-level data stays local' },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                  background: 'var(--color-surface)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 18px',
                  border: '1px solid var(--color-border-2)',
                }}>
                  <CheckCircle2 size={18} color="var(--color-accent)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-3)' }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────────── */}
      <section className="section">
        <div className="container" style={{ textAlign: 'center' }}>
          <div style={{
            position: 'relative',
            background: 'var(--grad-primary)',
            borderRadius: 'var(--radius-2xl)',
            padding: '80px 48px',
            overflow: 'hidden',
          }}>
            <div className="orb" style={{ position: 'absolute', borderRadius: '50%', filter: 'blur(40px)', width: 400, height: 400, background: 'rgba(255,255,255,0.06)', top: -150, right: -100, animationDelay: '1s' }} />
            <div className="orb" style={{ position: 'absolute', borderRadius: '50%', filter: 'blur(40px)', width: 300, height: 300, background: 'rgba(255,255,255,0.04)', bottom: -120, left: -80, animationDelay: '4s' }} />

            <BarChart3 size={48} color="rgba(255,255,255,0.4)" style={{ margin: '0 auto 24px' }} />
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', color: '#fff', marginBottom: 20 }}>
              Ready to See What's Hidden in Your Data?
            </h2>
            <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.75)', marginBottom: 40, maxWidth: 480, margin: '0 auto 40px' }}>
              Upload your sales CSV and get your first data-mining report in minutes.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/signup" className="btn btn-lg" id="cta-banner-signup" style={{ background: '#fff', color: 'var(--color-primary)', fontWeight: 700 }}>
                Get Started — It's Free
                <ArrowRight size={18} />
              </Link>
              <Link to="/login" className="btn btn-outline btn-lg" id="cta-banner-login" style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}>
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--color-border-2)',
        padding: 'var(--space-8) 0',
        background: 'var(--color-bg-2)',
      }}>
        <div className="container" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
            <span style={{ fontSize: 18 }}>⬡</span>
            <span className="text-gradient">Nex Mine</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
            AI-Powered Data Mining for Smarter Business Decisions
          </p>
        </div>
      </footer>
    </div>
  )
}
