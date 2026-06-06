import React, { useState } from 'react'
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

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <AdminTopNav
        onToggleSidebar={() => setCollapsed((prev) => !prev)}
        currentPath={currentPath}
      />
      <AdminSidebar
        collapsed={collapsed}
        currentPath={currentPath}
      />
      <main style={{
        marginLeft: collapsed ? COLLAPSED_W : SIDEBAR_W,
        paddingTop: TOPNAV_H,
        minHeight: '100vh',
        background: '#FAFAF8',
        transition: 'margin-left 0.25s ease',
        boxSizing: 'border-box',
      }}>
        {children}
      </main>
    </div>
  )
}
