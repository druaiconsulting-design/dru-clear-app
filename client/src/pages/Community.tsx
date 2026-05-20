import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import NavBar from '../components/NavBar';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── Payment links ─────────────────────────────────────────────────────────
const NAVIGATOR_PAYMENT_LINK   = 'https://link.druaiconsulting.com/payment-link/69ead3017dd3512d920794b0';
const ACCELERATOR_PAYMENT_LINK = 'https://link.druaiconsulting.com/payment-link/69ead3d37dd3512d920794b1';

const NAVIGATOR_FEATURES = [
  'Access to DRU AI Consulting — Community Connection',
  'Daily Leadership with AI Insights',
  'Framework Micro-Lessons',
  "Today's Action Challenge",
  "DeAnna's Strategic Edge",
  'Weekly Framework Training Content',
  'Exclusive Founder Pricing — Locked In Forever',
];

const ACCELERATOR_FEATURES = [
  'Everything in Navigator — plus:',
  'Weekly Branded Framework PDF Downloadable',
  "Monthly DeAnna's Leadership Lab! Video Access",
  'Exclusive Founder Pricing — Locked In Forever',
];

// ─── Types ─────────────────────────────────────────────────────────────────
type Tier = 'free' | 'paid' | 'navigator' | 'accelerator';
type PostType = 'daily_insight' | 'framework_lesson' | 'action_challenge' | 'strategic_edge' | 'framework_training' | 'pdf_downloadable' | 'lab_video';
type TierRequired = 'all' | 'navigator' | 'accelerator';

interface CommunityPost {
  id: string;
  title: string;
  content: string;
  post_type: PostType;
  tier_required: TierRequired;
  agent_id: string;
  agent_name: string;
  published_at: string;
  is_active: boolean;
  pdf_url?: string;
  video_url?: string;
}

// ─── Feed config ───────────────────────────────────────────────────────────
const POST_TYPE_CONFIG: Record<PostType, { label: string; icon: string; color: string; bg: string; border: string }> = {
  daily_insight:      { label: 'Daily Insight',      icon: '◆', color: '#B8941F', bg: '#FFFBEE', border: '#F0D980' },
  framework_lesson:   { label: 'Framework Lesson',   icon: '▣', color: '#0A2342', bg: '#EEF3FA', border: '#C0D0E8' },
  action_challenge:   { label: 'Action Challenge',   icon: '▲', color: '#9B0D44', bg: '#FDF0F5', border: '#F0B8CF' },
  strategic_edge:     { label: 'Strategic Edge',     icon: '◉', color: '#B8941F', bg: '#FFFBEE', border: '#F0D980' },
  framework_training: { label: 'Framework Training', icon: '◫', color: '#0A2342', bg: '#EEF3FA', border: '#C0D0E8' },
  pdf_downloadable:   { label: 'PDF Resource',       icon: '⬡', color: '#9B0D44', bg: '#FDF0F5', border: '#F0B8CF' },
  lab_video:          { label: 'Lab Video',          icon: '▷', color: '#B8941F', bg: '#FFFBEE', border: '#F0D980' },
};

const TIER_BADGE: Record<TierRequired, { label: string; color: string; bg: string } | null> = {
  all:         null,
  navigator:   { label: 'NAVIGATOR',   color: '#0A2342', bg: '#C0D0E8' },
  accelerator: { label: 'ACCELERATOR', color: '#7A5C00', bg: '#F0D980' },
};

const TIER_RANK: Record<Tier, number> = { free: 0, paid: 1, navigator: 2, accelerator: 3 };

function tierLabel(t: Tier): string {
  return { free: 'Free', paid: 'Member', navigator: 'Navigator', accelerator: 'Accelerator' }[t] ?? 'Free';
}

