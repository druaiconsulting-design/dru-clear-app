import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import NavBar from '../components/NavBar';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const NAVIGATOR_PAYMENT_LINK   = 'https://link.druaiconsulting.com/payment-link/69ead3017dd3512d920794b0';
const ACCELERATOR_PAYMENT_LINK = 'https://link.druaiconsulting.com/payment-link/69ead3d37dd3512d920794b1';

const NAVIGATOR_FEATURES = [
  'Access to DRU AI Consulting \u2014 Community Connection',
  'Daily Leadership with AI Insights',
  'Framework Micro-Lessons',
  "Today's Action Challenge",
  "DeAnna's Strategic Edge",
  'Weekly Framework Training Content',
  'Exclusive Founder Pricing \u2014 Locked In Forever',
];

const ACCELERATOR_FEATURES = [
  'Everything in Navigator \u2014 plus:',
  'Weekly Branded Framework PDF Downloadable',
  "Monthly DeAnna's Leadership Lab! Video Access",
  'Exclusive Founder Pricing \u2014 Locked In Forever',
];

// --- Types ---
type Tier = 'free' | 'paid' | 'navigator' | 'accelerator';
type PostType = 'daily_insight' | 'framework_lesson' | 'action_challenge' | 'strategic_edge' | 'framework_training' | 'pdf_downloadable' | 'lab_video';
type TierRequired = 'all' | 'navigator' | 'accelerator';
type NotifType = 'mention' | 'reply' | 'new_post' | 'new_agent_post';

interface CommunityPost {
  id: string; title: string; content: string;
  post_type: PostType; tier_required: TierRequired;
  agent_id: string; agent_name: string;
  published_at: string; is_active: boolean;
  pdf_url?: string; video_url?: string;
}

interface CommunityComment {
  id: string; post_id: string; member_id: string;
  content: string; is_flagged: boolean; is_active: boolean;
  created_at: string; profiles?: { first_name?: string; photo_url?: string };
}

interface CommunityNotification {
  id: string; recipient_id: string; sender_id: string;
  post_id: string; comment_id: string;
  type: NotifType; message: string; is_read: boolean; created_at: string;
}

interface NotificationPreferences {
  mention_push: boolean; mention_inapp: boolean; mention_email: boolean;
  reply_push: boolean; reply_inapp: boolean; reply_email: boolean;
  new_agent_post_push: boolean; new_agent_post_inapp: boolean; new_agent_post_email: boolean;
  new_post_push: boolean; new_post_inapp: boolean; new_post_email: boolean;
}

interface MemberProfile { id: string; first_name: string; photo_url?: string; }

// --- Feed config ---
const POST_TYPE_CONFIG: Record<PostType, { label: string; icon: string; color: string; bg: string; border: string }> = {
  daily_insight:      { label: 'Daily Insight',      icon: '\u25c6', color: '#B8941F', bg: '#FFFBEE', border: '#F0D980' },
  framework_lesson:   { label: 'Framework Lesson',   icon: '\u25a3', color: '#0A2342', bg: '#EEF3FA', border: '#C0D0E8' },
  action_challenge:   { label: 'Action Challenge',   icon: '\u25b2', color: '#9B0D44', bg: '#FDF0F5', border: '#F0B8CF' },
  strategic_edge:     { label: 'Strategic Edge',     icon: '\u25c9', color: '#B8941F', bg: '#FFFBEE', border: '#F0D980' },
  framework_training: { label: 'Framework Training', icon: '\u25eb', color: '#0A2342', bg: '#EEF3FA', border: '#C0D0E8' },
  pdf_downloadable:   { label: 'PDF Resource',       icon: '\u2b21', color: '#9B0D44', bg: '#FDF0F5', border: '#F0B8CF' },
  lab_video:          { label: 'Lab Video',          icon: '\u25b7', color: '#B8941F', bg: '#FFFBEE', border: '#F0D980' },
};

const TIER_BADGE: Record<TierRequired, { label: string; color: string; bg: string } | null> = {
  all: null,
  navigator:   { label: 'NAVIGATOR',   color: '#0A2342', bg: '#C0D0E8' },
  accelerator: { label: 'ACCELERATOR', color: '#7A5C00', bg: '#F0D980' },
};

const TIER_RANK: Record<Tier, number> = { free: 0, paid: 1, navigator: 2, accelerator: 3 };

// --- Agent framework map ---
const AGENT_FRAMEWORK_MAP: Record<string, { framework: string; specialty: string }> = {
  'Dominique Carter': { framework: 'DRU CLEAR\u2122', specialty: 'Clarity & Leadership' },
  'Elijah Brooks':    { framework: 'DRU CLEAR\u2122', specialty: 'Alignment, Execution & Results' },
  'Tariq Oladele':    { framework: 'AI Sales Mastery\u2122', specialty: 'AI Revenue Acceleration' },
  'Solange Dupont':   { framework: '5D Leadership\u2122', specialty: 'Self & People' },
  'Isaiah Webb':      { framework: '5D Leadership\u2122', specialty: 'Team, Org & Visionary' },
  'Nadia Osei':       { framework: '5C Cultural DNA\u2122', specialty: 'Communication & Connection' },
  'Victor Reyes':     { framework: '5C Cultural DNA\u2122', specialty: 'Collaboration & Culture' },
  'Sasha Kim':        { framework: 'AI Sales Mastery\u2122', specialty: 'DISC Behavioral Intelligence' },
  'Zoe Beaumont':     { framework: 'DRU AI Leadership Ecosystem\u2122', specialty: 'Community Leadership' },
  'Micah Santos':     { framework: 'DRU AI Leadership Ecosystem\u2122', specialty: 'Member Experience' },
};

// --- Helpers ---
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

// --- Soft moderation ---
const FLAGGED_KEYWORDS = ['fuck','shit','bitch','asshole','spam','scam','fraud','fake','click here','buy now'];
function checkFlagged(text: string): boolean {
  const lower = text.toLowerCase();
  return FLAGGED_KEYWORDS.some(kw => lower.includes(kw));
}

