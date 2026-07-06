import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { AI_ARSENAL_CATEGORIES } from '../data/aiArsenalData'
import ToolCategoryModal from '../components/resources/ToolCategoryModal'
import { NAVIGATOR_PAYMENT_LINK, ACCELERATOR_PAYMENT_LINK } from './community/types'

// ─── Upgrade gate (free tier) ───────────────────────────────────────────────

function UpgradeGate() {
  return (
    <div style={{ padding: '36px 24px', maxWidth: 700, margin: '0 auto' }}>
      <div style={{
        background: '#fff', border: '1px solid rgba(212,175,55,0.25)',
        borderRadius: 16, padding: '40px 32px', textAlign: 'center',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: 22,
        }}>
          🧰
        </div>
        <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700, color: '#0A2342', margin: '0 0 10px' }}>
          AI Arsenal requires Navigator or Accelerator Access 
        </h2>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: 'rgba(10,35,66,0.55)', lineHeight: 1.7, margin: '0 0 28px' }}>
          The full curated tool library — categories, recommendations, and quick-start guidance — unlocks the moment you join Navigator or Accelerator.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={NAVIGATOR_PAYMENT_LINK} target="_blank" rel="noopener noreferrer" style={{
            padding: '13px 22px', background: '#0A2342', color: '#fff', borderRadius: 8,
            fontFamily: 'Montserrat, sans-serif', fontSize: 12.5, fontWeight: 700,
            letterSpacing: '0.04em', textTransform: 'uppercase', textDecoration: 'none',
          }}>
            Navigator — $97/mo
          </a>
          <a href={ACCELERATOR_PAYMENT_LINK} target="_blank" rel="noopener noreferrer" style={{
            padding: '13px 22px', background: '#C2185B', color: '#fff', borderRadius: 8,
            fontFamily: 'Montserrat, sans-serif', fontSize: 12.5, fontWeight: 700,
            letterSpacing: '0.04em', textTransform: 'uppercase', textDecoration: 'none',
          }}>
            Accelerator — $197/mo
          </a>
        </div>
      </div>
    </div>
  )
}

// ─── Category card ──────────────────────────────────────────────────────────