function tierDotColor(t: Tier): string {
  return { free: '#BBBBBB', paid: '#0A2342', navigator: '#0A2342', accelerator: '#B8941F' }[t];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatContent(content: string): string[] {
  return content.split('\n\n').filter(p => p.trim().length > 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// JOIN PAGE — shown to free / not logged in users
// ═══════════════════════════════════════════════════════════════════════════
function CommunityJoin() {
  return (
    <div style={{ minHeight: '100dvh', background: '#0A2342', display: 'flex', flexDirection: 'column' }}>
      <NavBar active="/community" />

      <main style={{ flex: 1, padding: '0 0 4rem' }}>

        {/* Hero */}
        <div style={{
          background: 'linear-gradient(135deg, #0A2342 0%, #0d2d56 50%, #0A2342 100%)',
          borderBottom: '1px solid rgba(212,175,55,0.2)',
          padding: '3.5rem 1.5rem 3rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 300, background: 'radial-gradient(ellipse, rgba(194,24,91,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

          <p style={{ fontFamily: "'Montserrat', sans-serif", color: '#C2185B', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '1rem' }}>
            🔥 Founders Special — Limited Time
          </p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: '#FFFFFF', fontSize: 'clamp(1.75rem, 5vw, 2.75rem)', fontWeight: 700, lineHeight: 1.2, marginBottom: '1rem', maxWidth: 640, margin: '0 auto 1rem' }}>
            Join the DRU AI Consulting<br />
            <span style={{ color: '#D4AF37' }}>Community Connection</span>
          </h1>
          <p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.75)', fontSize: '0.95rem', lineHeight: 1.7, maxWidth: 520, margin: '0 auto 2rem' }}>
            A community built for leaders who are serious about navigating the AI era with clarity, confidence, and a concrete pathway forward.
          </p>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.35)', borderRadius: 50, padding: '0.5rem 1.25rem' }}>
            <span style={{ color: '#D4AF37', fontSize: '0.75rem' }}>⭐</span>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: '#D4AF37', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Founding Members Lock In Pricing Forever
            </p>
          </div>
        </div>

        {/* Pricing Tiers */}
        <div style={{ padding: '2.5rem 1.5rem', maxWidth: 720, margin: '0 auto' }}>

          <p style={{ fontFamily: "'Montserrat', sans-serif", color: '#D4AF37', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', textAlign: 'center', marginBottom: '1.5rem' }}>
            Choose Your Path
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Navigator */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ background: 'rgba(212,175,55,0.07)', borderBottom: '1px solid rgba(212,175,55,0.2)', padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", color: '#D4AF37', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>DRU CLEAR™</p>
                    <h3 style={{ fontFamily: "'Playfair Display', serif", color: '#FFFFFF', fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.25rem' }}>Navigator</h3>
                    <p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.55)', fontSize: '0.75rem' }}>Self-directed AI leadership transformation</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontFamily: "'Playfair Display', serif", color: '#D4AF37', fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 }}>$47</p>
                    <p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.5)', fontSize: '0.68rem' }}>/month</p>
                    <p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.35)', fontSize: '0.63rem', textDecoration: 'line-through', marginTop: '0.2rem' }}>normally $97</p>
                  </div>
                </div>
              </div>
              <div style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
                  {NAVIGATOR_FEATURES.map((f) => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                      <span style={{ color: '#D4AF37', fontSize: '0.7rem', marginTop: 3, flexShrink: 0 }}>✓</span>
                      <p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.8)', fontSize: '0.78rem', lineHeight: 1.5 }}>{f}</p>
                    </div>
                  ))}
                </div>
                <a href={NAVIGATOR_PAYMENT_LINK} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', width: '100%', background: 'transparent', border: '1.5px solid #D4AF37', borderRadius: 8, padding: '0.85rem', fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#D4AF37', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>
                  Join as Navigator Founder →
                </a>
              </div>
            </div>

            {/* Accelerator */}
            <div style={{ background: 'rgba(194,24,91,0.06)', border: '2px solid rgba(194,24,91,0.5)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ background: 'rgba(194,24,91,0.1)', borderBottom: '1px solid rgba(194,24,91,0.3)', padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                  <div style={{ background: '#C2185B', borderRadius: 50, padding: '0.3rem 0.75rem', display: 'inline-block' }}>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", color: '#FFFFFF', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>Best Value</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", color: '#C2185B', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>DRU CLEAR™</p>
                    <h3 style={{ fontFamily: "'Playfair Display', serif", color: '#FFFFFF', fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.25rem' }}>Accelerator</h3>
                    <p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.55)', fontSize: '0.75rem' }}>Premium access + monthly DeAnna video</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontFamily: "'Playfair Display', serif", color: '#C2185B', fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 }}>$147</p>
                    <p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.5)', fontSize: '0.68rem' }}>/month</p>
                    <p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.35)', fontSize: '0.63rem', textDecoration: 'line-through', marginTop: '0.2rem' }}>normally $297</p>
                  </div>
                </div>
              </div>
              <div style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
                  {ACCELERATOR_FEATURES.map((f, i) => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                      <span style={{ color: i === 0 ? 'rgba(230,230,230,0.4)' : '#C2185B', fontSize: '0.7rem', marginTop: 3, flexShrink: 0 }}>{i === 0 ? '—' : '✓'}</span>
                      <p style={{ fontFamily: "'Inter', sans-serif", color: i === 0 ? 'rgba(230,230,230,0.5)' : 'rgba(230,230,230,0.85)', fontSize: '0.78rem', lineHeight: 1.5, fontStyle: i === 0 ? 'italic' : 'normal' }}>{f}</p>
                    </div>
                  ))}
                </div>
                <a href={ACCELERATOR_PAYMENT_LINK} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', width: '100%', background: '#C2185B', border: 'none', borderRadius: 8, padding: '0.85rem', fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#FFFFFF', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>
                  Join as Accelerator Founder →
                </a>
              </div>
            </div>

          </div>

          {/* Bottom note */}
          <div style={{ marginTop: '2rem', textAlign: 'center', padding: '1.25rem 1.5rem', background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 10 }}>
            <p style={{ fontFamily: "'Playfair Display', serif", color: '#FFFFFF', fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              The answers are already inside you.
            </p>
            <p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.55)', fontSize: '0.78rem', lineHeight: 1.6 }}>
              This community is where you find the clarity, the tools, and the people to move forward — with confidence — in the AI era.
            </p>
          </div>

          {/* Already purchased prompt */}
          <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.35)', fontSize: '0.75rem' }}>
              Already a member?
            </p>
            <a href="/login?redirect=/community" style={{
              fontFamily: "'Montserrat', sans-serif", color: '#D4AF37',
              fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em',
              textDecoration: 'none', borderBottom: '1px solid rgba(212,175,55,0.4)',
              paddingBottom: '1px',
            }}>
              Log in to access your content →
            </a>
          </div>

        </div>
      </main>

      <footer style={{ textAlign: 'center', padding: '1rem', color: 'rgba(255,255,255,0.2)', fontFamily: "'Montserrat', sans-serif", fontSize: '0.65rem', letterSpacing: '0.04em' }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FEED PAGE — shown to navigator / accelerator subscribers
// ═══════════════════════════════════════════════════════════════════════════

function UpgradeBanner({ userTier, lockedCounts }: { userTier: Tier; lockedCounts: { navigator: number; accelerator: number } }) {
  const userRank = TIER_RANK[userTier];
  const needsAccelerator = userRank < 3 && lockedCounts.accelerator > 0;
  if (!needsAccelerator) return null;
  return (
    <div style={{
      background: '#FFFBEE', border: '1px solid #F0D980',
      borderLeft: '4px solid #B8941F', borderRadius: '10px',
      padding: '18px 22px', marginBottom: '28px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: '12px',
    }}>
      <div>
        <div style={{ color: '#7A5C00', fontFamily: "'Cinzel', serif", fontSize: '10px', letterSpacing: '2px', marginBottom: '4px', fontWeight: '600' }}>
          ACCELERATOR EXCLUSIVE
        </div>
        <div style={{ color: 'rgba(10,35,66,0.65)', fontFamily: "'Montserrat', sans-serif", fontSize: '13px' }}>
          {lockedCounts.accelerator} additional posts — AI Sales Mastery™ insights & premium PDF resources
        </div>
      </div>
      <a href={ACCELERATOR_PAYMENT_LINK} target="_blank" rel="noopener noreferrer" style={{
        background: 'linear-gradient(135deg, #B8941F 0%, #D4AF37 100%)', color: '#fff',
        padding: '10px 20px', borderRadius: '6px',
        fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '700',
        letterSpacing: '1px', textDecoration: 'none', whiteSpace: 'nowrap',
      }}>
        UPGRADE TO ACCELERATOR
      </a>
    </div>
  );
}

function PostCard({ post, index }: { post: CommunityPost; index: number }) {
  const cfg = POST_TYPE_CONFIG[post.post_type] ?? POST_TYPE_CONFIG.daily_insight;
  const tierBadge = TIER_BADGE[post.tier_required];
  const paragraphs = formatContent(post.content);

  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #E8E4DF',
      borderTop: `3px solid ${cfg.color}`, borderRadius: '12px',
      padding: '28px 32px',
      animation: 'ccFadeIn 0.45s ease both',
      animationDelay: `${index * 55}ms`,
      boxShadow: '0 1px 4px rgba(10,35,66,0.06)',
      transition: 'box-shadow 0.2s ease',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(10,35,66,0.1)'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(10,35,66,0.06)'; }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{
            color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
            fontSize: '10px', fontFamily: "'Cinzel', serif",
            letterSpacing: '1.5px', fontWeight: '600',
            padding: '4px 10px', borderRadius: '4px',
            display: 'flex', alignItems: 'center', gap: '5px',
          }}>
            <span>{cfg.icon}</span>{cfg.label.toUpperCase()}
          </span>
          {tierBadge && (
            <span style={{
              color: tierBadge.color, background: tierBadge.bg,
              fontSize: '9px', fontFamily: "'Montserrat', sans-serif",
              fontWeight: '700', letterSpacing: '1.5px',
              padding: '3px 8px', borderRadius: '3px',
            }}>
              {tierBadge.label}
            </span>
          )}
        </div>
        <div style={{ color: 'rgba(10,35,66,0.35)', fontSize: '12px', fontFamily: "'Montserrat', sans-serif", whiteSpace: 'nowrap', flexShrink: 0 }}>
          {formatDate(post.published_at)}
        </div>
      </div>

      {/* Title */}
      <h3 style={{ fontFamily: "'Cinzel', serif", color: '#0A2342', fontSize: '17px', fontWeight: '600', lineHeight: '1.45', marginBottom: '16px' }}>
        {post.title}
      </h3>

      {/* Full content — no truncation */}
      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '14px', lineHeight: '1.85', color: 'rgba(10,35,66,0.7)' }}>
        {paragraphs.map((p, i) => (
          <p key={i} style={{ marginBottom: '12px' }}>{p}</p>
        ))}
      </div>

      {/* Footer */}
      <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #F0EDE8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'rgba(10,35,66,0.35)', fontFamily: "'Montserrat', sans-serif", fontSize: '12px' }}>{post.agent_name}</span>
        <a href="https://assessment.druaiconsulting.com" target="_blank" rel="noopener noreferrer"
          style={{ color: 'rgba(184,148,31,0.7)', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', textDecoration: 'none' }}>
          assessment.druaiconsulting.com
        </a>
      </div>
    </div>
  );
}



function EmptyState({ filter }: { filter: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <div style={{ color: '#D4AF37', fontSize: '40px', marginBottom: '16px' }}>◆</div>
      <div style={{ fontFamily: "'Cinzel', serif", color: 'rgba(10,35,66,0.4)', fontSize: '13px', letterSpacing: '2px', marginBottom: '8px' }}>
        {filter === 'all' ? 'NO POSTS YET' : `NO ${filter.replace(/_/g, ' ').toUpperCase()} POSTS YET`}
      </div>
      <div style={{ fontFamily: "'Montserrat', sans-serif", color: 'rgba(10,35,66,0.35)', fontSize: '13px', maxWidth: '320px', margin: '0 auto' }}>
        Your agents are working — content will appear here once approved.
      </div>
    </div>
  );
}

function CommunityFeed({ tier }: { tier: Tier }) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveCount, setLiveCount] = useState(0);
  const [pdfs, setPdfs] = useState<{ name: string; url: string }[]>([]);
  const [showArchives, setShowArchives] = useState(false);
  const lockedCounts = { navigator: 0, accelerator: tier === 'navigator' ? 2 : 0 };

  const loadPdfs = useCallback(async () => {
    const { data, error } = await supabase.storage.from('pdfs').list('', {
      sortBy: { column: 'created_at', order: 'desc' },
    });
    if (error || !data) return;
    const files = data
      .filter(f => f.name.startsWith('CC_Framework_Training'))
      .map(f => ({
        name: f.name.replace(/_/g, ' ').replace('.pdf', ''),
        url: supabase.storage.from('pdfs').getPublicUrl(f.name).data.publicUrl,
      }));
    setPdfs(files);
  }, []);

  const loadPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from('community_posts')
      .select('*')
      .eq('is_active', true)
      .order('published_at', { ascending: false })
      .limit(50);
    if (error) { console.error('[community feed] error:', error); return []; }
    return (data ?? []) as CommunityPost[];
  }, []);

  useEffect(() => {
    let mounted = true;
    loadPosts().then(loaded => { if (mounted) { setPosts(loaded); setLoading(false); } });
    loadPdfs();

    const channel = supabase
      .channel('community_posts_live')
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
        if (newPost.is_active) { setLiveCount(c => c + 1); setPosts(prev => [newPost, ...prev]); }
      })
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [loadPosts, loadPdfs]);

  return (
    <div style={{ minHeight: '100dvh', background: '#FAFAF8', display: 'flex', flexDirection: 'column' }}>
      <NavBar active="/community" />

      <main style={{ flex: 1, padding: '40px 24px 80px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: '32px', animation: 'ccFadeIn 0.5s ease both' }}>

            {/* Back to Portal */}
            <a href="/portal" style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '600',
              color: 'rgba(10,35,66,0.45)', textDecoration: 'none', letterSpacing: '0.5px',
              marginBottom: '20px',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#0A2342'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(10,35,66,0.45)'; }}
            >
              ← Back to Portal
            </a>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ color: '#B8941F', fontFamily: "'Cinzel', serif", fontSize: '10px', letterSpacing: '3px', fontWeight: '600', marginBottom: '8px' }}>
                  DRU AI LEADERSHIP ECOSYSTEM™
                </div>
                <h1 style={{ fontFamily: "'Cinzel', serif", color: '#0A2342', fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: '700', letterSpacing: '0.5px', lineHeight: '1.2' }}>
                  Community Connection
                </h1>
                <p style={{ color: 'rgba(10,35,66,0.45)', fontFamily: "'Montserrat', sans-serif", fontSize: '14px', marginTop: '8px' }}>
                  Daily insights, framework lessons, and action challenges from your AI team
                </p>
              </div>
              <div style={{
                background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: '8px',
                padding: '8px 16px', fontFamily: "'Montserrat', sans-serif",
                fontSize: '12px', color: 'rgba(10,35,66,0.5)',
                display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: '0 1px 3px rgba(10,35,66,0.06)', alignSelf: 'flex-start',
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: tierDotColor(tier), flexShrink: 0 }} />
                {tierLabel(tier)}
              </div>
            </div>

            {liveCount > 0 && (
              <button onClick={() => { setLiveCount(0); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{
                marginTop: '14px', background: '#FFFBEE', border: '1px solid #F0D980',
                color: '#7A5C00', padding: '7px 16px', borderRadius: '6px', cursor: 'pointer',
                fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '600',
                letterSpacing: '0.5px', display: 'inline-flex', alignItems: 'center', gap: '6px',
              }}>
                ↑ {liveCount} new post{liveCount > 1 ? 's' : ''} just approved
              </button>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)', marginBottom: '28px' }} />

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ background: '#FFF', border: '1px solid #E8E4DF', borderRadius: '12px', height: '180px', animation: 'ccShimmer 1.5s ease infinite', animationDelay: `${i*150}ms` }} />
              ))}
            </div>
          ) : (
            <>
              <UpgradeBanner userTier={tier} lockedCounts={lockedCounts} />

              {/* Weekly Framework Training Content */}
              {pdfs.length > 0 && (
                <div style={{ marginBottom: '28px' }}>

                  {/* Latest PDF — always the most recent upload */}
                  <a
                    href={pdfs[0].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: '#FFFFFF', border: '1px solid #E8E4DF',
                      borderLeft: '4px solid #0A2342', borderRadius: '10px',
                      padding: '18px 24px', textDecoration: 'none',
                      boxShadow: '0 1px 4px rgba(10,35,66,0.06)',
                      transition: 'box-shadow 0.2s ease',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 16px rgba(10,35,66,0.1)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 1px 4px rgba(10,35,66,0.06)'; }}
                  >
                    <div>
                      <div style={{ color: '#0A2342', fontFamily: "'Cinzel', serif", fontSize: '10px', letterSpacing: '2px', fontWeight: '600', marginBottom: '4px' }}>
                        THIS WEEK
                      </div>
                      <div style={{ color: '#0A2342', fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: '600' }}>
                        Weekly Framework Training Content
                      </div>
                    </div>
                    <div style={{
                      background: '#0A2342', color: '#fff',
                      padding: '8px 16px', borderRadius: '6px',
                      fontFamily: "'Montserrat', sans-serif", fontSize: '11px',
                      fontWeight: '700', letterSpacing: '1px', whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      DOWNLOAD ↓
                    </div>
                  </a>

                  {/* Archives toggle — only show if there are past PDFs */}
                  {pdfs.length > 1 && (
                    <div style={{ marginTop: '10px' }}>
                      <button
                        onClick={() => setShowArchives(!showArchives)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'rgba(10,35,66,0.45)', fontFamily: "'Montserrat', sans-serif",
                          fontSize: '12px', fontWeight: '600', letterSpacing: '0.5px',
                          padding: '6px 0', display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                      >
                        {showArchives ? '↑ Hide Archives' : '↓ Archives'}
                      </button>

                      {showArchives && (
                        <div style={{
                          background: '#FFFFFF', border: '1px solid #E8E4DF',
                          borderRadius: '10px', overflow: 'hidden', marginTop: '8px',
                        }}>
                          {pdfs.slice(1).map((pdf, i) => (
                            <a
                              key={pdf.name}
                              href={pdf.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '14px 20px',
                                borderBottom: i < pdfs.length - 2 ? '1px solid #F0EDE8' : 'none',
                                textDecoration: 'none',
                                transition: 'background 0.15s ease',
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#FAFAF8'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#FFFFFF'; }}
                            >
                              <span style={{ color: 'rgba(10,35,66,0.65)', fontFamily: "'Montserrat', sans-serif", fontSize: '13px' }}>
                                {pdf.name}
                              </span>
                              <span style={{ color: '#B8941F', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '700', letterSpacing: '1px' }}>
                                DOWNLOAD ↓
                              </span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}

              {posts.length === 0 ? <EmptyState filter="all" /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {posts.map((post, i) => <PostCard key={post.id} post={post} index={i} />)}
                </div>
              )}

              {posts.length > 0 && (
                <div style={{ textAlign: 'center', marginTop: '60px', paddingTop: '36px', borderTop: '1px solid #E8E4DF' }}>
                  <div style={{ color: 'rgba(184,148,31,0.7)', fontFamily: "'Cinzel', serif", fontSize: '10px', letterSpacing: '3px', marginBottom: '10px' }}>
                    YOUR AI TRANSFORMATION STARTS HERE
                  </div>
                  <a href="https://assessment.druaiconsulting.com" target="_blank" rel="noopener noreferrer"
                    style={{ color: '#0A2342', fontFamily: "'Montserrat', sans-serif", fontSize: '13px', textDecoration: 'none', borderBottom: '1px solid rgba(10,35,66,0.25)', paddingBottom: '1px' }}>
                    assessment.druaiconsulting.com
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <footer style={{ textAlign: 'center', padding: '1rem', color: 'rgba(10,35,66,0.25)', fontFamily: "'Montserrat', sans-serif", fontSize: '0.65rem', letterSpacing: '0.04em', borderTop: '1px solid #E8E4DF' }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SMART DETECTION — checks tier, renders the right page
// ═══════════════════════════════════════════════════════════════════════════
export default function Community() {
  const [tier, setTier] = useState<Tier | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setTier('free'); setChecking(false); return; }
        const { data } = await supabase
          .from('profiles')
          .select('tier')
          .eq('id', user.id)
          .maybeSingle();
        setTier((data?.tier as Tier) ?? 'free');
      } catch {
        setTier('free');
      } finally {
        setChecking(false);
      }
    };
    check();
  }, []);

  // Brief loading state while we check auth
  if (checking) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600&family=Montserrat:wght@500&display=swap');
          @keyframes ccFadeIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
          @keyframes ccShimmer { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
          @keyframes ccPulse { 0%,100% { opacity:0.6; } 50% { opacity:1; } }
        `}</style>
        <div style={{ minHeight: '100dvh', background: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
          <div style={{ color: '#D4AF37', fontSize: '32px', animation: 'ccPulse 1.5s ease infinite' }}>◆</div>
          <div style={{ fontFamily: "'Cinzel', serif", color: 'rgba(10,35,66,0.4)', fontSize: '11px', letterSpacing: '3px' }}>LOADING</div>
        </div>
      </>
    );
  }

  const isMember = tier === 'navigator' || tier === 'accelerator';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Montserrat:wght@400;500;600;700&family=Playfair+Display:wght@700&family=Inter:wght@400;500&display=swap');
        @keyframes ccFadeIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes ccShimmer { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes ccPulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
      {isMember
        ? <CommunityFeed tier={tier!} />
        : <CommunityJoin />
      }
    </>
  );
}
