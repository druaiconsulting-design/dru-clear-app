import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminTopNavProps {
  onToggleSidebar: () => void
  currentPath: string
}

// ─── Nav links ────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Portal',      href: '/portal' },
  { label: 'Frameworks',  href: '/frameworks' },
  { label: 'Resources',   href: '/resources' },
  { label: 'Daily',       href: '/daily' },
  { label: 'Community',   href: '/community' },
  { label: 'Leaderboard', href: '/leaderboard' },
  { label: 'Affiliate',   href: '/affiliate' },
]

// ─── Avatar helpers (carried from NavBar.tsx) ─────────────────────────────────

function getUserDisplay(user: any) {
  const firstName    = user?.firstName || ''
  const fullName     = user?.fullName  || firstName
  const email        = user?.email     || ''
  const avatarUrl    = user?.picture   || null
  const displayFirst = firstName || email.split('@')[0] || 'User'
  const initials     = fullName
    ? fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase()
  return { name: fullName || email, firstName: displayFirst, avatarUrl, initials }
}

function Avatar({ user, size = 34 }: { user: any; size?: number }) {
  const { avatarUrl, initials } = getUserDisplay(user)
  const [imgError, setImgError] = useState(false)

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt="Profile"
        onError={() => setImgError(true)}
        style={{
          width: size, height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '2px solid rgba(212,175,55,0.45)',
          flexShrink: 0,
        }}
      />
    )
  }

  return (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      background: 'linear-gradient(135deg,#1e3d6e,#0A2342)',
      border: '2px solid rgba(212,175,55,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <span style={{
        fontFamily: 'Montserrat, sans-serif',
        fontSize: size * 0.35,
        fontWeight: 700,
        color: '#D4AF37',
        lineHeight: 1,
      }}>
        {initials}
      </span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminTopNav({ onToggleSidebar, currentPath }: AdminTopNavProps) {
  const { user, logout, isLoggedIn } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const userDisplay = user ? getUserDisplay(user) : null

  const isNavActive = (href: string) => currentPath === href

  const handleLogout = async () => {
    setDropdownOpen(false)
    await logout()
  }

  return (
    <nav style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      height: 72,
      background: '#3366FF',
      borderBottom: '1px solid rgba(212,175,55,0.18)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 14px',
      gap: 10,
      zIndex: 1000,
      boxSizing: 'border-box',
    }}>

      {/* ── Sidebar toggle ── */}
      <button
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
        style={{
          width: 36, height: 36,
          borderRadius: 8,
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="9" y1="3" x2="9" y2="21"/>
        </svg>
      </button>

      {/* ── Logo ── */}
      <img
        src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663512997684/PPrwKSVlySJjkhTX.png"
        alt="DRU CLEAR™"
        style={{ height: 60, width: 'auto', flexShrink: 0 }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
      />

      {/* ── Nav links ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
        {NAV_LINKS.map((link) => {
          const active = isNavActive(link.href)
          return (
            <a
              key={link.href}
              href={link.href}
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? '#D4AF37' : 'rgba(255,255,255,0.65)',
                background: active ? 'rgba(212,175,55,0.1)' : 'transparent',
                textDecoration: 'none',
                borderRadius: 6,
                borderBottom: active ? '2px solid #D4AF37' : '2px solid transparent',
                padding: '6px 8px',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (active) return
                const el = e.currentTarget as HTMLAnchorElement
                el.style.color = '#D4AF37'
                el.style.background = 'rgba(212,175,55,0.08)'
              }}
              onMouseLeave={(e) => {
                if (active) return
                const el = e.currentTarget as HTMLAnchorElement
                el.style.color = 'rgba(255,255,255,0.65)'
                el.style.background = 'transparent'
              }}
            >
              {link.label}
            </a>
          )
        })}
      </div>

      {/* ── Right controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>

        {/* Search */}
        <button
          aria-label="Search"
          style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'transparent', border: 'none',
            color: 'rgba(255,255,255,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>

        {/* Notifications */}
        <button
          aria-label="Notifications"
          style={{
            position: 'relative',
            width: 34, height: 34, borderRadius: 8,
            background: 'transparent', border: 'none',
            color: 'rgba(255,255,255,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span style={{
            position: 'absolute', top: 6, right: 6,
            width: 6, height: 6,
            borderRadius: '50%',
            background: '#C2185B',
            border: '1.5px solid #3366FF',
          }} />
        </button>

        {/* Avatar + dropdown */}
        {isLoggedIn && user && userDisplay && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
            >
              <Avatar user={user} size={34} />
            </button>

            {dropdownOpen && (
              <>
                {/* Backdrop */}
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                  onClick={() => setDropdownOpen(false)}
                />
                {/* Dropdown panel */}
                <div style={{
                  position: 'absolute',
                  top: 42, right: 0,
                  background: '#0A2342',
                  border: '1px solid rgba(212,175,55,0.2)',
                  borderRadius: 10,
                  padding: '12px 0',
                  minWidth: 200,
                  zIndex: 999,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                }}>
                  {/* User info */}
                  <div style={{ padding: '0 16px 12px', borderBottom: '1px solid rgba(212,175,55,0.12)', marginBottom: 4 }}>
                    <p style={{ fontFamily: 'Montserrat, sans-serif', color: '#FFFFFF', fontWeight: 700, fontSize: 13, margin: '0 0 2px' }}>
                      {userDisplay.firstName}
                    </p>
                    <p style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(237,232,219,0.4)', fontSize: 11, margin: 0 }}>
                      {(user as any).email}
                    </p>
                  </div>
                  {/* Sign out */}
                  <button
                    onClick={handleLogout}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#D4AF37' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(237,232,219,0.7)' }}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      background: 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      fontFamily: 'Montserrat, sans-serif',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'rgba(237,232,219,0.7)',
                      cursor: 'pointer',
                      letterSpacing: '0.04em',
                    }}
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
  )
}
