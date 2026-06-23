import { useState } from 'react'
import { createPortal } from 'react-dom'

const DIFFICULTY_COLOR: Record<string, string> = {
  Beginner: '#D4AF37',
  Intermediate: '#C2185B',
  Advanced: '#1B4D8E',
}

interface Tool {
  name: string
  difficulty: string
  pricingModel: string
  inputModel: string
  url: string
  displayUrl?: string
  bestFor: string
  features: string[]
  useWhen: string
  alsoUsedIn?: string[]
}

interface QuickRecommendation { need: string; tool: string }

interface CategoryRow {
  id: string
  title: string
  description: string
  image_file: string
  tools: Tool[]
  quick_recommendations: QuickRecommendation[] | null
  sort_order: number
}

interface AdminToolCategoryModalProps {
  categories: CategoryRow[]
  categoryId: string
  onClose: () => void
  onNavigate: (categoryId: string) => void
}

// ─── Header icon button ──────────────────────────────────────────────────────

function IconButton({
  children, onClick, title, active,
}: { children: React.ReactNode; onClick?: () => void; title?: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 32, height: 32, borderRadius: '50%',
        background: active ? 'rgba(212,175,55,0.18)' : 'rgba(10,35,66,0.06)',
        border: active ? '1px solid rgba(212,175,55,0.4)' : '1px solid rgba(10,35,66,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: active ? '#D4AF37' : 'rgba(10,35,66,0.5)',
        cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}

// ─── Quick recommendation lookup table (Need → Best Tool) ─────────────────

function QuickRecTable({ rows }: { rows: QuickRecommendation[] }) {
  return (
    <div style={{ border: '1px solid rgba(10,35,66,0.1)', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        background: 'rgba(10,35,66,0.04)', padding: '8px 14px',
        fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 700,
        color: 'rgba(10,35,66,0.5)', letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        <span>Need</span>
        <span>Best Tool</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '9px 14px',
          borderTop: '1px solid rgba(10,35,66,0.06)', fontFamily: 'Inter, sans-serif', fontSize: 13,
        }}>
          <span style={{ color: 'rgba(10,35,66,0.75)' }}>{r.need}</span>
          <span style={{ color: '#0A2342', fontWeight: 600 }}>{r.tool}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Tool entry (full detail view) ───────────────────────────────────────────

function ToolEntry({ tool, isLast }: { tool: Tool; isLast: boolean }) {
  return (
    <div style={{ paddingBottom: isLast ? 0 : 24, marginBottom: isLast ? 0 : 24, borderBottom: isLast ? 'none' : '1px solid rgba(10,35,66,0.08)' }}>
      <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 16, fontWeight: 700, color: '#0A2342', margin: '0 0 6px', letterSpacing: '0.01em' }}>
        {tool.name.toUpperCase()}
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
        <span style={{ width: 14, height: 14, borderRadius: '50%', background: DIFFICULTY_COLOR[tool.difficulty] ?? '#0A2342', flexShrink: 0, boxShadow: `0 0 0 3px ${DIFFICULTY_COLOR[tool.difficulty] ?? '#0A2342'}22` }} />
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(10,35,66,0.75)' }}>
          {tool.difficulty} | {tool.pricingModel}
        </span>
      </div>
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(10,35,66,0.5)', marginBottom: 6 }}>
        {tool.inputModel}
      </div>

      {tool.url !== '#' && (
        <a href={tool.url} target="_blank" rel="noopener noreferrer"
          style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#1565C0', textDecoration: 'none', wordBreak: 'break-all' }}>
          {tool.displayUrl || tool.url}
        </a>
      )}

      <div style={{ marginTop: 14 }}>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, color: '#0A2342', marginBottom: 3 }}>Best for:</div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: 'rgba(10,35,66,0.75)', lineHeight: 1.6 }}>{tool.bestFor}</div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, color: '#0A2342', marginBottom: 6 }}>Key features:</div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {tool.features.map((f, i) => (
            <li key={i} style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: 'rgba(10,35,66,0.75)', lineHeight: 1.7 }}>{f}</li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: 14, paddingLeft: 12, borderLeft: '3px solid #D4AF37' }}>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700, color: '#0A2342', marginBottom: 3 }}>Use this when:</div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: 'rgba(10,35,66,0.75)', lineHeight: 1.6 }}>{tool.useWhen}</div>
        {tool.alsoUsedIn && tool.alsoUsedIn.length > 0 && (
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12.5, color: 'rgba(10,35,66,0.45)', fontStyle: 'italic', marginTop: 4 }}>
            (Also used in: {tool.alsoUsedIn.join(', ')})
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────
// Note: no bookmark / AI-summarize controls here — those are member-account
// features (resource_bookmarks table, member-auth summarize endpoint) that
// don't apply to the admin view. This is read-only, same as the page it's on.

export default function AdminToolCategoryModal({ categories, categoryId, onClose, onNavigate }: AdminToolCategoryModalProps) {
  const [expanded, setExpanded] = useState(false)

  const index = categories.findIndex(c => c.id === categoryId)
  const category = categories[index]
  if (!category) return null

  const hasPrev = index > 0
  const hasNext = index < categories.length - 1

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(10,35,66,0.55)', backdropFilter: 'blur(4px)' }} />

      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 301,
        width: expanded ? 'calc(100vw - 24px)' : 'min(720px, calc(100vw - 24px))',
        height: expanded ? 'calc(100vh - 24px)' : 'min(820px, calc(100vh - 60px))',
        background: '#fff', borderRadius: 16, boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px 16px', flexShrink: 0, borderBottom: '1px solid rgba(10,35,66,0.08)' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 700, color: '#0A2342', margin: 0 }}>
            {category.title}
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconButton title={expanded ? 'Exit full page' : 'Full page'} onClick={() => setExpanded(e => !e)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M8 3H5a2 2 0 00-2 2v3M16 3h3a2 2 0 012 2v3M8 21H5a2 2 0 01-2-2v-3M16 21h3a2 2 0 002-2v-3" />
              </svg>
            </IconButton>

            <IconButton title="Close" onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </IconButton>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 28px', position: 'relative' }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontStyle: 'italic', color: 'rgba(10,35,66,0.6)', lineHeight: 1.7, margin: '0 0 22px' }}>
            {category.description}
          </p>

          {category.quick_recommendations && category.quick_recommendations.length > 0 && (
            <QuickRecTable rows={category.quick_recommendations} />
          )}

          {category.tools.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: 'rgba(10,35,66,0.4)', border: '1px dashed rgba(10,35,66,0.15)', borderRadius: 10 }}>
              Tools for this category are coming soon.
            </div>
          ) : (
            category.tools.map((tool, i) => (
              <ToolEntry key={tool.name} tool={tool} isLast={i === category.tools.length - 1} />
            ))
          )}
        </div>

        {/* Prev / Next */}
        {hasPrev && (
          <button onClick={() => onNavigate(categories[index - 1].id)} title="Previous category" style={navArrowStyle('left')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        )}
        {hasNext && (
          <button onClick={() => onNavigate(categories[index + 1].id)} title="Next category" style={navArrowStyle('right')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        )}
      </div>
    </>,
    document.body
  )
}

function navArrowStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'fixed', top: '50%', [side]: 'max(8px, calc(50vw - 400px))',
    transform: 'translateY(-50%)', zIndex: 302,
    width: 40, height: 40, borderRadius: '50%',
    background: '#fff', border: '1px solid rgba(10,35,66,0.1)',
    boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#0A2342', cursor: 'pointer',
  } as React.CSSProperties
}
