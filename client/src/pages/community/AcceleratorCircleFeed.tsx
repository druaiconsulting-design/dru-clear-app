import { useState, useEffect, useCallback } from 'react';
import { supabase } from './types';
import type { CommunityPost, Tier } from './types';
import ACCComposeBox from './ACCComposeBox';
import PostCard from './PostCard';
import MemberProfile from '../community-engagement/MemberProfile';

// =============================================================================
// ACCELERATOR CIRCLE FEED
// =============================================================================
export default function AcceleratorCircleFeed({
  tier,
}: {
  tier: Tier;
}) {
  const [posts, setPosts]         = useState<CommunityPost[]>([]);
  const [loading, setLoading]     = useState(true);
  const [liveCount, setLiveCount] = useState(0);
  const [userId, setUserId]       = useState('');
  const [userName, setUserName]   = useState('');
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | undefined>();
  const [isAdmin, setIsAdmin]     = useState(false);
  const [photoMap, setPhotoMap]   = useState<Record<string, string>>({});
  const [levelMap, setLevelMap]   = useState<Record<string, string>>({});
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const cacheMemberProfile = useCallback((uid: string, photoUrl?: string, level?: string) => {
    if (photoUrl) setPhotoMap(m => ({ ...m, [uid]: photoUrl }));
    if (level)    setLevelMap(m => ({ ...m, [uid]: level }));
  }, []);

  const loadPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from('community_posts').select('*')
      .eq('is_active', true)
      .eq('channel', 'accelerator_circle')
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(50);
    if (error) { console.error('[acc circle feed]', error); return []; }
    const loaded = (data ?? []) as CommunityPost[];

    const memberIds = [...new Set(
      loaded.filter(p => p.post_type === 'member_post' && p.agent_id).map(p => p.agent_id)
    )];
    if (memberIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles').select('id, photo_url, community_level').in('id', memberIds);
      const pm: Record<string, string> = {};
      const lm: Record<string, string> = {};
      (profiles ?? []).forEach((p: any) => {
        if (p.photo_url)       pm[p.id] = p.photo_url;
        if (p.community_level) lm[p.id] = p.community_level;
      });
      setPhotoMap(pm);
      setLevelMap(lm);
    }
    return loaded;
  }, []);

  useEffect(() => {
    let mounted = true;
    loadPosts().then(loaded => { if (mounted) { setPosts(loaded); setLoading(false); } });

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!mounted || !user) return;
      setUserId(user.id);
      setIsAdmin(user.email?.toLowerCase() === import.meta.env.VITE_ADMIN_EMAIL?.toLowerCase());
      supabase.from('profiles').select('first_name, photo_url, community_level').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) {
            setUserName(data.first_name ?? '');
            setUserPhotoUrl(data.photo_url ?? user.user_metadata?.avatar_url ?? undefined);
            if (data.community_level) setLevelMap(m => ({ ...m, [user.id]: data.community_level }));
          }
        });
    });

    const realtimeChannel = supabase.channel('acc_circle_posts_live')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'community_posts',
        filter: 'channel=eq.accelerator_circle',
      }, (payload) => {
        const updated = payload.new as CommunityPost;
        if (updated.is_active) {
          setPosts(prev => {
            const exists = prev.find(p => p.id === updated.id);
            if (exists) return prev.map(p => p.id === updated.id ? updated : p);
            setLiveCount(c => c + 1);
            return [updated, ...prev];
          });
        }
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'community_posts',
        filter: 'channel=eq.accelerator_circle',
      }, (payload) => {
        const newPost = payload.new as CommunityPost;
        if (newPost.is_active) {
          setPosts(prev => {
            if (prev.find(p => p.id === newPost.id)) return prev;
            setLiveCount(c => c + 1);
            if (newPost.post_type === 'member_post' && newPost.agent_id) {
              supabase.from('profiles').select('id, photo_url, community_level').eq('id', newPost.agent_id).single()
                .then(({ data }) => { if (data) cacheMemberProfile(data.id, data.photo_url, data.community_level); });
            }
            return [newPost, ...prev];
          });
        }
      })
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(realtimeChannel); };
  }, [loadPosts, cacheMemberProfile]);

  const handleMemberPost = useCallback((post: CommunityPost) => {
    setPosts(prev => [post, ...prev]);
    if (post.post_type === 'member_post' && post.agent_id) {
      supabase.from('profiles').select('id, photo_url, community_level').eq('id', post.agent_id).single()
        .then(({ data }) => { if (data) cacheMemberProfile(data.id, data.photo_url, data.community_level); });
    }
  }, [cacheMemberProfile]);

  const handlePinChange = useCallback((postId: string, pinned: boolean) => {
    setPosts(prev => {
      const updated = prev.map(p => p.id === postId ? { ...p, is_pinned: pinned } as CommunityPost : p);
      return [...updated].sort((a, b) => {
        const ap = (a as any).is_pinned ? 1 : 0;
        const bp = (b as any).is_pinned ? 1 : 0;
        if (bp !== ap) return bp - ap;
        return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
      });
    });
  }, []);

  return (
    <div style={{ minHeight: '100%', background: '#FAFAF8', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1, padding: typeof window !== 'undefined' && window.innerWidth < 768 ? '20px 12px 80px' : '40px 24px 80px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>

          {/* Page header */}
          <div style={{ marginBottom: '32px', animation: 'ccFadeIn 0.5s ease both' }}>
            <a href="/community"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '600', color: 'rgba(10,35,66,0.45)', textDecoration: 'none', letterSpacing: '0.5px', marginBottom: '20px', transition: 'color 0.15s ease' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#0A2342'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(10,35,66,0.45)'; }}>
              ← Back to Community
            </a>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ color: '#B8941F', fontFamily: "'Cinzel', serif", fontSize: '10px', letterSpacing: '3px', fontWeight: '600', marginBottom: '8px' }}>DRU AI LEADERSHIP ECOSYSTEM™</div>
                <h1 style={{ fontFamily: "'Cinzel', serif", color: '#0A2342', fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: '700', letterSpacing: '0.5px', lineHeight: '1.2' }}>Accelerator Circle</h1>
                <p style={{ color: 'rgba(10,35,66,0.45)', fontFamily: "'Montserrat', sans-serif", fontSize: '14px', marginTop: '8px' }}>Executive peer conversations. High-stakes questions, real implementation, no small talk.</p>
                <p style={{ color: 'rgba(10,35,66,0.45)', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', marginTop: '5px', fontWeight: '600' }}>Soliciting and self-promotion are prohibited; violation will result in removal from the membership.</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', alignSelf: 'flex-start' }}>
                <button
                  onClick={() => { window.location.href = '/leaderboard'; }}
                  style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: '8px', padding: '8px 14px', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '600', color: 'rgba(10,35,66,0.5)', cursor: 'pointer', letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: '0 1px 3px rgba(10,35,66,0.06)', transition: 'all 0.15s ease' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#0A2342'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(10,35,66,0.25)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(10,35,66,0.5)'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#E8E4DF'; }}>
                  <span>🏆</span><span>Leaderboard</span>
                </button>
              </div>
            </div>

            {liveCount > 0 && (
              <button
                onClick={() => { setLiveCount(0); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                style={{ marginTop: '14px', background: '#FFFBEE', border: '1px solid #F0D980', color: '#7A5C00', padding: '7px 16px', borderRadius: '6px', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '600', letterSpacing: '0.5px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                ↑ {liveCount} new post{liveCount > 1 ? 's' : ''}
              </button>
            )}
          </div>

          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)', marginBottom: '28px' }} />

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ background: '#FFF', border: '1px solid #E8E4DF', borderRadius: '12px', height: '180px', animation: 'ccShimmer 1.5s ease infinite', animationDelay: `${i*150}ms` }} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <ACCComposeBox
                userId={userId}
                userName={userName}
                userPhotoUrl={userPhotoUrl}
                onPostSubmitted={handleMemberPost}
              />
              {posts.map((post, i) => (
                <PostCard
                  key={post.id} post={post} index={i}
                  userId={userId} userName={userName} userPhotoUrl={userPhotoUrl}
                  isAdmin={isAdmin} photoMap={photoMap} levelMap={levelMap}
                  onMemberClick={setSelectedMemberId}
                  onPinChange={handlePinChange}
                />
              ))}
            </div>
          )}
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
    </div>
  );
}
