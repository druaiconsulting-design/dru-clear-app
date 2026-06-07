import { useState, useEffect } from 'react'
import AdminTopNav from './AdminTopNav'
import AdminSidebar from './AdminSidebar'

const TOPNAV_H   = 88
const SIDEBAR_W  = 264
const COLLAPSED_W = 64

interface AdminLayoutProps {
  children: React.ReactNode
  currentPath: string
}

export default function AdminLayout({ children, currentPath }: AdminLayoutProps) {
  const [collapsed, setCollapsed]   = useState(false)
  const [isMobile, setIsMobile]     = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false) // mobile overlay open state

  // Detect mobile
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

  const handleToggle = () => {
    if (isMobile) {
      setSidebarOpen(prev => !prev)
    } else {
      setCollapsed(prev => !prev)
    }
  }

  const sidebarVisible = isMobile ? sidebarOpen : true
  const sidebarWidth   = isMobile ? SIDEBAR_W : (collapsed ? COLLAPSED_W : SIDEBAR_W)

  return (
    <div style={{ minHeight: '100dvh', background: '#FAFAF8', display: 'flex', flexDirection: 'column' }}>

      {/* Top nav */}
      <AdminTopNav onToggleSidebar={handleToggle} currentPath={currentPath} />

      {/* Mobile sidebar backdrop */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 900, top: TOPNAV_H }}
        />
      )}

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, paddingTop: TOPNAV_H }}>

        {/* Sidebar */}
        <div style={{
          position: 'fixed',
          top: TOPNAV_H,
          left: isMobile ? (sidebarOpen ? 0 : -SIDEBAR_W) : 0,
          width: sidebarWidth,
          height: `calc(100vh - ${TOPNAV_H}px)`,
          zIndex: isMobile ? 950 : 100,
          transition: isMobile ? 'left 0.25s ease' : 'width 0.2s ease',
          overflowY: 'auto',
          overflowX: 'hidden',
          flexShrink: 0,
        }}>
          <AdminSidebar
            collapsed={isMobile ? false : collapsed}
            currentPath={currentPath}
            onItemClick={isMobile ? () => setSidebarOpen(false) : undefined}
          />
        </div>

        {/* Main content */}
        <main style={{
          flex: 1,
          marginLeft: isMobile ? 0 : (collapsed ? COLLAPSED_W : SIDEBAR_W),
          transition: isMobile ? 'none' : 'margin-left 0.2s ease',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {children}
        </main>
      </div>
    </div>
  )
}
