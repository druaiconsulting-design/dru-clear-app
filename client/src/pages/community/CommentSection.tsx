import { useState, useEffect, useRef } from 'react';
import { supabase, checkFlagged, formatRelativeTime } from './types';
import type { CommunityComment, MemberProfile } from './types';
import MemberAvatar from './MemberAvatar';

function renderWithMentions(text: string): React.ReactNode[] {
  const parts = text.split(/(@[A-Za-z]+(?:\s[A-Za-z]+)?)/g);
  return parts.map((part, i) =>
    part.startsWith('@')
      ? <span key={i} style={{ color: '#B8941F', fontWeight: '600' }}>{part}</span>
      : <span key={i}>{part}</span>
  );
}

// =============================================================================
// COMMENT SECTION — hearts + likes + replies (one level deep)
// =============================================================================
export default function CommentSection({
  postId, userId, userName, open, onToggle, commentCount, setCommentCount,
}: {
  postId: string; userId: string; userName: string;
  open: boolean; onToggle: () => void;
  commentCount: number | null;
  setCommentCount: (fn: (n: number | null) => number | null) => void;
}) {
  const [comments,        setComments]        = useState<CommunityComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment,      setNewComment]      = useState('');
  const [submitting,      setSubmitting]      = useState(false);
  const [editingId,       setEditingId]       = useState<string | null>(null);
  const [editContent,     setEditContent]     = useState('');
  const [mentionSearch,   setMentionSearch]   = useState('');
  const [mentionResults,  setMentionResults]  = useState<MemberProfile[]>([]);
  const [showMentions,    setShowMentions]    = useState(false);

  // ── Hearts ─────────────────────────────────────────────────────────────────
  const [heartedComments,      setHeartedComments]      = useState<Record<string, boolean>>({});
  const [heartLoadingComments, setHeartLoadingComments] = useState<Record<string, boolean>>({});

  // ── Likes ──────────────────────────────────────────────────────────────────
  const [likedComments,      setLikedComments]      = useState<Record<string, boolean>>({});
  const [likeLoadingComments, setLikeLoadingComments] = useState<Record<string, boolean>>({});
  const [likeCounts,          setLikeCounts]          = useState<Record<string, number>>({});

  // ── Replies ────────────────────────────────────────────────────────────────
  const [replyingToId,   setReplyingToId]   = useState<string | null>(null);
  const [replyContent,   setReplyContent]   = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Load comments + reactions ──────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setLoadingComments(true);

    supabase.from('community_comments')
      .select('*, profiles(first_name, photo_url)')
      .eq('post_id', postId).eq('is_active', true).eq('is_flagged', false)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        const loaded = (data ?? []) as CommunityComment[];
        setComments(loaded);
        setLoadingComments(false);

        if (loaded.length > 0 && userId) {
          const ids = loaded.map(c => c.id);

          // Batch fetch all reactions for this post's comments
          supabase.from('community_reactions')
            .select('comment_id, reaction_type, member_id')
            .in('comment_id', ids)
            .then(({ data: rData }) => {
              const hm: Record<string, boolean> = {};
              const lm: Record<string, boolean> = {};
              const lc: Record<string, number>  = {};
              (rData ?? []).forEach((r: any) => {
                if (!r.comment_id) return;
                // Like counts visible to everyone
                if (r.reaction_type === 'like') {
                  lc[r.comment_id] = (lc[r.comment_id] ?? 0) + 1;
                }
                // Per-user state
                if (r.member_id === userId) {
                  if (r.reaction_type === 'heart') hm[r.comment_id] = true;
                  if (r.reaction_type === 'like')  lm[r.comment_id] = true;
                }
              });
              setHeartedComments(hm);
              setLikedComments(lm);
              setLikeCounts(lc);
            });
        }
      });

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
        if (!c.is_active || c.is_flagged) {
          setComments(prev => prev.filter(x => x.id !== c.id));
          setCommentCount(n => Math.max(0, (n ?? 1) - 1));
        } else {
          setComments(prev => prev.map(x => x.id === c.id ? { ...x, content: c.content } : x));
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'community_comments', filter: `post_id=eq.${postId}` }, (payload) => {
        setComments(prev => prev.filter(x => x.id !== (payload.old as CommunityComment).id));
        setCommentCount(n => Math.max(0, (n ?? 1) - 1));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [open, postId]);

  // ── Mention search ─────────────────────────────────────────────────────────
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

  // ── Submit top-level comment ───────────────────────────────────────────────
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

  // ── Submit reply ───────────────────────────────────────────────────────────
  const handleReplySubmit = async (parentCommentId: string) => {
    if (!replyContent.trim() || replySubmitting || !userId) return;
    setReplySubmitting(true);
    const flagged = checkFlagged(replyContent);
    const { data, error } = await supabase.from('community_comments')
      .insert({
        post_id: postId,
        member_id: userId,
        content: replyContent.trim(),
        parent_comment_id: parentCommentId,
        is_flagged: flagged,
      })
      .select('*, profiles(first_name, photo_url)').single();
    if (!error && data && !flagged) {
      setComments(prev => [...prev, data as CommunityComment]);
      setCommentCount(n => (n ?? 0) + 1);
    }
    setReplyContent('');
    setReplyingToId(null);
    setReplySubmitting(false);
  };

  const handleEditSave = async (commentId: string) => {
    if (!editContent.trim()) return;
    const flagged = checkFlagged(editContent);
    await supabase.from('community_comments').update({ content: editContent.trim(), is_flagged: flagged }).eq('id', commentId);
    if (flagged) {
      setComments(prev => prev.filter(c => c.id !== commentId));
      setCommentCount(n => Math.max(0, (n ?? 1) - 1));
    } else {
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: editContent.trim() } : c));
    }
    setEditingId(null); setEditContent('');
  };

  const handleDelete = async (commentId: string) => {
    await supabase.from('community_comments').update({ is_active: false }).eq('id', commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
    setCommentCount(n => Math.max(0, (n ?? 1) - 1));
  };

  // ── Heart toggle ───────────────────────────────────────────────────────────
  const handleCommentHeart = async (commentId: string) => {
    if (!userId || heartLoadingComments[commentId]) return;
    setHeartLoadingComments(prev => ({ ...prev, [commentId]: true }));
    if (heartedComments[commentId]) {
      await supabase.from('community_reactions').delete()
        .eq('comment_id', commentId).eq('member_id', userId)
        .eq('reaction_type', 'heart');
      setHeartedComments(prev => ({ ...prev, [commentId]: false }));
    } else {
      await supabase.from('community_reactions')
        .insert({ comment_id: commentId, member_id: userId, reaction_type: 'heart' });
      setHeartedComments(prev => ({ ...prev, [commentId]: true }));
    }
    setHeartLoadingComments(prev => ({ ...prev, [commentId]: false }));
  };

  // ── Like toggle ────────────────────────────────────────────────────────────
  const handleCommentLike = async (commentId: string) => {
    if (!userId || likeLoadingComments[commentId]) return;
    setLikeLoadingComments(prev => ({ ...prev, [commentId]: true }));
    if (likedComments[commentId]) {
      await supabase.from('community_reactions').delete()
        .eq('comment_id', commentId).eq('member_id', userId)
        .eq('reaction_type', 'like');
      setLikedComments(prev => ({ ...prev, [commentId]: false }));
      setLikeCounts(prev => ({ ...prev, [commentId]: Math.max(0, (prev[commentId] ?? 1) - 1) }));
    } else {
      await supabase.from('community_reactions')
        .insert({ comment_id: commentId, member_id: userId, reaction_type: 'like' });
      setLikedComments(prev => ({ ...prev, [commentId]: true }));
      setLikeCounts(prev => ({ ...prev, [commentId]: (prev[commentId] ?? 0) + 1 }));
    }
    setLikeLoadingComments(prev => ({ ...prev, [commentId]: false }));
  };

  const getDisplayName = (c: CommunityComment) =>
    c.agent_name ? c.agent_name : c.member_id === userId ? 'You' : (c as any).profiles?.first_name ?? 'Member';
  const getPhoto = (c: CommunityComment) =>
    c.agent_name ? null : (c as any).profiles?.photo_url;

  // ── Nest comments: top-level + their replies ───────────────────────────────
  const topLevel = comments.filter(c => !(c as any).parent_comment_id);
  const repliesFor = (parentId: string) => comments.filter(c => (c as any).parent_comment_id === parentId);

  if (!open) return null;

  // ── Render a single comment row ────────────────────────────────────────────
  const renderComment = (comment: CommunityComment, isReply = false) => (
    <div key={comment.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <MemberAvatar firstName={getDisplayName(comment)} photoUrl={getPhoto(comment)} size={isReply ? 24 : 28} />
      <div style={{ flex: 1, background: comment.agent_name ? '#EEF3FA' : '#FAFAF8', border: `1px solid ${comment.agent_name ? '#C0D0E8' : '#F0EDE8'}`, borderRadius: '8px', padding: '10px 12px' }}>

        {/* Header */}
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

        {/* Content or edit form */}
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
          <>
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '13px', color: 'rgba(10,35,66,0.7)', lineHeight: '1.65', margin: '0' }}>
              {renderWithMentions(comment.content)}
            </p>

            {/* ── Reaction row: Heart · Like · Reply ─────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '8px' }}>

              {/* Heart — toggle only, no count */}
              <button
                onClick={() => handleCommentHeart(comment.id)}
                disabled={heartLoadingComments[comment.id]}
                aria-label={heartedComments[comment.id] ? 'Remove heart' : 'Heart'}
                style={{ background: 'none', border: 'none', cursor: heartLoadingComments[comment.id] ? 'default' : 'pointer', padding: '0', display: 'inline-flex', alignItems: 'center', transition: 'transform 0.15s ease' }}
                onMouseEnter={e => { if (!heartLoadingComments[comment.id]) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
              >
                <span style={{ fontSize: '13px', color: heartedComments[comment.id] ? '#C2185B' : 'rgba(10,35,66,0.22)', transition: 'color 0.15s ease' }}>
                  {heartedComments[comment.id] ? '♥' : '♡'}
                </span>
              </button>

              {/* Like — toggle with count */}
              <button
                onClick={() => handleCommentLike(comment.id)}
                disabled={likeLoadingComments[comment.id]}
                aria-label={likedComments[comment.id] ? 'Remove like' : 'Like'}
                style={{ background: 'none', border: 'none', cursor: likeLoadingComments[comment.id] ? 'default' : 'pointer', padding: '0', display: 'inline-flex', alignItems: 'center', gap: '4px', transition: 'transform 0.15s ease' }}
                onMouseEnter={e => { if (!likeLoadingComments[comment.id]) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
              >
                <span style={{ fontSize: '13px', color: likedComments[comment.id] ? '#B8941F' : 'rgba(10,35,66,0.22)', transition: 'color 0.15s ease' }}>
                  👍
                </span>
                {(likeCounts[comment.id] ?? 0) > 0 && (
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '600', color: likedComments[comment.id] ? '#B8941F' : 'rgba(10,35,66,0.4)', transition: 'color 0.15s ease' }}>
                    {likeCounts[comment.id]}
                  </span>
                )}
              </button>

              {/* Reply — top-level comments only */}
              {!isReply && (
                <button
                  onClick={() => setReplyingToId(replyingToId === comment.id ? null : comment.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '600', color: replyingToId === comment.id ? '#0A2342' : 'rgba(10,35,66,0.35)', letterSpacing: '0.3px', transition: 'color 0.15s ease' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#0A2342'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = replyingToId === comment.id ? '#0A2342' : 'rgba(10,35,66,0.35)'; }}
                >
                  Reply
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ marginTop: '12px' }}>
      {loadingComments ? (
        <div style={{ color: 'rgba(10,35,66,0.35)', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', padding: '8px 0' }}>Loading...</div>
      ) : comments.length === 0 ? (
        <div style={{ color: 'rgba(10,35,66,0.3)', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', padding: '8px 0', fontStyle: 'italic' }}>No comments yet — be the first.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
          {topLevel.map(comment => (
            <div key={comment.id}>
              {renderComment(comment, false)}

              {/* Inline reply input */}
              {replyingToId === comment.id && (
                <div style={{ marginTop: '8px', marginLeft: '38px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <textarea
                    value={replyContent}
                    onChange={e => setReplyContent(e.target.value)}
                    placeholder={`Reply to ${getDisplayName(comment)}...`}
                    rows={2}
                    autoFocus
                    style={{ width: '100%', border: '1px solid #C0D0E8', borderRadius: '8px', padding: '8px 12px', fontFamily: "'Montserrat', sans-serif", fontSize: '13px', color: '#0A2342', background: '#fff', resize: 'none', outline: 'none', boxSizing: 'border-box' }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleReplySubmit(comment.id); } if (e.key === 'Escape') { setReplyingToId(null); setReplyContent(''); } }}
                  />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={() => { setReplyingToId(null); setReplyContent(''); }}
                      style={{ background: 'none', color: 'rgba(10,35,66,0.45)', border: '1px solid #E8E4DF', borderRadius: '6px', padding: '6px 14px', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', cursor: 'pointer' }}>
                      Cancel
                    </button>
                    <button onClick={() => handleReplySubmit(comment.id)} disabled={replySubmitting || !replyContent.trim()}
                      style={{ background: replyContent.trim() ? '#0A2342' : 'rgba(10,35,66,0.12)', color: replyContent.trim() ? '#fff' : 'rgba(10,35,66,0.3)', border: 'none', borderRadius: '6px', padding: '6px 16px', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '700', cursor: replyContent.trim() ? 'pointer' : 'default', transition: 'all 0.15s' }}>
                      {replySubmitting ? 'Posting...' : 'Reply'}
                    </button>
                  </div>
                </div>
              )}

              {/* Nested replies — indented, one level */}
              {repliesFor(comment.id).length > 0 && (
                <div style={{ marginTop: '8px', marginLeft: '38px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {repliesFor(comment.id).map(reply => renderComment(reply, true))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New top-level comment input */}
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
