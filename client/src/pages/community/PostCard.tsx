import { useState, useEffect } from 'react';
import { supabase, formatRelativeTime, formatContent, ZOE_POST_TYPES } from './types';
import type { CommunityPost } from './types';
import MemberAvatar from './MemberAvatar';
import CommentSection from './CommentSection';
import LevelBadge from '../community-engagement/LevelBadge';

// ── Video embed detector ──────────────────────────────────────────────────────
function getVideoEmbed(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  const loom = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (loom) return `https://www.loom.com/embed/${loom[1]}`;
  return null;
}

function getPdfFilename(url: string): string {
  const parts = url.split('/');
  const raw = parts[parts.length - 1] || 'Document.pdf';
  return decodeURIComponent(raw).replace(/^\d+_/, '');
}

// ── Category tag ──────────────────────────────────────────────────────────────
const CATEGORY_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  win:       { bg: '#EAF3DE', color: '#27500A', label: 'Win'       },
  question:  { bg: '#E6F1FB', color: '#0C447C', label: 'Question'  },
  resource:  { bg: '#EEEDFE', color: '#3C3489', label: 'Resource'  },
  challenge: { bg: '#FBEAF0', color: '#72243E', label: 'Challenge' },
  general:   { bg: '#F1EFE8', color: '#444441', label: 'General'   },
};

function CategoryTag({ category }: { category: string }) {
  if (!category || category === 'general') return null;
  const s = CATEGORY_STYLES[category] || CATEGORY_STYLES.general;
  return (
    <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: '700', fontFamily: "'Montserrat', sans-serif", padding: '2px 8px', borderRadius: '4px', background: s.bg, color: s.color, letterSpacing: '0.3px' }}>
      {s.label}
    </span>
  );
}

