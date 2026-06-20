import { useState, useEffect } from 'react';
import { supabase, formatRelativeTime } from '../community/types';
import LevelBadge from './LevelBadge';
import MemberAvatar from '../community/MemberAvatar';
import { useCommunityLevels, getGapSignal, PATHWAY_STAGES, DEFAULT_LEVEL_NAME } from '../../lib/communityLevels';

const PATHWAY_COPY: Record<string, string> = {
  Discover: 'Your AI readiness score is your starting point. Your transformation journey begins here.',
  Diagnose: "You're in the Diagnose phase — your diagnostic deep-dive is where your transformation accelerates.",
  Design:   "You're in the Design phase — you're building the AI leadership blueprint for your organization.",
  Deploy:   "You're in the Deploy phase — your AI leadership strategy is actively in motion.",
  Dominate: "You've reached Dominate — you're driving AI-powered transformation across your entire ecosystem.",
};

const CATEGORY_STYLES: Record<string, { bg: string; color: string }> = {
  win:       { bg: '#EAF3DE', color: '#27500A' },
  question:  { bg: '#E6F1FB', color: '#0C447C' },
  resource:  { bg: '#EEEDFE', color: '#3C3489' },
  challenge: { bg: '#FBEAF0', color: '#72243E' },
};

interface ProfileData {
  first_name:      string;
  last_name:       string;
  photo_url:       string | null;
  community_level: string;
  clarity_points:  number;
  pathway_stage:   string | null;
  tier:            string;
}

interface RankData {
  weekly_rank:   number;
  all_time_rank: number;
}

interface RecentPost {
  id:           string;
  content:      string;
  category:     string;
  published_at: string;
}

