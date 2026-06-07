import { useState, useEffect } from 'react'
import AdminTopNav from './AdminTopNav'
import AdminSidebar from './AdminSidebar'

const SIDEBAR_W   = 264
const COLLAPSED_W = 64
const MOBILE_TOP  = 64   // floating bar height on mobile
const BOTTOM_BAR  = 60   // bottom tab bar height on mobile

interface AdminLayoutProps {
  children: React.ReactNode
  currentPath: string
}

export default function AdminLayout({ children, currentPath }: AdminLayoutProps) {
  const [collapsed,         setCollapsed]         = useState(false)
  const [isMobile,          setIsMobile]          = useState(() => window.innerWidth < 768)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

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

  const sidebarWidth = isMobile ? 0 : (collapsed ? COLLAPSED_W : SIDEBAR_W)

  const handleToggle = () => {
    if (isMobile) setMobileSidebarOpen(prev => !prev)
    else setCollapsed(prev => !prev)
  }

  return (
    <div style={{
      height: '100dvh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      background: '#FAFAF8',
    }}>

      <AdminTopNav
        onToggleSidebar={handleToggle}
        currentPath={currentPath}
      />

      {/* Body row — fixed below nav on desktop, starts at top:0 on mobile (floating nav overlays) */}
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
            paddingTop: isMobile ? MOBILE_TOP : 0,
            paddingBottom: isMobile ? BOTTOM_BAR : 0,
          }}
        >
          <div style={{ minHeight: '100%' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
