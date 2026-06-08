import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

// ─── Constants ────────────────────────────────────────────────────────────────

const UPGRADE_URL = 'https://link.druaiconsulting.com/payment-link/69ead3d37dd3512d920794b1'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LabVideo {
  id: string
  title: string
  month_year: string
  video_url: string
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractBunnyVideoId(url: string): string | null {
  try {
    const match = url.match(/iframe\.mediadelivery\.net\/embed\/[^/]+\/([^/?]+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    })
  } catch {
    return ''
  }
}

// ─── Loader ───────────────────────────────────────────────────────────────────

function Loader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div style={{
        width: 32, height: 32,
        border: '2px solid rgba(212,175,55,0.2)',
        borderTopColor: '#D4AF37',
        borderRadius: '50%',
        animation: 'dru-spin 0.8s linear infinite',
      }} />
    </div>
  )
}

// ─── Upgrade gate (Navigator members) ────────────────────────────────────────

function UpgradeGate() {
  return (
    <div style={{ padding: '40px 24px', maxWidth: 900, margin: '0 auto' }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(10,35,66,0.06)',
          border: '1px solid rgba(10,35,66,0.12)',
          borderRadius: 20, padding: '4px 14px',
          fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700,
          color: 'rgba(10,35,66,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase',
          marginBottom: 14,
        }}>
          🔒 Accelerator Only
        </div>
        <h1 style={{
          fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 700,
          color: '#0A2342', margin: '0 0 8px', lineHeight: 1.3,
        }}>
          DeAnna's Leadership Lab™
        </h1>
        <div style={{ height: 1, background: 'rgba(10,35,66,0.08)', marginTop: 24 }} />
      </div>

      {/* Upgrade card */}
      <div style={{
        background: '#fff', border: '1px solid rgba(10,35,66,0.1)',
        borderRadius: 16, padding: '40px 32px', maxWidth: 520, margin: '0 auto',
        textAlign: 'center',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'rgba(10,35,66,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px', fontSize: 22, color: 'rgba(10,35,66,0.3)',
        }}>
          🔒
        </div>

        <h2 style={{
          fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700,
          color: '#0A2342', margin: '0 0 10px',
        }}>
          Accelerator members only
        </h2>

        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 13,
          color: 'rgba(10,35,66,0.5)', lineHeight: 1.7, margin: '0 0 24px',
        }}>
          Monthly deep-dive strategy sessions with DeAnna — plus everything else in the Accelerator tier.
        </p>

        {/* Feature list */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 10,
          marginBottom: 28, textAlign: 'left',
        }}>
          {[
            "DeAnna's Leadership Lab™ monthly video",
            "Today's Action Challenge",
            "DeAnna's Strategic Edge",
            'Weekly Framework PDF download',
          ].map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ color: '#D4AF37', fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
              <span style={{
                fontFamily: 'Inter, sans-serif', fontSize: 13,
                color: 'rgba(10,35,66,0.65)', lineHeight: 1.45,
              }}>
                {f}
              </span>
            </div>
          ))}
        </div>

        <a
          href={UPGRADE_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block', padding: '14px 0',
            background: '#C2185B', color: '#fff',
            fontFamily: 'Montserrat, sans-serif', fontSize: 13, fontWeight: 700,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            borderRadius: 8, textDecoration: 'none',
          }}
        >
          Upgrade to Accelerator — $197/mo
        </a>
      </div>
    </div>
  )
}

// ─── Coming Soon (no videos published yet) ────────────────────────────────────

function ComingSoon() {
  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(10,35,66,0.08)',
      borderRadius: 12, padding: '64px 24px', textAlign: 'center',
      marginBottom: 28,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: '50%',
        background: 'rgba(212,175,55,0.08)',
        border: '1px solid rgba(212,175,55,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px', fontSize: 22,
      }}>
        🎬
      </div>
      <h3 style={{
        fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700,
        color: '#0A2342', margin: '0 0 8px',
      }}>
        Coming Soon
      </h3>
      <p style={{
        fontFamily: 'Inter, sans-serif', fontSize: 13,
        color: 'rgba(10,35,66,0.4)', lineHeight: 1.65, margin: 0,
      }}>
        Your first Leadership Lab session is being prepared.
        <br />Check back soon.
      </p>
    </div>
  )
}

// ─── Replay card ──────────────────────────────────────────────────────────────

