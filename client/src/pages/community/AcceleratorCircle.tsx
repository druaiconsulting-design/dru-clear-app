import { useState, useEffect, useCallback } from 'react';
import { supabase } from './types';
import type { CommunityPost } from './types';
import ACCComposeBox from './ACCComposeBox';
import PostCard from './PostCard';
import MemberAvatar from './MemberAvatar';
import MemberProfile from '../community-engagement/MemberProfile';

interface AccMember {
  id:              string;
  first_name:      string | null;
  photo_url:       string | null;
  community_level: string | null;
}

// =============================================================================
// ACCELERATOR CIRCLE FEED (Admin)
// =============================================================================
export default function AcceleratorCircleFeed({
  tier,
}: {
  tier: string;
}) {
  const [posts,            setPosts]            = useState<CommunityPost[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [memberCount,      setMemberCount]      = useState(0);
  const [memberAvatars,    setMemberAvatars]    = useState<AccMember[]>([]);
  const [userId,           setUserId]           = useState('');
  const [userName,         setUserName]         = useState('');
  const [userPhotoUrl,     setUserPhotoUrl]     = useState<string | undefined>();
  const [isAdmin,          setIsAdmin]          = useState(false);
  const [photoMap,         setPhotoMap]         = useState<Record<string, string>>({});
  const [levelMap,         setLevelMap]         = useState<Record<string, string>>({});
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Agent (non-human) avatars — pulled live from Supabase `agents` table.
  // Never hardcode a photo URL here: swap the file in agents-photos + update
  // agents.photo_url in Supabase, and it updates everywhere automatically.
  const [agentPhotoBySlug, setAgentPhotoBySlug] = useState<Record<string, string>>({});
  const [agentPhotoByName, setAgentPhotoByName] = useState<Record<string, string>>({});

  const loadAgentPhotos = useCallback(async () => {
    const { data, error } = await supabase.from('agents').select('slug, name, photo_url');
    if (error || !data) { console.error('[agent photos]', error); return; }
    const bySlug: Record<string, string> = {};
    const byName: Record<string, string> = {};
    data.forEach((a: any) => {
      if (a.photo_url && a.slug) bySlug[a.slug] = a.photo_url;
      if (a.photo_url && a.name) byName[a.name] = a.photo_url;
    });
    setAgentPhotoBySlug(bySlug);
    setAgentPhotoByName(byName);
  }, []);

  const cacheMemberProfile = useCallback((uid: string, photoUrl?: string, level?: string) => {
    if (photoUrl) setPhotoMap(m => ({ ...m, [uid]: photoUrl }));
    if (level)    setLevelMap(m => ({ ...m, [uid]: level }));
  }, []);

  const loadCircle = useCallback(async () => {
    setLoading(true);

    // Load accelerator member profiles for count + avatars
    const { data: accProfiles } = await supabase
      .from('profiles')
      .select('id, first_name, photo_url, community_level')
      .eq('tier', 'accelerator');

    const members = (accProfiles ?? []) as AccMember[];
    setMemberCount(members.length);
    setMemberAvatars(members.slice(0, 5));

    const pm: Record<string, string> = {};
    const lm: Record<string, string> = {};
    members.forEach(m => {
      if (m.photo_url)       pm[m.id] = m.photo_url;
      if (m.community_level) lm[m.id] = m.community_level;
    });
    setPhotoMap(pm);
    setLevelMap(lm);

    // Load posts tagged for the Accelerator Circle
    const { data: postsData, error } = await supabase
      .from('community_posts')
      .select('*')
      .eq('is_active', true)
      .eq('tier_required', 'accelerator')
      .order('is_pinned',    { ascending: false })
      .order('published_at', { ascending: false })
      .limit(50);

    if (error) console.error('[acc circle feed]', error);
    setPosts((postsData ?? []) as CommunityPost[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!mounted || !user) return;
      setUserId(user.id);
      const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
      setIsAdmin(user.email?.toLowerCase() === adminEmail?.toLowerCase());
      supabase.from('profiles').select('first_name, photo_url, community_level').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) {
            setUserName(data.first_name ?? '');
            setUserPhotoUrl(data.photo_url ?? user.user_metadata?.avatar_url ?? undefined);
            if (data.community_level) setLevelMap(m => ({ ...m, [user.id]: data.community_level }));
          }
        });
    });

    loadCircle();
    loadAgentPhotos();

    const realtimeChannel = supabase.channel('acc_circle_posts_live')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'community_posts',
        filter: 'tier_required=eq.accelerator',
      }, (payload) => {
        const newPost = payload.new as CommunityPost;
        if (!newPost.is_active || newPost.tier_required !== 'accelerator') return;
        setPosts(prev => prev.find(p => p.id === newPost.id) ? prev : [newPost, ...prev]);
        if (newPost.agent_id) {
          supabase.from('profiles').select('id, photo_url, community_level').eq('id', newPost.agent_id).single()
            .then(({ data }) => { if (data) cacheMemberProfile(data.id, data.photo_url, data.community_level); });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'community_posts',
        filter: 'tier_required=eq.accelerator',
      }, (payload) => {
        const updated = payload.new as CommunityPost;
        if (updated.is_active && updated.tier_required === 'accelerator') {
          setPosts(prev => {
            const exists = prev.find(p => p.id === updated.id);
            if (exists) return prev.map(p => p.id === updated.id ? updated : p);
            return [updated, ...prev];
          });
        }
      })
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(realtimeChannel); };
  }, [loadCircle, loadAgentPhotos, cacheMemberProfile]);

  const handleMemberPost = useCallback((post: CommunityPost) => {
    setPosts(prev => [post, ...prev]);
    if (post.agent_id) {
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
    <div style={{ minHeight: '100%', background: '#FAFAF8' }}>
      <main style={{ padding: typeof window !== 'undefined' && window.innerWidth < 768 ? '20px 12px 80px' : '40px 24px 80px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>

          {/* ── Header ── */}
          <div style={{ marginBottom: 28, animation: 'ccFadeIn 0.5s ease both' }}>
            <div style={{ color: '#B8941F', fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: '3px', fontWeight: 600, marginBottom: 8 }}>
              DRU AI LEADERSHIP ECOSYSTEM™
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h1 style={{ fontFamily: "'Cinzel', serif", color: '#0A2342', fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 700, letterSpacing: '0.5px', lineHeight: 1.2, margin: 0 }}>
                  ⚡ Accelerator Circle
                </h1>
                <p style={{ color: 'rgba(10,35,66,0.45)', fontFamily: "'Montserrat', sans-serif", fontSize: 14, marginTop: 8, marginBottom: 0 }}>
                  Your exclusive inner circle — deeper conversations, bigger wins, higher-level leaders.
                </p>
              </div>

              {/* Member count + overlapping avatars */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, alignSelf: 'flex-start', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {memberAvatars.map((m, i) => (
                    <div key={m.id} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: memberAvatars.length - i, borderRadius: '50%', border: '2px solid #FAFAF8' }}>
                      <MemberAvatar firstName={m.first_name || '?'} photoUrl={m.photo_url ?? undefined} size={32} />
                    </div>
                  ))}
                </div>
                {memberCount > 0 && (
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 600, color: 'rgba(10,35,66,0.55)' }}>
                    {memberCount} {memberCount === 1 ? 'member' : 'members'}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)', marginBottom: 28 }} />

          {/* ── Welcome card ── */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: 16, boxShadow: '0 2px 12px rgba(10,35,66,0.06)', overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ height: 4, background: 'linear-gradient(90deg, #D4AF37, #B8941F, #D4AF37)' }} />
            <div style={{ padding: '24px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #D4AF37, #B8941F)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>⚡</div>
                <div>
                  <div style={{ fontFamily: "'Cinzel', serif", fontSize: 16, fontWeight: 700, color: '#0A2342', marginBottom: 2 }}>Welcome to the Circle</div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: 'rgba(10,35,66,0.45)' }}>Accelerator Members Only</div>
                </div>
              </div>
              <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: 'rgba(10,35,66,0.6)', lineHeight: 1.75, margin: 0 }}>
                This is your inner circle. Ask deeper questions, share bigger wins, and connect with fellow Accelerator leaders who are serious about AI-powered transformation. The conversations that happen here go beyond the feed.
              </p>
            </div>
          </div>

          {/* ── Three value cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
            {[
              { icon: '🤝', title: 'Peer Accountability',  desc: 'Connect with leaders at your level. Share challenges, celebrate wins.' },
              { icon: '🧠', title: 'Deeper Strategy',       desc: 'Go beyond basics. This is where real transformation conversations happen.' },
              { icon: '🚀', title: 'Accelerate Together',   desc: 'Your peers are your competitive advantage. Use this space.' },
            ].map(card => (
              <div key={card.title} style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: 12, padding: '20px', boxShadow: '0 1px 4px rgba(10,35,66,0.04)' }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>{card.icon}</div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 700, color: '#0A2342', marginBottom: 6 }}>{card.title}</div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 12, color: 'rgba(10,35,66,0.5)', lineHeight: 1.6 }}>{card.desc}</div>
              </div>
            ))}
          </div>

          {/* ── Compose + feed ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ACCComposeBox
              userId={userId}
              userName={userName}
              userPhotoUrl={userPhotoUrl}
              onPostSubmitted={handleMemberPost}
            />

            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ background: '#FFF', border: '1px solid #E8E4DF', borderRadius: 12, height: 180, animation: 'ccShimmer 1.5s ease infinite', animationDelay: `${i * 150}ms` }} />
              ))
            ) : posts.length === 0 ? (
              <div style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: 12, padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 16, color: '#0A2342', marginBottom: 8 }}>Be the first to post</div>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 13, color: 'rgba(10,35,66,0.4)' }}>
                  Start a conversation — your Accelerator Circle is ready.
                </div>
              </div>
            ) : (
              posts.map((post, i) => (
                <PostCard
                  key={post.id}
                  post={post}
                  index={i}
                  userId={userId}
                  userName={userName}
                  userPhotoUrl={userPhotoUrl}
                  isAdmin={isAdmin}
                  photoMap={photoMap}
                  levelMap={levelMap}
                  agentPhotoBySlug={agentPhotoBySlug}
                  agentPhotoByName={agentPhotoByName}
                  onMemberClick={setSelectedMemberId}
                  onPinChange={handlePinChange}
                />
              ))
            )}
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
    </div>
  );
}

