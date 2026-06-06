import React, { useState } from 'react'
import AdminTopNav from './AdminTopNav'
import AdminSidebar from './AdminSidebar'

// ─── Constants ────────────────────────────────────────────────────────────────

const TOPNAV_H    = 72
const SIDEBAR_W   = 264
const COLLAPSED_W = 64

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminLayoutProps {
  children: React.ReactNode
  currentPath: string
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminLayout({ children, currentPath }: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>

      {/* ── Fixed top nav ── */}
      <AdminTopNav
        onToggleSidebar={() => setCollapsed((prev) => !prev)}
        currentPath={currentPath}
      />

      {/* ── Fixed sidebar ── */}
      <AdminSidebar
        collapsed={collapsed}
        currentPath={currentPath}
      />

      {/* ── Scrollable content area ── */}
      <main
        style={{
          marginLeft: collapsed ? COLLAPSED_W : SIDEBAR_W,
          paddingTop: TOPNAV_H,
          minHeight: '100vh',
          background: '#FAFAF8',
          transition: 'margin-left 0.25s ease',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </main>

    </div>
  )
}
