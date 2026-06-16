import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const NAVIGATOR_PAYMENT_LINK   = 'https://link.druaiconsulting.com/payment-link/69ead3017dd3512d920794b0';
export const ACCELERATOR_PAYMENT_LINK = 'https://link.druaiconsulting.com/payment-link/69ead3d37dd3512d920794b1';

export const NAVIGATOR_FEATURES = [
  'Access to DRU AI Consulting — Community Connection',
  'Daily Leadership with AI Insights',
  'Framework Micro-Lessons',
  'Executive Founder Pricing — Locked In Forever',
];

export const ACCELERATOR_FEATURES = [
  'Everything in Navigator, plus:',
  "Today's Action Challenge",
  "DeAnna's Strategic Edge",
  'Weekly Framework PDF Downloadable',
  "Monthly DeAnna's Leadership Lab! Video Access",
  'Executive Founder Pricing — Locked In Forever',
];

// ── Types ────────────────────────────────────────────────────────────────────
export type Tier         = 'free' | 'paid' | 'navigator' | 'accelerator';
export type PostType     = 'daily_insight' | 'framework_lesson' | 'action_challenge' | 'strategic_edge' | 'framework_training' | 'pdf_downloadable' | 'lab_video' | 'member_post';
export type TierRequired = 'all' | 'navigator' | 'accelerator';
export type NotifType    = 'mention' | 'reply' | 'new_post' | 'new_agent_post';
export type PostCategory = 'win' | 'question' | 'resource' | 'challenge' | 'general';
export type CommunityLevel = 'Connected' | 'Contributor' | 'Cultivator' | 'Cornerstone' | 'Changemaker';

// ── Interfaces ────────────────────────────────────────────────────────────────
export interface CommunityPost {
  id: string; title: string; content: string;
  post_type: PostType; tier_required: TierRequired;
  agent_id: string; agent_name: string;
  published_at: string; is_active: boolean;
  pdf_url?: string; video_url?: string; image_url?: string;
  content_es?: string | null;
  // Engagement fields
  category?:   PostCategory;
  is_pinned?:  boolean;
  pinned_at?:  string | null;
}
export interface CommunityComment {
  id: string; post_id: string; member_id: string | null;
  content: string; is_flagged: boolean; is_active: boolean;
  created_at: string; agent_name?: string | null;
  profiles?: { first_name?: string; photo_url?: string };
}
export interface CommunityNotification {
  id: string; recipient_id: string; sender_id: string;
  post_id: string; comment_id: string;
  type: NotifType; message: string; is_read: boolean; created_at: string;
}
export interface NotificationPreferences {
  mention_push: boolean; mention_inapp: boolean; mention_email: boolean;
  reply_push: boolean; reply_inapp: boolean; reply_email: boolean;
  new_agent_post_push: boolean; new_agent_post_inapp: boolean; new_agent_post_email: boolean;
  new_post_push: boolean; new_post_inapp: boolean; new_post_email: boolean;
}
export interface MemberProfile { id: string; first_name: string; photo_url?: string; }

// ── Configs ───────────────────────────────────────────────────────────────────
export const POST_TYPE_CONFIG: Record<PostType, { label: string; icon: string; color: string; bg: string; border: string }> = {
  daily_insight:      { label: 'Daily Insight',      icon: '◆', color: '#B8941F', bg: '#FFFBEE', border: '#F0D980' },
  framework_lesson:   { label: 'Framework Lesson',   icon: '▣', color: '#0A2342', bg: '#EEF3FA', border: '#C0D0E8' },
  action_challenge:   { label: 'Action Challenge',   icon: '▲', color: '#9B0D44', bg: '#FDF0F5', border: '#F0B8CF' },
  strategic_edge:     { label: 'Strategic Edge',     icon: '◉', color: '#B8941F', bg: '#FFFBEE', border: '#F0D980' },
  framework_training: { label: 'Framework Training', icon: '◫', color: '#0A2342', bg: '#EEF3FA', border: '#C0D0E8' },
  pdf_downloadable:   { label: 'PDF Resource',       icon: '⬡', color: '#9B0D44', bg: '#FDF0F5', border: '#F0B8CF' },
  lab_video:          { label: 'Lab Video',          icon: '▷', color: '#B8941F', bg: '#FFFBEE', border: '#F0D980' },
  member_post:        { label: 'Community',          icon: '◈', color: '#2D5A8E', bg: '#EEF3FA', border: '#C0D0E8' },
};

