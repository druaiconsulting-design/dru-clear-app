import { useState, useEffect, useCallback } from 'react';
import { supabase, tierLabel, tierDotColor, ACCELERATOR_PAYMENT_LINK } from './types';
import type { CommunityPost, Tier } from './types';
import NavBar from '../../components/NavBar';
import ComposeBox from './ComposeBox';
import PostCard from './PostCard';
import { NotificationBell, SettingsPanel } from './NotificationBell';
import MemberProfile from '../community-engagement/MemberProfile';

// =============================================================================
// COMMUNITY FEED
// =============================================================================
export default function CommunityFeed({
  tier,
  onShowLeaderboard,
}: {
  tier:               Tier;
  onShowLeaderboard?: () => void;
}) {
  const [posts, setPosts]         = useState<CommunityPost[]>([]);
  const [loading, setLoading]     = useState(true);
  const [liveCount, setLiveCount] = useState(0);
  const [pdfs, setPdfs]           = useState<{ name: string; url: string }[]>([]);
  const [showArchives, setShowArchives] = useState(false);
  const [userId, setUserId]       = useState('');
  const [userName, setUserName]   = useState('');
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | undefined>();
  const [isAdmin, setIsAdmin]     = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [photoMap, setPhotoMap]   = useState<Record<string, string>>({});
  const [levelMap, setLevelMap]   = useState<Record<string, string>>({});
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const loadPdfs = useCallback(async () => {
    const { data, error } = await supabase.storage.from('pdfs').list('', { sortBy: { column: 'created_at', order: 'desc' } });
    if (error || !data) return;
    setPdfs(data.filter(f => f.name.startsWith('CC_Framework_Training')).map(f => ({
      name: f.name.replace(/_/g, ' ').replace('.pdf', ''),
      url:  supabase.storage.from('pdfs').getPublicUrl(f.name).data.publicUrl,
    })));
  }, []);

  const cacheMemberProfile = useCallback((uid: string, photoUrl?: string, level?: string) => {
    if (photoUrl) setPhotoMap(m => ({ ...m, [uid]: photoUrl }));
    if (level)    setLevelMap(m => ({ ...m, [uid]: level }));
  }, []);

  const loadPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from('community_posts').select('*')
      .eq('is_active', true)
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(50);
    if (error) { console.error('[community feed]', error); return []; }
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

  const registerPush = useCallback(async (uid: string) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
      const reg      = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) return;
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      const sub      = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey });
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch('/api/subscribe-push', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }, body: JSON.stringify({ subscription: sub }) });
    } catch (err) { console.error('[push register]', err); }
  }, []);

  const requestPushPermission = useCallback(async (uid: string) => {
    if (!('Notification' in window) || Notification.permission !== 'default') return;
    setTimeout(async () => {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') registerPush(uid);
    }, 3000);
  }, [registerPush]);

  useEffect(() => {
    let mounted = true;
    loadPosts().then(loaded => { if (mounted) { setPosts(loaded); setLoading(false); } });
    loadPdfs();
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
      requestPushPermission(user.id);
      registerPush(user.id);
    });

    const channel = supabase.channel('community_posts_live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'community_posts' }, (payload) => {
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_posts' }, (payload) => {
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
    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [loadPosts, loadPdfs, requestPushPermission, registerPush, cacheMemberProfile]);

  const handleMemberPost = useCallback((post: CommunityPost) => {
    setPosts(prev => [post, ...prev]);
    if (post.post_type === 'member_post' && post.agent_id) {
      supabase.from('profiles').select('id, photo_url, community_level').eq('id', post.agent_id).single()
        .then(({ data }) => { if (data) cacheMemberProfile(data.id, data.photo_url, data.community_level); });
    }
  }, [cacheMemberProfile]);

  // Re-sort feed after a pin change without a full reload
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
    <div style={{ minHeight: '100dvh', background: '#FAFAF8', display: 'flex', flexDirection: 'column' }}>
      <NavBar active="/community" />
      <main style={{ flex: 1, padding: '40px 24px 80px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>

          {/* Page header */}
          <div style={{ marginBottom: '32px', animation: 'ccFadeIn 0.5s ease both' }}>
            <a href="/portal"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '600', color: 'rgba(10,35,66,0.45)', textDecoration: 'none', letterSpacing: '0.5px', marginBottom: '20px', transition: 'color 0.15s ease' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#0A2342'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(10,35,66,0.45)'; }}>
              ← Back to Portal
            </a>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ color: '#B8941F', fontFamily: "'Cinzel', serif", fontSize: '10px', letterSpacing: '3px', fontWeight: '600', marginBottom: '8px' }}>DRU AI LEADERSHIP ECOSYSTEM™</div>
                <h1 style={{ fontFamily: "'Cinzel', serif", color: '#0A2342', fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: '700', letterSpacing: '0.5px', lineHeight: '1.2' }}>Community Connection</h1>
                <p style={{ color: 'rgba(10,35,66,0.45)', fontFamily: "'Montserrat', sans-serif", fontSize: '14px', marginTop: '8px' }}>Share your thoughts, ask questions, connect and collaborate with like-minded leaders.</p>
                <p style={{ color: 'rgba(10,35,66,0.45)', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', marginTop: '5px', fontWeight: '600' }}>Soliciting and self-promotion are prohibited; violation will result in removal from the membership.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', alignSelf: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: '8px', padding: '8px 16px', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', color: 'rgba(10,35,66,0.5)', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 1px 3px rgba(10,35,66,0.06)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: tierDotColor(tier), flexShrink: 0 }} />{tierLabel(tier)}
                </div>
                {onShowLeaderboard && (
                  <button
                    onClick={() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); onShowLeaderboard(); }}
                    style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: '8px', padding: '8px 14px', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '600', color: 'rgba(10,35,66,0.5)', cursor: 'pointer', letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: '0 1px 3px rgba(10,35,66,0.06)', transition: 'all 0.15s ease' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#0A2342'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(10,35,66,0.25)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(10,35,66,0.5)'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#E8E4DF'; }}>
                    <span>🏆</span><span>Leaderboard</span>
                  </button>
                )}
                {userId && (
                  <NotificationBell userId={userId} userFirstName={userName} userPhotoUrl={userPhotoUrl} onOpenSettings={() => setSettingsOpen(true)} />
                )}
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
            <>
              {pdfs.length > 0 && (
                <div style={{ marginBottom: '28px' }}>
                  <a href={pdfs[0].url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', border: '1px solid #E8E4DF', borderLeft: '4px solid #0A2342', borderRadius: '10px', padding: '18px 24px', textDecoration: 'none', boxShadow: '0 1px 4px rgba(10,35,66,0.06)', transition: 'box-shadow 0.2s ease' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 16px rgba(10,35,66,0.1)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 1px 4px rgba(10,35,66,0.06)'; }}>
                    <div>
                      <div style={{ color: '#0A2342', fontFamily: "'Cinzel', serif", fontSize: '10px', letterSpacing: '2px', fontWeight: '600', marginBottom: '4px' }}>THIS WEEK</div>
                      <div style={{ color: '#0A2342', fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: '600' }}>Weekly Framework Training Content</div>
                    </div>
                    <div style={{ background: '#0A2342', color: '#fff', padding: '8px 16px', borderRadius: '6px', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '700', letterSpacing: '1px', whiteSpace: 'nowrap', flexShrink: 0 }}>DOWNLOAD ↓</div>
                  </a>
                  {pdfs.length > 1 && (
                    <div style={{ marginTop: '10px' }}>
                      <button onClick={() => setShowArchives(!showArchives)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(10,35,66,0.45)', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '600', letterSpacing: '0.5px', padding: '6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {showArchives ? '↑ Hide Archives' : '↓ Archives'}
                      </button>
                      {showArchives && (
                        <div style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: '10px', overflow: 'hidden', marginTop: '8px' }}>
                          {pdfs.slice(1).map((pdf, i) => (
                            <a key={pdf.name} href={pdf.url} target="_blank" rel="noopener noreferrer"
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < pdfs.length - 2 ? '1px solid #F0EDE8' : 'none', textDecoration: 'none', transition: 'background 0.15s ease' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#FAFAF8'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#FFFFFF'; }}>
                              <span style={{ color: 'rgba(10,35,66,0.65)', fontFamily: "'Montserrat', sans-serif", fontSize: '13px' }}>{pdf.name}</span>
                              <span style={{ color: '#B8941F', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '700', letterSpacing: '1px' }}>DOWNLOAD ↓</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <ComposeBox userId={userId} userName={userName} userPhotoUrl={userPhotoUrl} onPostSubmitted={handleMemberPost} />
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
            </>
          )}
        </div>
      </main>

      {tier === 'navigator' && (
        <a href={ACCELERATOR_PAYMENT_LINK} target="_blank" rel="noopener noreferrer"
          style={{ position: 'fixed', bottom: '28px', right: '28px', background: '#B8941F', color: '#fff', padding: '8px 16px', borderRadius: '20px', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', textDecoration: 'none', boxShadow: '0 2px 12px rgba(184,148,31,0.3)', zIndex: 50, display: 'flex', alignItems: 'center', gap: '6px', transition: 'opacity 0.2s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.85'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}>
          ↑ Upgrade
        </a>
      )}

      {settingsOpen && userId && (
        <SettingsPanel userId={userId} userFirstName={userName} userPhotoUrl={userPhotoUrl} onClose={() => setSettingsOpen(false)} onPhotoUpdate={url => setUserPhotoUrl(url)} />
      )}

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
