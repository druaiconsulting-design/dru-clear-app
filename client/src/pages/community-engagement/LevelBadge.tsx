// =============================================================================
// LEVEL BADGE — shared component for community-engagement directory
// Used by: PostCard.tsx, Leaderboard.tsx
// Import: import LevelBadge from '../community-engagement/LevelBadge';
//
// Colors/names now come from the shared community_level_tiers table via
// useCommunityLevels() — see src/lib/communityLevels.ts. Edit tiers there
// (or in Supabase), not here.
// =============================================================================

import { useCommunityLevels, levelStyle } from '../../lib/communityLevels';

export default function LevelBadge({ level }: { level: string }) {
  const levels = useCommunityLevels();
  const s = levelStyle(level, levels);
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

