import { useState, useEffect, useRef } from 'react';
import { supabase, checkFlagged, formatRelativeTime } from './types';
import type { CommunityComment, MemberProfile } from './types';
import MemberAvatar from './MemberAvatar';

// ── Inline helper (JSX — kept here, not in types.ts) ─────────────────────────
function renderWithMentions(text: string): React.ReactNode[] {
  const parts = text.split(/(@[A-Za-z]+(?:\s[A-Za-z]+)?)/g);
  return parts.map((part, i) =>
    part.startsWith('@')
      ? <span key={i} style={{ color: '#B8941F', fontWeight: '600' }}>{part}</span>
      : <span key={i}>{part}</span>
  );
}

// =============================================================================
// COMMENT SECTION
// =============================================================================
export default function CommentSection({
  postId, userId, userName, open, onToggle, commentCount, setCommentCount,
}: {
  postId: string; userId: string; userName: string;
  open: boolean; onToggle: () => void;
  commentCount: number | null;
  setCommentCount: (fn: (n: number | null) => number | null) => void;
}) {
  const [comments, setComments]               = useState<CommunityComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment]           = useState('');
  const [submitting, setSubmitting]           = useState(false);
  const [editingId, setEditingId]             = useState<string | null>(null);
  const [editContent, setEditContent]         = useState('');
  const [mentionSearch, setMentionSearch]     = useState('');
  const [mentionResults, setMentionResults]   = useState<MemberProfile[]>([]);
  const [showMentions, setShowMentions]       = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingComments(true);
    supabase.from('community_comments')
      .select('*, profiles(first_name, photo_url)')
      .eq('post_id', postId).eq('is_active', true).eq('is_flagged', false)
      .order('created_at', { ascending: true })
      .then(({ data }) => { setComments((data ?? []) as CommunityComment[]); setLoadingComments(false); });

    const channel = supabase.channel(`cc_comments_${postId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_comments', filter: `post_id=eq.${postId}` }, (payload) => {
        const c = payload.new as CommunityComment;
        if (c.is_active && !c.is_flagged) {
          setComments(prev => {
            if (prev.find(x => x.id === c.id)) return prev;
            setCommentCount(n => (n ?? 0) + 1);
            return [...prev, c];
          });
        }
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

  useEffect(() => {
    if (!mentionSearch) { setMentionResults([]); return; }
    const t = setTimeout(() => {
      supabase.from('profiles').select('id, first_name, photo_url')
        .in('tier', ['navigator', 'accelerator'])
        .ilike('first_name', `${mentionSearch}%`)
        .neq('id', userId).limit(6)
        .then(({ data }) => setMentionResults((data ?? []) as MemberProfile[]));
    }, 200);
    return () => clearTimeout(t);
  }, [mentionSearch, userId]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNewComment(val);
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const m = before.match(/@(\w*)$/);
    if (m) { setMentionSearch(m[1]); setShowMentions(true); }
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

  const fireMentionNotifications = async (commentId: string, text: string, pid: string) => {
    const names = (text.match(/@([A-Za-z]+(?:\s[A-Za-z]+)?)/g) ?? []).map((m: string) => m.slice(1).trim());
    for (const name of names) {
      const { data: profiles } = await supabase.from('profiles').select('id').eq('first_name', name).in('tier', ['navigator','accelerator']).neq('id', userId);
      for (const p of profiles ?? []) {
        fetch('/api/send-notification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipient_id: p.id, sender_id: userId, post_id: pid, comment_id: commentId, type: 'mention', message: `${userName} mentioned you in a comment`, sender_name: userName }) });
      }
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || submitting || !userId) return;
    setSubmitting(true);
    const flagged = checkFlagged(newComment);
    const { data, error } = await supabase.from('community_comments')
      .insert({ post_id: postId, member_id: userId, content: newComment.trim(), is_flagged: flagged })
      .select('*, profiles(first_name, photo_url)').single();
    if (!error && data && !flagged) {
      setComments(prev => [...prev, data as CommunityComment]);
      setCommentCount(n => (n ?? 0) + 1);
      fireMentionNotifications(data.id, newComment, postId);
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

  // ── Display helpers — agent_name takes priority over profiles join ──────────
  const getDisplayName = (c: CommunityComment) =>
    c.agent_name ? c.agent_name : c.member_id === userId ? 'You' : (c as any).profiles?.first_name ?? 'Member';
  const getPhoto = (c: CommunityComment) =>
    c.agent_name ? null : (c as any).profiles?.photo_url;

  if (!open) return null;

  return (
    <div style={{ marginTop: '12px' }}>
      {loadingComments ? (
        <div style={{ color: 'rgba(10,35,66,0.35)', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', padding: '8px 0' }}>Loading...</div>
      ) : comments.length === 0 ? (
        <div style={{ color: 'rgba(10,35,66,0.3)', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', padding: '8px 0', fontStyle: 'italic' }}>No comments yet — be the first.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
          {comments.map(comment => (
            <div key={comment.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <MemberAvatar firstName={getDisplayName(comment)} photoUrl={getPhoto(comment)} size={28} />
              <div style={{ flex: 1, background: comment.agent_name ? '#EEF3FA' : '#FAFAF8', border: `1px solid ${comment.agent_name ? '#C0D0E8' : '#F0EDE8'}`, borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '700', color: '#0A2342' }}>{getDisplayName(comment)}</span>
                    {comment.agent_name && (
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'rgba(10,35,66,0.08)', color: '#0A2342', letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>DRU AI Consulting Team</span>
                    )}
                    <span style={{ color: 'rgba(10,35,66,0.3)', fontFamily: "'Montserrat', sans-serif", fontSize: '11px' }}>{formatRelativeTime(comment.created_at)}</span>
                  </div>
                  {!comment.agent_name && comment.member_id === userId && editingId !== comment.id && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => { setEditingId(comment.id); setEditContent(comment.content); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(10,35,66,0.35)', fontSize: '13px', padding: '0' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#0A2342'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(10,35,66,0.35)'; }}
                        title="Edit">✎</button>
                      <button onClick={() => handleDelete(comment.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(194,24,91,0.35)', fontSize: '13px', padding: '0' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#C2185B'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(194,24,91,0.35)'; }}
                        title="Delete">✕</button>
                    </div>
                  )}
                </div>
                {editingId === comment.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={2}
                      style={{ width: '100%', border: '1px solid #C0D0E8', borderRadius: '6px', padding: '8px 10px', fontFamily: "'Montserrat', sans-serif", fontSize: '13px', color: '#0A2342', background: '#fff', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleEditSave(comment.id)}
                        style={{ background: '#0A2342', color: '#fff', border: 'none', borderRadius: '5px', padding: '6px 14px', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Save</button>
                      <button onClick={() => { setEditingId(null); setEditContent(''); }}
                        style={{ background: 'none', color: 'rgba(10,35,66,0.45)', border: '1px solid #E8E4DF', borderRadius: '5px', padding: '6px 14px', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
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
              <button key={member.id} onClick={() => insertMention(member)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FAFAF8'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}>
                <MemberAvatar firstName={member.first_name} photoUrl={member.photo_url} size={26} />
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '13px', fontWeight: '600', color: '#0A2342' }}>{member.first_name}</span>
              </button>
            ))}
          </div>
        )}
        <textarea ref={textareaRef} value={newComment} onChange={handleTextChange}
          placeholder="Add a comment... use @ to mention a member" rows={2}
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
  );
}
