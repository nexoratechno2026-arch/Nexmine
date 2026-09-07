import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  MessageSquare, Sparkles, Send, Bot, User as UserIcon,
  RefreshCw, ExternalLink, ShieldCheck, ArrowRight
} from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../../api/client'

export default function AskNexMine() {
  const [datasetId, setDatasetId] = useState(localStorage.getItem('active_dataset_id') || '')
  const [inputQuery, setInputQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestedQuestions, setSuggestedQuestions] = useState([
    'Which products are most frequently bought together?',
    'How many customers are at risk of leaving?',
    'What is our total revenue and sales trend?',
    'What are our best-selling categories?'
  ])
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: (
        "Hello! I am your **Store Assistant**. "
        + "Ask me any question in plain English about your sales, top products, customer loyalty, or bundles. "
        + "All my answers are calculated directly from your uploaded store records."
      ),
      evidence: ['Grounded in your real store dataset', 'Values formatted in Indian Rupees (₹)'],
      suggested_follow_ups: [
        'Which products are most frequently bought together?',
        'How many customers are at risk of leaving?'
      ]
    }
  ])

  const chatEndRef = useRef(null)

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
      fetchSuggestedQuestions()
    }
  }, [datasetId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function fetchSuggestedQuestions() {
    try {
      const res = await client.get(`/assistant/${datasetId}/suggested-questions`)
      if (res.data?.questions?.length > 0) {
        setSuggestedQuestions(res.data.questions)
      }
    } catch {
      // Keep defaults on failure
    }
  }

  async function handleSend(queryToSend) {
    const text = (queryToSend || inputQuery).trim()
    if (!text || loading) return

    if (!datasetId) {
      toast.error('Please upload your store dataset first.')
      return
    }

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text
    }

    setMessages(prev => [...prev, userMsg])
    setInputQuery('')
    setLoading(true)

    try {
      const res = await client.post(`/assistant/${datasetId}/ask`, {
        query: text
      })

      const assistantMsg = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.data.answer,
        evidence: res.data.evidence || [],
        related_module: res.data.related_module,
        suggested_follow_ups: res.data.suggested_follow_ups || []
      }

      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      const errDetail = err.response?.data?.detail || 'Failed to process question. Make sure your data is analyzed.'
      toast.error(errDetail)
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `I ran into an issue finding that answer: ${errDetail}. Please try rephrasing your question or check your dataset.`,
          evidence: []
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function resetChat() {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: "Conversation restarted. What would you like to know about your store's sales and customers?",
        evidence: []
      }
    ])
  }

  function renderFormattedContent(content) {
    if (typeof content !== 'string') return content

    const lines = content.split('\n')
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return <h4 key={idx} style={{ margin: '8px 0 4px', fontSize: 14, fontWeight: 700 }}>{line.replace('### ', '')}</h4>
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <div key={idx} style={{ display: 'flex', gap: 8, margin: '3px 0', fontSize: 13.5, lineHeight: 1.5 }}>
            <span style={{ color: 'var(--color-primary-light)', fontWeight: 'bold' }}>•</span>
            <div>{renderBoldText(line.substring(2))}</div>
          </div>
        )
      }
      if (!line.trim()) {
        return <div key={idx} style={{ height: 6 }} />
      }
      return (
        <p key={idx} style={{ margin: '0 0 6px', fontSize: 13.5, lineHeight: 1.55, color: 'var(--color-text-2)' }}>
          {renderBoldText(line)}
        </p>
      )
    })
  }

  function renderBoldText(text) {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ color: 'var(--color-text)', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} style={{ background: 'var(--color-surface-3)', padding: '2px 5px', borderRadius: 4, fontSize: 12, color: 'var(--color-primary-light)' }}>{part.slice(1, -1)}</code>
      }
      return part
    })
  }

  if (!datasetId) {
    return (
      <div className="card empty-state" style={{ minHeight: 360 }}>
        <div className="empty-state-icon"><MessageSquare size={28} /></div>
        <h3>No Store Data Loaded</h3>
        <p style={{ maxWidth: 420 }}>
          Upload your sales records first to ask questions in plain English and get verified answers.
        </p>
        <Link to="/app/upload" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
          Upload Store Data <ArrowRight size={14} />
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-fade-up" style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0 }}>Ask Nex Mine</h1>
            <span className="badge badge-primary" style={{ fontSize: 11 }}>
              <Sparkles size={12} /> Instant Answers
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--color-text-3)' }}>
            Ask anything in plain English. Answers are calculated directly from your sales numbers.
          </p>
        </div>

        <button
          onClick={resetChat}
          className="btn btn-secondary btn-sm"
          style={{ gap: 6 }}
          title="Clear chat and start fresh"
        >
          <RefreshCw size={13} /> Clear Chat
        </button>
      </div>

      {/* Suggested Starter Chips */}
      {messages.length <= 2 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.05em' }}>
            Suggested Questions
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {suggestedQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSend(q)}
                disabled={loading}
                className="btn btn-secondary btn-sm"
                style={{
                  borderRadius: 20,
                  fontSize: 12,
                  padding: '5px 12px',
                  textAlign: 'left'
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages Container */}
      <div
        className="card"
        style={{
          minHeight: 380,
          maxHeight: 520,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: '18px 16px',
          marginBottom: 14,
          background: 'var(--color-surface)',
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              flexDirection: m.role === 'user' ? 'row-reverse' : 'row'
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: m.role === 'user' ? 'var(--color-primary)' : 'var(--color-surface-3)',
                color: m.role === 'user' ? '#fff' : 'var(--color-primary-light)',
              }}
            >
              {m.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
            </div>

            {/* Bubble */}
            <div
              style={{
                maxWidth: 'min(88%, 680px)',
                background: m.role === 'user' ? 'var(--color-primary)' : 'var(--color-surface-2)',
                color: m.role === 'user' ? '#ffffff' : 'var(--color-text)',
                padding: '12px 16px',
                borderRadius: m.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                border: m.role === 'user' ? 'none' : '1px solid var(--color-border)',
                wordBreak: 'break-word',
              }}
            >
              {m.role === 'user' ? (
                <div style={{ fontSize: 13.5, lineHeight: 1.5, fontWeight: 500 }}>{m.content}</div>
              ) : (
                <div>
                  {renderFormattedContent(m.content)}

                  {/* Evidence Citations */}
                  {m.evidence && m.evidence.length > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {m.evidence.map((ev, ei) => (
                          <span
                            key={ei}
                            className="badge badge-accent"
                            style={{ fontSize: 10.5 }}
                          >
                            <ShieldCheck size={11} /> {ev}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Deep link to Module */}
                  {m.related_module && (
                    <div style={{ marginTop: 10 }}>
                      <Link
                        to={m.related_module.url}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 11.5, gap: 5 }}
                      >
                        View in {m.related_module.title} <ExternalLink size={11} />
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-surface-3)',
                color: 'var(--color-primary-light)',
              }}
            >
              <Bot size={16} />
            </div>
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '14px 14px 14px 2px',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: 'var(--color-text-3)',
                fontSize: 13
              }}
            >
              <span className="spinner" style={{ width: 13, height: 13 }} />
              <span>Checking store records...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Box */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your sales... (e.g. 'What products sell best together?')"
          disabled={loading}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 13.5,
            color: 'var(--color-text)',
            padding: '6px 4px'
          }}
        />

        <button
          onClick={() => handleSend()}
          disabled={!inputQuery.trim() || loading}
          className="btn btn-primary btn-sm"
          style={{ gap: 5, padding: '7px 14px' }}
        >
          <Send size={14} />
          <span>Ask</span>
        </button>
      </div>
    </div>
  )
}
