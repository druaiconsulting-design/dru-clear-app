import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import AdminLayout from '../components/AdminLayout'
import AdminToolCategoryModal from './AdminToolCategoryModal'

// ─────────────────────────────────────────────────────────────────────────────
// AI ARSENAL — ADMIN VIEW (read-only)
// Data source: Supabase table `ai_arsenal_categories` (run ai-arsenal-migration.sql
// once to create + populate it from src/data/aiArsenalData.ts).
// This table is a snapshot of the members-repo catalog as of the migration
// date — it does NOT auto-sync. Editing a tool here changes only what admin
// sees; editing aiArsenalData.ts changes only what members see.
// Visual design intentionally mirrors AIArsenal.tsx / ToolCategoryModal.tsx
// on the members site — same card grid, same modal layout — minus the
// member-only features (bookmarks, AI summarize, paywall) that don't apply
// to an internal, already-logged-in admin view.
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

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

interface CategoryRow {
  id: string
  title: string
  description: string
  image_file: string
  tools: Tool[]
  quick_recommendations: { need: string; tool: string }[] | null
  sort_order: number
}

// ─── Category card (matches members-site CategoryCard exactly) ────────────

function CategoryCard({ title, description, imageFile, onClick }: { title: string; description: string; imageFile: string; onClick: () => void }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'missing'>('loading')

  useEffect(() => {
    if (!imageFile) { setStatus('missing'); return }
    let active = true
    const img = new Image()
    img.onload = () => { if (active) setStatus('ok') }
    img.onerror = () => { if (active) setStatus('missing') }
    img.src = `https://members.druaiconsulting.com/${imageFile}`
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
          ? `#0A2342 url(https://members.druaiconsulting.com/${imageFile}) center/cover no-repeat`
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

export default function AdminAIArsenal() {
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('ai_arsenal_categories')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) {
        console.error('[AdminAIArsenal] supabase error:', error)
        setError('Could not load the AI Arsenal catalog from Supabase.')
      } else {
        setCategories((data ?? []) as CategoryRow[])
      }
      setLoading(false)
    }
    load()
  }, [])

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const totalTools = categories.reduce((sum, c) => sum + c.tools.length, 0)

  return (
    <AdminLayout currentPath={window.location.pathname}>
      <main style={{ flex: 1, padding: isMobile ? '20px 12px' : '2rem 1.5rem', maxWidth: 1140, margin: '0 auto', width: '100%' }}>

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: '10px', letterSpacing: '3px', fontWeight: '600', color: '#B8941F', marginBottom: '6px' }}>
              DRU AI LEADERSHIP ECOSYSTEM™
            </div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: '#0A2342', fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.2, margin: 0 }}>
              AI Arsenal
            </h1>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: 'rgba(10,35,66,0.45)', fontSize: '0.75rem', marginTop: '4px', margin: 0 }}>
              {loading ? 'Loading catalog…' : `${categories.length} categories · ${totalTools} tools · read-only — edit aiArsenalData.ts for the live members site`}
            </p>
          </div>
        </div>

        {/* ── States ───────────────────────────────────────────────────────── */}
        {loading && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: '16px', padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '13px', color: 'rgba(10,35,66,0.35)' }}>Loading AI Arsenal catalog…</div>
          </div>
        )}

        {!loading && error && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: '16px', padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>⚠️</div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '13px', color: '#C2185B' }}>{error}</div>
          </div>
        )}

        {!loading && !error && categories.length === 0 && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: '16px', padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '13px', color: 'rgba(10,35,66,0.35)' }}>
              No categories found — run ai-arsenal-migration.sql in the Supabase SQL editor first.
            </div>
          </div>
        )}

        {/* ── Category grid (matches members-site layout exactly) ────────── */}
        {!loading && !error && categories.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: 16,
          }}>
            {categories.map(cat => (
              <CategoryCard
                key={cat.id}
                title={cat.title}
                description={cat.description}
                imageFile={cat.image_file}
                onClick={() => setActiveCategory(cat.id)}
              />
            ))}
          </div>
        )}

        {activeCategory && (
          <AdminToolCategoryModal
            categories={categories}
            categoryId={activeCategory}
            onClose={() => setActiveCategory(null)}
            onNavigate={setActiveCategory}
          />
        )}
      </main>
    </AdminLayout>
  )
}
