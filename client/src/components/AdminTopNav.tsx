import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminTopNavProps {
  onToggleSidebar: () => void
  currentPath: string
}

interface Notification {
  id: string
  message: string
  type: string
  is_read: boolean
  created_at: string
}

// ─── Nav links ────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Home',        href: '/portal' },
  { label: 'Frameworks',  href: '/frameworks' },
  { label: 'Daily',       href: '/daily' },
  { label: 'Community',   href: '/community' },
  { label: 'Leaderboard', href: '/leaderboard' },
  { label: 'Courses',     href: '/admin-courses' },
  { label: 'Affiliate',   href: '/affiliate' },
]

// ─── Avatar helpers ───────────────────────────────────────────────────────────

function getUserDisplay(user: any) {
  const firstName    = user?.firstName || ''
  const fullName     = user?.fullName  || firstName
  const email        = user?.email     || ''
  const avatarUrl    = user?.picture   || user?.avatar_url || null
  const displayFirst = firstName || email.split('@')[0] || 'User'
  const initials     = fullName
    ? fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase()
  return { name: fullName || email, firstName: displayFirst, avatarUrl, initials }
}

function Avatar({ user, size = 42, avatarOverride }: { user: any; size?: number; avatarOverride?: string | null }) {
  const { avatarUrl, initials } = getUserDisplay(user)
  const [imgError, setImgError] = useState(false)
  const src = avatarOverride || avatarUrl

  if (src && !imgError) {
    return (
      <img src={src} alt="Profile" onError={() => setImgError(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(212,175,55,0.5)', flexShrink: 0 }} />
    )
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(212,175,55,0.15)', border: '2px solid rgba(212,175,55,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: size * 0.35, fontWeight: 700, color: '#D4AF37', lineHeight: 1 }}>{initials}</span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminTopNav({ onToggleSidebar, currentPath }: AdminTopNavProps) {
  const { user, logout, isLoggedIn }          = useAuth()
  const [dropdownOpen, setDropdownOpen]       = useState(false)
  const [notifOpen, setNotifOpen]             = useState(false)
  const [notifications, setNotifications]     = useState<Notification[]>([])
  const [unreadCount, setUnreadCount]         = useState(0)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [localAvatar, setLocalAvatar]         = useState<string | null>(null)
  const fileInputRef                          = useRef<HTMLInputElement>(null)
  const navScrollRef                          = useRef<HTMLDivElement>(null)
  const userDisplay                           = user ? getUserDisplay(user) : null

  const isNavActive = (href: string) => currentPath === href

  // ── Fetch notifications ───────────────────────────────────────────────────
  useEffect(() => {
    if (!(user as any)?.id) return
    async function fetchNotifs() {
      const { data } = await supabase
        .from('community_notifications')
        .select('id, message, type, is_read, created_at')
        .eq('recipient_id', (user as any).id)
        .order('created_at', { ascending: false })
        .limit(10)
      if (data) {
        setNotifications(data)
        setUnreadCount(data.filter((n: Notification) => !n.is_read).length)
      }
    }
    fetchNotifs()
  }, [(user as any)?.id])

  // ── Restore nav scroll position on mount ─────────────────────────────────
  useEffect(() => {
    const saved = sessionStorage.getItem('dru-nav-scroll')
    if (saved && navScrollRef.current) {
      navScrollRef.current.scrollLeft = parseInt(saved, 10)
    }
  }, [])

  const handleNavScroll = () => {
    if (navScrollRef.current) {
      sessionStorage.setItem('dru-nav-scroll', String(navScrollRef.current.scrollLeft))
    }
  }

  // ── Open notif panel + mark as read ──────────────────────────────────────
  const handleNotifToggle = async () => {
    const opening = !notifOpen
    setNotifOpen(opening)
    setDropdownOpen(false)
    if (opening && unreadCount > 0) {
      await supabase
        .from('community_notifications')
        .update({ is_read: true })
        .eq('recipient_id', (user as any).id)
        .eq('is_read', false)
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    }
  }

  // ── Avatar upload ─────────────────────────────────────────────────────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !(user as any)?.id) return
    setAvatarUploading(true)
    const ext      = file.name.split('.').pop()
    const fileName = `${(user as any).id}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true })
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName)
      const publicUrl = urlData.publicUrl
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', (user as any).id)
      setLocalAvatar(publicUrl)
    }
    setAvatarUploading(false)
  }

  const handleLogout = async () => { setDropdownOpen(false); await logout() }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  // ─── Scroll nav link into view on click ──────────────────────────────────
  const handleNavLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const target = e.currentTarget
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    // Allow default navigation
  }

  return (
    <>
      {/* ── Responsive styles ── */}
      <style>{`
        :root { --topnav-h: 120px; }
        .dru-topnav-scroll::-webkit-scrollbar { display: none; }
        .dru-topnav-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        .dru-nav-link {
          font-family: 'Montserrat', sans-serif;
          font-size: 0.72rem;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #EDE8DB;
          background: transparent;
          text-decoration: none;
          border-radius: 4px;
          border-bottom: 2px solid transparent;
          padding: 0.4rem 0.75rem;
          white-space: nowrap;
          flex-shrink: 0;
          transition: color 0.2s, border-color 0.2s;
          scroll-snap-align: start;
        }
        .dru-nav-link:hover { color: #D4AF37; }
        .dru-nav-link.active {
          color: #D4AF37;
          font-weight: 700;
          background: rgba(212,175,55,0.1);
          border-bottom: 2px solid #D4AF37;
        }
        .dru-icon-btn {
          width: 40px; height: 40px; border-radius: 8px;
          background: transparent; border: none;
          color: #EDE8DB;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: color 0.15s, background 0.15s;
          flex-shrink: 0;
        }
        .dru-icon-btn:hover { color: #D4AF37; }
        /* Mobile: compact bar, shield icon replaces full logo */
        .dru-logo-full { display: block; }
        .dru-logo-shield { display: none; }
        @media (max-width: 768px) {
          :root { --topnav-h: 64px; }
          .dru-topnav-nav { height: 64px !important; }
          .dru-logo-full { display: none !important; }
          .dru-logo-shield { display: block !important; }
          .dru-nav-link { padding: 0.4rem 0.6rem; font-size: 0.68rem; }
        }
      `}</style>

      <nav className="dru-topnav-nav" style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height: 120,
        background: '#0A2342',
        borderBottom: '1px solid rgba(212,175,55,0.18)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        // overflow:hidden removed — was clipping dropdown panels
      }}>

        {/* ── Left: hamburger + logo ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 12, flexShrink: 0 }}>

          {/* Sidebar toggle */}
          <button onClick={onToggleSidebar} aria-label="Toggle sidebar" className="dru-icon-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          </button>

          {/* Logo — full on desktop, shield icon on mobile */}
          <a href="/portal" style={{ display: 'flex', alignItems: 'center', flexShrink: 0, textDecoration: 'none' }}>
            {/* Full logo — desktop only */}
            <img
              src="/new-dru-clear-transparent-logo.png"
              alt="DRU CLEAR™"
              className="dru-logo-full"
              style={{ height: 120, width: 'auto', objectFit: 'contain', display: 'block' }}
            />
            {/* Mobile logo — transparent DC shield, no background */}
            <img
              src="/dru-shield-transparent.png"
              alt="DRU CLEAR™"
              className="dru-logo-shield"
              style={{ height: 52, width: 'auto', objectFit: 'contain', flexShrink: 0 }}
            />
          </a>
        </div>

        {/* ── Center: scrollable nav links ── */}
        <div
          ref={navScrollRef}
          onScroll={handleNavScroll}
          className="dru-topnav-scroll"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflowX: 'auto',
            overflowY: 'hidden',
            height: '100%',
            gap: 2,
            padding: '0 8px',
            WebkitOverflowScrolling: 'touch',
            scrollSnapType: 'x proximity',
          }}
        >
          {NAV_LINKS.map((link) => {
            const active = isNavActive(link.href)
            return (
              <a
                key={link.href}
                href={link.href}
                className={`dru-nav-link${active ? ' active' : ''}`}
                onClick={(e) => handleNavLinkClick(e, link.href)}
              >
                <span className="dru-nav-label">{link.label}</span>
              </a>
            )
          })}
        </div>

        {/* ── Right: notifications + avatar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 14, flexShrink: 0 }}>

          {/* Notifications bell */}
          <div style={{ position: 'relative' }}>
            <button
              aria-label="Notifications"
              onClick={handleNotifToggle}
              className="dru-icon-btn"
              style={{ background: notifOpen ? 'rgba(212,175,55,0.1)' : 'transparent', color: notifOpen ? '#D4AF37' : '#EDE8DB', position: 'relative' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unreadCount > 0 && (
                <span style={{ position: 'absolute', top: 7, right: 7, minWidth: 6, height: 6, borderRadius: '50%', background: '#C2185B', border: '1.5px solid #0A2342' }} />
              )}
            </button>

            {/* Notifications panel */}
            {notifOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setNotifOpen(false)} />
                <div style={{ position: 'fixed', top: 'var(--topnav-h, 120px)', right: 14, width: 320, background: '#0A2342', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 10, zIndex: 1100, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(212,175,55,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ fontFamily: 'Montserrat, sans-serif', color: '#D4AF37', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>Notifications</p>
                    {unreadCount === 0 && <span style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(237,232,219,0.35)', fontSize: 11 }}>All caught up</span>}
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                        <p style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(237,232,219,0.35)', fontSize: 13, margin: 0 }}>No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: n.is_read ? 'transparent' : 'rgba(212,175,55,0.05)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          {!n.is_read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C2185B', flexShrink: 0, marginTop: 5 }} />}
                          <div style={{ flex: 1 }}>
                            <p style={{ fontFamily: 'Inter, sans-serif', color: '#EDE8DB', fontSize: 13, margin: '0 0 3px', lineHeight: 1.4 }}>{n.message}</p>
                            <p style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(237,232,219,0.35)', fontSize: 11, margin: 0 }}>{timeAgo(n.created_at)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Avatar + dropdown */}
          {isLoggedIn && user && userDisplay && (
            <div style={{ position: 'relative' }}>

              {/* Hidden file input for photo change */}
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />

              <button
                onClick={() => { setDropdownOpen(!dropdownOpen); setNotifOpen(false) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', opacity: avatarUploading ? 0.6 : 1 }}
              >
                <Avatar user={user} size={42} avatarOverride={localAvatar} />
              </button>

              {dropdownOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={() => setDropdownOpen(false)} />
                  <div style={{ position: 'fixed', top: 'var(--topnav-h, 120px)', right: 14, background: '#0A2342', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 10, padding: '12px 0', minWidth: 210, zIndex: 1100, boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>

                    {/* User info */}
                    <div style={{ padding: '0 16px 12px', borderBottom: '1px solid rgba(212,175,55,0.12)', marginBottom: 4 }}>
                      <p style={{ fontFamily: 'Montserrat, sans-serif', color: '#EDE8DB', fontSize: 13, fontWeight: 600, margin: '0 0 2px' }}>{userDisplay.name}</p>
                      <p style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(237,232,219,0.4)', fontSize: 11, margin: 0 }}>{(user as any).email}</p>
                    </div>

                    {/* Change photo */}
                    <button
                      onClick={() => { setDropdownOpen(false); fileInputRef.current?.click() }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#D4AF37' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(237,232,219,0.7)' }}
                      style={{ width: '100%', padding: '10px 16px', background: 'transparent', border: 'none', textAlign: 'left', fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 600, color: 'rgba(237,232,219,0.7)', cursor: 'pointer', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 8, transition: 'color 0.15s' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                      {avatarUploading ? 'Uploading...' : 'Change Photo'}
                    </button>

                    {/* Sign out */}
                    <button
                      onClick={handleLogout}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#D4AF37' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(237,232,219,0.7)' }}
                      style={{ width: '100%', padding: '10px 16px', background: 'transparent', border: 'none', textAlign: 'left', fontFamily: 'Montserrat, sans-serif', fontSize: 12, fontWeight: 600, color: 'rgba(237,232,219,0.7)', cursor: 'pointer', letterSpacing: '0.04em', transition: 'color 0.15s' }}
                    >
                      Sign Out
                    </button>

                  </div>
                </>
              )}
            </div>
          )}
        </div>

      </nav>
    </>
  )
}
