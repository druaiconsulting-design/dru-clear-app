import { useState, useEffect } from 'react'
import AdminTopNav from './AdminTopNav'
import AdminSidebar from './AdminSidebar'

const TOPNAV_H    = 88
const SIDEBAR_W   = 264
const COLLAPSED_W = 64

interface AdminLayoutProps {
  children: React.ReactNode
  currentPath: string
}

export default function AdminLayout({ children, currentPath }: AdminLayoutProps) {
  const [collapsed, setCollapsed]     = useState(false)
  const [isMobile, setIsMobile]       = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) { setCollapsed(true); setSidebarOpen(false) }
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const handleToggle = () => {
    if (isMobile) setSidebarOpen(prev => !prev)
    else setCollapsed(prev => !prev)
  }

  const closeSidebar = () => setSidebarOpen(false)

  const contentMargin = isMobile ? 0 : (collapsed ? COLLAPSED_W : SIDEBAR_W)

  return (
    <div style={{ minHeight: '100dvh', background: '#FAFAF8', display: 'flex', flexDirection: 'column' }}>

      {/* Top nav — always fixed */}
      <AdminTopNav onToggleSidebar={handleToggle} currentPath={currentPath} />

      {/* Mobile backdrop — rendered BEFORE sidebar so sidebar sits on top */}
      {isMobile && sidebarOpen && (
        <div
          onClick={closeSidebar}
          style={{
            position: 'fixed', inset: 0,
            top: TOPNAV_H,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 940,
          }}
        />
      )}

      {/* Sidebar */}
      <div style={{
        position: 'fixed',
        top: TOPNAV_H,
        left: isMobile ? (sidebarOpen ? 0 : -SIDEBAR_W - 10) : 0,
        width: isMobile ? SIDEBAR_W : (collapsed ? COLLAPSED_W : SIDEBAR_W),
        height: `calc(100vh - ${TOPNAV_H}px)`,
        zIndex: 950,
        transition: isMobile
          ? 'left 0.28s cubic-bezier(0.4,0,0.2,1)'
          : 'width 0.2s ease',
        overflowY: 'auto',
        overflowX: 'hidden',
        flexShrink: 0,
      }}>
        <AdminSidebar
          collapsed={isMobile ? false : collapsed}
          currentPath={currentPath}
          onItemClick={isMobile ? closeSidebar : undefined}
        />
      </div>

      {/* Main content */}
      <main style={{
        flex: 1,
        paddingTop: TOPNAV_H,
        marginLeft: contentMargin,
        transition: isMobile ? 'none' : 'margin-left 0.2s ease',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {children}
      </main>
    </div>
  )
}