function CategoryCard({ title, description, imageFile, onClick }: { title: string; description: string; imageFile: string; onClick: () => void }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'missing'>('loading')

  useEffect(() => {
    if (!imageFile) { setStatus('missing'); return }
    let active = true
    const img = new Image()
    img.onload = () => { if (active) setStatus('ok') }
    img.onerror = () => { if (active) setStatus('missing') }
    img.src = `/${imageFile}`
    return () => { active = false }
  }, [imageFile])

  return (
    <button
      onClick={onClick}
      style={{
        background: '#fff', border: '1px solid rgba(10,35,66,0.08)', borderRadius: 12,
        padding: 0, textAlign: 'left', cursor: 'pointer', overflow: 'hidden',
        transition: 'transform 0.12s, box-shadow 0.12s',
        display: 'flex', flexDirection: 'column', height: '100%', width: '100%',
      }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-3px)'
        ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
        ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
      }}
    >
      <div style={{
        aspectRatio: '16/9',
        flex: '1 1 auto',
        minHeight: 0,
        background: status === 'ok'
          ? `#0A2342 url(/${imageFile}) center/cover no-repeat`
          : 'linear-gradient(135deg, #0A2342, #1B4D8E)',
      }} />
      <div style={{ padding: '14px 16px 16px', flexShrink: 0 }}>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 14.5, fontWeight: 700, color: '#0A2342', marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: 'rgba(10,35,66,0.5)', lineHeight: 1.5 }}>
          {description}
        </div>
      </div>
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AIArsenal() {
  const { isPaid, user } = useAuth()
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false)

  // ── Load this member's bookmarked category ids ──
  useEffect(() => {
    if (!user) return
    let active = true
    supabase
      .from('resource_bookmarks')
      .select('category_id')
      .eq('member_id', user.id)
      .then(({ data }) => {
        if (active && data) setBookmarkedIds(new Set(data.map(row => row.category_id)))
      })
    return () => { active = false }
  }, [user])

  // ── Deep link: /resources/ai-arsenal?open=<categoryId> opens that category directly ──
  useEffect(() => {
    const openId = new URLSearchParams(window.location.search).get('open')
    if (openId && AI_ARSENAL_CATEGORIES.some(c => c.id === openId)) {
      setActiveCategory(openId)
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  function handleBookmarkChange(categoryId: string, bookmarked: boolean) {
    setBookmarkedIds(prev => {
      const next = new Set(prev)
      if (bookmarked) next.add(categoryId)
      else next.delete(categoryId)
      return next
    })
  }

  if (!isPaid) return <UpgradeGate />

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const visibleCategories = showBookmarkedOnly
    ? AI_ARSENAL_CATEGORIES.filter(c => bookmarkedIds.has(c.id))
    : AI_ARSENAL_CATEGORIES

  return (
    <div style={{ padding: isMobile ? '20px 12px' : '36px 24px', maxWidth: 1140, margin: '0 auto' }}>

      {/* Hero */}
      <div style={{ marginBottom: 28, borderRadius: 16, overflow: 'hidden' }}>
        <img
          src="/arsenal-banner.png"
          alt="AI Arsenal"
          style={{ width: '100%', display: 'block' }}
        />
      </div>

      {/* Pinned intro post */}
      <div style={{
        background: '#fff', border: '1px solid rgba(10,35,66,0.08)', borderRadius: 12,
        padding: '22px 24px', marginBottom: 28,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 16 }}>📌</span>
          <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 15, fontWeight: 700, color: '#0A2342', margin: 0 }}>
            Before You Dive In... Please Read
          </h2>
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: 'rgba(10,35,66,0.7)', lineHeight: 1.75 }}>
          <p style={{ margin: '0 0 12px' }}>
            This AI Arsenal is a reference, not a checklist. <strong style={{ color: '#D4AF37' }}>Discover</strong> the specific need for your problem, find what solves it, and keep moving forward. Browsing aimlessly causes tool overload, which we want to avoid.
          </p>
          <p style={{ margin: '0 0 12px' }}>
            <strong style={{ color: '#0A2342' }}>Here's the most important thing to keep in mind before you continue scrolling:</strong>
          </p>
          <p style={{ margin: '0 0 12px' }}>
            You don't have to sign up for or buy all these tools. Take your time — <strong style={{ color: '#D4AF37' }}>learn</strong> each one as necessary, focusing on what's right for your business at the moment.
          </p>
          <p style={{ margin: '0 0 16px' }}>
            Remember 😊 — it's the people, not the tools, that make this community powerful. Ask questions, share what works for you, and rely on those around you. Everyone started somewhere, and no one masters this alone.
          </p>

          <div style={{ height: 1, background: 'rgba(10,35,66,0.08)', margin: '0 0 16px' }} />

          <p style={{ margin: '0 0 10px' }}>
            <strong style={{ color: '#0A2342' }}>A few things to keep in mind as you use your AI Arsenal</strong>
          </p>
          <ul style={{ margin: '0 0 16px', paddingLeft: 18 }}>
            <li style={{ marginBottom: 6 }}>Most tools mentioned here offer a free plan or free trial, so you can get started without spending money.</li>
            <li style={{ marginBottom: 6 }}>Many tools overlap intentionally because different people work differently. There's no single right tool — only what's right for you and your business now.</li>
            <li style={{ marginBottom: 6 }}>If you're new and unfamiliar with these names, that's perfectly normal. Begin with Claude or ChatGPT.</li>
            <li>Advanced? Great! Enter with a clear vision, <strong style={{ color: '#D4AF37' }}>discover</strong> a solution, <strong style={{ color: '#D4AF37' }}>learn</strong>, <strong style={{ color: '#D4AF37' }}>apply</strong>, and <strong style={{ color: '#D4AF37' }}>transform</strong>.</li>
          </ul>

          <p style={{ margin: '0 0 12px' }}>
            The AI Arsenal is updated regularly as the AI landscape evolves. Have a tool to suggest? Drop it in Community.
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: '#0A2342' }}>Disclaimer:</strong> Some links in this arsenal are affiliate links. We may earn a small commission if you make a purchase, at no extra cost to you.
          </p>
        </div>
      </div>

      {/* Category grid header + bookmark filter toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700, color: 'rgba(10,35,66,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {visibleCategories.length} {visibleCategories.length === 1 ? 'Category' : 'Categories'}
        </div>
        <button
          onClick={() => setShowBookmarkedOnly(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 20, cursor: 'pointer',
            background: showBookmarkedOnly ? 'rgba(212,175,55,0.12)' : '#fff',
            border: showBookmarkedOnly ? '1px solid rgba(212,175,55,0.45)' : '1px solid rgba(10,35,66,0.12)',
            color: showBookmarkedOnly ? '#B8941F' : 'rgba(10,35,66,0.6)',
            fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 700,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={showBookmarkedOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
          </svg>
          {showBookmarkedOnly ? 'Bookmarked' : 'Show Bookmarked'}
        </button>
      </div>

      {/* Category grid */}
      {visibleCategories.length === 0 ? (
        <div style={{
          background: '#fff', border: '1px solid rgba(10,35,66,0.08)', borderRadius: 12,
          padding: '40px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>🔖</div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: 'rgba(10,35,66,0.5)' }}>
            No bookmarked categories yet. Tap the bookmark icon inside any category to save it here.
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: 16,
        }}>
          {visibleCategories.map(cat => (
            <CategoryCard
              key={cat.id}
              title={cat.title}
              description={cat.description}
              imageFile={cat.imageFile}
              onClick={() => setActiveCategory(cat.id)}
            />
          ))}
        </div>
      )}

      {activeCategory && (
        <ToolCategoryModal
          categoryId={activeCategory}
          onClose={() => setActiveCategory(null)}
          onNavigate={setActiveCategory}
          onBookmarkChange={handleBookmarkChange}
        />
      )}
    </div>
  )
}
