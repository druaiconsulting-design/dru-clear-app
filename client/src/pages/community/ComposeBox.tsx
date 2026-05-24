import { useState, useRef } from 'react';
import { supabase, checkFlagged } from './types';
import type { CommunityPost } from './types';
import MemberAvatar from './MemberAvatar';

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

// =============================================================================
// COMPOSE BOX
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

  // Image / GIF
  const [imageFile, setImageFile]       = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Video
  const [videoFile, setVideoFile]           = useState<File | null>(null);
  const [videoLink, setVideoLink]           = useState('');
  const [videoMode, setVideoMode]           = useState<'upload' | 'link'>('link');
  const [showVideoPanel, setShowVideoPanel] = useState(false);

  // PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef   = useRef<HTMLInputElement>(null);

  const MAX_CHARS      = 1000;
  const MAX_IMAGE_MB   = 10;
  const MAX_VIDEO_MB   = 25;
  const MAX_PDF_MB     = 5;

  const resetMedia = () => {
    setImageFile(null); setImagePreview(null);
    setVideoFile(null); setVideoLink(''); setShowVideoPanel(false); setVideoMode('link');
    setPdfFile(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (pdfInputRef.current)   pdfInputRef.current.value   = '';
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) { alert(`Image must be under ${MAX_IMAGE_MB}MB`); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) { alert(`Video must be under ${MAX_VIDEO_MB}MB`); return; }
    setVideoFile(file);
  };

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_PDF_MB * 1024 * 1024) { alert(`PDF must be under ${MAX_PDF_MB}MB`); return; }
    setPdfFile(file);
  };

  const hasContent = text.trim() || imageFile || videoFile || (videoLink.trim() && getVideoEmbed(videoLink)) || pdfFile;

  const handleSubmit = async () => {
    if (!hasContent || submitting || !userId) return;
    setSubmitting(true);

    let image_url: string | null = null;
    let video_url: string | null = null;
    let pdf_url:   string | null = null;

    // Upload image
    if (imageFile) {
      const ext  = imageFile.name.split('.').pop();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('community-images').upload(path, imageFile);
      if (!error) image_url = supabase.storage.from('community-images').getPublicUrl(path).data.publicUrl;
    }

    // Upload or save video link
    if (videoFile) {
      const ext  = videoFile.name.split('.').pop();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('community-videos').upload(path, videoFile);
      if (!error) video_url = supabase.storage.from('community-videos').getPublicUrl(path).data.publicUrl;
    } else if (videoLink.trim()) {
      video_url = videoLink.trim();
    }

    // Upload PDF
    if (pdfFile) {
      const path = `${userId}/${Date.now()}_${pdfFile.name.replace(/\s/g, '_')}`;
      const { error } = await supabase.storage.from('community-pdfs').upload(path, pdfFile);
      if (!error) pdf_url = supabase.storage.from('community-pdfs').getPublicUrl(path).data.publicUrl;
    }

    const content    = text.trim() || ' ';
    const isFlagged  = checkFlagged(content);
    const title      = content.slice(0, 80) + (content.length > 80 ? '...' : '');

    const { data, error } = await supabase.from('community_posts').insert({
      title,
      content,
      post_type:     'member_post',
      tier_required: 'navigator',
      agent_id:      userId,
      agent_name:    userName || 'Member',
      published_at:  new Date().toISOString(),
      is_active:     true,
      is_flagged:    isFlagged,
      ...(image_url ? { image_url } : {}),
      ...(video_url ? { video_url } : {}),
      ...(pdf_url   ? { pdf_url }   : {}),
    }).select('*').single();

    if (!error && data) {
      if (isFlagged) {
        // Write policy violation card to AdminApprovals — post is suppressed
        await supabase.from('approvals').insert({
          source:           'cc_post_flag',
          trigger_type:     'cc_post_flag',
          agent_name:       userName || 'Member',
          agent_role:       'Community Member',
          division:         'Community Connection',
          task_brief:       `Member: ${userName}\nMember ID: ${userId}\nPost ID: ${data.id}`,
          original_content: content,
          output:           `⚠ Policy Violation Detected\n\nMember: ${userName}\nMember ID: ${userId}\nPost ID: ${data.id}\n\n"${content.slice(0, 500)}${content.length > 500 ? '...' : ''}"`,
          edited_output:    null,
          status:           'pending',
          ghl_contact_id:   null,
          notify_deanna:    true,
          priority:         'HIGH',
          category:         'CC Post Triggers',
          platform:         null,
          context:          null,
          archived:         false,
        });
        // Silently close — post is suppressed, feed never receives it
      } else {
        onPostSubmitted(data as CommunityPost);
      }
      setText('');
      resetMedia();
      setExpanded(false);
    }
    setSubmitting(false);
  };

  // ── Icon button style ────────────────────────────────────────────────────────
  const iconBtn = (active?: boolean) => ({
    background: active ? 'rgba(10,35,66,0.08)' : 'none',
    border: `1px solid ${active ? '#C0D0E8' : '#E8E4DF'}`,
    borderRadius: '6px',
    padding: '6px 10px',
    cursor: 'pointer' as const,
    color: active ? '#0A2342' : 'rgba(10,35,66,0.45)',
    display: 'flex',
    alignItems: 'center' as const,
    gap: '5px',
    fontFamily: "'Montserrat', sans-serif",
    fontSize: '11px',
    fontWeight: '600' as const,
    transition: 'all 0.15s',
  });

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8E4DF', borderRadius: '12px', padding: '18px 24px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(10,35,66,0.06)' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <MemberAvatar firstName={userName} photoUrl={userPhotoUrl} size={40} />
        <div style={{ flex: 1 }}>
          {!expanded ? (
            <button onClick={() => setExpanded(true)}
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
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSubmit(); }
                  if (e.key === 'Escape') { setExpanded(false); setText(''); resetMedia(); }
                }}
              />

              {/* Image preview */}
              {imagePreview && (
                <div style={{ position: 'relative', marginTop: '10px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #E8E4DF' }}>
                  <img src={imagePreview} alt="Preview" style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', display: 'block' }} />
                  <button onClick={() => { setImageFile(null); setImagePreview(null); if (imageInputRef.current) imageInputRef.current.value = ''; }}
                    style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(10,35,66,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>
              )}

              {/* Video panel */}
              {showVideoPanel && (
                <div style={{ marginTop: '10px', border: '1px solid #E8E4DF', borderRadius: '8px', padding: '12px', background: '#FAFAF8' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    {(['link', 'upload'] as const).map(m => (
                      <button key={m} onClick={() => setVideoMode(m)}
                        style={{ ...iconBtn(videoMode === m), fontSize: '11px', padding: '5px 14px' }}>
                        {m === 'link' ? '🔗 Paste Link' : '⬆ Upload File'}
                      </button>
                    ))}
                  </div>
                  {videoMode === 'link' ? (
                    <div>
                      <input type="text" value={videoLink} onChange={e => setVideoLink(e.target.value)}
                        placeholder="Paste YouTube, Vimeo, or Loom link..."
                        style={{ width: '100%', border: '1px solid #C0D0E8', borderRadius: '6px', padding: '8px 12px', fontFamily: "'Montserrat', sans-serif", fontSize: '13px', color: '#0A2342', outline: 'none', boxSizing: 'border-box' }} />
                      {videoLink && !getVideoEmbed(videoLink) && (
                        <p style={{ color: '#C2185B', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', marginTop: '4px' }}>
                          Not a recognized video link. Paste a YouTube, Vimeo, or Loom URL.
                        </p>
                      )}
                      {videoLink && getVideoEmbed(videoLink) && (
                        <p style={{ color: '#4CAF50', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', marginTop: '4px' }}>✓ Video link recognized</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <input ref={videoInputRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/mov" onChange={handleVideoSelect} style={{ display: 'none' }} />
                      <button onClick={() => videoInputRef.current?.click()}
                        style={{ ...iconBtn(), width: '100%', justifyContent: 'center', padding: '10px' }}>
                        {videoFile ? `✓ ${videoFile.name}` : 'Choose video file (max 25MB)'}
                      </button>
                      {videoFile && (
                        <button onClick={() => { setVideoFile(null); if (videoInputRef.current) videoInputRef.current.value = ''; }}
                          style={{ background: 'none', border: 'none', color: '#C2185B', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', cursor: 'pointer', marginTop: '4px', padding: '0' }}>
                          Remove video
                        </button>
                      )}
                    </div>
                  )}
                  <button onClick={() => { setShowVideoPanel(false); setVideoFile(null); setVideoLink(''); if (videoInputRef.current) videoInputRef.current.value = ''; }}
                    style={{ background: 'none', border: 'none', color: 'rgba(10,35,66,0.35)', fontFamily: "'Montserrat', sans-serif", fontSize: '11px', cursor: 'pointer', marginTop: '8px', padding: '0' }}>
                    Remove video
                  </button>
                </div>
              )}

              {/* PDF preview */}
              {pdfFile && (
                <div style={{ marginTop: '10px', border: '1px solid #E8E4DF', borderRadius: '8px', padding: '10px 14px', background: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>📄</span>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '12px', color: '#0A2342', fontWeight: '600' }}>{pdfFile.name}</span>
                  </div>
                  <button onClick={() => { setPdfFile(null); if (pdfInputRef.current) pdfInputRef.current.value = ''; }}
                    style={{ background: 'none', border: 'none', color: '#C2185B', cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>✕</button>
                </div>
              )}

              {/* Hidden file inputs */}
              <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
              <input ref={pdfInputRef}   type="file" accept="application/pdf" onChange={handlePdfSelect} style={{ display: 'none' }} />

              {/* Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {/* Photo/GIF */}
                  <button onClick={() => imageInputRef.current?.click()} style={iconBtn(!!imageFile)}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#C0D0E8'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = imageFile ? '#C0D0E8' : '#E8E4DF'; }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                    Photo/GIF
                  </button>

                  {/* Video */}
                  <button onClick={() => setShowVideoPanel(!showVideoPanel)} style={iconBtn(showVideoPanel || !!videoFile || !!videoLink)}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#C0D0E8'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = (showVideoPanel || videoFile || videoLink) ? '#C0D0E8' : '#E8E4DF'; }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                    </svg>
                    Video
                  </button>

                  {/* PDF */}
                  <button onClick={() => pdfInputRef.current?.click()} style={iconBtn(!!pdfFile)}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#C0D0E8'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = pdfFile ? '#C0D0E8' : '#E8E4DF'; }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                    PDF
                  </button>

                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '11px', color: text.length > MAX_CHARS * 0.85 ? '#C2185B' : 'rgba(10,35,66,0.3)' }}>
                    {text.length}/{MAX_CHARS}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={() => { setExpanded(false); setText(''); resetMedia(); }}
                    style={{ background: 'none', border: '1px solid #E8E4DF', borderRadius: '6px', padding: '8px 16px', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '600', color: 'rgba(10,35,66,0.45)', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={handleSubmit} disabled={!hasContent || submitting}
                    style={{ background: hasContent ? '#0A2342' : 'rgba(10,35,66,0.12)', color: hasContent ? '#fff' : 'rgba(10,35,66,0.3)', border: 'none', borderRadius: '6px', padding: '8px 20px', fontFamily: "'Montserrat', sans-serif", fontSize: '12px', fontWeight: '700', letterSpacing: '0.5px', cursor: hasContent ? 'pointer' : 'default', transition: 'all 0.15s' }}>
                    {submitting ? 'Posting...' : 'Post'}
                  </button>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '10px', color: 'rgba(10,35,66,0.3)' }}>Shift+Enter for new line</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
