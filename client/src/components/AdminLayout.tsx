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
  const [collapsed, setCollapsed] = useState(false)

  // Auto-collapse on mobile
  useEffect(() => {
    const check = () => {
      if (window.innerWidth < 768) setCollapsed(true)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const sidebarWidth = collapsed ? COLLAPSED_W : SIDEBAR_W

  return (
    <div style={{ minHeight: '100dvh', background: '#FAFAF8', display: 'flex', flexDirection: 'column' }}>

      <AdminTopNav
        onToggleSidebar={() => setCollapsed(prev => !prev)}
        currentPath={currentPath}
      />

      <div style={{ display: 'flex', flex: 1, paddingTop: TOPNAV_H }}>

        {/* Sidebar — always visible, collapses to icons on mobile */}
        <div style={{
          position: 'fixed',
          top: TOPNAV_H,
          left: 0,
          width: sidebarWidth,
          height: `calc(100vh - ${TOPNAV_H}px)`,
          zIndex: 100,
          transition: 'width 0.2s ease',
          overflowY: 'auto',
          overflowX: 'hidden',
          flexShrink: 0,
        }}>
          <AdminSidebar collapsed={collapsed} currentPath={currentPath} />
        </div>

        {/* Main content */}
        <main style={{
          flex: 1,
          marginLeft: sidebarWidth,
          transition: 'margin-left 0.2s ease',
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
