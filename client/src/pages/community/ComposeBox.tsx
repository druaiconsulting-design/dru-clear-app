import { useState } from 'react';
import { supabase } from './types';
import type { CommunityPost } from './types';
import MemberAvatar from './MemberAvatar';

// =============================================================================
// COMPOSE BOX — member post creation, pinned top of feed
// =============================================================================
export default function ComposeBox({
  userId, userName, userPhotoUrl, onPostSubmitted,
}: {
  userId: string; userName: string; userPhotoUrl?: string;
  onPostSubmitted: (post: CommunityPost) => void;
}) {
  const [text, setText]           = useState('');
  const [expanded, setExpanded]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const MAX_CHARS = 1000;

  const handleSubmit = async () => {
    if (!text.trim() || submitting || !userId) return;
    setSubmitting(true);
    const title = text.trim().slice(0, 80) + (text.trim().length > 80 ? '...' : '');
    const { data, error } = await supabase.from('community_posts').insert({
      title,
      content:       text.trim(),
      post_type:     'member_post',
      tier_required: 'navigator',
      user_id:       userId,
      agent_id:      userId,
      agent_name:    userName || 'Member',
      published_at:  new Date().toISOString(),
      is_active:     true,
    }).select('*').single();
    if (!error && data) {
      onPostSubmitted(data as CommunityPost);
      setText('');
      setExpanded(false);
    }
    setSubmitting(false);
  };

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: '12px', padding: '18px 24px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(10,35,66,0.06)' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <MemberAvatar firstName={userName} photoUrl={userPhotoUrl} size={40} />
        <div style={{ flex: 1 }}>
          {!expanded ? (
            <button
              onClick={() => setExpanded(true)}
              style={{ width: '100%', background: '#FAFAF8', border: '1.5px solid #E8E4DF', borderRadius: '24px', padding: '12px 18px', textAlign: 'left', fontFamily: "'Montserrat', sans-serif", fontSize: '14px', color: 'rgba(10,35,66,0.35)', cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#C0D0E8'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E8E4DF'; }}>
              Share with the community...
            </button>
          ) : (
            <div>
              <textarea
                autoFocus
                value={text}
                onChange={e => setText(e.target.value.slice(0, MAX_CHARS))}
                placeholder="Share with the community..."
                rows={4}
                style={{ width: '100%', border: '1.5px solid #C0D0E8', borderRadius: '10px', padding: '12px 14px', fontFamily: "'Montserrat', sans-serif", fontSize: '14px', color: '#0A2342', background: '#fff', resize: 'vertical', outline: 'none', lineHeight: '1.65', boxSizing: 'border-box' }}
                onKeyDown={e => { if (e.key === 'Escape') { setExpanded(false); setText(''); } }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', color: text.length > MAX_CHARS * 0.85 ? '#C2185B' : 'rgba(10,35,66,0.3)' }}>
                  {text.length}/{MAX_CHARS}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => { setExpanded(false); setText(''); }}
                    style={{ background: 'none', border: '1px solid #E8E4DF', borderRadius: '6px', padding: '8px 16px', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '600', color: 'rgba(10,35,66,0.45)', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!text.trim() || submitting}
                    style={{ background: text.trim() ? '#0A2342' : 'rgba(10,35,66,0.12)', color: text.trim() ? '#fff' : 'rgba(10,35,66,0.3)', border: 'none', borderRadius: '6px', padding: '8px 20px', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '700', letterSpacing: '0.5px', cursor: text.trim() ? 'pointer' : 'default', transition: 'all 0.15s' }}>
                    {submitting ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
