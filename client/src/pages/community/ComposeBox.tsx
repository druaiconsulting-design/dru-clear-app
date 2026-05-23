import { useState, useRef } from 'react';
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
  const [text, setText]               = useState('');
  const [expanded, setExpanded]       = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [imageFile, setImageFile]     = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading]     = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX_CHARS = 1000;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!text.trim() && !imageFile) return;
    if (submitting || !userId) return;
    setSubmitting(true);

    let image_url: string | null = null;

    if (imageFile) {
      setUploading(true);
      const ext  = imageFile.name.split('.').pop();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('community-images').upload(path, imageFile, { upsert: false });
      if (!uploadError) {
        const { data } = supabase.storage.from('community-images').getPublicUrl(path);
        image_url = data.publicUrl;
      }
      setUploading(false);
    }

    const content = text.trim() || ' ';
    const title   = content.slice(0, 80) + (content.length > 80 ? '...' : '');

    const { data, error } = await supabase.from('community_posts').insert({
      title,
      content,
      post_type:     'member_post',
      tier_required: 'navigator',
      agent_id:      userId,
      agent_name:    userName || 'Member',
      published_at:  new Date().toISOString(),
      is_active:     true,
      ...(image_url ? { image_url } : {}),
    }).select('*').single();

    if (!error && data) {
      onPostSubmitted(data as CommunityPost);
      setText('');
      setImageFile(null);
      setImagePreview(null);
      setExpanded(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
                onKeyDown={e => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void handleSubmit(); }
                  if (e.key === 'Escape') { setExpanded(false); setText(''); removeImage(); }
                }}
              />

              {/* Image preview */}
              {imagePreview && (
                <div style={{ position: 'relative', marginTop: '10px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #E8E4DF' }}>
                  <img src={imagePreview} alt="Preview" style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', display: 'block' }} />
                  <button onClick={removeImage}
                    style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(10,35,66,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    ✕
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Image upload button */}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
                  <button onClick={() => fileInputRef.current?.click()}
                    style={{ background: 'none', border: '1px solid #E8E4DF', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', color: 'rgba(10,35,66,0.45)', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', fontWeight: '600', transition: 'all 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#C0D0E8'; (e.currentTarget as HTMLButtonElement).style.color = '#0A2342'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E8E4DF'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(10,35,66,0.45)'; }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                    Photo
                  </button>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', color: text.length > MAX_CHARS * 0.85 ? '#C2185B' : 'rgba(10,35,66,0.3)' }}>
                    {text.length}/{MAX_CHARS}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => { setExpanded(false); setText(''); removeImage(); }}
                    style={{ background: 'none', border: '1px solid #E8E4DF', borderRadius: '6px', padding: '8px 16px', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '600', color: 'rgba(10,35,66,0.45)', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={(!text.trim() && !imageFile) || submitting}
                    style={{ background: (text.trim() || imageFile) ? '#0A2342' : 'rgba(10,35,66,0.12)', color: (text.trim() || imageFile) ? '#fff' : 'rgba(10,35,66,0.3)', border: 'none', borderRadius: '6px', padding: '8px 20px', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '700', letterSpacing: '0.5px', cursor: (text.trim() || imageFile) ? 'pointer' : 'default', transition: 'all 0.15s' }}>
                    {uploading ? 'Uploading...' : submitting ? 'Posting...' : 'Post'}
                  </button>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '10px', color: 'rgba(10,35,66,0.3)' }}>Ctrl+Enter</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
