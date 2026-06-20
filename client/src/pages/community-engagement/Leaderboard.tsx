import { useState, useEffect } from 'react';
import { supabase } from '../community/types';
import type { Tier } from '../community/types';
import LevelBadge from './LevelBadge';
import MemberAvatar from '../community/MemberAvatar';
import MemberProfile from './MemberProfile';
import NavBar from '../../components/NavBar';
import { useCommunityLevels, getGapSignal } from '../../lib/communityLevels';

interface LeaderboardRow {
  id:              string;
  full_name:       string;
  photo_url:       string | null;
  community_level: string;
  pathway_stage:   string;
  clarity_points:  number;
  tier:            string;
  all_time_rank:   number;
  weekly_points:   number;
  weekly_rank:     number;
}

// =============================================================================
// LEADERBOARD
// =============================================================================
export default function Leaderboard({
  userId,
  isAdmin,
  tier,
  onBack,
}: {
  userId:  string;
  isAdmin: boolean;
  tier:    Tier;
  onBack:  () => void;
}) {
  const [view,             setView]             = useState<'weekly' | 'alltime'>('weekly');
  const [rows,             setRows]             = useState<LeaderboardRow[]>([]);
  const [myRow,            setMyRow]            = useState<LeaderboardRow | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const levels = useCommunityLevels();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.from('community_leaderboard').select('*');
      if (!data) { setLoading(false); return; }
      const all = data as LeaderboardRow[];
      const sorted = view === 'weekly'
        ? [...all].sort((a, b) => a.weekly_rank - b.weekly_rank)
        : [...all].sort((a, b) => a.all_time_rank - b.all_time_rank);
      setRows(sorted.slice(0, 10));
      const me = all.find(r => r.id === userId);
      if (me) {
        const r = view === 'weekly' ? me.weekly_rank : me.all_time_rank;
        setMyRow(r > 10 ? me : null);
      } else { setMyRow(null); }
      setLoading(false);
    };
    load();
  }, [view, userId]);

  const getRowRank = (r: LeaderboardRow) => view === 'weekly' ? r.weekly_rank  : r.all_time_rank;
  const getRowPts  = (r: LeaderboardRow) => view === 'weekly' ? r.weekly_points : r.clarity_points;
  const medal      = (n: number) => n === 1 ? '🥇' : n === 2 ? '🥈' : n === 3 ? '🥉' : null;
  const mob = typeof window !== 'undefined' && window.innerWidth < 768;
  const colTemplate = mob
    ? (isAdmin ? '32px 1fr 70px 80px' : '32px 1fr 80px')
    : (isAdmin ? '40px 1fr 110px 120px' : '40px 1fr 120px');

  const renderRow = (row: LeaderboardRow, isMe: boolean) => {
    const r   = getRowRank(row);
    const p   = getRowPts(row);
    const gap = isAdmin ? getGapSignal(row.community_level, row.pathway_stage, levels) : null;
    return (
      <div
        key={row.id}
        style={{ display: 'grid', gridTemplateColumns: colTemplate, alignItems: 'center', gap: '12px', padding: '14px 20px', background: isMe ? '#FFFBEE' : '#FFFFFF', borderBottom: '1px solid #F0EDE8', borderLeft: isMe ? '3px solid #D4AF37' : '3px solid transparent', transition: 'background 0.15s ease' }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = isMe ? '#FFF8E1' : '#FAFAF8'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isMe ? '#FFFBEE' : '#FFFFFF'; }}
      >
        {/* Rank */}
        <div style={{ textAlign: 'center', fontFamily: "'Montserrat', sans-serif", fontWeight: '700', fontSize: r <= 3 ? '18px' : '13px', color: 'rgba(10,35,66,0.3)' }}>
          {medal(r) ?? r}
        </div>

        {/* Avatar + Name — clickable */}
        <button
          onClick={() => setSelectedMemberId(row.id)}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
        >
          <MemberAvatar firstName={row.full_name} photoUrl={row.photo_url ?? undefined} size={34} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '13px', fontWeight: '600', color: '#0A2342', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px', transition: 'color 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLSpanElement).style.color = '#B8941F'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLSpanElement).style.color = '#0A2342'; }}
              >
                {row.full_name}{isMe ? ' (you)' : ''}
              </span>
              <LevelBadge level={row.community_level} />
            </div>
            {isAdmin && (
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '10px', color: 'rgba(10,35,66,0.4)', marginTop: '2px' }}>
                {row.pathway_stage ?? '—'}
              </div>
            )}
          </div>
        </button>

        {/* Points */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: '700', color: '#0A2342' }}>{p?.toLocaleString() ?? '—'}</div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '10px', color: 'rgba(10,35,66,0.4)' }}>
            {view === 'weekly' ? 'this week' : 'Clarity Points™'}
          </div>
        </div>

        {/* Gap signal — admin only */}
        {isAdmin && (
          <div>
            {gap && (
              <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: '700', fontFamily: "'Montserrat', sans-serif", padding: '3px 8px', borderRadius: '4px', background: gap.bg, color: gap.color, letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                {gap.label}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#FAFAF8', display: 'flex', flexDirection: 'column' }}>
      <NavBar active="/community" />
      <main style={{ flex: 1, padding: mob ? '20px 12px 80px' : '40px 24px 80px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>

          <button
            onClick={() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); onBack(); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '600', color: 'rgba(10,35,66,0.45)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.5px', marginBottom: '20px', padding: 0, transition: 'color 0.15s ease' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#0A2342'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(10,35,66,0.45)'; }}
          >← Community Feed</button>

          <div style={{ marginBottom: '28px', animation: 'ccFadeIn 0.5s ease both' }}>
            <div style={{ color: '#B8941F', fontFamily: "'Cinzel', serif", fontSize: '10px', letterSpacing: '3px', fontWeight: '600', marginBottom: '8px' }}>DRU AI LEADERSHIP ECOSYSTEM™</div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h1 style={{ fontFamily: "'Cinzel', serif", color: '#0A2342', fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: '700', letterSpacing: '0.5px', lineHeight: '1.2' }}>Clarity Points™ Leaderboard</h1>
                <p style={{ color: 'rgba(10,35,66,0.45)', fontFamily: "'Montserrat', sans-serif", fontSize: '14px', marginTop: '8px' }}>Earn points by posting, commenting, and engaging with the community.</p>
              </div>
              <div style={{ display: 'flex', background: '#F1EFE8', borderRadius: '8px', padding: '3px', gap: '2px', alignSelf: 'flex-start', flexShrink: 0 }}>
                {(['weekly', 'alltime'] as const).map(v => (
                  <button key={v} onClick={() => setView(v)}
                    style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '600', letterSpacing: '0.3px', background: view === v ? '#FFFFFF' : 'transparent', color: view === v ? '#0A2342' : 'rgba(10,35,66,0.4)', boxShadow: view === v ? '0 1px 3px rgba(10,35,66,0.1)' : 'none', transition: 'all 0.15s ease' }}>
                    {v === 'weekly' ? 'This Week' : 'All-Time'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)', marginBottom: '28px' }} />

          {isAdmin && (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px', padding: '12px 16px', background: '#FAFAF8', border: '1px solid #E8E4DF', borderRadius: '8px' }}>
              {[
                { label: 'Hot Lead',       bg: '#ECC2D1', color: '#C2185B', tip: 'Engagement ahead of pathway — ready to buy' },
                { label: 'Aligned',        bg: '#D2DBE5', color: '#1B4D8E', tip: 'Getting full value at their stage'            },
                { label: 'Retention Risk', bg: '#F2EACE', color: '#947B27', tip: 'Pathway ahead of engagement — re-engage'      },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: '700', fontFamily: "'Montserrat', sans-serif", padding: '2px 8px', borderRadius: '4px', background: s.bg, color: s.color }}>{s.label}</span>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', color: 'rgba(10,35,66,0.4)' }}>{s.tip}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(10,35,66,0.06)', marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: colTemplate, gap: '12px', padding: '10px 20px', background: '#FAFAF8', borderBottom: '1px solid #E8E4DF' }}>
              {['#', 'MEMBER', 'POINTS', ...(isAdmin ? ['SIGNAL'] : [])].map((h, i) => (
                <div key={h} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '10px', fontWeight: '600', color: 'rgba(10,35,66,0.35)', letterSpacing: '0.5px', textAlign: i === 2 ? 'right' : 'left' }}>{h}</div>
              ))}
            </div>

            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ height: '64px', background: '#FFF', borderBottom: '1px solid #F0EDE8', animation: 'ccShimmer 1.5s ease infinite', animationDelay: `${i * 100}ms` }} />
              ))
            ) : rows.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', fontFamily: "'Montserrat', sans-serif", fontSize: '13px', color: 'rgba(10,35,66,0.35)' }}>
                No members ranked yet — start posting to earn Clarity Points™
              </div>
            ) : (
              rows.map(row => renderRow(row, row.id === userId))
            )}

            {!loading && myRow && (
              <>
                <div style={{ padding: '6px 20px', background: '#F5F3EF', borderTop: '1px dashed #E8E4DF' }}>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '10px', fontWeight: '600', color: 'rgba(10,35,66,0.4)', letterSpacing: '0.5px' }}>YOUR RANK</span>
                </div>
                {renderRow(myRow, true)}
              </>
            )}
          </div>

          <div style={{ padding: '14px 20px', background: '#FAFAF8', border: '1px solid #E8E4DF', borderRadius: '10px', display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '600', color: 'rgba(10,35,66,0.4)', letterSpacing: '0.5px', flexShrink: 0 }}>EARN POINTS:</span>
            {[
              { action: 'Post created',    pts: '+5 pts' },
              { action: 'Comment written', pts: '+2 pts' },
              { action: 'Heart received',  pts: '+1 pt'  },
            ].map(item => (
              <div key={item.action} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', color: 'rgba(10,35,66,0.55)' }}>{item.action}</span>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '700', color: '#B8941F', background: '#FFFBEE', padding: '1px 6px', borderRadius: '4px' }}>{item.pts}</span>
              </div>
            ))}
          </div>

        </div>
      </main>

      {selectedMemberId && (
        <MemberProfile
          profileUserId={selectedMemberId}
          viewerUserId={userId}
          isAdmin={isAdmin}
          onClose={() => setSelectedMemberId(null)}
        />
      )}

      <footer style={{ textAlign: 'center', padding: '1rem', color: 'rgba(10,35,66,0.25)', fontFamily: "'Montserrat', sans-serif", fontSize: '0.65rem', letterSpacing: '0.04em', borderTop: '1px solid #E8E4DF' }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
