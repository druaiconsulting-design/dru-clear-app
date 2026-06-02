// =============================================================================
// LEVEL BADGE — shared component for community-engagement directory
// Used by: PostCard.tsx, Leaderboard.tsx
// Import: import LevelBadge from '../community-engagement/LevelBadge';
// =============================================================================

export const LEVEL_STYLES: Record<string, { bg: string; color: string }> = {
  Connected:   { bg: '#F1EFE8', color: '#5F5E5A' },
  Contributor: { bg: '#E6F1FB', color: '#185FA5' },
  Cultivator:  { bg: '#EAF3DE', color: '#27500A' },
  Cornerstone: { bg: '#FAEEDA', color: '#633806' },
  Changemaker: { bg: '#0A2342', color: '#D4AF37' },
};

export default function LevelBadge({ level }: { level: string }) {
  const s = LEVEL_STYLES[level] || LEVEL_STYLES.Connected;
  return (
    <span style={{
      display:       'inline-block',
      fontSize:      '10px',
      fontWeight:    '700',
      fontFamily:    "'Montserrat', sans-serif",
      padding:       '2px 8px',
      borderRadius:  '4px',
      background:    s.bg,
      color:         s.color,
      letterSpacing: '0.3px',
      flexShrink:    0,
    }}>
      {level}
    </span>
  );
}