function ReplayCard({
  video,
  isSelected,
  onClick,
}: {
  video: LabVideo
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: isSelected ? 'rgba(212,175,55,0.06)' : '#fff',
        border: isSelected
          ? '1px solid rgba(212,175,55,0.35)'
          : '1px solid rgba(10,35,66,0.08)',
        borderRadius: 10, padding: 16,
        textAlign: 'left', cursor: 'pointer', width: '100%',
        transition: 'transform 0.12s, box-shadow 0.12s',
      }}
      onMouseEnter={e => {
        if (isSelected) return
        ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'
        ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
        ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
      }}
    >
      {/* Thumbnail placeholder */}
      <div style={{
        background: '#0A2342', borderRadius: 8,
        aspectRatio: '16/9', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 12, position: 'relative', overflow: 'hidden',
      }}>
        {isSelected && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: 3, background: '#D4AF37',
          }} />
        )}
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'rgba(212,175,55,0.15)',
          border: '1.5px solid rgba(212,175,55,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 0, height: 0, borderStyle: 'solid',
            borderWidth: '6px 0 6px 11px',
            borderColor: 'transparent transparent transparent #D4AF37',
            marginLeft: 3,
          }} />
        </div>
      </div>

      <div style={{
        fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700,
        color: '#D4AF37', letterSpacing: '0.1em', textTransform: 'uppercase',
        marginBottom: 4,
      }}>
        {video.month_year}
      </div>
      <div style={{
        fontFamily: 'Playfair Display, serif', fontSize: 13, fontWeight: 700,
        color: '#0A2342', lineHeight: 1.35,
      }}>
        {video.title}
      </div>
    </button>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function MonthlyVideos() {
  const { session } = useAuth()

  const [loading, setLoading]             = useState(true)
  const [isAccelerator, setIsAccelerator] = useState(false)
  const [videos, setVideos]               = useState<LabVideo[]>([])
  const [selectedVideo, setSelectedVideo] = useState<LabVideo | null>(null)
  const [signedUrl, setSignedUrl]         = useState<string | null>(null)
  const [videoLoading, setVideoLoading]   = useState(false)

  useEffect(() => {
    if (!session?.user) return
    loadData()
  }, [session])

  async function loadData() {
    setLoading(true)
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tier')
        .eq('id', session!.user.id)
        .single()

      const accelerator = profile?.tier === 'accelerator'
      setIsAccelerator(accelerator)

      if (!accelerator) return

      const { data: vids } = await supabase
        .from('lab_videos')
        .select('id, title, month_year, video_url, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      const list = (vids as LabVideo[]) || []
      setVideos(list)
      if (list.length > 0) setSelectedVideo(list[0])
    } catch (err) {
      console.error('[MonthlyVideos] load error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch signed Bunny URL whenever selected video changes
  useEffect(() => {
    if (!selectedVideo || !session?.access_token) {
      setSignedUrl(null)
      return
    }

    const videoId = extractBunnyVideoId(selectedVideo.video_url)

    if (!videoId) {
      // Non-Bunny URL — use as-is (Supabase storage etc.)
      setSignedUrl(selectedVideo.video_url)
      return
    }

    setVideoLoading(true)
    setSignedUrl(null)

    fetch(`/api/bunny-token?videoId=${videoId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(({ url }) => setSignedUrl(url))
      .catch(err => console.error('[MonthlyVideos] bunny token error:', err))
      .finally(() => setVideoLoading(false))

  }, [selectedVideo?.id, session?.access_token])

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return <Loader />
  if (!isAccelerator) return <UpgradeGate />

  const replays = videos.filter(v => v.id !== selectedVideo?.id)

  return (
    <div style={{ padding: '36px 24px', maxWidth: 900, margin: '0 auto' }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(194,24,91,0.1)',
          border: '1px solid rgba(194,24,91,0.25)',
          borderRadius: 20, padding: '4px 14px',
          fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700,
          color: '#C2185B', letterSpacing: '0.12em', textTransform: 'uppercase',
          marginBottom: 14,
        }}>
          ✦ Accelerator Exclusive
        </div>

        <h1 style={{
          fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 700,
          color: '#0A2342', margin: '0 0 8px', lineHeight: 1.3,
        }}>
          DeAnna's Leadership Lab™
        </h1>

        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 14,
          color: 'rgba(10,35,66,0.5)', lineHeight: 1.65, margin: 0,
        }}>
          Exclusive monthly strategy sessions — deep dives, frameworks in action, and leadership clarity you can apply immediately.
        </p>
      </div>

      <div style={{ height: 1, background: 'rgba(10,35,66,0.08)', marginBottom: 28 }} />

      {/* No videos yet */}
      {videos.length === 0 && <ComingSoon />}

      {/* Featured player */}
      {selectedVideo && (
        <div style={{ marginBottom: 32 }}>
          <div style={{
            fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700,
            color: '#D4AF37', letterSpacing: '0.12em', textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            {replays.length > 0 ? `Latest · ${selectedVideo.month_year}` : selectedVideo.month_year}
          </div>

          <h2 style={{
            fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 700,
            color: '#0A2342', margin: '0 0 4px', lineHeight: 1.3,
          }}>
            {selectedVideo.title}
          </h2>

          <div style={{
            fontFamily: 'Montserrat, sans-serif', fontSize: 11,
            color: 'rgba(10,35,66,0.4)', fontWeight: 600, marginBottom: 18,
          }}>
            Published {formatDate(selectedVideo.created_at)}
          </div>

          {/* Video */}
          <div style={{
            position: 'relative', paddingBottom: '56.25%', height: 0,
            background: '#0A2342', borderRadius: 12, overflow: 'hidden',
            border: '1px solid rgba(10,35,66,0.15)',
          }}>
            {videoLoading ? (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: 32, height: 32,
                  border: '2px solid rgba(212,175,55,0.2)',
                  borderTopColor: '#D4AF37', borderRadius: '50%',
                  animation: 'dru-spin 0.8s linear infinite',
                }} />
              </div>
            ) : signedUrl ? (
              <iframe
                key={selectedVideo.id}
                src={signedUrl}
                style={{
                  position: 'absolute', top: 0, left: 0,
                  width: '100%', height: '100%', border: 'none',
                }}
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12,
              }}>
                <div style={{ fontSize: 32, opacity: 0.25 }}>🎬</div>
                <p style={{
                  fontFamily: 'Montserrat, sans-serif',
                  color: 'rgba(255,255,255,0.3)', fontSize: 11,
                  letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0,
                }}>
                  Video coming soon
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Replays */}
      {replays.length > 0 && (
        <>
          <div style={{ height: 1, background: 'rgba(10,35,66,0.07)', marginBottom: 22 }} />

          <div style={{
            fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700,
            color: 'rgba(10,35,66,0.35)', letterSpacing: '0.14em',
            textTransform: 'uppercase', marginBottom: 14,
          }}>
            Previous Sessions
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
          }}>
            {replays.map(v => (
              <ReplayCard
                key={v.id}
                video={v}
                isSelected={false}
                onClick={() => setSelectedVideo(v)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
