interface AdminSidebarProps {
  collapsed: boolean
  currentPath: string
  mobileOpen?: boolean
  onMobileClose?: () => void
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
      { icon: '🎥', label: 'Member Vault',             path: '/admin-vault' },
      { icon: '🎬', label: "DeAnna's Leadership Lab", path: '/admin-lab' },
      { icon: '📄', label: 'Weekly Resources PDF',    path: '/admin-resources' },
      { icon: '📋', label: 'Onboarding Checklist',    path: '/admin-onboarding' },
    ],
  },
  {
    heading: 'LINKS',
    items: [
      { icon: '📋', label: 'Assessment ↗',  path: 'https://assessment.druaiconsulting.com/',  external: true },
      { icon: '🧩', label: 'Frameworks ↗',  path: 'https://frameworks.druaiconsulting.com/', external: true },
      { icon: '🎓', label: 'Courses ↗',     path: 'https://courses.druaiconsulting.com/',    external: true },
      { icon: '🌐', label: 'Website ↗',     path: 'https://druaiconsulting.com/',            external: true },
    ],
  },
]

function isActive(itemPath: string, currentPath: string): boolean {
  if (itemPath.startsWith('http')) return false
  if (itemPath === '/admin') return currentPath === '/admin'
  return currentPath === itemPath || currentPath.startsWith(itemPath + '/')
}

export default function AdminSidebar({ collapsed, currentPath, mobileOpen = false, onMobileClose }: AdminSidebarProps) {
  const SIDEBAR_W   = 264
  const COLLAPSED_W = 64

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  // On mobile: always show full-width drawer when open, hidden when closed
  // On desktop: respect collapsed state
  const w        = isMobile ? SIDEBAR_W : (collapsed ? COLLAPSED_W : SIDEBAR_W)
  const showText = isMobile ? true : !collapsed

  const navigate = (path: string, external?: boolean) => {
    if (external) window.open(path, '_blank', 'noopener,noreferrer')
    else window.location.href = path
    if (isMobile && onMobileClose) onMobileClose()
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

  // ── Mobile drawer ──────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        {/* Backdrop overlay */}
        {mobileOpen && (
          <div
            onClick={onMobileClose}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 49,
            }}
          />
        )}
        {/* Drawer */}
        <aside style={{
          position: 'fixed',
          top: 'var(--topnav-h, 64px)' as any,
          left: mobileOpen ? 0 : -SIDEBAR_W - 10,
          width: SIDEBAR_W,
          height: 'calc(100vh - var(--topnav-h, 64px))' as any,
          background: '#0A2342',
          borderRight: '1px solid rgba(212,175,55,0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overflowX: 'hidden',
          transition: 'left 0.25s ease',
          zIndex: 50,
        }}>
          <nav style={{ flex: 1, padding: '8px' }}>
            {SECTIONS.map((section) => (
              <div key={section.heading} style={{ marginBottom: 6 }}>
                <div style={{ padding: '10px 12px 4px', fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700, color: 'rgba(237,232,219,0.45)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {section.heading}
                </div>
                {section.items.map((item) => renderItem(item))}
              </div>
            ))}
          </nav>
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(212,175,55,0.12)', fontFamily: 'Cinzel, serif', fontSize: 9, color: 'rgba(237,232,219,0.25)', letterSpacing: '0.12em', textAlign: 'center', flexShrink: 0 }}>
            DRU AI LEADERSHIP ECOSYSTEM™
          </div>
        </aside>
      </>
    )
  }

  // ── Desktop sidebar ────────────────────────────────────────────────────────
  return (
    <aside style={{
      position: 'fixed',
      top: 'var(--topnav-h, 120px)' as any,
      left: 0,
      width: w,
      height: 'calc(100vh - var(--topnav-h, 120px))' as any,
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