export const TIER_BADGE: Record<TierRequired, { label: string; color: string; bg: string } | null> = {
  all:         null,
  navigator:   { label: 'NAVIGATOR',   color: '#0A2342', bg: '#C0D0E8' },
  accelerator: { label: 'ACCELERATOR', color: '#7A5C00', bg: '#F0D980' },
};

export const TIER_RANK: Record<Tier, number> = { free: 0, paid: 1, navigator: 2, accelerator: 3 };

export const AGENT_FRAMEWORK_MAP: Record<string, { framework: string; specialty: string }> = {
  'Dominique Carter': { framework: 'DRU CLEAR™',                   specialty: 'Clarity & Leadership' },
  'Elijah Brooks':    { framework: 'DRU CLEAR™',                   specialty: 'Alignment, Execution & Results' },
  'Tariq Oladele':    { framework: 'AI Sales Mastery™',            specialty: 'AI Revenue Acceleration' },
  'Solange Dupont':   { framework: '5D Leadership™',               specialty: 'Self & People' },
  'Isaiah Webb':      { framework: '5D Leadership™',               specialty: 'Team, Org & Visionary' },
  'Nadia Osei':       { framework: '5C Cultural DNA™',             specialty: 'Communication & Connection' },
  'Victor Reyes':     { framework: '5C Cultural DNA™',             specialty: 'Collaboration & Culture' },
  'Sasha Kim':        { framework: 'AI Sales Mastery™',            specialty: 'DISC Behavioral Intelligence' },
  'Zoe Beaumont':     { framework: 'DRU AI Leadership Ecosystem™', specialty: 'Community Leadership' },
  'Micah Santos':     { framework: 'DRU AI Leadership Ecosystem™', specialty: 'Member Experience' },
};

export const ZOE_POST_TYPES: PostType[] = ['strategic_edge', 'daily_insight', 'framework_training'];

// ── Category config ───────────────────────────────────────────────────────────
export const CATEGORY_CONFIG: Record<PostCategory, { label: string; bg: string; color: string }> = {
  win:       { label: 'Win',       bg: '#EAF3DE', color: '#27500A' },
  question:  { label: 'Question',  bg: '#E6F1FB', color: '#0C447C' },
  resource:  { label: 'Resource',  bg: '#EEEDFE', color: '#3C3489' },
  challenge: { label: 'Challenge', bg: '#FBEAF0', color: '#72243E' },
  general:   { label: 'General',   bg: '#F1EFE8', color: '#444441' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
export function tierLabel(t: Tier): string {
  return { free: 'Free', paid: 'Member', navigator: 'Navigator', accelerator: 'Accelerator' }[t] ?? 'Free';
}
export function tierDotColor(t: Tier): string {
  return { free: '#BBBBBB', paid: '#0A2342', navigator: '#0A2342', accelerator: '#B8941F' }[t];
}
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
export function formatRelativeTime(iso: string): string {
  const diffMs   = Date.now() - new Date(iso).getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHrs  = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs / 24);
  if (diffSecs < 60)  return 'just now';
  if (diffMins < 60)  return `${diffMins}m`;
  if (diffHrs  < 24)  return `${diffHrs}h`;
  if (diffDays < 7)   return `${diffDays}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
export function formatContent(content: string): string[] {
  return content.split('\n\n').filter(p => p.trim().length > 0);
}
export const FLAGGED_KEYWORDS = ['fuck','shit','bitch','asshole','spam','scam','fraud','fake','click here','buy now'];
export function checkFlagged(text: string): boolean {
  return FLAGGED_KEYWORDS.some(kw => text.toLowerCase().includes(kw));
}
