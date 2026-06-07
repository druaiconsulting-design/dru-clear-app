import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import AdminLayout from '../components/AdminLayout'
import LevelBadge from './community-engagement/LevelBadge'
import MemberAvatar from './community/MemberAvatar'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ── Level thresholds — matches compute_community_level() in Supabase ──────────
const LEVELS = [
  { name: 'Connected',   min: 0    },
  { name: 'Contributor', min: 50   },
  { name: 'Cultivator',  min: 150  },
  { name: 'Cornerstone', min: 400  },
  { name: 'Changemaker', min: 1000 },
] as const

const LEVEL_RANK:   Record<string, number> = { Connected:1, Contributor:2, Cultivator:3, Cornerstone:4, Changemaker:5 }
const PATHWAY_RANK: Record<string, number> = { Discover:1,  Diagnose:2,   Design:3,     Deploy:4,      Dominate:5    }

interface LeaderboardRow {
  id:              string
  full_name:       string
  photo_url:       string | null
  community_level: string
  pathway_stage:   string
  clarity_points:  number
  tier:            string
  all_time_rank:   number
  weekly_points:   number
  weekly_rank:     number
}

function getGapSignal(level: string, pathway: string) {
  const l = LEVEL_RANK[level]   ?? 0
  const p = PATHWAY_RANK[pathway] ?? 0
  if (!l)      return { label: 'No Activity',    bg: 'rgba(10,35,66,0.05)', color: 'rgba(10,35,66,0.35)' }
  if (l > p)   return { label: 'Hot Lead',        bg: '#FBEAF0',             color: '#72243E'              }
  if (l === p) return { label: 'Aligned',         bg: '#EAF3DE',             color: '#27500A'              }
  return         { label: 'Retention Risk',  bg: '#FAEEDA',             color: '#633806'              }
}

