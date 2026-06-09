import React, { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'

// ─── Types ────────────────────────────────────────────────────────────────────

type View = 'landing' | 'manage' | 'contact' | 'protocols'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Account & Billing',
  'Course Access',
  'Community',
  'Frameworks',
  'Other',
]

const STRIPE_PORTAL = 'https://billing.stripe.com/p/login/14A9AT0q42PQ7sk8j78Zq00'

// ─── Shared styles ────────────────────────────────────────────────────────────

const NAVY       = '#1B4D8E'
const GOLD       = '#D4AF37'
const MAGENTA    = '#C2185B'
const WARM_WHITE = '#FAFAF8'

const pageWrap: React.CSSProperties = {
  minHeight: '100%',
  background: WARM_WHITE,
  fontFamily: 'Montserrat, sans-serif',
}

const navyHeader: React.CSSProperties = {
  background: NAVY,
  padding: '16px 20px 28px',
}

const backBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: 'rgba(255,255,255,0.12)',
  border: 'none',
  borderRadius: 20,
  padding: '5px 14px',
  color: 'rgba(255,255,255,0.75)',
  fontFamily: 'Montserrat, sans-serif',
  fontSize: 12,
  cursor: 'pointer',
  marginBottom: 14,
}

const pageContent: React.CSSProperties = {
  padding: '24px 20px',
  maxWidth: 680,
  margin: '0 auto',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SupportHub() {
  const { profile, session, profileDisplayName } = useAuth()

  const [view,          setView]          = useState<View>('landing')
  const [category,      setCategory]      = useState<string | null>(null)
  const [question,      setQuestion]      = useState('')
  const [file,          setFile]          = useState<File | null>(null)
  const [submitting,    setSubmitting]    = useState(false)
  const [submitted,     setSubmitted]     = useState(false)
  const [submitError,   setSubmitError]   = useState('')
  const [pwSent,        setPwSent]        = useState(false)
  const [pwError,       setPwError]       = useState('')

  const fileRef = useRef<HTMLInputElement>(null)

  const email      = session?.user?.email || ''
  const memberName = profileDisplayName
    || (profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : '')
    || email

  const stripeUrl = `${STRIPE_PORTAL}${email ? `?prefilled_email=${encodeURIComponent(email)}` : ''}`

  // ─── Password reset ──────────────────────────────────────────────────────

  const handlePasswordReset = async () => {
    if (!email) return
    setPwError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/profile`,
    })
    if (error) setPwError(error.message)
    else setPwSent(true)
  }

  // ─── Form submit ─────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!category || !question.trim()) return
    setSubmitting(true)
    setSubmitError('')

    try {
      let fileUrl: string | null = null

      // Attempt file upload — gracefully skip if bucket not configured
      if (file && session?.user?.id) {
        const ext  = file.name.split('.').pop()
        const path = `${session.user.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('support-files')
          .upload(path, file)
        if (!upErr) {
          const { data } = supabase.storage.from('support-files').getPublicUrl(path)
          fileUrl = data.publicUrl
        }
      }

      const { error } = await supabase
        .from('support_requests')
        .insert({
          member_id:    session?.user?.id,
          member_name:  memberName,
          member_email: email,
          member_tier:  profile?.tier || 'navigator',
          category,
          question:     question.trim(),
          file_url:     fileUrl,
        })

      if (error) throw error
      setSubmitted(true)

    } catch {
      setSubmitError(
        'Something went wrong. Please try again or email us directly at support@support.druaiconsulting.com.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const resetContact = () => {
    setSubmitted(false)
    setCategory(null)
    setQuestion('')
    setFile(null)
    setSubmitError('')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LANDING
  // ─────────────────────────────────────────────────────────────────────────

  if (view === 'landing') {
    const cards = [
      {
        id:    'manage' as View,
        icon:  '💳',
        label: 'Account',
        title: 'Manage Your Account',
        sub:   'Billing, password & account settings',
        ring:  `rgba(212,175,55,0.18)`,
        rbdr:  `rgba(212,175,55,0.3)`,
      },
      {
        id:    'contact' as View,
        icon:  '🎧',
        label: 'Support',
        title: 'Contact Our Team',
        sub:   'Submit a request — we reply within one business day',
        ring:  `rgba(194,24,91,0.15)`,
        rbdr:  `rgba(194,24,91,0.35)`,
      },
      {
        id:    'protocols' as View,
        icon:  '👥',
        label: 'Community',
        title: 'Community Protocols',
        sub:   'Standards, guidelines & expectations',
        ring:  `rgba(212,175,55,0.12)`,
        rbdr:  `rgba(212,175,55,0.25)`,
      },
    ]

    return (
      <div style={pageWrap}>
        {/* Header */}
        <div style={{ background: NAVY, padding: '28px 20px 36px' }}>
          <div style={{
            fontFamily:    'Cinzel, serif',
            fontSize:      11,
            color:         GOLD,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom:  10,
          }}>
            Support Hub
          </div>
          <h1 style={{
            fontFamily: 'Playfair Display, serif',
            fontSize:   28,
            fontWeight: 700,
            color:      '#fff',
            margin:     0,
            lineHeight: 1.2,
          }}>
            How can we help you?
          </h1>
          <p style={{
            fontFamily: 'Montserrat, sans-serif',
            fontSize:   13,
            color:      'rgba(255,255,255,0.6)',
            margin:     '8px 0 0',
          }}>
            Select a topic below to get started.
          </p>
        </div>

        {/* Cards */}
        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 680, margin: '0 auto' }}>
          {cards.map((card) => (
            <div
              key={card.id}
              onClick={() => setView(card.id)}
              style={{
                borderRadius: 14,
                overflow:     'hidden',
                border:       '0.5px solid rgba(0,0,0,0.08)',
                cursor:       'pointer',
                transition:   'opacity 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.92')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              {/* Banner */}
              <div style={{
                background:     NAVY,
                padding:        '32px 20px 28px',
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                justifyContent: 'center',
                minHeight:      160,
              }}>
                {/* Icon ring */}
                <div style={{
                  width:          88,
                  height:         88,
                  borderRadius:   '50%',
                  background:     card.ring,
                  border:         `1.5px solid ${card.rbdr}`,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  marginBottom:   16,
                  fontSize:       44,
                }}>
                  {card.icon}
                </div>
                <div style={{
                  fontFamily:    'Montserrat, sans-serif',
                  fontSize:      10,
                  color:         'rgba(255,255,255,0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  marginBottom:  6,
                }}>
                  {card.label}
                </div>
                <div style={{
                  fontFamily:  'Playfair Display, serif',
                  fontSize:    18,
                  fontWeight:  700,
                  color:       '#fff',
                  textAlign:   'center',
                }}>
                  {card.title}
                </div>
              </div>

              {/* Footer bar */}
              <div style={{
                background:     '#fff',
                padding:        '12px 20px',
                display:        'flex',
                justifyContent: 'space-between',
                alignItems:     'center',
              }}>
                <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: '#888' }}>
                  {card.sub}
                </span>
                <span style={{ color: '#bbb', fontSize: 18, lineHeight: 1 }}>›</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MANAGE ACCOUNT
  // ─────────────────────────────────────────────────────────────────────────

  if (view === 'manage') {
    const faqs = [
      {
        q: 'Why am I seeing a charge from DRU AI Consulting?',
        a: "That's your Navigator or Accelerator membership at work. It covers your access to the community, courses, frameworks, monthly resources, and AI insights.",
      },
      {
        q: 'Did I agree to this charge?',
        a: "Yes. When you signed up, you reviewed and acknowledged the subscription terms on the checkout page. We also sent a welcome email right after your purchase with all the details. Can't find it? Check your spam or promotions folder.",
      },
      {
        q: 'Can I cancel my subscription?',
        a: 'Anytime. Click Manage Your Billing above and the cancel option will be right there waiting for you.',
      },
      {
        q: 'How do I update my payment method?',
        a: 'Use the Manage Your Billing button above. Your current card is shown at the top with an option to swap in a new one.',
      },
      {
        q: "My payment didn't go through. What now?",
        a: "These things happen — almost always because of an expired card or a billing address mismatch. Use Manage Your Billing to update your payment info and our system will retry the charge automatically.",
      },
    ]

    return (
      <div style={pageWrap}>
        <div style={navyHeader}>
          <button onClick={() => setView('landing')} style={backBtn}>
            ← Support Hub
          </button>
          <div style={{
            fontFamily:    'Montserrat, sans-serif',
            fontSize:      10,
            color:         'rgba(255,255,255,0.5)',
            textTransform: 'uppercase',
            letterSpacing: '1.2px',
            marginBottom:  6,
          }}>
            Support Hub
          </div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>
            Manage Your Account
          </h1>
          <p style={{ fontFamily: 'Montserrat, sans-serif', fontStyle: 'italic', fontSize: 13, color: GOLD, margin: 0 }}>
            Your Account, Your Control
          </p>
        </div>

        <div style={pageContent}>
          <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 14, color: '#555', lineHeight: 1.65, marginBottom: 24 }}>
            Whether you need to update your payment method, view billing history, or change your password — you can handle it all from here.
          </p>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
            <a
              href={stripeUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display:        'block',
                background:     NAVY,
                color:          '#fff',
                border:         'none',
                borderRadius:   32,
                padding:        '14px 24px',
                fontFamily:     'Montserrat, sans-serif',
                fontSize:       14,
                fontWeight:     600,
                cursor:         'pointer',
                textAlign:      'center',
                textDecoration: 'none',
              }}
            >
              Manage Your Billing
            </a>

            {pwSent ? (
              <div style={{
                background:   'rgba(27,77,142,0.06)',
                border:       `1px solid rgba(27,77,142,0.2)`,
                borderRadius: 10,
                padding:      '12px 16px',
                fontFamily:   'Montserrat, sans-serif',
                fontSize:     13,
                color:        NAVY,
                textAlign:    'center',
              }}>
                ✓ Password reset link sent to {email}
              </div>
            ) : (
              <button
                onClick={handlePasswordReset}
                style={{
                  background:   'transparent',
                  color:        NAVY,
                  border:       `1.5px solid ${NAVY}`,
                  borderRadius: 32,
                  padding:      '14px 24px',
                  fontFamily:   'Montserrat, sans-serif',
                  fontSize:     14,
                  fontWeight:   600,
                  cursor:       'pointer',
                  textAlign:    'center',
                }}
              >
                Change Your Password
              </button>
            )}

            {pwError && (
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: MAGENTA, margin: 0 }}>
                {pwError}
              </p>
            )}
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', marginBottom: 24 }} />

          <h2 style={{
            fontFamily:   'Playfair Display, serif',
            fontSize:     18,
            fontWeight:   700,
            color:        NAVY,
            margin:       '0 0 4px',
          }}>
            Common billing questions
          </h2>

          {faqs.map(({ q, a }, i) => (
            <div key={i} style={{ borderTop: '1px solid rgba(0,0,0,0.07)', padding: '16px 0' }}>
              <p style={{
                fontFamily:     'Montserrat, sans-serif',
                fontWeight:     600,
                fontSize:       13,
                color:          NAVY,
                margin:         '0 0 6px',
                textDecoration: 'underline',
              }}>
                {q}
              </p>
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: '#555', margin: 0, lineHeight: 1.65 }}>
                {a}
              </p>
            </div>
          ))}

          {/* Escalation */}
          <div style={{
            marginTop:    24,
            background:   `rgba(27,77,142,0.05)`,
            border:       `1px solid rgba(27,77,142,0.12)`,
            borderRadius: 12,
            padding:      '16px 20px',
          }}>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: 13, color: NAVY, margin: '0 0 4px' }}>
              Need something else?
            </p>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, color: '#666', margin: '0 0 10px', lineHeight: 1.5 }}>
              For anything not covered here, our team will get back to you within one business day.
            </p>
            <button
              onClick={() => setView('contact')}
              style={{
                background:     'none',
                border:         'none',
                color:          MAGENTA,
                fontFamily:     'Montserrat, sans-serif',
                fontSize:       13,
                fontWeight:     600,
                cursor:         'pointer',
                padding:        0,
                textDecoration: 'underline',
              }}
            >
              Contact Our Team →
            </button>
          </div>

          <div style={{ height: 32 }} />
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONTACT OUR TEAM
  // ─────────────────────────────────────────────────────────────────────────

  if (view === 'contact') {
    // ── Success state ──────────────────────────────────────────────────────
    if (submitted) {
      return (
        <div style={pageWrap}>
          <div style={navyHeader}>
            <button onClick={() => { setView('landing'); resetContact() }} style={backBtn}>
              ← Support Hub
            </button>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 700, color: '#fff', margin: 0 }}>
              Contact Our Team
            </h1>
          </div>
          <div style={{ ...pageContent, textAlign: 'center', paddingTop: 60 }}>
            <div style={{
              width:          64,
              height:         64,
              borderRadius:   '50%',
              background:     `rgba(27,77,142,0.1)`,
              border:         `2px solid ${NAVY}`,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              margin:         '0 auto 20px',
              fontSize:       28,
            }}>
              ✓
            </div>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: NAVY, margin: '0 0 12px' }}>
              Request received!
            </h2>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 14, color: '#555', lineHeight: 1.65, margin: '0 0 32px' }}>
              We've got your message and will respond to <strong>{email}</strong> within one business day.
            </p>
            <button
              onClick={() => { setView('landing'); resetContact() }}
              style={{
                background:   NAVY,
                color:        '#fff',
                border:       'none',
                borderRadius: 32,
                padding:      '12px 28px',
                fontFamily:   'Montserrat, sans-serif',
                fontSize:     14,
                fontWeight:   600,
                cursor:       'pointer',
              }}
            >
              Back to Support Hub
            </button>
          </div>
        </div>
      )
    }

    // ── Form state ─────────────────────────────────────────────────────────
    const canSubmit = !!category && question.trim().length > 0 && !submitting

    return (
      <div style={pageWrap}>
        <div style={navyHeader}>
          <button onClick={() => setView('landing')} style={backBtn}>
            ← Support Hub
          </button>
          <div style={{
            fontFamily:    'Montserrat, sans-serif',
            fontSize:      10,
            color:         'rgba(255,255,255,0.5)',
            textTransform: 'uppercase',
            letterSpacing: '1.2px',
            marginBottom:  6,
          }}>
            Support Hub
          </div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>
            Contact Our Team
          </h1>
          <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
            We'll respond within one business day.
          </p>
        </div>

        <div style={pageContent}>

          {/* Category selector */}
          <p style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: 13, color: '#333', margin: '0 0 10px' }}>
            What do you need help with? <span style={{ color: MAGENTA }}>*</span>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {CATEGORIES.map((cat, i) => {
              const active = category === cat
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  style={{
                    display:     'flex',
                    alignItems:  'center',
                    gap:         12,
                    padding:     '11px 14px',
                    background:  active ? 'rgba(27,77,142,0.06)' : '#fff',
                    border:      active ? `1.5px solid ${NAVY}` : '1px solid rgba(0,0,0,0.1)',
                    borderRadius: 10,
                    cursor:      'pointer',
                    textAlign:   'left',
                    width:       '100%',
                    transition:  'all 0.15s',
                  }}
                >
                  <div style={{
                    width:          24,
                    height:         24,
                    borderRadius:   6,
                    background:     active ? NAVY : '#f0f0f0',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    fontFamily:     'Montserrat, sans-serif',
                    fontSize:       11,
                    fontWeight:     700,
                    color:          active ? GOLD : '#888',
                    flexShrink:     0,
                    transition:     'all 0.15s',
                  }}>
                    {String.fromCharCode(65 + i)}
                  </div>
                  <span style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontSize:   13,
                    color:      active ? NAVY : '#333',
                    fontWeight: active ? 600 : 400,
                  }}>
                    {cat}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Question */}
          <p style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: 13, color: '#333', margin: '0 0 8px' }}>
            Describe your question or issue <span style={{ color: MAGENTA }}>*</span>
          </p>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Tell us what's going on in detail..."
            style={{
              width:       '100%',
              minHeight:   100,
              borderRadius: 10,
              border:      '1px solid rgba(0,0,0,0.12)',
              padding:     '12px 14px',
              fontFamily:  'Montserrat, sans-serif',
              fontSize:    13,
              color:       '#333',
              background:  '#fff',
              resize:      'vertical',
              boxSizing:   'border-box',
              marginBottom: 24,
              outline:     'none',
              lineHeight:  1.6,
            }}
          />

          {/* File upload */}
          <p style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: 13, color: '#333', margin: '0 0 8px' }}>
            Screenshots or documents?{' '}
            <span style={{ fontWeight: 400, color: '#999' }}>(optional)</span>
          </p>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border:       '1.5px dashed rgba(0,0,0,0.15)',
              borderRadius: 10,
              padding:      '22px 20px',
              textAlign:    'center',
              background:   '#f7f7f5',
              cursor:       'pointer',
              marginBottom: 24,
            }}
          >
            {file ? (
              <div>
                <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: NAVY, margin: 0, fontWeight: 600 }}>
                  📎 {file.name}
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null) }}
                  style={{
                    background:  'none',
                    border:      'none',
                    color:       MAGENTA,
                    fontSize:    12,
                    cursor:      'pointer',
                    marginTop:   4,
                    fontFamily:  'Montserrat, sans-serif',
                    padding:     0,
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 28, marginBottom: 6 }}>⬆️</div>
                <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: NAVY, fontWeight: 600, margin: 0 }}>
                  Choose a file or drag it here
                </p>
                <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: '#999', margin: '3px 0 0' }}>
                  Screenshots, PDFs, or documents
                </p>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ display: 'none' }}
          />

          {/* Pre-filled fields */}
          <p style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: 13, color: '#333', margin: '0 0 8px' }}>
            Your name
          </p>
          <input
            type="text"
            value={memberName}
            readOnly
            style={{
              width:        '100%',
              borderRadius: 8,
              border:       '1px solid rgba(0,0,0,0.1)',
              padding:      '10px 14px',
              fontFamily:   'Montserrat, sans-serif',
              fontSize:     13,
              color:        '#999',
              background:   '#f0f0ee',
              boxSizing:    'border-box',
              marginBottom: 16,
            }}
          />

          <p style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: 13, color: '#333', margin: '0 0 8px' }}>
            Email address
          </p>
          <input
            type="email"
            value={email}
            readOnly
            style={{
              width:        '100%',
              borderRadius: 8,
              border:       '1px solid rgba(0,0,0,0.1)',
              padding:      '10px 14px',
              fontFamily:   'Montserrat, sans-serif',
              fontSize:     13,
              color:        '#999',
              background:   '#f0f0ee',
              boxSizing:    'border-box',
              marginBottom: 8,
            }}
          />
          <p style={{
            fontFamily:   'Montserrat, sans-serif',
            fontSize:     11,
            color:        '#aaa',
            margin:       '0 0 28px',
            display:      'flex',
            alignItems:   'center',
            gap:          5,
          }}>
            🔒 Pre-filled from your profile — no need to type
          </p>

          {/* Error */}
          {submitError && (
            <p style={{
              fontFamily:   'Montserrat, sans-serif',
              fontSize:     13,
              color:        MAGENTA,
              margin:       '0 0 16px',
              lineHeight:   1.5,
              background:   'rgba(194,24,91,0.06)',
              borderRadius: 8,
              padding:      '10px 14px',
            }}>
              {submitError}
            </p>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              width:        '100%',
              background:   canSubmit ? MAGENTA : '#ccc',
              color:        '#fff',
              border:       'none',
              borderRadius: 32,
              padding:      '14px 24px',
              fontFamily:   'Montserrat, sans-serif',
              fontSize:     14,
              fontWeight:   600,
              cursor:       canSubmit ? 'pointer' : 'not-allowed',
              transition:   'background 0.2s',
            }}
          >
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>

          <div style={{ height: 32 }} />
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COMMUNITY PROTOCOLS
  // ─────────────────────────────────────────────────────────────────────────

  if (view === 'protocols') {
    return (
      <div style={pageWrap}>
        <div style={navyHeader}>
          <button onClick={() => setView('landing')} style={backBtn}>
            ← Support Hub
          </button>
          <div style={{
            fontFamily:    'Montserrat, sans-serif',
            fontSize:      10,
            color:         'rgba(255,255,255,0.5)',
            textTransform: 'uppercase',
            letterSpacing: '1.2px',
            marginBottom:  6,
          }}>
            DRU AI Leadership Ecosystem™
          </div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 700, color: '#fff', margin: 0 }}>
            Community Protocols
          </h1>
        </div>

        <div style={pageContent}>
          <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 14, color: '#555', lineHeight: 1.7, margin: '0 0 6px' }}>
            Welcome to the DRU AI Consulting Community Connection.
          </p>
          <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 14, color: '#555', lineHeight: 1.7, margin: '0 0 28px' }}>
            We are excited you have chosen to join us. Leadership with AI is our edge and your advantage. These protocols are put in place to ensure your growth, connection, and collaboration.
          </p>

          {/* Section: Lead with Respect */}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', padding: '18px 0' }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 700, color: NAVY, margin: '0 0 8px' }}>
              Lead with Respect and Intention
            </h3>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: '#555', margin: 0, lineHeight: 1.7 }}>
              Each member is at a unique stage of the Leadership with AI journey. Some are new; others are deep in implementation. Meet everyone where they are. Ideas are always welcome. If a conversation intensifies, lead by example. We are all here to learn from one another.
            </p>
          </div>

          {/* Section: Confidentiality */}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', padding: '18px 0' }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 700, color: NAVY, margin: '0 0 8px' }}>
              What's Shared Here, Stays Here
            </h3>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: '#555', margin: 0, lineHeight: 1.7 }}>
              This is a private community. Conversations, frameworks, insights, course content, and member contributions stay here. Members trust each other to maintain confidentiality. Honor that trust as you expect others to honor yours.
            </p>
          </div>

          {/* Section: Not a Marketplace */}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', padding: '18px 0' }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 700, color: NAVY, margin: '0 0 8px' }}>
              This Is a Leadership Space, Not a Marketplace
            </h3>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: '#555', margin: '0 0 12px', lineHeight: 1.7 }}>
              We're here to grow — not sell. No promotions, service pitches, affiliate links, DMs with offers, or sharing partial insights to drive traffic elsewhere. If your reason for posting is to generate business, that's self-promotion. When unsure, ask before posting. We'd rather help you share correctly than remove your post.
            </p>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: 12, color: '#333', margin: '0 0 8px' }}>
              Specifically not allowed:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[
                'DMing members to pitch a product, service, or offer',
                'Posting partial insights to push people toward outside content',
                '"DM me to learn more" or any similar invite to transact',
                'Promoting outside tools or programs',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: MAGENTA, fontSize: 14, lineHeight: 1.5, flexShrink: 0 }}>✕</span>
                  <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: '#555', lineHeight: 1.5 }}>
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Zero Tolerance */}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', padding: '18px 0' }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 700, color: NAVY, margin: '0 0 8px' }}>
              Zero Tolerance for Discrimination and Harassment
            </h3>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: '#555', margin: '0 0 12px', lineHeight: 1.7 }}>
              We do not tolerate harassment, hate speech, political policies, or discrimination of any kind — including age, race, ethnicity, national origin, religion, gender, gender identity, sexual orientation, disability, or any other protected characteristic. This is a safe space. No exceptions.
            </p>
            <div style={{
              background:   'rgba(194,24,91,0.07)',
              borderLeft:   `3px solid ${MAGENTA}`,
              borderRadius: '0 8px 8px 0',
              padding:      '10px 14px',
            }}>
              <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: '#333', margin: 0, fontWeight: 600 }}>
                Violations of this policy result in immediate removal — no warnings.
              </p>
            </div>
          </div>

          {/* Section: When Standards Aren't Met */}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', padding: '18px 0' }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 700, color: NAVY, margin: '0 0 12px' }}>
              When Standards Aren't Met
            </h3>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: '#555', margin: '0 0 14px', lineHeight: 1.7 }}>
              Our community is actively moderated. If something crosses a line:
            </p>
            {[
              ['First, we start with a private conversation.', 'Most issues are confusion and are often resolved here.'],
              ['A Clear Warning.', 'A repeat offense results in a formal warning and a chance to realign.'],
              ['Removal from the Community.', "Repeated violations will result in the loss of your membership. You'll get a full explanation if this happens."],
            ].map(([step, desc], i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{
                  width:          24,
                  height:         24,
                  borderRadius:   '50%',
                  background:     NAVY,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                  marginTop:      1,
                }}>
                  <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 700, color: GOLD }}>
                    {i + 1}
                  </span>
                </div>
                <div>
                  <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 600, color: '#333' }}>
                    {step}{' '}
                  </span>
                  <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: '#555' }}>
                    {desc}
                  </span>
                </div>
              </div>
            ))}
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: '#555', lineHeight: 1.7, margin: 0 }}>
              All moderation decisions are documented. If you think a decision was wrong, appeal to{' '}
              <a href="mailto:support@support.druaiconsulting.com" style={{ color: NAVY, fontWeight: 600 }}>
                support@support.druaiconsulting.com
              </a>.
            </p>
          </div>

          {/* Section: See Something */}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', padding: '18px 0' }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 700, color: NAVY, margin: '0 0 8px' }}>
              Your participation keeps us strong: See Something? Say Something.
            </h3>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: '#555', margin: 0, lineHeight: 1.7 }}>
              If you see content or behavior that doesn't belong here, report it. You help protect the quality of this community for everyone.
            </p>
          </div>

          {/* Section: Need Help */}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', padding: '18px 0' }}>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 700, color: NAVY, margin: '0 0 8px' }}>
              For additional support: Need Help?
            </h3>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: '#555', lineHeight: 1.7, margin: '0 0 8px' }}>
              Contact us at{' '}
              <a href="mailto:support@support.druaiconsulting.com" style={{ color: NAVY, fontWeight: 600 }}>
                support@support.druaiconsulting.com
              </a>
              . Keep support requests out of the community feed — we want discussions focused on leadership with AI.
            </p>
            <p style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, color: '#555', margin: '12px 0 0', fontStyle: 'italic' }}>
              Enjoy, — The DRU AI Consulting Team
            </p>
          </div>

          <div style={{ height: 32 }} />
        </div>
      </div>
    )
  }

  return null
}