// =============================================================================
// MEMBER PROFILE — modal overlay
// =============================================================================
export default function MemberProfile({
  profileUserId,
  viewerUserId,
  isAdmin,
  onClose,
}: {
  profileUserId: string;
  viewerUserId:  string;
  isAdmin:       boolean;
  onClose:       () => void;
}) {
  const [profile,     setProfile]     = useState<ProfileData | null>(null);
  const [rankData,    setRankData]    = useState<RankData | null>(null);
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    const load = async () => {
      const [profileRes, rankRes, postsRes] = await Promise.all([
        supabase.from('profiles')
          .select('first_name, last_name, photo_url, community_level, clarity_points, pathway_stage, tier')
          .eq('id', profileUserId).single(),
        supabase.from('community_leaderboard')
          .select('weekly_rank, all_time_rank')
          .eq('id', profileUserId).maybeSingle(),
        supabase.from('community_posts')
          .select('id, content, category, published_at')
          .eq('agent_id', profileUserId)
          .eq('is_active', true)
          .eq('post_type', 'member_post')
          .order('published_at', { ascending: false })
          .limit(3),
      ]);
      setProfile(profileRes.data as ProfileData);
      setRankData(rankRes.data as RankData | null);
      setRecentPosts((postsRes.data ?? []) as RecentPost[]);
      setLoading(false);
    };
    load();
  }, [profileUserId]);

  const levels = useCommunityLevels();
  const isSelf   = profileUserId === viewerUserId;
  const fullName = profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : '';

  const gap = isAdmin && profile
    ? getGapSignal(profile.community_level, profile.pathway_stage ?? '', levels)
    : null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,35,66,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#FFFFFF', borderRadius: '16px', width: '100%', maxWidth: '520px', maxHeight: '88vh', overflowY: 'auto', padding: '32px', position: 'relative', animation: 'ccFadeIn 0.3s ease both', boxShadow: '0 24px 64px rgba(10,35,66,0.2)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '20px', right: '20px', background: '#F1EFE8', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: 'rgba(10,35,66,0.45)', transition: 'all 0.15s', lineHeight: 1 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#E8E4DF'; (e.currentTarget as HTMLButtonElement).style.color = '#0A2342'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F1EFE8'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(10,35,66,0.45)'; }}
        >×</button>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '16px' }}>
            {[70, 100, 50, 90].map((w, i) => (
              <div key={i} style={{ height: '18px', width: `${w}%`, background: '#F1EFE8', borderRadius: '6px', animation: 'ccShimmer 1.5s ease infinite', animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        ) : !profile ? (
          <div style={{ textAlign: 'center', color: 'rgba(10,35,66,0.35)', fontFamily: "'Montserrat', sans-serif", fontSize: '13px', padding: '32px 0' }}>Profile not found.</div>
        ) : (
          <>
            {/* ── Header ──────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '24px', paddingRight: '40px' }}>
              <MemberAvatar firstName={profile.first_name} photoUrl={profile.photo_url ?? undefined} size={64} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: '20px', fontWeight: '700', color: '#0A2342', margin: 0, lineHeight: 1.2 }}>
                    {fullName || profile.first_name}
                  </h2>
                  {isSelf && (
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', color: 'rgba(10,35,66,0.35)', fontWeight: '600' }}>(you)</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <LevelBadge level={profile.community_level || DEFAULT_LEVEL_NAME} />
                  {gap && (
                    <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: '700', fontFamily: "'Montserrat', sans-serif", padding: '2px 8px', borderRadius: '4px', background: gap.bg, color: gap.color }}>
                      {gap.label}
                    </span>
                  )}
                  {isAdmin && (
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '10px', color: 'rgba(10,35,66,0.35)', fontWeight: '600', textTransform: 'capitalize' as const }}>
                      {profile.tier}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)', marginBottom: '20px' }} />

            {/* ── Stats ───────────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
              {[
                { label: 'Clarity Points™', value: (profile.clarity_points ?? 0).toLocaleString() },
                { label: 'This Week',        value: rankData?.weekly_rank   ? `#${rankData.weekly_rank}`   : '—' },
                { label: 'All-Time',         value: rankData?.all_time_rank ? `#${rankData.all_time_rank}` : '—' },
              ].map(stat => (
                <div key={stat.label} style={{ background: '#FAFAF8', border: '1px solid #E8E4DF', borderRadius: '10px', padding: '14px 10px', textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '18px', fontWeight: '700', color: '#0A2342', marginBottom: '4px' }}>{stat.value}</div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '10px', fontWeight: '600', color: 'rgba(10,35,66,0.4)', letterSpacing: '0.3px' }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* ── Pathway stage — self only ────────────────────────────────── */}
            {isSelf && profile.pathway_stage && (
              <div style={{ background: '#F7F5EE', border: '1px solid #E8E4DF', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                <div style={{ color: '#B8941F', fontFamily: "'Cinzel', serif", fontSize: '10px', letterSpacing: '2px', fontWeight: '600', marginBottom: '16px' }}>
                  DRU AI TRANSFORMATION PATHWAY™
                </div>
                {/* Step indicator */}
                <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {PATHWAY_STAGES.map((stage, i) => {
                    const isCurrent  = stage === profile.pathway_stage;
                    const isComplete = PATHWAY_STAGES.indexOf(stage) < PATHWAY_STAGES.indexOf((profile.pathway_stage ?? '') as typeof PATHWAY_STAGES[number]);
                    return (
                      <div key={stage} style={{ display: 'flex', alignItems: 'flex-start', flexShrink: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                            background: isCurrent ? '#0A2342' : isComplete ? '#D4AF37' : '#E8E4DF',
                            border: `2px solid ${isCurrent ? '#0A2342' : isComplete ? '#D4AF37' : '#D0CCC5'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {isComplete && <span style={{ color: '#FFF', fontSize: '11px', fontWeight: '700' }}>✓</span>}
                            {isCurrent  && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D4AF37', display: 'block' }} />}
                          </div>
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '9px', fontWeight: isCurrent ? '700' : '500', color: isCurrent ? '#0A2342' : isComplete ? '#B8941F' : 'rgba(10,35,66,0.3)', whiteSpace: 'nowrap', textAlign: 'center' }}>
                            {stage}
                          </span>
                        </div>
                        {i < PATHWAY_STAGES.length - 1 && (
                          <div style={{ width: '20px', height: '2px', background: isComplete ? '#D4AF37' : '#E8E4DF', margin: '13px 3px 0', flexShrink: 0 }} />
                        )}
                      </div>
                    );
                  })}
                </div>
                <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '12px', color: 'rgba(10,35,66,0.6)', lineHeight: '1.7', margin: 0 }}>
                  {PATHWAY_COPY[profile.pathway_stage] ?? ''}
                </p>
              </div>
            )}

            {/* ── Recent posts ─────────────────────────────────────────────── */}
            {recentPosts.length > 0 && (
              <div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '600', color: 'rgba(10,35,66,0.4)', letterSpacing: '0.5px', marginBottom: '10px' }}>RECENT POSTS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {recentPosts.map(p => {
                    const catStyle = p.category && p.category !== 'general' ? CATEGORY_STYLES[p.category] : null;
                    return (
                      <div key={p.id} style={{ background: '#FAFAF8', border: '1px solid #E8E4DF', borderRadius: '8px', padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          {catStyle && (
                            <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: '700', fontFamily: "'Montserrat', sans-serif", padding: '2px 8px', borderRadius: '4px', background: catStyle.bg, color: catStyle.color }}>
                              {p.category.charAt(0).toUpperCase() + p.category.slice(1)}
                            </span>
                          )}
                          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', color: 'rgba(10,35,66,0.35)' }}>
                            {formatRelativeTime(p.published_at)}
                          </span>
                        </div>
                        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '12px', color: 'rgba(10,35,66,0.6)', lineHeight: '1.6', margin: 0 }}>
                          {p.content.trim().slice(0, 120)}{p.content.trim().length > 120 ? '…' : ''}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
