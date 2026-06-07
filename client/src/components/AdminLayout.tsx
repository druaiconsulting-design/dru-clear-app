import { useState, useEffect } from 'react'
import AdminTopNav from './AdminTopNav'
import AdminSidebar from './AdminSidebar'

const SIDEBAR_W   = 264
const COLLAPSED_W = 64

interface AdminLayoutProps {
  children: React.ReactNode
  currentPath: string
}

export default function AdminLayout({ children, currentPath }: AdminLayoutProps) {
  const [collapsed,       setCollapsed]       = useState(false)
  const [isMobile,        setIsMobile]        = useState(false)
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

  // On mobile: sidebar takes no layout space (it's an overlay drawer)
  // On desktop: sidebar shifts content
  const sidebarWidth = isMobile ? 0 : (collapsed ? COLLAPSED_W : SIDEBAR_W)

  const handleToggle = () => {
    if (isMobile) setMobileSidebarOpen(prev => !prev)
    else setCollapsed(prev => !prev)
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#FAFAF8', display: 'flex', flexDirection: 'column' }}>

      <AdminTopNav
        onToggleSidebar={handleToggle}
        currentPath={currentPath}
      />

      <div style={{ display: 'flex', flex: 1, paddingTop: isMobile ? 0 : 'var(--topnav-h, 120px)' as any }}>

        <AdminSidebar
          collapsed={collapsed}
          currentPath={currentPath}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        {/* Main content — full width on mobile, offset by sidebar on desktop */}
        <main style={{
          flex: 1,
          marginLeft: sidebarWidth,
          transition: 'margin-left 0.25s ease',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: isMobile ? 60 : 0,
          overflowY: isMobile ? 'auto' : undefined,
        }}>
          {children}
        </main>
      </div>
    </div>
  )
}
