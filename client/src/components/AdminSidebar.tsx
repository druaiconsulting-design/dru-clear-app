import React from 'react'

interface AdminSidebarProps {
  collapsed: boolean
  currentPath: string
  onItemClick?: () => void
}

interface NavItem {
  icon: string
  label: string
  path: string
  external?: boolean
}

interface Section {
  heading: string
  items: NavItem[]
}

const SECTIONS: Section[] = [
  {
    heading: 'INTELLIGENCE',
    items: [
      { icon: '💰', label: 'Profit Pulse',    path: '/admin' },
      { icon: '🏛️', label: 'Dashboard',        path: '/admin-approvals' },
      { icon: '👥', label: 'Members',          path: '/admin-member-intelligence' },
    ],
  },
  {
    heading: 'AGENTS',
    items: [
      { icon: '🤖', label: 'Empire Org Chart', path: '/admin-org' },
      { icon: '🔮', label: 'Twin',              path: '/twin' },
    ],
  },
  {
    heading: 'BUILD',
    items: [
      { icon: '🗺️', label: 'Roadmap & Sprint Tracker', path: '/admin-sprints' },
    ],
  },
  {
    heading: 'VIEW',
    items: [
      { icon: '👤', label: 'Client View ↗',   path: 'https://members.druaiconsulting.com', external: true },
      { icon: '🎓', label: 'Student View ↗', path: 'https://courses.druaiconsulting.com', external: true },
    ],
  },
  {
    heading: 'COURSES',
    items: [
      { icon: '🎓', label: 'From Confusion to Confident', path: '/admin-courses' },
      { icon: '📊', label: 'Dashboard',                   path: '/course-dashboard' },
    ],
  },
  {
    heading: 'RESOURCES',
    items: [
      { icon: '🎬', label: "DeAnna's Leadership Lab", path: '/admin-lab' },
      { icon: '📄', label: 'Weekly Resources PDF',    path: '/admin-resources' },
    ],
  },
]

function isActive(itemPath: string, currentPath: string): boolean {
  if (itemPath.startsWith('http')) return false
  if (itemPath === '/admin') return currentPath === '/admin'
  return currentPath === itemPath || currentPath.startsWith(itemPath + '/')
}

export default function AdminSidebar({ collapsed, currentPath, onItemClick }: AdminSidebarProps) {
  const SIDEBAR_W   = 264
  const COLLAPSED_W = 64
  const TOPNAV_H    = 88

  const w        = collapsed ? COLLAPSED_W : SIDEBAR_W
  const showText = !collapsed

  const navigate = (path: string, external?: boolean) => {
    if (onItemClick) onItemClick()
    if (external) window.open(path, '_blank', 'noopener,noreferrer')
    else window.location.href = path
  }

  const renderItem = (item: NavItem) => {
    const active = isActive(item.path, currentPath)
    return (
      <button
        key={item.path + item.label}
        onClick={() => navigate(item.path, item.external)}
        title={showText ? undefined : item.label}
        onMouseEnter={(e) => {
          if (active) return
          const el = e.currentTarget as HTMLButtonElement
          el.style.background = 'rgba(212,175,55,0.08)'
          el.style.color = 'rgba(212,175,55,0.75)'
        }}
        onMouseLeave={(e) => {
          if (active) return
          const el = e.currentTarget as HTMLButtonElement
          el.style.background = 'transparent'
          el.style.color = '#EDE8DB'
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: showText ? 10 : 0,
          justifyContent: showText ? 'flex-start' : 'center',
          padding: showText ? '8px 12px' : '10px 0',
          borderRadius: 8,
          fontFamily: 'Montserrat, sans-serif',
          fontSize: 13,
          fontWeight: active ? 600 : 400,
          color: active ? '#D4AF37' : '#EDE8DB',
          background: active ? 'rgba(212,175,55,0.15)' : 'transparent',
          borderLeft: active ? '2px solid #D4AF37' : '2px solid transparent',
          borderTop: 'none', borderRight: 'none', borderBottom: 'none',
          transition: 'all 0.15s',
          cursor: 'pointer',
          textAlign: 'left',
          flexShrink: 0,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          marginTop: 2,
        }}>
        <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
        {showText && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
      </button>
    )
  }

  return (
    <aside style={{
      position: 'fixed',
      top: TOPNAV_H,
      left: 0,
      width: w,
      height: `calc(100vh - ${TOPNAV_H}px)`,
      background: '#0A2342',
      borderRight: '1px solid rgba(212,175,55,0.15)',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      overflowX: 'hidden',
      transition: 'width 0.25s ease',
      zIndex: 40,
      flexShrink: 0,
    }}>
      <nav style={{ flex: 1, padding: '8px' }}>
        {SECTIONS.map((section) => (
          <div key={section.heading} style={{ marginBottom: 6 }}>
            {showText && (
              <div style={{ padding: '10px 12px 4px', fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(237,232,219,0.45)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {section.heading}
              </div>
            )}
            {!showText && <div style={{ height: 8 }} />}
            {section.items.map((item) => renderItem(item))}
          </div>
        ))}
      </nav>
      {showText && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(212,175,55,0.12)', fontFamily: 'Cinzel, serif', fontSize: 9, color: 'rgba(237,232,219,0.25)', letterSpacing: '0.12em', textAlign: 'center', flexShrink: 0 }}>
          DRU AI LEADERSHIP ECOSYSTEM™
        </div>
      )}
    </aside>
  )
}
