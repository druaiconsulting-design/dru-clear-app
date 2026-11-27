// The subscribe links for the LEAD, CLARITY, WIN! Newsletter (Nov 26, 2026).
// Each platform has its own link. The platform name after "from=" puts a from-<platform> tag
// on the person's GHL record when they subscribe, so each platform's signups are counted.
// Nia and Darius receive these links in their code and place them beside the assessment link.

export type SubscribePlatform = 'linkedin' | 'facebook' | 'instagram';

export function subscribeLink(platform: SubscribePlatform): string {
  return `https://subscribe.druaiconsulting.com/?from=${platform}`;
}

// Nia: LinkedIn posts and LinkedIn articles.
export const NIA_SUBSCRIBE_NOTE =
  `The LinkedIn subscribe link is ${subscribeLink('linkedin')}. It appears beside the assessment link at the end of the piece.`;

// Nia on demand: the piece can be any kind of content, so the note names when it applies.
export const NIA_ON_DEMAND_SUBSCRIBE_NOTE =
  ` When the piece is a LinkedIn post or a LinkedIn article, the LinkedIn subscribe link ${subscribeLink('linkedin')} appears beside the assessment link.`;

// Darius on demand: social posts only.
export const DARIUS_ON_DEMAND_SUBSCRIBE_NOTE =
  ` When you write a LinkedIn, Facebook or Instagram post, the subscribe link for that platform appears beside the assessment link: LinkedIn ${subscribeLink('linkedin')}, Facebook ${subscribeLink('facebook')}, Instagram ${subscribeLink('instagram')}.`;
