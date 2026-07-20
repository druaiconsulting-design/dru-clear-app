import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { supabase } from './types';
import type { Tier } from './types';
import CommunityFeed from './CommunityFeed';
import CommunityJoin from './CommunityJoin';
import Leaderboard from '../community-engagement/Leaderboard';
import AcceleratorCircleFeed from './AcceleratorCircle';

export default function Community() {
  const [tier,        setTier]        = useState<Tier | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [checking,    setChecking]    = useState(true);
  const [activeTab,   setActiveTab]   = useState<'feed' | 'leaderboard' | 'accelerator'>('feed');
  const [userId,      setUserId]      = useState('');

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setTier('free'); setChecking(false); return; }
        const admin = user.email?.toLowerCase() === import.meta.env.VITE_ADMIN_EMAIL?.toLowerCase();
        setIsAdminUser(admin);
        setUserId(user.id);
        const { data } = await supabase.from('profiles').select('tier').eq('id', user.id).maybeSingle();
        setTier(admin ? 'accelerator' : ((data?.tier as Tier) ?? 'free'));
      } catch { setTier('free'); } finally { setChecking(false); }
    };
    check();
  }, []);

  const globalStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Montserrat:wght@400;500;600;700&family=Playfair+Display:wght@700&family=Inter:wght@400;500&display=swap');
    @keyframes ccFadeIn  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes ccShimmer { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
    @keyframes ccPulse   { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
    * { box-sizing: border-box; margin: 0; padding: 0; }
  `;

  if (checking) {
    return (
      <AdminLayout currentPath={window.location.pathname}>
        <style>{`@keyframes ccPulse { 0%,100% { opacity:0.6; } 50% { opacity:1; } }`}</style>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', minHeight: '60vh' }}>
          <div style={{ color: '#D4AF37', fontSize: '32px', animation: 'ccPulse 1.5s ease infinite' }}>◆</div>
          <div style={{ fontFamily: "'Cinzel', serif", color: 'rgba(10,35,66,0.4)', fontSize: '11px', letterSpacing: '3px' }}>LOADING</div>
        </div>
      </AdminLayout>
    );
  }

  const isMember = tier === 'navigator' || tier === 'accelerator' || isAdminUser;

  return (
    <AdminLayout currentPath={window.location.pathname}>
      <style>{globalStyles}</style>
      {isMember ? (
        <>
          {isAdminUser && (
            <div style={{ display: 'flex', gap: '0.5rem', padding: '1rem 1.5rem 0', borderBottom: '1px solid rgba(10,35,66,0.08)' }}>
              {([
                { key: 'feed',        label: 'Community Feed' },
                { key: 'accelerator', label: 'Accelerator Circle' },
                { key: 'leaderboard', label: 'Leaderboard' },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    fontFamily: "'Montserrat', sans-serif", fontSize: '0.65rem', fontWeight: 700,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    padding: '0.5rem 1rem', borderRadius: '8px 8px 0 0', cursor: 'pointer', border: 'none',
                    background: activeTab === tab.key ? '#0A2342' : 'transparent',
                    color: activeTab === tab.key ? '#D4AF37' : 'rgba(10,35,66,0.45)',
                    borderBottom: activeTab === tab.key ? '2px solid #D4AF37' : '2px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
          {activeTab === 'feed' && (
            <CommunityFeed
              tier={tier!}
              onShowLeaderboard={() => setActiveTab('leaderboard')}
            />
          )}
          {activeTab === 'accelerator' && (
            <AcceleratorCircleFeed tier={tier!} />
          )}
          {activeTab === 'leaderboard' && (
            <Leaderboard
              userId={userId}
              isAdmin={isAdminUser}
              tier={tier!}
              onBack={() => setActiveTab('feed')}
            />
          )}
        </>
      ) : (
        <CommunityJoin />
      )}
    </AdminLayout>
  );
}
