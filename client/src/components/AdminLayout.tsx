import { useState, useEffect, useRef, useCallback } from 'react'
import AdminTopNav from './AdminTopNav'
import AdminSidebar from './AdminSidebar'

const SIDEBAR_W   = 264
const COLLAPSED_W = 64
const MOBILE_TOP  = 64   // floating bar height on mobile
const BOTTOM_BAR  = 60   // bottom tab bar height on mobile
const PTR_THRESHOLD = 72 // px to pull before triggering refresh

interface AdminLayoutProps {
  children: React.ReactNode
  currentPath: string
}

export default function AdminLayout({ children, currentPath }: AdminLayoutProps) {
  const [collapsed,         setCollapsed]         = useState(false)
  const [isMobile,          setIsMobile]          = useState(() => window.innerWidth < 768)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [ptrPull,           setPtrPull]           = useState(0)
  const [ptrRefreshing,     setPtrRefreshing]     = useState(false)

  const touchStartY = useRef(0)
  const isPulling   = useRef(false)

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) setCollapsed(true)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── Pull-to-refresh handlers ──────────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return
    const el = document.getElementById('dru-admin-scroll')
    if (!el || el.scrollTop > 0) return
    touchStartY.current = e.touches[0].clientY
    isPulling.current = true
  }, [isMobile])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile || !isPulling.current || ptrRefreshing) return
    const el = document.getElementById('dru-admin-scroll')
    if (!el || el.scrollTop > 0) { isPulling.current = false; return }
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 0) {
      setPtrPull(Math.min(delta * 0.5, PTR_THRESHOLD))
    }
  }, [isMobile, ptrRefreshing])

  const handleTouchEnd = useCallback(() => {
    if (!isMobile || !isPulling.current) return
    isPulling.current = false
    if (ptrPull >= PTR_THRESHOLD) {
      setPtrRefreshing(true)
      setPtrPull(PTR_THRESHOLD)
      setTimeout(() => window.location.reload(), 600)
    } else {
      setPtrPull(0)
    }
  }, [isMobile, ptrPull])

  const sidebarWidth = isMobile ? 0 : (collapsed ? COLLAPSED_W : SIDEBAR_W)

  const handleToggle = () => {
    if (isMobile) setMobileSidebarOpen(prev => !prev)
    else setCollapsed(prev => !prev)
  }

  return (
    <div
      style={{
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: '#FAFAF8',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >

      <AdminTopNav
        onToggleSidebar={handleToggle}
        currentPath={currentPath}
      />

      {/* Body row */}
      <div style={{
        position: 'fixed',
        top: isMobile ? 0 : ('var(--topnav-h, 120px)' as any),
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
      }}>

        <AdminSidebar
          collapsed={collapsed}
          currentPath={currentPath}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        {/* Mobile overlay behind drawer */}
        {isMobile && mobileSidebarOpen && (
          <div
            onClick={() => setMobileSidebarOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 45,
            }}
          />
        )}

        {/* Pull-to-refresh indicator */}
        {isMobile && (ptrPull > 0 || ptrRefreshing) && (
          <div style={{
            position: 'absolute',
            top: MOBILE_TOP + ptrPull - 36,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            zIndex: 60,
          }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '3px solid #D4AF37',
              borderTopColor: 'transparent',
              animation: ptrRefreshing ? 'spin 0.7s linear infinite' : 'none',
              transform: ptrRefreshing ? undefined : `rotate(${(ptrPull / PTR_THRESHOLD) * 270}deg)`,
              background: '#0A2342',
            }} />
          </div>
        )}

        {/* Main content — scrollable container */}
        <main
          id="dru-admin-scroll"
          style={{
            position: 'absolute',
            top: 0,
            left: sidebarWidth,
            right: 0,
            bottom: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            background: '#FAFAF8',
            transition: 'left 0.25s ease',
            paddingTop: isMobile ? MOBILE_TOP + ptrPull : 0,
            paddingBottom: isMobile ? BOTTOM_BAR : 0,
          }}
        >
          <div style={{ minHeight: '100%' }}>
            {children}
          </div>
        </main>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