// --- Mention rendering ---
function renderWithMentions(text: string): React.ReactNode[] {
  const parts = text.split(/(@[A-Za-z]+(?:\s[A-Za-z]+)?)/g);
  return parts.map((part, i) =>
    part.startsWith('@')
      ? <span key={i} style={{ color: '#B8941F', fontWeight: '600' }}>{part}</span>
      : <span key={i}>{part}</span>
  );
}

// =============================================================================
// MEMBER AVATAR
// =============================================================================
function MemberAvatar({ firstName, photoUrl, size = 32 }: { firstName: string; photoUrl?: string; size?: number }) {
  const initials = firstName ? firstName.charAt(0).toUpperCase() : '?';
  const bgColors = ['#0A2342','#B8941F','#9B0D44','#1a6b3c','#4a3580'];
  const bg = bgColors[(firstName.charCodeAt(0) || 0) % bgColors.length];
  if (photoUrl) {
    return <img src={photoUrl} alt={firstName} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: `${Math.round(size * 0.38)}px`, fontWeight: '700', color: '#fff' }}>{initials}</span>
    </div>
  );
}

// =============================================================================
// COMMENT SECTION — with @mention, member avatars, notifications
// =============================================================================
function CommentSection({
  postId, userId, userName, open, onToggle, commentCount, setCommentCount,
}: {
  postId: string; userId: string; userName: string;
  open: boolean; onToggle: () => void;
  commentCount: number | null; setCommentCount: (fn: (n: number | null) => number | null) => void;
}) {
  const [comments, setComments]     = useState<CommunityComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionResults, setMentionResults] = useState<MemberProfile[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingComments(true);
    supabase
      .from('community_comments')
      .select('*, profiles(first_name, photo_url)')
      .eq('post_id', postId).eq('is_active', true).eq('is_flagged', false)
      .order('created_at', { ascending: true })
      .then(({ data }) => { setComments((data ?? []) as CommunityComment[]); setLoadingComments(false); });

    const channel = supabase.channel(`cc_comments_${postId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_comments', filter: `post_id=eq.${postId}` }, (payload) => {
        const c = payload.new as CommunityComment;
        if (c.is_active && !c.is_flagged) { setComments(prev => [...prev, c]); setCommentCount(n => (n ?? 0) + 1); }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'community_comments', filter: `post_id=eq.${postId}` }, (payload) => {
        const c = payload.new as CommunityComment;
        if (!c.is_active || c.is_flagged) { setComments(prev => prev.filter(x => x.id !== c.id)); setCommentCount(n => Math.max(0, (n ?? 1) - 1)); }
        else { setComments(prev => prev.map(x => x.id === c.id ? { ...x, content: c.content } : x)); }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'community_comments', filter: `post_id=eq.${postId}` }, (payload) => {
        setComments(prev => prev.filter(x => x.id !== (payload.old as CommunityComment).id));
        setCommentCount(n => Math.max(0, (n ?? 1) - 1));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [open, postId]);

  // @mention search
  useEffect(() => {
    if (!mentionSearch || mentionSearch.length < 1) { setMentionResults([]); return; }
    const timer = setTimeout(() => {
      supabase.from('profiles').select('id, first_name, photo_url')
        .in('tier', ['navigator', 'accelerator'])
        .ilike('first_name', `${mentionSearch}%`)
        .neq('id', userId).limit(6)
        .then(({ data }) => setMentionResults((data ?? []) as MemberProfile[]));
    }, 200);
    return () => clearTimeout(timer);
  }, [mentionSearch, userId]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNewComment(val);
    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const mentionMatch = textBefore.match(/@(\w*)$/);
    if (mentionMatch) { setMentionSearch(mentionMatch[1]); setShowMentions(true); }
    else { setShowMentions(false); setMentionSearch(''); }
  };

  const insertMention = (member: MemberProfile) => {
    const cursor = textareaRef.current?.selectionStart ?? newComment.length;
    const before = newComment.slice(0, cursor).replace(/@\w*$/, '');
    const after  = newComment.slice(cursor);
    setNewComment(`${before}@${member.first_name} ${after}`);
    setShowMentions(false); setMentionSearch('');
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const extractMentions = (text: string): string[] => {
    const matches = text.match(/@([A-Za-z]+(?:\s[A-Za-z]+)?)/g);
    return matches ? matches.map(m => m.slice(1).trim()) : [];
  };

  const fireMentionNotifications = async (commentId: string, text: string, postId: string) => {
    const names = extractMentions(text);
    if (!names.length) return;
    for (const name of names) {
      const { data: profiles } = await supabase
        .from('profiles').select('id').eq('first_name', name).in('tier', ['navigator','accelerator']).neq('id', userId);
      for (const p of profiles ?? []) {
        fetch('/api/send-notification', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient_id: p.id, sender_id: userId, post_id: postId,
            comment_id: commentId, type: 'mention',
            message: `${userName} mentioned you in a comment`,
            sender_name: userName,
          }),
        });
      }
    }
  };

  const fireReplyNotifications = async (commentId: string, postId: string, mentionedNames: string[]) => {
    const { data: prevComments } = await supabase
      .from('community_comments').select('member_id').eq('post_id', postId)
      .eq('is_active', true).neq('member_id', userId);
    const uniqueIds = [...new Set((prevComments ?? []).map((c: any) => c.member_id))];
    const { data: mentionedProfiles } = await supabase
      .from('profiles').select('id').in('first_name', mentionedNames);
    const mentionedIds = new Set((mentionedProfiles ?? []).map((p: any) => p.id));
    for (const rid of uniqueIds) {
      if (mentionedIds.has(rid)) continue;
      fetch('/api/send-notification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_id: rid, sender_id: userId, post_id: postId,
          comment_id: commentId, type: 'reply',
          message: `${userName} replied in a thread you're part of`,
          sender_name: userName,
        }),
      });
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || submitting || !userId) return;
    setSubmitting(true);
    const flagged = checkFlagged(newComment);
    const { data, error } = await supabase
      .from('community_comments')
      .insert({ post_id: postId, member_id: userId, content: newComment.trim(), is_flagged: flagged })
      .select('*, profiles(first_name, photo_url)').single();
    if (!error && data && !flagged) {
      setComments(prev => [...prev, data as CommunityComment]);
      setCommentCount(n => (n ?? 0) + 1);
      const mentions = extractMentions(newComment);
      fireMentionNotifications(data.id, newComment, postId);
      if (comments.length > 0) fireReplyNotifications(data.id, postId, mentions);
    }
    setNewComment(''); setSubmitting(false);
  };

  const handleEditSave = async (commentId: string) => {
    if (!editContent.trim()) return;
    const flagged = checkFlagged(editContent);
    await supabase.from('community_comments').update({ content: editContent.trim(), is_flagged: flagged }).eq('id', commentId);
    if (flagged) { setComments(prev => prev.filter(c => c.id !== commentId)); setCommentCount(n => Math.max(0, (n ?? 1) - 1)); }
    else { setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: editContent.trim() } : c)); }
    setEditingId(null); setEditContent('');
  };

  const handleDelete = async (commentId: string) => {
    await supabase.from('community_comments').update({ is_active: false }).eq('id', commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
    setCommentCount(n => Math.max(0, (n ?? 1) - 1));
  };

  const getDisplayName = (c: CommunityComment) => c.member_id === userId ? 'You' : (c as any).profiles?.first_name ?? 'Member';
  const getPhoto      = (c: CommunityComment) => (c as any).profiles?.photo_url;
  const countLabel    = commentCount === null ? '' : commentCount > 0 ? ` \u00b7 ${commentCount}` : '';

  return (
    <div>
      {open && (
        <div style={{ marginTop: '12px' }}>
          {loadingComments ? (
            <div style={{ color: 'rgba(10,35,66,0.35)', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', padding: '8px 0' }}>Loading...</div>
          ) : comments.length === 0 ? (
            <div style={{ color: 'rgba(10,35,66,0.3)', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', padding: '8px 0', fontStyle: 'italic' }}>No comments yet \u2014 be the first.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
              {comments.map(comment => (
                <div key={comment.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <MemberAvatar firstName={getDisplayName(comment)} photoUrl={getPhoto(comment)} size={28} />
                  <div style={{ flex: 1, background: '#FAFAF8', border: '1px solid #F0EDE8', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '700', color: '#0A2342' }}>{getDisplayName(comment)}</span>
                        <span style={{ color: 'rgba(10,35,66,0.3)', fontFamily: "'Montserrat', sans-serif", fontSize: '11px' }}>{formatDate(comment.created_at)}</span>
                      </div>
                      {comment.member_id === userId && editingId !== comment.id && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button onClick={() => { setEditingId(comment.id); setEditContent(comment.content); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(10,35,66,0.35)', fontSize: '13px', padding: '0' }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#0A2342'; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(10,35,66,0.35)'; }} title="Edit">\u270e</button>
                          <button onClick={() => handleDelete(comment.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(194,24,91,0.35)', fontSize: '13px', padding: '0' }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#C2185B'; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(194,24,91,0.35)'; }} title="Delete">\u2715</button>
                        </div>
                      )}
                    </div>
                    {editingId === comment.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={2} style={{ width: '100%', border: '1px solid #C0D0E8', borderRadius: '6px', padding: '8px 10px', fontFamily: "'Montserrat', sans-serif", fontSize: '13px', color: '#0A2342', background: '#fff', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleEditSave(comment.id)} style={{ background: '#0A2342', color: '#fff', border: 'none', borderRadius: '5px', padding: '6px 14px', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Save</button>
                          <button onClick={() => { setEditingId(null); setEditContent(''); }} style={{ background: 'none', color: 'rgba(10,35,66,0.45)', border: '1px solid #E8E4DF', borderRadius: '5px', padding: '6px 14px', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '13px', color: 'rgba(10,35,66,0.7)', lineHeight: '1.65', margin: '0' }}>
                        {renderWithMentions(comment.content)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* New comment input */}
          <div style={{ position: 'relative' }}>
            {showMentions && mentionResults.length > 0 && (
              <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E8E4DF', borderRadius: '8px', boxShadow: '0 4px 16px rgba(10,35,66,0.1)', zIndex: 50, marginBottom: '4px', overflow: 'hidden' }}>
                {mentionResults.map(member => (
                  <button key={member.id} onClick={() => insertMention(member)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FAFAF8'; }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}>
                    <MemberAvatar firstName={member.first_name} photoUrl={member.photo_url} size={26} />
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '13px', fontWeight: '600', color: '#0A2342' }}>{member.first_name}</span>
                  </button>
                ))}
              </div>
            )}
            <textarea ref={textareaRef} value={newComment} onChange={handleTextChange} placeholder="Add a comment... use @ to mention a member" rows={2}
              style={{ width: '100%', border: '1px solid #E8E4DF', borderRadius: '8px', padding: '10px 12px', fontFamily: "'Montserrat', sans-serif", fontSize: '13px', color: '#0A2342', background: '#fff', resize: 'vertical', outline: 'none', transition: 'border-color 0.15s', boxSizing: 'border-box' }}
              onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = '#C0D0E8'; }}
              onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = '#E8E4DF'; setTimeout(() => setShowMentions(false), 200); }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSubmit(); } if (e.key === 'Escape') setShowMentions(false); }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button onClick={handleSubmit} disabled={submitting || !newComment.trim()}
                style={{ background: newComment.trim() ? '#0A2342' : 'rgba(10,35,66,0.12)', color: newComment.trim() ? '#fff' : 'rgba(10,35,66,0.3)', border: 'none', borderRadius: '6px', padding: '8px 20px', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', cursor: newComment.trim() ? 'pointer' : 'default', transition: 'all 0.15s ease' }}>
                {submitting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// NOTIFICATION BELL — bell icon, panel, and settings
// =============================================================================
function NotificationBell({ userId, userFirstName, userPhotoUrl, onOpenSettings }: {
  userId: string; userFirstName: string; userPhotoUrl?: string; onOpenSettings: () => void;
}) {
  const [panelOpen, setPanelOpen]         = useState(false);
  const [notifications, setNotifications] = useState<CommunityNotification[]>([]);
  const [unread, setUnread]               = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    supabase.from('community_notifications').select('*').eq('recipient_id', userId)
      .order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => {
        const notifs = (data ?? []) as CommunityNotification[];
        setNotifications(notifs);
        setUnread(notifs.filter(n => !n.is_read).length);
      });

    const channel = supabase.channel(`notif_${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_notifications', filter: `recipient_id=eq.${userId}` }, (payload) => {
        const n = payload.new as CommunityNotification;
        setNotifications(prev => [n, ...prev]);
        setUnread(c => c + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setPanelOpen(false);
    };
    if (panelOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [panelOpen]);

  const markAllRead = async () => {
    await supabase.from('community_notifications').update({ is_read: true }).eq('recipient_id', userId).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnread(0);
  };

  const notifIcon: Record<NotifType, string> = {
    mention: '@', reply: '\u21aa', new_post: '\u25c6', new_agent_post: '\u25c6',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }} ref={panelRef}>

      {/* Bell */}
      <button onClick={() => { setPanelOpen(!panelOpen); if (!panelOpen && unread > 0) markAllRead(); }}
        style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(10,35,66,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span style={{ position: 'absolute', top: '0', right: '0', background: '#C2185B', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Montserrat', sans-serif", fontSize: '9px', fontWeight: '700' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Avatar — opens settings */}
      <button onClick={onOpenSettings} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', borderRadius: '50%' }}>
        <MemberAvatar firstName={userFirstName} photoUrl={userPhotoUrl} size={34} />
      </button>

      {/* Notification panel */}
      {panelOpen && (
        <div style={{ position: 'absolute', top: '44px', right: '0', width: '320px', background: '#fff', border: '1px solid #E8E4DF', borderRadius: '12px', boxShadow: '0 8px 32px rgba(10,35,66,0.12)', zIndex: 100, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #F0EDE8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: "'Cinzel', serif", fontSize: '13px', fontWeight: '600', color: '#0A2342', letterSpacing: '0.5px' }}>Notifications</span>
            {notifications.some(n => !n.is_read) && (
              <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', color: '#B8941F', fontWeight: '600' }}>Mark all read</button>
            )}
          </div>
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'rgba(10,35,66,0.35)', fontFamily: "'Montserrat', sans-serif", fontSize: '13px', fontStyle: 'italic' }}>No notifications yet</div>
            ) : notifications.map(n => (
              <div key={n.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F8F6F3', display: 'flex', alignItems: 'flex-start', gap: '10px', background: n.is_read ? '#fff' : '#FFFBEE', transition: 'background 0.2s' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: n.is_read ? '#F0EDE8' : '#F0D980', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '700', color: n.is_read ? 'rgba(10,35,66,0.4)' : '#7A5C00' }}>
                  {notifIcon[n.type] ?? '\u25c6'}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '12px', color: 'rgba(10,35,66,0.8)', lineHeight: '1.5', margin: '0 0 3px' }}>{n.message}</p>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', color: 'rgba(10,35,66,0.35)', margin: 0 }}>{formatDate(n.created_at)}</p>
                </div>
                {!n.is_read && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C2185B', flexShrink: 0, marginTop: '6px' }} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SETTINGS PANEL — profile photo + notification preferences
// =============================================================================
function SettingsPanel({ userId, userFirstName, userPhotoUrl, onClose, onPhotoUpdate }: {
  userId: string; userFirstName: string; userPhotoUrl?: string;
  onClose: () => void; onPhotoUpdate: (url: string) => void;
}) {
  const [tab, setTab]           = useState<'profile' | 'notifications'>('profile');
  const [prefs, setPrefs]       = useState<NotificationPreferences | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('notification_preferences').select('*').eq('user_id', userId).single()
      .then(({ data }) => { if (data) setPrefs(data as NotificationPreferences); });
    if ('Notification' in window) setPushEnabled(Notification.permission === 'granted');
  }, [userId]);

  const togglePref = async (key: keyof NotificationPreferences) => {
    if (!prefs) return;
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    await supabase.from('notification_preferences').update({ [key]: !prefs[key] }).eq('user_id', userId);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true);
    const ext  = file.name.split('.').pop();
    const path = `${userId}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (!uploadError) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      await supabase.from('profiles').update({ photo_url: url }).eq('id', userId);
      onPhotoUpdate(url);
    }
    setUploading(false);
  };

  const prefGroups: { key: string; label: string; push: keyof NotificationPreferences; inapp: keyof NotificationPreferences; email: keyof NotificationPreferences }[] = [
    { key: 'mention',        label: '@Mentions',         push: 'mention_push',        inapp: 'mention_inapp',        email: 'mention_email' },
    { key: 'reply',          label: 'Thread replies',    push: 'reply_push',          inapp: 'reply_inapp',          email: 'reply_email' },
    { key: 'new_agent_post', label: 'New agent posts',   push: 'new_agent_post_push', inapp: 'new_agent_post_inapp', email: 'new_agent_post_email' },
    { key: 'new_post',       label: 'New posts',         push: 'new_post_push',       inapp: 'new_post_inapp',       email: 'new_post_email' },
  ];

  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button onClick={onClick} style={{ width: '36px', height: '20px', borderRadius: '10px', background: on ? '#0A2342' : '#E8E4DF', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: '2px', left: on ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
    </button>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,35,66,0.4)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '80px 24px 0 0' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: '340px', background: '#fff', borderRadius: '14px', border: '1px solid #E8E4DF', boxShadow: '0 16px 48px rgba(10,35,66,0.15)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #F0EDE8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: "'Cinzel', serif", fontSize: '13px', fontWeight: '600', color: '#0A2342', letterSpacing: '0.5px' }}>Settings</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(10,35,66,0.4)', fontSize: '16px', padding: '0' }}>\u2715</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #F0EDE8' }}>
          {(['profile', 'notifications'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '10px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? '#0A2342' : 'transparent'}`, fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '600', color: tab === t ? '#0A2342' : 'rgba(10,35,66,0.4)', cursor: 'pointer', textTransform: 'capitalize', letterSpacing: '0.3px', transition: 'all 0.15s' }}>
              {t}
            </button>
          ))}
        </div>

        {/* Profile tab */}
        {tab === 'profile' && (
          <div style={{ padding: '20px 18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <MemberAvatar firstName={userFirstName} photoUrl={userPhotoUrl} size={72} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: '15px', fontWeight: '600', color: '#0A2342', marginBottom: '4px' }}>{userFirstName}</p>
                <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', color: 'rgba(10,35,66,0.4)' }}>Community Member</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                style={{ background: 'transparent', border: '1.5px solid #0A2342', borderRadius: '8px', padding: '9px 20px', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '700', color: '#0A2342', cursor: uploading ? 'default' : 'pointer', letterSpacing: '0.5px', opacity: uploading ? 0.5 : 1 }}>
                {uploading ? 'Uploading...' : userPhotoUrl ? 'Change Photo' : 'Upload Photo'}
              </button>
              {userPhotoUrl && (
                <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', color: 'rgba(10,35,66,0.35)', textAlign: 'center' }}>
                  Photo appears on your comments and profile
                </p>
              )}
            </div>
          </div>
        )}

        {/* Notifications tab */}
        {tab === 'notifications' && prefs && (
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '0' }}>
            {/* Push permission row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F0EDE8', marginBottom: '4px' }}>
              <div>
                <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '700', color: '#0A2342', margin: '0 0 2px' }}>Push notifications</p>
                <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', color: 'rgba(10,35,66,0.4)', margin: 0 }}>{pushEnabled ? 'Enabled on this device' : 'Not enabled on this device'}</p>
              </div>
              {!pushEnabled && (
                <button onClick={async () => {
                  const perm = await Notification.requestPermission();
                  if (perm === 'granted') setPushEnabled(true);
                }} style={{ background: '#0A2342', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Enable</button>
              )}
            </div>

            {/* Preference groups */}
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginBottom: '6px', paddingLeft: '120px' }}>
                {['Push', 'In-App', 'Email'].map(l => (
                  <span key={l} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '10px', fontWeight: '700', color: 'rgba(10,35,66,0.4)', textAlign: 'center', letterSpacing: '0.5px' }}>{l.toUpperCase()}</span>
                ))}
              </div>
              {prefGroups.map(group => (
                <div key={group.key} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F8F6F3' }}>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '12px', color: '#0A2342', width: '120px', flexShrink: 0 }}>{group.label}</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}><Toggle on={prefs[group.push]} onClick={() => togglePref(group.push)} /></div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}><Toggle on={prefs[group.inapp]} onClick={() => togglePref(group.inapp)} /></div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}><Toggle on={prefs[group.email]} onClick={() => togglePref(group.email)} /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// JOIN PAGE
// =============================================================================
function CommunityJoin() {
  return (
    <div style={{ minHeight: '100dvh', background: '#0A2342', display: 'flex', flexDirection: 'column' }}>
      <NavBar active="/community" />
      <main style={{ flex: 1, padding: '0 0 4rem' }}>
        <div style={{ background: 'linear-gradient(135deg, #0A2342 0%, #0d2d56 50%, #0A2342 100%)', borderBottom: '1px solid rgba(212,175,55,0.2)', padding: '3.5rem 1.5rem 3rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 300, background: 'radial-gradient(ellipse, rgba(194,24,91,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: '#C2185B', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '1rem' }}>\ud83d\udd25 Founders Special \u2014 Limited Time</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: '#FFFFFF', fontSize: 'clamp(1.75rem, 5vw, 2.75rem)', fontWeight: 700, lineHeight: 1.2, maxWidth: 640, margin: '0 auto 1rem' }}>Join the DRU AI Consulting<br /><span style={{ color: '#D4AF37' }}>Community Connection</span></h1>
          <p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.75)', fontSize: '0.95rem', lineHeight: 1.7, maxWidth: 520, margin: '0 auto 2rem' }}>A community built for leaders who are serious about navigating the AI era with clarity, confidence, and a concrete pathway forward.</p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.35)', borderRadius: 50, padding: '0.5rem 1.25rem' }}>
            <span style={{ color: '#D4AF37', fontSize: '0.75rem' }}>\u2b50</span>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: '#D4AF37', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Founding Members Lock In Pricing Forever</p>
          </div>
        </div>
        <div style={{ padding: '2.5rem 1.5rem', maxWidth: 720, margin: '0 auto' }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: '#D4AF37', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', textAlign: 'center', marginBottom: '1.5rem' }}>Choose Your Path</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ background: 'rgba(212,175,55,0.07)', borderBottom: '1px solid rgba(212,175,55,0.2)', padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  <div><p style={{ fontFamily: "'Montserrat', sans-serif", color: '#D4AF37', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>DRU CLEAR\u2122</p><h3 style={{ fontFamily: "'Playfair Display', serif", color: '#FFFFFF', fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.25rem' }}>Navigator</h3><p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.55)', fontSize: '0.75rem' }}>Self-directed AI leadership transformation</p></div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}><p style={{ fontFamily: "'Playfair Display', serif", color: '#D4AF37', fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 }}>$47</p><p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.5)', fontSize: '0.68rem' }}>/month</p><p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.35)', fontSize: '0.63rem', textDecoration: 'line-through', marginTop: '0.2rem' }}>normally $97</p></div>
                </div>
              </div>
              <div style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
                  {NAVIGATOR_FEATURES.map(f => (<div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}><span style={{ color: '#D4AF37', fontSize: '0.7rem', marginTop: 3, flexShrink: 0 }}>\u2713</span><p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.8)', fontSize: '0.78rem', lineHeight: 1.5 }}>{f}</p></div>))}
                </div>
                <a href={NAVIGATOR_PAYMENT_LINK} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '100%', background: 'transparent', border: '1.5px solid #D4AF37', borderRadius: 8, padding: '0.85rem', fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#D4AF37', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>Join as Navigator Founder \u2192</a>
              </div>
            </div>
            <div style={{ background: 'rgba(194,24,91,0.06)', border: '2px solid rgba(194,24,91,0.5)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ background: 'rgba(194,24,91,0.1)', borderBottom: '1px solid rgba(194,24,91,0.3)', padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}><div style={{ background: '#C2185B', borderRadius: 50, padding: '0.3rem 0.75rem', display: 'inline-block' }}><p style={{ fontFamily: "'Montserrat', sans-serif", color: '#FFFFFF', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>Best Value</p></div></div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  <div><p style={{ fontFamily: "'Montserrat', sans-serif", color: '#C2185B', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>DRU CLEAR\u2122</p><h3 style={{ fontFamily: "'Playfair Display', serif", color: '#FFFFFF', fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.25rem' }}>Accelerator</h3><p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.55)', fontSize: '0.75rem' }}>Premium access + monthly DeAnna video</p></div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}><p style={{ fontFamily: "'Playfair Display', serif", color: '#C2185B', fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 }}>$147</p><p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.5)', fontSize: '0.68rem' }}>/month</p><p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.35)', fontSize: '0.63rem', textDecoration: 'line-through', marginTop: '0.2rem' }}>normally $297</p></div>
                </div>
              </div>
              <div style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
                  {ACCELERATOR_FEATURES.map((f, i) => (<div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}><span style={{ color: i === 0 ? 'rgba(230,230,230,0.4)' : '#C2185B', fontSize: '0.7rem', marginTop: 3, flexShrink: 0 }}>{i === 0 ? '\u2014' : '\u2713'}</span><p style={{ fontFamily: "'Inter', sans-serif", color: i === 0 ? 'rgba(230,230,230,0.5)' : 'rgba(230,230,230,0.85)', fontSize: '0.78rem', lineHeight: 1.5, fontStyle: i === 0 ? 'italic' : 'normal' }}>{f}</p></div>))}
                </div>
                <a href={ACCELERATOR_PAYMENT_LINK} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '100%', background: '#C2185B', border: 'none', borderRadius: 8, padding: '0.85rem', fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#FFFFFF', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>Join as Accelerator Founder \u2192</a>
              </div>
            </div>
          </div>
          <div style={{ marginTop: '2rem', textAlign: 'center', padding: '1.25rem 1.5rem', background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 10 }}>
            <p style={{ fontFamily: "'Playfair Display', serif", color: '#FFFFFF', fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>The answers are already inside you.</p>
            <p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.55)', fontSize: '0.78rem', lineHeight: 1.6 }}>This community is where you find the clarity, the tools, and the people to move forward \u2014 with confidence \u2014 in the AI era.</p>
          </div>
          <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <p style={{ fontFamily: "'Inter', sans-serif", color: 'rgba(230,230,230,0.35)', fontSize: '0.75rem' }}>Already a member?</p>
            <a href="/login?redirect=/community" style={{ fontFamily: "'Montserrat', sans-serif", color: '#D4AF37', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textDecoration: 'none', borderBottom: '1px solid rgba(212,175,55,0.4)', paddingBottom: '1px' }}>Log in to access your content \u2192</a>
          </div>
        </div>
      </main>
      <footer style={{ textAlign: 'center', padding: '1rem', color: 'rgba(255,255,255,0.2)', fontFamily: "'Montserrat', sans-serif", fontSize: '0.65rem', letterSpacing: '0.04em' }}>\u00a9 2026 DRU CLEAR\u2122 \u00b7 All Rights Reserved \u00b7 DRU AI Consulting</footer>
    </div>
  );
}

// =============================================================================
// POST CARD — heart + comments interaction, agent info footer, no ask agent
// =============================================================================
function PostCard({ post, index, userId, userName }: { post: CommunityPost; index: number; userId: string; userName: string }) {
  const cfg      = POST_TYPE_CONFIG[post.post_type] ?? POST_TYPE_CONFIG.daily_insight;
  const tierBadge = TIER_BADGE[post.tier_required];
  const paragraphs = formatContent(post.content);
  const agentInfo  = AGENT_FRAMEWORK_MAP[post.agent_name];

  const [hearted, setHearted]         = useState(false);
  const [heartLoading, setHeartLoading] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase.from('community_reactions').select('id', { count: 'exact', head: true })
      .eq('post_id', post.id).eq('member_id', userId).eq('reaction_type', 'heart')
      .then(({ count }) => { if ((count ?? 0) > 0) setHearted(true); });
    supabase.from('community_comments').select('id', { count: 'exact', head: true })
      .eq('post_id', post.id).eq('is_active', true).eq('is_flagged', false)
      .then(({ count }) => { if (count !== null) setCommentCount(count); });
  }, [post.id, userId]);

  const handleHeart = async () => {
    if (!userId || heartLoading) return;
    setHeartLoading(true);
    if (hearted) {
      await supabase.from('community_reactions').delete().eq('post_id', post.id).eq('member_id', userId).eq('reaction_type', 'heart');
      setHearted(false);
    } else {
      await supabase.from('community_reactions').insert({ post_id: post.id, member_id: userId, reaction_type: 'heart' });
      setHearted(true);
    }
    setHeartLoading(false);
  };

  const countLabel = commentCount === null ? '' : commentCount > 0 ? ` \u00b7 ${commentCount}` : '';

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderTop: `3px solid ${cfg.color}`, borderRadius: '12px', padding: '28px 32px', animation: 'ccFadeIn 0.45s ease both', animationDelay: `${index * 55}ms`, boxShadow: '0 1px 4px rgba(10,35,66,0.06)', transition: 'box-shadow 0.2s ease' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(10,35,66,0.1)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(10,35,66,0.06)'; }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, fontSize: '10px', fontFamily: "'Cinzel', serif", letterSpacing: '1.5px', fontWeight: '600', padding: '4px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span>{cfg.icon}</span>{cfg.label.toUpperCase()}
          </span>
          {tierBadge && <span style={{ color: tierBadge.color, background: tierBadge.bg, fontSize: '9px', fontFamily: "'Montserrat', sans-serif", fontWeight: '700', letterSpacing: '1.5px', padding: '3px 8px', borderRadius: '3px' }}>{tierBadge.label}</span>}
        </div>
        <div style={{ color: 'rgba(10,35,66,0.35)', fontSize: '12px', fontFamily: "'Montserrat', sans-serif", whiteSpace: 'nowrap', flexShrink: 0 }}>{formatDate(post.published_at)}</div>
      </div>

      {/* Title */}
      <h3 style={{ fontFamily: "'Cinzel', serif", color: '#0A2342', fontSize: '17px', fontWeight: '600', lineHeight: '1.45', marginBottom: '16px' }}>{post.title}</h3>

      {/* Content */}
      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '14px', lineHeight: '1.85', color: 'rgba(10,35,66,0.7)' }}>
        {paragraphs.map((p, i) => <p key={i} style={{ marginBottom: '12px' }}>{p}</p>)}
      </div>

      {/* Footer */}
      <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #F0EDE8' }}>
        {/* Agent info */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ color: 'rgba(10,35,66,0.45)', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '600' }}>{post.agent_name}</span>
          {agentInfo && (
            <span style={{ color: 'rgba(10,35,66,0.3)', fontFamily: "'Montserrat', sans-serif", fontSize: '11px' }}>
              {agentInfo.framework} \u00b7 {agentInfo.specialty}
            </span>
          )}
        </div>

        {/* Interactions — heart first, comments second */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={handleHeart} disabled={heartLoading}
            style={{ background: 'none', border: 'none', cursor: heartLoading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '5px', padding: '0', transition: 'transform 0.15s ease' }}
            onMouseEnter={e => { if (!heartLoading) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.15)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}>
            <span style={{ fontSize: '17px', color: hearted ? '#C2185B' : 'rgba(10,35,66,0.3)', transition: 'color 0.15s ease' }}>{hearted ? '\u2665' : '\u2661'}</span>
          </button>
          <button onClick={() => setCommentsOpen(!commentsOpen)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', padding: '0', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '600', color: commentsOpen ? '#0A2342' : 'rgba(10,35,66,0.4)', transition: 'color 0.15s ease' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#0A2342'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = commentsOpen ? '#0A2342' : 'rgba(10,35,66,0.4)'; }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>Comments{countLabel}</span>
          </button>
        </div>
      </div>

      {/* Comments panel */}
      <CommentSection
        postId={post.id} userId={userId} userName={userName}
        open={commentsOpen} onToggle={() => setCommentsOpen(!commentsOpen)}
        commentCount={commentCount} setCommentCount={setCommentCount}
      />
    </div>
  );
}

function EmptyState({ filter }: { filter: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <div style={{ color: '#D4AF37', fontSize: '40px', marginBottom: '16px' }}>\u25c6</div>
      <div style={{ fontFamily: "'Cinzel', serif", color: 'rgba(10,35,66,0.4)', fontSize: '13px', letterSpacing: '2px', marginBottom: '8px' }}>
        {filter === 'all' ? 'NO POSTS YET' : `NO ${filter.replace(/_/g, ' ').toUpperCase()} POSTS YET`}
      </div>
      <div style={{ fontFamily: "'Montserrat', sans-serif", color: 'rgba(10,35,66,0.35)', fontSize: '13px', maxWidth: '320px', margin: '0 auto' }}>
        Your agents are working \u2014 content will appear here once approved.
      </div>
    </div>
  );
}

// =============================================================================
// COMMUNITY FEED
// =============================================================================
function CommunityFeed({ tier }: { tier: Tier }) {
  const [posts, setPosts]           = useState<CommunityPost[]>([]);
  const [loading, setLoading]       = useState(true);
  const [liveCount, setLiveCount]   = useState(0);
  const [pdfs, setPdfs]             = useState<{ name: string; url: string }[]>([]);
  const [showArchives, setShowArchives] = useState(false);
  const [userId, setUserId]         = useState('');
  const [userName, setUserName]     = useState('');
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pushRegistered, setPushRegistered] = useState(false);

  const loadPdfs = useCallback(async () => {
    const { data, error } = await supabase.storage.from('pdfs').list('', { sortBy: { column: 'created_at', order: 'desc' } });
    if (error || !data) return;
    setPdfs(data.filter(f => f.name.startsWith('CC_Framework_Training')).map(f => ({
      name: f.name.replace(/_/g, ' ').replace('.pdf', ''),
      url: supabase.storage.from('pdfs').getPublicUrl(f.name).data.publicUrl,
    })));
  }, []);

  const loadPosts = useCallback(async () => {
    const { data, error } = await supabase.from('community_posts').select('*').eq('is_active', true).order('published_at', { ascending: false }).limit(50);
    if (error) { console.error('[community feed]', error); return []; }
    return (data ?? []) as CommunityPost[];
  }, []);

  // Register service worker + push subscription once
  const registerPush = useCallback(async (uid: string) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) { setPushRegistered(true); return; }
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey });
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch('/api/subscribe-push', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }, body: JSON.stringify({ subscription: sub }) });
      setPushRegistered(true);
    } catch (err) { console.error('[push register]', err); }
  }, []);

  // Request push permission after 3s if not yet granted
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
      supabase.from('profiles').select('first_name, photo_url').eq('id', user.id).single().then(({ data }) => {
        if (data) { setUserName(data.first_name ?? ''); setUserPhotoUrl(data.photo_url ?? undefined); }
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
            setLiveCount(c => c + 1); return [updated, ...prev];
          });
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_posts' }, (payload) => {
        const newPost = payload.new as CommunityPost;
        if (newPost.is_active) { setLiveCount(c => c + 1); setPosts(prev => [newPost, ...prev]); }
      })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [loadPosts, loadPdfs, requestPushPermission, registerPush]);

  return (
    <div style={{ minHeight: '100dvh', background: '#FAFAF8', display: 'flex', flexDirection: 'column' }}>
      <NavBar active="/community" />

      <main style={{ flex: 1, padding: '40px 24px 80px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: '32px', animation: 'ccFadeIn 0.5s ease both' }}>
            <a href="/portal" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '600', color: 'rgba(10,35,66,0.45)', textDecoration: 'none', letterSpacing: '0.5px', marginBottom: '20px', transition: 'color 0.15s ease' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#0A2342'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(10,35,66,0.45)'; }}>
              \u2190 Back to Portal
            </a>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ color: '#B8941F', fontFamily: "'Cinzel', serif", fontSize: '10px', letterSpacing: '3px', fontWeight: '600', marginBottom: '8px' }}>DRU AI LEADERSHIP ECOSYSTEM\u2122</div>
                <h1 style={{ fontFamily: "'Cinzel', serif", color: '#0A2342', fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: '700', letterSpacing: '0.5px', lineHeight: '1.2' }}>Community Connection</h1>
                <p style={{ color: 'rgba(10,35,66,0.45)', fontFamily: "'Montserrat', sans-serif", fontSize: '14px', marginTop: '8px' }}>Daily insights, framework lessons, and action challenges from your AI team</p>
              </div>

              {/* Tier badge + bell + avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', alignSelf: 'flex-start' }}>
                <div style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: '8px', padding: '8px 16px', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', color: 'rgba(10,35,66,0.5)', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 1px 3px rgba(10,35,66,0.06)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: tierDotColor(tier), flexShrink: 0 }} />{tierLabel(tier)}
                </div>
                {userId && (
                  <NotificationBell
                    userId={userId} userFirstName={userName} userPhotoUrl={userPhotoUrl}
                    onOpenSettings={() => setSettingsOpen(true)}
                  />
                )}
              </div>
            </div>

            {liveCount > 0 && (
              <button onClick={() => { setLiveCount(0); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ marginTop: '14px', background: '#FFFBEE', border: '1px solid #F0D980', color: '#7A5C00', padding: '7px 16px', borderRadius: '6px', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '600', letterSpacing: '0.5px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                \u2191 {liveCount} new post{liveCount > 1 ? 's' : ''} just approved
              </button>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)', marginBottom: '28px' }} />

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[0,1,2].map(i => <div key={i} style={{ background: '#FFF', border: '1px solid #E8E4DF', borderRadius: '12px', height: '180px', animation: 'ccShimmer 1.5s ease infinite', animationDelay: `${i*150}ms` }} />)}
            </div>
          ) : (
            <>
              {/* PDF section */}
              {pdfs.length > 0 && (
                <div style={{ marginBottom: '28px' }}>
                  <a href={pdfs[0].url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', border: '1px solid #E8E4DF', borderLeft: '4px solid #0A2342', borderRadius: '10px', padding: '18px 24px', textDecoration: 'none', boxShadow: '0 1px 4px rgba(10,35,66,0.06)', transition: 'box-shadow 0.2s ease' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 16px rgba(10,35,66,0.1)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 1px 4px rgba(10,35,66,0.06)'; }}>
                    <div><div style={{ color: '#0A2342', fontFamily: "'Cinzel', serif", fontSize: '10px', letterSpacing: '2px', fontWeight: '600', marginBottom: '4px' }}>THIS WEEK</div><div style={{ color: '#0A2342', fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: '600' }}>Weekly Framework Training Content</div></div>
                    <div style={{ background: '#0A2342', color: '#fff', padding: '8px 16px', borderRadius: '6px', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '700', letterSpacing: '1px', whiteSpace: 'nowrap', flexShrink: 0 }}>DOWNLOAD \u2193</div>
                  </a>
                  {pdfs.length > 1 && (
                    <div style={{ marginTop: '10px' }}>
                      <button onClick={() => setShowArchives(!showArchives)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(10,35,66,0.45)', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '600', letterSpacing: '0.5px', padding: '6px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {showArchives ? '\u2191 Hide Archives' : '\u2193 Archives'}
                      </button>
                      {showArchives && (
                        <div style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: '10px', overflow: 'hidden', marginTop: '8px' }}>
                          {pdfs.slice(1).map((pdf, i) => (
                            <a key={pdf.name} href={pdf.url} target="_blank" rel="noopener noreferrer"
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < pdfs.length - 2 ? '1px solid #F0EDE8' : 'none', textDecoration: 'none', transition: 'background 0.15s ease' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#FAFAF8'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#FFFFFF'; }}>
                              <span style={{ color: 'rgba(10,35,66,0.65)', fontFamily: "'Montserrat', sans-serif", fontSize: '13px' }}>{pdf.name}</span>
                              <span style={{ color: '#B8941F', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '700', letterSpacing: '1px' }}>DOWNLOAD \u2193</span>
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
                  {posts.map((post, i) => <PostCard key={post.id} post={post} index={i} userId={userId} userName={userName} />)}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Upgrade pill — subtle, bottom right, navigator only */}
      {tier === 'navigator' && (
        <a href={ACCELERATOR_PAYMENT_LINK} target="_blank" rel="noopener noreferrer"
          style={{ position: 'fixed', bottom: '28px', right: '28px', background: '#B8941F', color: '#fff', padding: '8px 16px', borderRadius: '20px', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', textDecoration: 'none', boxShadow: '0 2px 12px rgba(184,148,31,0.3)', zIndex: 50, display: 'flex', alignItems: 'center', gap: '6px', transition: 'opacity 0.2s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.85'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}>
          \u2191 Upgrade
        </a>
      )}

      {/* Settings panel */}
      {settingsOpen && userId && (
        <SettingsPanel
          userId={userId} userFirstName={userName} userPhotoUrl={userPhotoUrl}
          onClose={() => setSettingsOpen(false)}
          onPhotoUpdate={(url) => setUserPhotoUrl(url)}
        />
      )}

      <footer style={{ textAlign: 'center', padding: '1rem', color: 'rgba(10,35,66,0.25)', fontFamily: "'Montserrat', sans-serif", fontSize: '0.65rem', letterSpacing: '0.04em', borderTop: '1px solid #E8E4DF' }}>
        \u00a9 2026 DRU CLEAR\u2122 \u00b7 All Rights Reserved \u00b7 DRU AI Consulting
      </footer>
    </div>
  );
}

// =============================================================================
// SMART DETECTION
// =============================================================================
export default function Community() {
  const [tier, setTier]       = useState<Tier | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setTier('free'); setChecking(false); return; }
        const { data } = await supabase.from('profiles').select('tier').eq('id', user.id).maybeSingle();
        setTier((data?.tier as Tier) ?? 'free');
      } catch { setTier('free'); } finally { setChecking(false); }
    };
    check();
  }, []);

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
          <div style={{ color: '#D4AF37', fontSize: '32px', animation: 'ccPulse 1.5s ease infinite' }}>\u25c6</div>
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
      {isMember ? <CommunityFeed tier={tier!} /> : <CommunityJoin />}
    </>
  );
}
