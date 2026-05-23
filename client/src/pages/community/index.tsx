import { useState, useEffect } from 'react';
import { supabase } from './types';
import type { Tier } from './types';
import CommunityFeed from './CommunityFeed';
import CommunityJoin from './CommunityJoin';

// =============================================================================
// COMMUNITY — smart detection, renders Feed or Join page
// =============================================================================
export default function Community() {
  const [tier, setTier]               = useState<Tier | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [checking, setChecking]       = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setTier('free'); setChecking(false); return; }
        const admin = user.email?.toLowerCase() === import.meta.env.VITE_ADMIN_EMAIL?.toLowerCase();
        setIsAdminUser(admin);
        const { data } = await supabase.from('profiles').select('tier').eq('id', user.id).maybeSingle();
        // Admin always gets full access — treat as accelerator so all content is visible
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
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600&family=Montserrat:wght@500&display=swap');
          @keyframes ccPulse { 0%,100% { opacity:0.6; } 50% { opacity:1; } }
        `}</style>
        <div style={{ minHeight: '100dvh', background: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
          <div style={{ color: '#D4AF37', fontSize: '32px', animation: 'ccPulse 1.5s ease infinite' }}>◆</div>
          <div style={{ fontFamily: "'Cinzel', serif", color: 'rgba(10,35,66,0.4)', fontSize: '11px', letterSpacing: '3px' }}>LOADING</div>
        </div>
      </>
    );
  }

  // Admin always gets feed. Members need navigator or accelerator tier.
  const isMember = tier === 'navigator' || tier === 'accelerator' || isAdminUser;

  return (
    <>
      <style>{globalStyles}</style>
      {isMember ? <CommunityFeed tier={tier!} /> : <CommunityJoin />}
    </>
  );
}