// =============================================================================
// POST CARD
// =============================================================================
export default function PostCard({
  post, index, userId, userName, userPhotoUrl, isAdmin, photoMap = {}, levelMap = {},
  onMemberClick, onPinChange,
}: {
  post:            CommunityPost;
  index:           number;
  userId:          string;
  userName:        string;
  userPhotoUrl?:   string;
  isAdmin:         boolean;
  photoMap?:       Record<string, string>;
  levelMap?:       Record<string, string>;
  onMemberClick?:  (memberId: string) => void;
  onPinChange?:    (postId: string, isPinned: boolean) => void;
}) {
  const isMemberPost = post.post_type === 'member_post';
  const paragraphs   = formatContent(post.content);
  const category     = (post as any).category  as string  ?? 'general';
  const memberLevel  = isMemberPost ? (levelMap[post.agent_id] ?? 'Connected') : null;

  const [pinned,       setPinned]       = useState<boolean>((post as any).is_pinned ?? false);
  const [pinLoading,   setPinLoading]   = useState(false);
  const [hearted,      setHearted]      = useState(false);
  const [heartLoading, setHeartLoading] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState<number | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentQueued,  setAgentQueued]  = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase.from('community_reactions')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', post.id).eq('member_id', userId)
      .eq('reaction_type', 'heart').is('comment_id', null)
      .then(({ count }) => { if ((count ?? 0) > 0) setHearted(true); });

    supabase.from('community_comments')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', post.id).eq('is_active', true).eq('is_flagged', false)
      .then(({ count }) => { if (count !== null) setCommentCount(count); });
  }, [post.id, userId]);

  const handleHeart = async () => {
    if (!userId || heartLoading) return;
    setHeartLoading(true);
    if (hearted) {
      await supabase.from('community_reactions').delete()
        .eq('post_id', post.id).eq('member_id', userId)
        .eq('reaction_type', 'heart').is('comment_id', null);
      setHearted(false);
    } else {
      await supabase.from('community_reactions')
        .insert({ post_id: post.id, member_id: userId, reaction_type: 'heart' });
      setHearted(true);
    }
    setHeartLoading(false);
  };

  const handlePin = async () => {
    if (pinLoading) return;
    setPinLoading(true);
    const newPinned = !pinned;
    await supabase.from('community_posts').update({
      is_pinned: newPinned,
      pinned_at: newPinned ? new Date().toISOString() : null,
    }).eq('id', post.id);
    setPinned(newPinned);
    onPinChange?.(post.id, newPinned);
    setPinLoading(false);
  };

  const handleAskAgent = async () => {
    if (agentLoading || agentQueued) return;
    setAgentLoading(true);
    try {
      await fetch('/api/cc-agent-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger_type: 'cc_agent_reply',
          post_id:      post.id,
          post_type:    post.post_type,
          post_title:   post.title,
          post_content: post.content,
          route_to:     ZOE_POST_TYPES.includes(post.post_type) ? 'zoe' : 'micah',
        }),
      });
      const routedTo = ZOE_POST_TYPES.includes(post.post_type) ? 'Zoe Beaumont' : 'Micah Santos';
      await supabase.from('community_comments').insert({
        post_id: post.id, member_id: null,
        content: `Reply requested — ${routedTo} queued to respond`,
        is_flagged: true, is_active: true,
      });
      setAgentQueued(true);
    } catch (err) { console.error('[ask agent]', err); }
    finally { setAgentLoading(false); }
  };

  const countLabel      = commentCount === null ? '' : commentCount > 0 ? ` · ${commentCount}` : '';
  const videoEmbed      = post.video_url ? getVideoEmbed(post.video_url) : null;
  const topBorderColor  = pinned || !isMemberPost ? '#B8941F' : '#2D5A8E';
  const cardShadow      = pinned ? '0 1px 4px rgba(212,175,55,0.18)' : '0 1px 4px rgba(10,35,66,0.06)';
  const cardShadowHover = pinned ? '0 4px 20px rgba(212,175,55,0.22)' : '0 4px 20px rgba(10,35,66,0.1)';

  return (
    <div
      style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderTop: `3px solid ${topBorderColor}`, borderRadius: '12px', padding: '28px 32px', animation: 'ccFadeIn 0.45s ease both', animationDelay: `${index * 55}ms`, boxShadow: cardShadow, transition: 'box-shadow 0.2s ease' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = cardShadowHover; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = cardShadow; }}
    >
      {/* ── Pin + Category row ─────────────────────────────────────────────── */}
      {(pinned || (isMemberPost && category !== 'general')) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
          {pinned && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: '700', fontFamily: "'Montserrat', sans-serif", padding: '2px 8px', borderRadius: '4px', background: '#FAEEDA', color: '#633806', letterSpacing: '0.3px' }}>
              ↑ Pinned
            </span>
          )}
          {isMemberPost && <CategoryTag category={category} />}
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <MemberAvatar
            firstName={post.agent_name}
            photoUrl={isMemberPost ? (post.agent_id === userId ? userPhotoUrl : photoMap[post.agent_id]) : undefined}
            size={36}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {/* Member name — clickable for member posts */}
              {isMemberPost && onMemberClick ? (
                <button
                  onClick={() => onMemberClick(post.agent_id)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", fontSize: '13px', fontWeight: '700', color: '#0A2342', transition: 'color 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#B8941F'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#0A2342'; }}
                >
                  {post.agent_name}
                </button>
              ) : (
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '13px', fontWeight: '700', color: '#0A2342' }}>
                  {post.agent_name}
                </span>
              )}
              {isMemberPost && memberLevel && <LevelBadge level={memberLevel} />}
            </div>
            {!isMemberPost && (
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', color: 'rgba(10,35,66,0.35)' }}>
                DRU AI Consulting Team
              </div>
            )}
          </div>
        </div>
        <div style={{ color: 'rgba(10,35,66,0.35)', fontSize: '12px', fontFamily: "'Montserrat', sans-serif", whiteSpace: 'nowrap', flexShrink: 0 }}>
          {formatRelativeTime(post.published_at)}
        </div>
      </div>

      {/* ── Title — agent posts only ───────────────────────────────────────── */}
      {!isMemberPost && post.title && (
        <h3 style={{ fontFamily: "'Cinzel', serif", color: '#0A2342', fontSize: '17px', fontWeight: '600', lineHeight: '1.45', marginBottom: '16px' }}>
          {post.title}
        </h3>
      )}

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {post.content.trim() && (
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '14px', lineHeight: '1.85', color: 'rgba(10,35,66,0.7)' }}>
          {paragraphs.map((p, i) => <p key={i} style={{ marginBottom: '12px' }}>{p}</p>)}
        </div>
      )}

      {/* ── Image ─────────────────────────────────────────────────────────── */}
      {post.image_url && (
        <div style={{ marginTop: '12px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #F0EDE8' }}>
          <img src={post.image_url} alt="Post image" style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', display: 'block' }} />
        </div>
      )}

      {/* ── Video embed ───────────────────────────────────────────────────── */}
      {post.video_url && videoEmbed && (
        <div style={{ marginTop: '12px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #F0EDE8', position: 'relative', paddingBottom: '56.25%', height: 0 }}>
          <iframe src={videoEmbed} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="Video" />
        </div>
      )}

      {/* ── Direct video ──────────────────────────────────────────────────── */}
      {post.video_url && !videoEmbed && (
        <div style={{ marginTop: '12px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #F0EDE8' }}>
          <video src={post.video_url} controls style={{ width: '100%', maxHeight: '400px', display: 'block', background: '#000' }} />
        </div>
      )}

      {/* ── PDF ───────────────────────────────────────────────────────────── */}
      {post.pdf_url && (
        <a href={post.pdf_url} target="_blank" rel="noopener noreferrer"
          style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#FAFAF8', border: '1px solid #E8E4DF', borderRadius: '8px', textDecoration: 'none', transition: 'background 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#F0EDE8'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#FAFAF8'; }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>📄</span>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '600', color: '#0A2342' }}>{getPdfFilename(post.pdf_url)}</span>
          </div>
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '700', color: '#B8941F', letterSpacing: '0.5px' }}>DOWNLOAD ↓</span>
        </a>
      )}

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #F0EDE8' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Left: heart + comments */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={handleHeart} disabled={heartLoading} aria-label={hearted ? 'Remove heart' : 'Heart this post'}
              style={{ background: 'none', border: 'none', cursor: heartLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '5px', padding: '0', transition: 'transform 0.15s ease' }}
              onMouseEnter={e => { if (!heartLoading) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.15)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}>
              <span style={{ fontSize: '17px', color: hearted ? '#C2185B' : 'rgba(10,35,66,0.3)', transition: 'color 0.15s ease' }}>
                {hearted ? '♥' : '♡'}
              </span>
            </button>
            <button onClick={() => setCommentsOpen(!commentsOpen)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', padding: '0', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '600', color: commentsOpen ? '#0A2342' : 'rgba(10,35,66,0.4)', transition: 'color 0.15s ease' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#0A2342'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = commentsOpen ? '#0A2342' : 'rgba(10,35,66,0.4)'; }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span>Comments{countLabel}</span>
            </button>
          </div>

          {/* Right: admin controls — pin + ask agent */}
          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Pin toggle */}
              <button onClick={handlePin} disabled={pinLoading}
                style={{ background: 'none', border: `1px dashed ${pinned ? '#B8941F' : 'rgba(10,35,66,0.2)'}`, borderRadius: '6px', padding: '5px 10px', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '600', color: pinned ? '#B8941F' : 'rgba(10,35,66,0.35)', cursor: pinLoading ? 'default' : 'pointer', letterSpacing: '0.4px', transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: '4px' }}
                onMouseEnter={e => { if (!pinLoading) { (e.currentTarget as HTMLButtonElement).style.color = pinned ? '#633806' : '#0A2342'; (e.currentTarget as HTMLButtonElement).style.borderColor = pinned ? '#B8941F' : 'rgba(10,35,66,0.4)'; } }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = pinned ? '#B8941F' : 'rgba(10,35,66,0.35)'; (e.currentTarget as HTMLButtonElement).style.borderColor = pinned ? '#B8941F' : 'rgba(10,35,66,0.2)'; }}>
                <span>📌</span>
                <span>{pinLoading ? '...' : pinned ? 'Unpin' : 'Pin'}</span>
              </button>

              {/* Ask Agent */}
              <button onClick={handleAskAgent} disabled={agentLoading || agentQueued}
                style={{ background: 'none', border: `1px dashed ${agentQueued ? '#B8941F' : 'rgba(10,35,66,0.2)'}`, borderRadius: '6px', padding: '5px 10px', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '600', color: agentQueued ? '#B8941F' : 'rgba(10,35,66,0.35)', cursor: agentQueued || agentLoading ? 'default' : 'pointer', letterSpacing: '0.4px', transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: '4px' }}
                onMouseEnter={e => { if (!agentQueued && !agentLoading) { (e.currentTarget as HTMLButtonElement).style.color = '#0A2342'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(10,35,66,0.4)'; } }}
                onMouseLeave={e => { if (!agentQueued) { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(10,35,66,0.35)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(10,35,66,0.2)'; } }}>
                <span>{agentQueued ? '✓' : '↺'}</span>
                <span>{agentLoading ? 'Queuing...' : agentQueued ? 'Agent queued' : 'Ask Agent to Reply'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <CommentSection
        postId={post.id} userId={userId} userName={userName}
        open={commentsOpen} onToggle={() => setCommentsOpen(!commentsOpen)}
        commentCount={commentCount} setCommentCount={setCommentCount}
      />
    </div>
  );
}
