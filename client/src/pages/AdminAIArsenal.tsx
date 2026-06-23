import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import AdminLayout from '../components/AdminLayout'

// ─────────────────────────────────────────────────────────────────────────────
// AI ARSENAL — ADMIN VIEW (read-only)
// Data source: Supabase table `ai_arsenal_categories` (run ai-arsenal-migration.sql
// once to create + populate it from src/data/aiArsenalData.ts).
// This table is a copy of the members-repo catalog as of the migration date —
// it does NOT auto-sync. Editing a tool here changes only what admin sees;
// editing aiArsenalData.ts changes only what members see. Keep that in mind
// until/unless the two are unified onto one source of truth.
// No write controls on this page by design — it's read-only.
// ─────────────────────────────────────────────────────────────────────────────

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

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

interface CategoryRow {
  id: string
  title: string
  description: string
  image_file: string
  tools: Tool[]
  quick_recommendations: { need: string; tool: string }[] | null
  sort_order: number
}

export default function AdminAIArsenal() {
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [openId, setOpenId]         = useState<string | null>(null)

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

  const totalTools = categories.reduce((sum, c) => sum + c.tools.length, 0)

  return (
    <AdminLayout currentPath={window.location.pathname}>
      <main style={{ flex: 1, padding: '2rem 1.5rem', maxWidth: 1200, margin: '0 auto', width: '100%' }}>

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
              {loading ? 'Loading catalog…' : `${categories.length} categories · ${totalTools} tools · read-only — this is a snapshot, edit aiArsenalData.ts for the live members site`}
            </p>
          </div>
          <div
            onClick={() => window.open('https://members.druaiconsulting.com/ai-arsenal', '_blank', 'noopener,noreferrer')}
            style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '0.72rem', fontWeight: 700, color: 'rgba(10,35,66,0.5)', border: '1px solid rgba(10,35,66,0.2)', borderRadius: 8, padding: '0.6rem 1.25rem', letterSpacing: '0.06em', cursor: 'pointer' }}
          >
            View live on members site ↗
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

        {/* ── Category list ───────────────────────────────────────────────── */}
        {!loading && !error && categories.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {categories.map(cat => {
              const isOpen = openId === cat.id
              return (
                <div key={cat.id} style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: '14px', overflow: 'hidden' }}>

                  {/* Category row */}
                  <div
                    onClick={() => setOpenId(isOpen ? null : cat.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', cursor: 'pointer' }}
                  >
                    <img
                      src={`https://members.druaiconsulting.com/${cat.image_file}`}
                      alt=""
                      style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0, background: '#0A2342' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", color: '#0A2342', fontSize: '1rem', fontWeight: 700 }}>
                        {cat.title}
                      </div>
                      <div style={{ fontFamily: "'Montserrat', sans-serif", color: 'rgba(10,35,66,0.45)', fontSize: '0.75rem', marginTop: '2px' }}>
                        {cat.description}
                      </div>
                    </div>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '0.7rem', fontWeight: 700, color: 'rgba(10,35,66,0.4)', flexShrink: 0 }}>
                      {cat.tools.length} tools
                    </div>
                    <div style={{ fontSize: '14px', color: 'rgba(10,35,66,0.3)', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                      ▾
                    </div>
                  </div>

                  {/* Expanded tool table */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid #E8E4DF', padding: '4px 20px 16px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Montserrat', sans-serif", fontSize: '0.78rem' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', color: 'rgba(10,35,66,0.4)', fontSize: '0.68rem', letterSpacing: '0.04em' }}>
                            <th style={{ padding: '8px 8px', fontWeight: 700 }}>TOOL</th>
                            <th style={{ padding: '8px 8px', fontWeight: 700 }}>DIFFICULTY</th>
                            <th style={{ padding: '8px 8px', fontWeight: 700 }}>PRICING</th>
                            <th style={{ padding: '8px 8px', fontWeight: 700 }}>INPUT MODEL</th>
                            <th style={{ padding: '8px 8px', fontWeight: 700 }}>BEST FOR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cat.tools.map(tool => (
                            <tr key={tool.name} style={{ borderTop: '1px solid #F1EFE8' }}>
                              <td style={{ padding: '10px 8px', color: '#0A2342', fontWeight: 600 }}>
                                <a href={tool.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0A2342', textDecoration: 'none' }}>
                                  {tool.name} ↗
                                </a>
                              </td>
                              <td style={{ padding: '10px 8px' }}>
                                <span style={{
                                  display: 'inline-block', padding: '2px 10px', borderRadius: 999,
                                  fontSize: '0.68rem', fontWeight: 700, color: '#FFFFFF',
                                  background: DIFFICULTY_COLOR[tool.difficulty] ?? '#0A2342',
                                }}>
                                  {tool.difficulty}
                                </span>
                              </td>
                              <td style={{ padding: '10px 8px', color: 'rgba(10,35,66,0.7)' }}>{tool.pricingModel}</td>
                              <td style={{ padding: '10px 8px', color: 'rgba(10,35,66,0.7)' }}>{tool.inputModel}</td>
                              <td style={{ padding: '10px 8px', color: 'rgba(10,35,66,0.55)' }}>{tool.bestFor}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </AdminLayout>
  )
}
