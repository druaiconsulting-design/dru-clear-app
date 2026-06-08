import { useEffect, useState } from 'react'
import { useAuth } from './context/AuthContext'
import { navigate } from './lib/router'
import Login from './pages/Login'
import Portal from './pages/Portal'
import Daily from './pages/Daily'
import Community from './pages/community'
import Courses from './pages/Courses'
import ModuleLessons from './pages/ModuleLessons'
import LessonPlayer from './pages/LessonPlayer'
import MonthlyVideos from './pages/MonthlyVideos'
import Leaderboard from './pages/community-engagement/Leaderboard'
import Announcements from './pages/community/Announcements'
import AcceleratorCircle from './pages/community/AcceleratorCircle'
import MemberLayout from './components/layout/MemberLayout'

// ─── Loading screen ───────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(160deg, #051528 0%, #0A2342 60%, #07192e 100%)',
      gap: 20,
    }}>
      <div style={{
        fontFamily: 'Cinzel, serif',
        fontSize: 16,
        fontWeight: 700,
        color: '#D4AF37',
        letterSpacing: '0.2em',
      }}>
        DRU AI CONSULTING™
      </div>
      <div style={{
        width: 36,
        height: 36,
        border: '2px solid rgba(212,175,55,0.2)',
        borderTopColor: '#D4AF37',
        borderRadius: '50%',
        animation: 'dru-spin 0.8s linear infinite',
      }} />
    </div>
  )
}

// ─── Coming Soon placeholder ──────────────────────────────────────────────────

function ComingSoon({ title }: { title: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: 12,
      padding: '40px 24px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 40 }}>🔨</div>
      <div style={{
        fontFamily: 'Playfair Display, serif',
        fontSize: 22,
        color: '#D4AF37',
      }}>
        {title}
      </div>
      <div style={{
        fontFamily: 'Montserrat, sans-serif',
        fontSize: 13,
        color: 'rgba(138,164,200,0.6)',
      }}>
        Coming soon
      </div>
    </div>
  )
}

// ─── App / Router ─────────────────────────────────────────────────────────────

export default function App() {
  const { session, loading } = useAuth()
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const handlePop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  useEffect(() => {
    if (loading) return
    if (!session && path !== '/login') {
      navigate('/login')
    } else if (session && path === '/login') {
      navigate('/')
    }
  }, [session, loading, path])

  if (loading) return <LoadingScreen />

  if (!session || path === '/login') return <Login />

  // ── Authenticated page resolver ──────────────────────────────────────────
  const renderPage = () => {
    // Home / Dashboard
    if (path === '/' || path === '/home') return <Portal />

    // Community sub-pages — must come BEFORE the /community catch-all
    if (path === '/community/announcements')
      return <Announcements />

    if (path === '/community/accelerator')
      return <AcceleratorCircle />

    // Community feed
    if (path === '/feed' || path.startsWith('/community')) return <Community />

    // Daily
    if (path === '/daily' || path === '/daily/') return <Daily />

    // Start Here
    if (path === '/start-here')
      return <ComingSoon title="Start Here" />

    // Courses — lesson player
    if (path.startsWith('/courses/lesson/'))
      return <LessonPlayer />

    // Courses — module lesson list
    if (path.startsWith('/courses/module/'))
      return <ModuleLessons />

    // Courses — main catalog
    if (path === '/courses' || path === '/courses/')
      return <Courses />

    // Monthly Videos
    if (path === '/videos' || path.startsWith('/videos/'))
      return <MonthlyVideos />

    // Leaderboard
    if (path === '/leaderboard')
      return <Leaderboard />

    // Resources
    if (path.startsWith('/resources'))
      return <ComingSoon title="Resources" />

    // Support
    if (path.startsWith('/support'))
      return <ComingSoon title="Support Hub" />

    // Profile
    if (path === '/profile')
      return <ComingSoon title="My Profile" />

    // 404
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 12,
        color: 'rgba(138,164,200,0.6)',
      }}>
        <div style={{ fontSize: 40 }}>🔍</div>
        <div style={{
          fontFamily: 'Playfair Display, serif',
          fontSize: 20,
          color: '#D4AF37',
        }}>
          Page Not Found
        </div>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '8px 20px',
            background: 'rgba(212,175,55,0.1)',
            border: '1px solid rgba(212,175,55,0.3)',
            borderRadius: 8,
            color: '#D4AF37',
            fontFamily: 'Montserrat, sans-serif',
            fontSize: 13,
            cursor: 'pointer',
            marginTop: 8,
          }}
        >
          Back to Home
        </button>
      </div>
    )
  }

  return (
    <MemberLayout currentPath={path}>
      {renderPage()}
    </MemberLayout>
  )
}