// =============================================================================
// ADMIN LEADERBOARD
// =============================================================================
export default function AdminLeaderboard() {
  const [allRows,        setAllRows]        = useState<LeaderboardRow[]>([])
  const [selectedMember, setSelectedMember] = useState<LeaderboardRow | null>(null)
  const [view,           setView]           = useState<'weekly' | 'alltime'>('weekly')
  const [loading,        setLoading]        = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('community_leaderboard').select('*')
      if (!data) { setLoading(false); return }
      const rows = data as LeaderboardRow[]
      setAllRows(rows)
      const top = [...rows].sort((a, b) => a.weekly_rank - b.weekly_rank)[0]
      setSelectedMember(top ?? null)
      setLoading(false)
    }
    load()
  }, [])

  const sortedRows = useMemo(() =>
    view === 'weekly'
      ? [...allRows].sort((a, b) => a.weekly_rank  - b.weekly_rank)
      : [...allRows].sort((a, b) => a.all_time_rank - b.all_time_rank)
  , [allRows, view])

  const getRowRank = (r: LeaderboardRow) => view === 'weekly' ? r.weekly_rank  : r.all_time_rank
  const getRowPts  = (r: LeaderboardRow) => view === 'weekly' ? r.weekly_points : r.clarity_points
  const medal      = (n: number) => n === 1 ? '🥇' : n === 2 ? '🥈' : n === 3 ? '🥉' : null

  // ── Selected member stats helpers ─────────────────────────────────────────
  const m              = selectedMember
  const communityLevel = m?.community_level ?? 'Connected'
  const clarityPts     = m?.clarity_points  ?? 0
  const safeIdx        = Math.max(0, LEVELS.findIndex(l => l.name === communityLevel))
  const currentLevel   = LEVELS[safeIdx]
  const nextLevel      = LEVELS[safeIdx + 1] ?? null
  const pointsToNext   = nextLevel ? Math.max(0, nextLevel.min - clarityPts) : 0
  const progressPct    = nextLevel
    ? Math.min(100, ((clarityPts - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100)
    : 100
  const gap = m ? getGapSignal(m.community_level, m.pathway_stage) : null

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
              Clarity Points™ Leaderboard
            </h1>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: 'rgba(10,35,66,0.45)', fontSize: '0.75rem', marginTop: '4px', margin: 0 }}>
              Click any member to preview their card exactly as they see it
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div
              onClick={() => window.location.href = '/community'}
              style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '0.72rem', fontWeight: 700, color: 'rgba(10,35,66,0.5)', border: '1px solid rgba(10,35,66,0.2)', borderRadius: 8, padding: '0.6rem 1.25rem', letterSpacing: '0.06em', cursor: 'pointer' }}
            >
              ← Community
            </div>
          </div>
        </div>

        {/* ── Toggle ───────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', background: '#F1EFE8', borderRadius: '8px', padding: '3px', gap: '2px' }}>
            {(['weekly', 'alltime'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '600', background: view === v ? '#FFFFFF' : 'transparent', color: view === v ? '#0A2342' : 'rgba(10,35,66,0.4)', boxShadow: view === v ? '0 1px 3px rgba(10,35,66,0.1)' : 'none', transition: 'all 0.15s' }}>
                {v === 'weekly' ? 'This Week' : 'All-Time'}
              </button>
            ))}
          </div>
          {m && (
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', color: 'rgba(10,35,66,0.4)', fontStyle: 'italic' }}>
              Previewing: <strong style={{ color: '#0A2342', fontStyle: 'normal' }}>{m.full_name}</strong>
            </div>
          )}
        </div>

        {/* ── Two-column layout ────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '24px', alignItems: 'start' }}>

          {/* ── LEFT: Member card preview ─────────────────────────────────── */}
          <div style={{ position: 'sticky', top: '24px' }}>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '10px', fontWeight: '700', color: 'rgba(10,35,66,0.4)', letterSpacing: '0.5px', marginBottom: '10px' }}>
              MEMBER CARD PREVIEW
            </div>

            {!m ? (
              <div style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: '16px', padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>👆</div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '13px', color: 'rgba(10,35,66,0.35)' }}>Click any member to preview their card</div>
              </div>
            ) : (
              <div style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: '16px', boxShadow: '0 2px 12px rgba(10,35,66,0.08)' }}>

                {/* Gold accent strip */}
                <div style={{ height: '4px', background: 'linear-gradient(90deg, #D4AF37, #B8941F, #D4AF37)', borderRadius: '16px 16px 0 0' }} />

                <div style={{ padding: '28px' }}>

                  {/* Avatar + name + level hero */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', marginBottom: '20px' }}>

                    {/* Avatar with gold ring + weekly rank badge */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: '108px', height: '108px', borderRadius: '50%', border: '4px solid #D4AF37', padding: '3px', background: '#fff', boxShadow: '0 0 0 3px rgba(212,175,55,0.15)' }}>
                        <MemberAvatar
                          firstName={m.full_name.split(' ')[0] || m.full_name}
                          photoUrl={m.photo_url ?? undefined}
                          size={100}
                        />
                      </div>
                      {m.weekly_rank > 0 && (
                        <div style={{ position: 'absolute', bottom: 2, right: 2, width: '30px', height: '30px', borderRadius: '50%', background: '#0A2342', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(10,35,66,0.3)' }}>
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '9px', fontWeight: '800', color: '#D4AF37' }}>#{m.weekly_rank}</span>
                        </div>
                      )}
                    </div>

                    {/* Name + level hero + rank chips + gap signal */}
                    <div style={{ flex: 1, minWidth: 0, paddingTop: '8px' }}>
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '13px', fontWeight: '500', color: 'rgba(10,35,66,0.5)', marginBottom: '4px' }}>
                        {m.full_name}
                      </div>
                      <div style={{ fontFamily: "'Cinzel', serif", fontSize: '22px', fontWeight: '700', color: '#B8941F', lineHeight: '1.1', marginBottom: '6px' }}>
                        {communityLevel}
                      </div>
                      {nextLevel ? (
                        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '12px', color: 'rgba(10,35,66,0.5)', marginBottom: '10px' }}>
                          {pointsToNext} points to level up
                        </div>
                      ) : (
                        <div style={{ fontFamily: "'Cinzel', serif", fontSize: '11px', color: '#B8941F', fontWeight: '700', marginBottom: '10px' }}>MAX LEVEL ✦</div>
                      )}

                      {/* Rank chips */}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#F7F5EE', border: '1px solid #E8E4DF', borderRadius: '6px', padding: '3px 8px' }}>
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '9px', color: 'rgba(10,35,66,0.4)', fontWeight: '600' }}>THIS WEEK</span>
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '800', color: '#0A2342' }}>#{m.weekly_rank || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#F7F5EE', border: '1px solid #E8E4DF', borderRadius: '6px', padding: '3px 8px' }}>
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '9px', color: 'rgba(10,35,66,0.4)', fontWeight: '600' }}>ALL-TIME</span>
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '800', color: '#0A2342' }}>#{m.all_time_rank || '—'}</span>
                        </div>
                        {/* Gap signal — admin only, not visible to member */}
                        {gap && (
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '9px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', background: gap.bg, color: gap.color }}>
                            {gap.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {nextLevel && (
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '10px', fontWeight: '700', color: 'rgba(10,35,66,0.4)', letterSpacing: '0.3px' }}>YOUR PROGRESS</span>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '10px', fontWeight: '700', color: '#B8941F' }}>{Math.round(progressPct)}%</span>
                      </div>
                      <div style={{ height: '10px', background: '#F1EFE8', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg, #D4AF37, #B8941F)', borderRadius: '999px', transition: 'width 0.8s ease' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', fontFamily: "'Montserrat', sans-serif", fontSize: '9px', color: 'rgba(10,35,66,0.35)', fontWeight: '600' }}>
                        <span>{currentLevel.name} · {currentLevel.min} pts</span>
                        <span>{nextLevel.name} · {nextLevel.min} pts</span>
                      </div>
                    </div>
                  )}

                  {/* Level progression track */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '10px', fontWeight: '700', color: 'rgba(10,35,66,0.4)', letterSpacing: '0.5px', marginBottom: '12px' }}>
                      COMMUNITY LEVELS
                    </div>
                    <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 'max-content' }}>
                        {LEVELS.map((level, i) => {
                          const isUnlocked = safeIdx >= i
                          const isCurrent  = level.name === communityLevel
                          return (
                            <div key={level.name} style={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: isCurrent ? '#0A2342' : isUnlocked ? '#D4AF37' : '#F1EFE8', border: `2px solid ${isCurrent ? '#0A2342' : isUnlocked ? '#D4AF37' : '#E0DDD7'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isCurrent ? '0 0 0 3px rgba(212,175,55,0.2)' : 'none' }}>
                                  {!isUnlocked
                                    ? <span style={{ color: 'rgba(10,35,66,0.2)', fontSize: '13px' }}>🔒</span>
                                    : isCurrent
                                      ? <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#D4AF37', display: 'block' }} />
                                      : <span style={{ color: '#fff', fontSize: '13px', fontWeight: '700' }}>✓</span>
                                  }
                                </div>
                                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '9px', fontWeight: isCurrent ? '800' : '500', color: isCurrent ? '#0A2342' : isUnlocked ? '#B8941F' : 'rgba(10,35,66,0.3)', whiteSpace: 'nowrap' }}>
                                  {level.name}
                                </span>
                                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '8px', color: 'rgba(10,35,66,0.3)', whiteSpace: 'nowrap' }}>
                                  {level.min === 0 ? '0 pts' : `${level.min} pts`}
                                </span>
                              </div>
                              {i < LEVELS.length - 1 && (
                                <div style={{ width: '32px', height: '2px', background: isUnlocked && !isCurrent ? '#D4AF37' : '#E0DDD7', margin: '17px 0 0', flexShrink: 0 }} />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Points total footer */}
                  <div style={{ paddingTop: '16px', borderTop: '1px solid #F0EDE8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', color: 'rgba(10,35,66,0.4)', fontWeight: '600', letterSpacing: '0.3px' }}>CLARITY POINTS™</span>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: '700', color: '#D4AF37' }}>{clarityPts.toLocaleString()}</span>
                  </div>

                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Leaderboard table ──────────────────────────────────── */}
          <div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '10px', fontWeight: '700', color: 'rgba(10,35,66,0.4)', letterSpacing: '0.5px', marginBottom: '10px' }}>
              FULL LEADERBOARD — CLICK TO PREVIEW
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(10,35,66,0.06)' }}>

              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 70px 100px', gap: '8px', padding: '10px 16px', background: '#FAFAF8', borderBottom: '1px solid #E8E4DF' }}>
                {['#', 'MEMBER', 'PTS', 'SIGNAL'].map((h, i) => (
                  <div key={h} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '10px', fontWeight: '600', color: 'rgba(10,35,66,0.35)', letterSpacing: '0.5px', textAlign: i === 2 ? 'right' : 'left' }}>
                    {h}
                  </div>
                ))}
              </div>

              {loading ? (
                <div style={{ padding: '48px 20px', textAlign: 'center', fontFamily: "'Montserrat', sans-serif", fontSize: '13px', color: 'rgba(10,35,66,0.35)' }}>
                  Loading...
                </div>
              ) : sortedRows.length === 0 ? (
                <div style={{ padding: '48px 20px', textAlign: 'center', fontFamily: "'Montserrat', sans-serif", fontSize: '13px', color: 'rgba(10,35,66,0.35)' }}>
                  No members ranked yet
                </div>
              ) : sortedRows.map(row => {
                const rank       = getRowRank(row)
                const pts        = getRowPts(row)
                const rowGap     = getGapSignal(row.community_level, row.pathway_stage)
                const isSelected = selectedMember?.id === row.id
                return (
                  <div
                    key={row.id}
                    onClick={() => setSelectedMember(row)}
                    style={{ display: 'grid', gridTemplateColumns: '36px 1fr 70px 100px', alignItems: 'center', gap: '8px', padding: '12px 16px', background: isSelected ? '#FFFBEE' : '#FFFFFF', borderBottom: '1px solid #F0EDE8', borderLeft: isSelected ? '3px solid #D4AF37' : '3px solid transparent', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#FAFAF8' }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#FFFFFF' }}
                  >
                    <div style={{ textAlign: 'center', fontFamily: "'Montserrat', sans-serif", fontWeight: '700', fontSize: rank <= 3 ? '16px' : '12px', color: 'rgba(10,35,66,0.3)' }}>
                      {medal(rank) ?? rank}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <MemberAvatar
                        firstName={row.full_name.split(' ')[0] || row.full_name}
                        photoUrl={row.photo_url ?? undefined}
                        size={44}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '600', color: '#0A2342', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '3px' }}>
                          {row.full_name}
                        </div>
                        <LevelBadge level={row.community_level} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '13px', fontWeight: '700', color: '#0A2342' }}>{pts?.toLocaleString() ?? '—'}</div>
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '9px', color: 'rgba(10,35,66,0.35)' }}>{view === 'weekly' ? 'this wk' : 'pts'}</div>
                    </div>
                    <div>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '9px', fontWeight: '700', padding: '2px 7px', borderRadius: '4px', background: rowGap.bg, color: rowGap.color, whiteSpace: 'nowrap' }}>
                        {rowGap.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Gap signal legend */}
            <div style={{ marginTop: '16px', padding: '12px 16px', background: '#FAFAF8', border: '1px solid #E8E4DF', borderRadius: '8px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '10px', fontWeight: '700', color: 'rgba(10,35,66,0.4)', letterSpacing: '0.5px' }}>SIGNALS:</span>
              {[
                { label: 'Hot Lead',       bg: '#FBEAF0', color: '#72243E', tip: 'Engagement ahead — ready to invest' },
                { label: 'Aligned',        bg: '#EAF3DE', color: '#27500A', tip: 'Getting full value' },
                { label: 'Retention Risk', bg: '#FAEEDA', color: '#633806', tip: 'Re-engage now' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', background: s.bg, color: s.color }}>{s.label}</span>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '10px', color: 'rgba(10,35,66,0.4)' }}>{s.tip}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        <footer style={{ textAlign: 'center', padding: '2rem 0 0.5rem', color: 'rgba(10,35,66,0.3)', fontFamily: "'Montserrat', sans-serif", fontSize: '0.6rem' }}>
          © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
        </footer>
      </main>
    </AdminLayout>
  )
}
