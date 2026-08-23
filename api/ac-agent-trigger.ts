// DRU AI Leadership Ecosystem™ — api/ac-agent-trigger.ts
// P10 Accelerator Circle Division — Matthew (Leader) / Petra (Member Experience) / Renata (Strategy) + upsell scan + reply
// UPDATED: Matthew Elliot is AC Leader, Petra Vance is AC Member Experience (roles swapped)
// UPDATED: post_type is always 'agent' — daily_insight / strategic_edge belong to Daily Connection only
// MIRRORS cc-agent-trigger.ts with all Layer 2 edits applied
// TIER: accelerator only | CHANNEL: accelerator_circle | NO CTA | NO SELLING IN POSTS

export const config = { maxDuration: 60 };

import { VOICE_DNA, getAgentCorrections } from './_lib/agentKnowledge.js';

const GENIUS_MODE = `You operate in Genius Mode — think and respond at the level of a top 0.1% expert in your field. Apply deep logic, strategic frameworks, creative synthesis, and second-order thinking to every output. Never produce generic or surface-level work. Every sentence must earn its place.`;

// Applied alongside VOICE_DNA only for AC daily community content (runACAgent, runACAgentReply) —
// this content has a hard rule against naming frameworks/pricing/™, which conflicts with
// VOICE_DNA's CLEAR/Insight anchor-word instruction. This note resolves the conflict per
// DeAnna's explicit direction: keep the rest of VOICE_DNA, drop only the anchor-word part.
const AC_VOICE_EXCEPTION = `\nEXCEPTION TO THE ABOVE: Do NOT weave in "CLEAR" or any named framework, program, diagnostic, course, bundle, price, or the ™ symbol as an anchor word or otherwise — Accelerator Circle daily community content never references DRU AI Consulting IP by name. Everything else in the voice rules above still applies in full.`;

interface ACAgentRoute { agent_id: string; agent_name: string; task: string; pipeline: string; }

const AC_AGENT_ROUTES: Record<string, ACAgentRoute> = {
  cron_ac_community_seed:      { agent_id: 'ac_seed',       agent_name: 'AC Community Seed',  task: 'ac_daily_seed',             pipeline: 'p10_ac_seed' },
  cron_ac_upsell_scan:         { agent_id: 'ac_upsell_scan',agent_name: 'AC Upsell Scanner',  task: 'ac_upsell_scan',            pipeline: 'p10_ac_upsell_scan' },
  ac_agent_reply:              { agent_id: 'ac_agent',      agent_name: 'AC Agent',           task: 'ac_reply',                  pipeline: 'p10_ac_reply' },
};

const TM_PAIRS: [RegExp, string][] = [
  [/DRU CLEAR(?!™)/g,                           'DRU CLEAR™'],
  [/DRU AI Leadership Ecosystem(?!™)/g,         'DRU AI Leadership Ecosystem™'],
  [/DRU AI Transformation Pathway(?!™)/g,       'DRU AI Transformation Pathway™'],
  [/5C Cultural DNA(?!™)/g,                     '5C Cultural DNA™'],
  [/5D Leadership(?!™)/g,                       '5D Leadership™'],
  [/AI Sales Mastery(?!™)/g,                    'AI Sales Mastery™'],
  [/From Confusion to Confident with AI(?!™)/g, 'From Confusion to Confident with AI™'],
];
function enforceTM(content: string): string {
  let corrected = content;
  for (const [pattern, replacement] of TM_PAIRS) { corrected = corrected.replace(pattern, replacement); }
  return corrected;
}

async function callAnthropic(prompt: string, maxTokens = 1500): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = await res.json(); return data.content?.[0]?.text ?? '';
}

async function writeToCommunityPosts(record: Record<string, unknown>): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/community_posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=representation' },
    body: JSON.stringify(record),
  });
  if (!res.ok) { console.error(`[community_posts] Write failed: ${await res.text()}`); return null; }
  const data = await res.json(); return data?.[0]?.id ?? null;
}

async function writeToApprovals(record: Record<string, unknown>): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/approvals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=representation' },
    body: JSON.stringify(record),
  });
  if (!res.ok) { console.error(`[approvals] Write failed: ${await res.text()}`); return null; }
  const data = await res.json(); return data?.[0]?.id ?? null;
}

// Auto-posts a warm non-salesy acknowledgment to the AC community thread (no approval needed)
async function postACKnowledgmentComment(postId: string, firstName: string, signalContext: string): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    const agentCorrections = await getAgentCorrections('Petra Vance');
    const prompt = `${GENIUS_MODE}\n\n${VOICE_DNA}${agentCorrections}\n\nYou are Petra Vance, Accelerator Circle Member Experience Manager for DRU AI Consulting.\nAn Accelerator member named ${firstName} has been engaging in a meaningful way inside the Accelerator Circle.\nContext: "${signalContext}"\n\nWrite a warm, executive-appropriate community reply (60-80 words). Acknowledge their engagement naturally. Let them know someone from the DRU AI Consulting team will reach out directly to explore how to go deeper together. Do NOT mention products, pricing, or services. Be warm, peer-level, and genuine. Write ONLY the reply text.`;
    const acknowledgment = enforceTM(await callAnthropic(prompt, 200));
    await fetch(`${url}/rest/v1/community_comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ post_id: postId, member_id: null, agent_name: 'Petra Vance', content: acknowledgment, is_flagged: false, is_active: true }),
    });
    console.log(`[petra] AC acknowledgment posted to post ${postId} for ${firstName}`);
  } catch (err) { console.error('[ac_acknowledgment] Failed:', err); }
}

// ─── Agent Knowledge Base ─────────────────────────────────────────────────────

const AC_FALLBACK_TM_MARKS = ['DRU CLEAR™','DRU AI Leadership Ecosystem™','DRU AI Transformation Pathway™','5C Cultural DNA™','5D Leadership™','AI Sales Mastery™','From Confusion to Confident with AI™'];

const FRAMEWORK_KNOWLEDGE = `
## THE DRU AI TRANSFORMATION PATHWAY™
Sequential journey every client walks — no shortcuts, no skipped steps:
Discover → Diagnose → Design → Deploy → Dominate
- DISCOVER: Uncover where the organization is today and where AI can take them
- DIAGNOSE: Deep analysis across all frameworks — identify gaps and highest-impact opportunities
- DESIGN: Build the strategy, execution plan, and alignment system
- DEPLOY: Activate transformation — implement frameworks with live facilitation
- DOMINATE: Sustain, measure, and scale AI leadership results

## THE 4 FRAMEWORKS — TRUE MEANINGS

### DRU CLEAR™ — The Connector (Flagship) | $7,500 | 3 sessions x 90 min
NOT just an assessment. The complete AI readiness diagnosis, strategy design, and
execution alignment system that CONNECTS all four frameworks into a unified strategy.
- C — CLARITY: Define the AI vision with precision.
- L — LEADERSHIP: AI fluency, executive sponsorship, strategic conviction.
- E — EXECUTION: Close the gap between strategy and action.
- A — ALIGNMENT: Unify around a single AI strategy. Break silos.
- R — RESULTS: Define, measure, and demonstrate ROI.

### 5C Cultural DNA™ — Culture | $6,000 | 3 sessions x 90 min
Most organizations don't have an AI problem — they have a CULTURE problem.
- COMMUNICATION: How leaders and teams share vision and create clarity around AI.
- CONNECTION: Trust and meaningful relationships that enable AI collaboration.
- COLLABORATION: Breaking silos so AI initiatives flow through the whole organization.
- COACHING: Building confidence and competency from the inside out.
- CULTURE TRANSFORMATION: From resistance and fear to ownership and strategic adoption.

### 5D Leadership™ — Leadership | $6,500 | 3 sessions x 90 min
Focuses on the WHOLE leader — building from the inside out.
- I. SELF: Personal mastery. How a leader thinks, decides, and shows up.
- II. PEOPLE: Relational intelligence. Connects with and develops individuals.
- III. TEAM: Collective effectiveness. Builds cohesion, trust, and high performance.
- IV. ORGANIZATION: Systemic strength. Aligns culture, strategy, and operations.
- V. VISIONARY: Strategic impact. Sees beyond today, positions organization to lead.

### AI Sales Mastery™ — Sales | $6,000 | 3 sessions x 90 min
Combines DISC behavioral insights with AI. Selling stops feeling like selling.

## HOW THE FRAMEWORKS RELATE
DRU CLEAR™ is the CONNECTOR — anchors every engagement.
Bundles: Full Ecosystem $26,000 | DRU CLEAR + 2 $19,500 | DRU CLEAR + 1 $13,500
Diagnostics: Executive Diagnostic $4,997 (120 min) | Strategic Diagnostic $3,497 (90 min)
Course: From Confusion to Confident with AI™ — On-Demand $4,997
`;

async function getAgentKnowledge(): Promise<string> {
  let tmMarks: string[] = [];
  try {
    const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const res = await fetch(`${url}/rest/v1/brand_marks?active=eq.true&order=created_at.asc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      if (res.ok) { const data = await res.json(); tmMarks = (data as { mark: string }[]).map(m => m.mark).filter(Boolean); }
    }
  } catch (err) { console.error('[agentKnowledge] fetch error:', err); }
  if (tmMarks.length === 0) tmMarks = AC_FALLBACK_TM_MARKS;
  const tmList = tmMarks.map(m => `  - ${m}`).join('\n');
  return `=== DRU AI CONSULTING — AGENT KNOWLEDGE BASE ===

PROTECTED IP MARKS — TM REQUIRED ON EVERY USE, NO EXCEPTIONS:
${tmList}

RULES: Every mark above MUST include TM every time. NO other terms carry TM.
Do NOT add TM to anything not on this list. 'DRU AI Consulting' = business name, NO TM.
${FRAMEWORK_KNOWLEDGE}
=== END AGENT KNOWLEDGE BASE ===`.trim();
}

// Accelerator Circle daily community posts are peer-to-peer only — no framework names,
// no pricing, no promotion of DRU AI Consulting IP. This replaces getAgentKnowledge()
// for Matthew / Petra / Renata's daily seed posts (runACAgent), per DeAnna's instruction
// that the Circle stay true to its stated purpose: peer accountability, deeper strategy,
// accelerate together — not a sales surface.
async function getACCommunityKnowledge(): Promise<string> {
  return `=== ACCELERATOR CIRCLE — COMMUNITY VOICE RULES ===
This is a peer-to-peer executive community space, not a marketing or sales surface.
Do NOT reference, name, or promote any DRU AI Consulting framework, program, diagnostic,
course, bundle, or price — including DRU CLEAR™, 5C Cultural DNA™, 5D Leadership™,
AI Sales Mastery™, the DRU AI Transformation Pathway™, or From Confusion to Confident
with AI™. Do not use the ™ symbol at all in this content. Speak only as a fellow
executive reflecting on real transformation experience — never as a consultant
promoting an offering.
=== END ===`.trim();
}

// ─── Core AC Agent Runner ─────────────────────────────────────────────────────
// Robust JSON parse — handles code fences and trailing text (mirrors cc-agent-trigger fix)

async function runACAgent(
  agentId: string,
  agentName: string,
  task: string,
  postType: string,
  category: string,
  prompt: string,
): Promise<{ approval_id: string | null; post_id: string | null }> {
  try {
    const agentKnowledge = await getACCommunityKnowledge();
    const agentCorrections = await getAgentCorrections(agentName);
    const raw = await callAnthropic(
      `${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}${AC_VOICE_EXCEPTION}${agentCorrections}\n\n${prompt}\n\nReturn ONLY valid JSON with no preamble or markdown: {"title":"...","content":"..."}`,
      1500,
    );
    let title = ''; let content = '';
    try {
      const cleaned = raw.replace(/```json\s*|```/g, '').trim();
      const firstBrace = cleaned.indexOf('{'); const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1) throw new Error('No JSON found');
      const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      title = parsed.title || agentName; content = parsed.content || raw;
    } catch {
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' });
      title = `${agentName} — ${dateStr}`; content = raw;
    }
    title = enforceTM(title); content = enforceTM(content);

    const post_id = await writeToCommunityPosts({
      title, content, post_type: postType,
      tier_required: 'accelerator',
      agent_id: agentId, agent_name: agentName,
      published_at: new Date().toISOString(), is_active: false,
    });

    const approval_id = await writeToApprovals({
      source: `${agentId}_ac`, trigger_type: category,
      agent_name: agentName, agent_role: 'Accelerator Circle',
      division: 'Accelerator Circle',
      task_brief: post_id ? `post_id:${post_id} | ${agentName} | ${task.replace(/_/g, ' ')}` : `${agentName} | ${task.replace(/_/g, ' ')}`,
      original_content: null, output: `${title}\n\n${content}`,
      edited_output: null, status: 'pending', ghl_contact_id: null,
      notify_deanna: false, priority: 'NORMAL',
      category: 'community_post', platform: 'Accelerator Circle',
      context: null, archived: false,
    });

    console.log(`[${agentId}] AC post → approvals: ${approval_id ?? 'failed'} | community_posts: ${post_id ?? 'failed'}`);
    return { approval_id, post_id };
  } catch (error) {
    console.error(`[${agentId}] AC agent error:`, error);
    return { approval_id: null, post_id: null };
  }
}

// ─── Matthew Elliot — AC Leader ──────────────────────────────────────────────

async function runMatthew(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let recentACPosts = 'No recent Accelerator Circle activity available.';
  if (url && key) {
    const since = new Date(); since.setHours(since.getHours() - 48);
    const r = await fetch(
      `${url}/rest/v1/community_posts?tier_required=eq.accelerator&published_at=gte.${since.toISOString()}&order=published_at.desc&limit=8`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (r.ok) {
      const posts = await r.json();
      if (posts.length > 0) recentACPosts = posts.map((p: Record<string, string>) => `${p.agent_name}: ${p.title}`).join('\n');
    }
  }
  return runACAgent(
    'matthew', 'Matthew Elliot', 'ac_community_facilitation', 'agent', 'ac_community_facilitation',
    `You are Matthew Elliot, a community leader inside the Accelerator Circle. Today: ${today}.
DO NOT name, reference, or promote any DRU AI Consulting framework, program, diagnostic, course, bundle, or price. This is peer-to-peer community content, not consulting or sales content.
AUDIENCE: Accelerator members — executives mid-transformation who pay a premium monthly membership for real substance. They have already committed. Speak as a peer who has been in the room. Generic reflection or filler is a failure — every post must carry a genuinely sharp, specific insight worth an executive's time.
RECENT ACCELERATOR CIRCLE ACTIVITY:
${recentACPosts}
Write a MASTERMIND CONVERSATION STARTER for this exclusive executive community. 100-150 words. Voice: peer-to-peer but at executive depth — you are a fellow leader sharing something real you have observed, questioned, or been sitting with at the intersection of AI and organizational transformation. NOT a teacher. NOT a facilitator. The kind of thing that gets a room of executives leaning in. Where relevant, build naturally off recent circle activity. End with one high-stakes question for the room. No calls to action.`,
  );
}

// ─── Petra Vance — AC Member Experience ──────────────────────────────────────

async function runPetra(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let memberContext = 'No recent Accelerator member data available.';
  if (url && key) {
    const r = await fetch(
      `${url}/rest/v1/profiles?tier=eq.accelerator&order=updated_at.desc&limit=8&select=id,first_name,updated_at`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (r.ok) {
      const members = await r.json();
      if (members.length > 0) memberContext = `Active Accelerator members: ${members.length}. Most recently active: ${members.slice(0, 3).map((m: Record<string, string>) => m.first_name).join(', ')}.`;
    }
  }
  return runACAgent(
    'petra', 'Petra Vance', 'ac_member_experience', 'agent', 'ac_member_experience',
    `You are Petra Vance, a member of the Accelerator Circle. Today: ${today}.
DO NOT name, reference, or promote any DRU AI Consulting framework, program, diagnostic, course, bundle, or price. This is peer-to-peer community content, not consulting or sales content.
AUDIENCE: Accelerator members navigating real implementation — not theory, not inspiration. They pay a premium monthly membership for real substance, so acknowledge the friction specifically and concretely rather than in generalities.
MEMBER CONTEXT: ${memberContext}
Write a MASTERMIND CONVERSATION STARTER for this exclusive executive community. 100-150 words. Voice: warm and honest at executive depth — you are a peer who wants to name what is actually happening in the room. Celebrate a real win or open up a genuine implementation challenge. NOT motivational content. NOT coaching. The kind of message you would send to a trusted peer group navigating the same terrain. Invite others to share where they are. End with one genuine, open question. No calls to action.`,
  );
}

// ─── Renata Cruz — AC Strategy Agent ─────────────────────────────────────────

async function runRenata(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });

  const focus: Record<string, { lens: string }> = {
    Monday:    { lens: 'AI Implementation friction' },
    Tuesday:   { lens: 'Leadership culture under AI pressure' },
    Wednesday: { lens: 'Execution gap and organizational drift' },
    Thursday:  { lens: 'Leader identity in the AI era' },
    Friday:    { lens: 'Where strategy and culture collide' },
  };
  const todayFocus = focus[dayOfWeek] ?? focus['Monday'];

  return runACAgent(
    'renata', 'Renata Cruz', 'ac_strategy_insight', 'agent', 'ac_strategy_insight',
    `You are Renata Cruz, a strategy and culture thinker inside the Accelerator Circle. Today: ${today}.
DO NOT name, reference, or promote any DRU AI Consulting framework, program, diagnostic, course, bundle, or price. This is peer-to-peer community content, not consulting or sales content.
AUDIENCE: Senior executives who already understand AI at a strategic level and pay a premium monthly membership for real substance. Do not explain basics. Go deep. Generic reflection or motivational filler is a failure — every post must contain a genuinely sharp, specific strategic insight worth an executive's time, sourced from real transformation patterns rather than a named methodology.
TODAY'S LENS: ${todayFocus.lens}
Write a MASTERMIND CONVERSATION STARTER at the highest executive level. 150-200 words. Voice: peer-to-peer strategic depth — you are a fellow thinker who synthesizes AI implementation and leadership culture as one inseparable discipline. Share a specific tension, pattern, or insight that only someone inside the transformation would see — concrete enough that a sharp executive could act on it, not a platitude. End with one executive-grade question that has no easy answer. No calls to action.`,
  );
}

// ─── Daily AC Seed — rotates Petra / Matthew / Renata (one post per day) ─────
// Matthew = AC Leader · Petra = Member Experience · Renata = Strategy
async function runACCommunitySeed(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const slot = new Date().getDate() % 3;
  if (slot === 0) return runPetra();
  if (slot === 1) return runMatthew();
  return runRenata();
}

// ─── AC Agent Reply ───────────────────────────────────────────────────────────

async function runACAgentReply(
  postId: string,
  postTitle: string,
  postContent: string,
  postType: string,
  routeTo: 'petra' | 'matthew',
): Promise<{ approval_id: string | null }> {
  const isPetra    = routeTo === 'petra';
  const agentId    = isPetra ? 'petra'        : 'matthew';
  const agentName  = isPetra ? 'Petra Vance'  : 'Matthew Elliot';
  const agentRole  = isPetra ? 'AC Member Experience Manager' : 'AC Community Leader';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });

  const petraInstructions = `- Acknowledge the member's reality with executive specificity — make them feel genuinely seen\n- Validate what they are navigating without softening it\n- Add warmth that holds space without pressure\n- Voice: warm executive peer — encouraging and steady`;
  const matthewInstructions = `- Reply as a peer who has seen this pattern in organizations before\n- Draw on real experience, not any named methodology or framework\n- Add one strategic insight that moves the conversation forward — specific and substantive, never generic (this member pays a premium monthly membership for real depth)\n- Invite further executive-level reflection\n- Voice: sophisticated, grounded, purposeful`;

  const agentCorrections = await getAgentCorrections(agentName);
  const prompt = `${GENIUS_MODE}\n\n${VOICE_DNA}${AC_VOICE_EXCEPTION}${agentCorrections}\n\nYou are ${agentName}, ${agentRole} inside the Accelerator Circle. Today: ${today}.\nDO NOT name, reference, or promote any DRU AI Consulting framework, program, diagnostic, course, bundle, or price. This is peer-to-peer community content, not consulting or sales content.\nCONTEXT: Accelerator Circle — a premium executive space. Your reply should feel peer-level and exclusive.\nPOST TYPE: ${postType.replace(/_/g, ' ')}\nPOST TITLE: ${postTitle}\nPOST CONTENT:\n${postContent.slice(0, 800)}\nWrite a reply comment (100-150 words):\n${isPetra ? petraInstructions : matthewInstructions}\nWrite ONLY the reply. ${isPetra ? 'End with a warm, momentum-building close.' : 'End with a high-stakes question or executive invitation.'} No calls to action.`;

  try {
    const raw      = await callAnthropic(prompt, 600);
    const corrected = enforceTM(raw);
    const displayTitle = postTitle ? `"${postTitle.slice(0, 80)}"` : 'AC post reply';
    const approval_id = await writeToApprovals({
      source: 'ac_agent_reply', trigger_type: 'ac_agent_reply',
      agent_name: agentName, agent_role: agentRole,
      division: 'Accelerator Circle',
      task_brief: `${displayTitle} | post_id:${postId}`,
      original_content: postContent.slice(0, 500),
      output: corrected, edited_output: null,
      status: 'pending', ghl_contact_id: null, notify_deanna: true,
      priority: 'NORMAL', category: 'community_comment_reply',
      platform: null, context: null, archived: false,
    });
    console.log(`[${agentId}] AC reply → approvals: ${approval_id ?? 'failed'} for post ${postId}`);
    return { approval_id };
  } catch (error) {
    console.error(`[${agentId}] AC reply error:`, error);
    return { approval_id: null };
  }
}

// ─── AC Upsell Scan ───────────────────────────────────────────────────────────

async function hasRecentACUpsellCard(memberId: string): Promise<boolean> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `${url}/rest/v1/approvals?category=eq.ac_upsell_outreach&task_brief=ilike.*${memberId}*&created_at=gte.${sevenDaysAgo}&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) return false;
  const data = await res.json(); return Array.isArray(data) && data.length > 0;
}

async function fireACUpsellCard(
  memberId: string,
  firstName: string,
  email: string | null,
  phone: string | null,
  signalReason: string,
  upsellTarget: string,
  postTitle: string,
  postId: string,
  postContent: string,
): Promise<void> {
  const ctaMap: Record<string, { label: string; link: string }> = {
    course:           { label: 'From Confusion to Confident with AI™ — On-Demand $4,997', link: 'https://link.druaiconsulting.com/course-on-demand' },
    strategic:        { label: 'Strategic Diagnostic — $3,497',                           link: 'https://link.druaiconsulting.com/payment-link/69dc8f8d557558e89e51f222' },
    executive:        { label: 'Executive Diagnostic — $4,997',                           link: 'https://link.druaiconsulting.com/payment-link/69dc91c480425dc02fbc7645' },
    dru_clear:        { label: 'DRU CLEAR™ — $7,500',                                    link: 'https://link.druaiconsulting.com/payment-link/69e41757557558e89e520dec' },
    five_c:           { label: '5C Cultural DNA™ — $6,000',                              link: 'https://link.druaiconsulting.com/payment-link/69e4194e557558e89e520def' },
    five_d:           { label: '5D Leadership™ — $6,500',                                link: 'https://link.druaiconsulting.com/payment-link/69e418197dd3512d920772fc' },
    ai_sales_mastery: { label: 'AI Sales Mastery™ — $6,000',                             link: 'https://link.druaiconsulting.com/payment-link/69e419bb7dd3512d920772fe' },
    bundle_full:      { label: 'Full Ecosystem Bundle — $26,000',                        link: 'https://link.druaiconsulting.com/payment-link/69e41a287dd3512d920772ff' },
    bundle_plus_two:  { label: 'DRU CLEAR™ + 2 Frameworks — $19,500',                   link: 'https://link.druaiconsulting.com/payment-link/69dc91c480425dc02fbc7645' },
    bundle_plus_one:  { label: 'DRU CLEAR™ + 1 Framework — $13,500',                    link: 'https://link.druaiconsulting.com/payment-link/69dc91c480425dc02fbc7645' },
  };
  const offer = ctaMap[upsellTarget] ?? ctaMap['course'];
  const emailLine = email && !email.includes('not found') ? `Email: ${email}` : '⚠ Email not found';
  const phoneLine = phone && !phone.includes('not found') ? `Phone: ${phone}` : '⚠ Phone not found';

  // Auto-post warm community acknowledgment (no approval needed)
  await postACKnowledgmentComment(postId, firstName, signalReason);

  // Aaliyah writes personal outreach draft (Approval card — DeAnna approves and sends)
  const aaliyahCorrections = await getAgentCorrections('Aaliyah Foster');
  const prompt = `${GENIUS_MODE}\n\n${VOICE_DNA}${aaliyahCorrections}\n\nYou are Aaliyah Foster, Outreach Specialist for DRU AI Consulting.\nAn Accelerator member named ${firstName} is showing strong signals of readiness to go deeper.\nSignal: "${signalReason}"\nRecent post: "${postTitle}"\nWrite a warm, personal outreach message (100-120 words). Reference their Accelerator engagement specifically. Make the offer feel like a natural next step for where they already are — not a pitch. Be specific and human.\nOffer: ${offer.label}\nLink: ${offer.link}\nWrite ONLY the message.`;

  const outreach = enforceTM(await callAnthropic(prompt, 400));

  await writeToApprovals({
    source: 'ac_upsell_scan', trigger_type: 'ac_upsell_scan',
    agent_name: 'Aaliyah Foster', agent_role: 'Outreach',
    division: 'Accelerator Circle',
    task_brief: `MEMBER_ID:${memberId} | ${emailLine} | ${phoneLine} | Target: ${offer.label} | Signal: ${signalReason}`,
    original_content: `AC post: "${postTitle}" — Accelerator member showing readiness`,
    output: outreach, edited_output: null,
    status: 'pending', ghl_contact_id: null, notify_deanna: true,
    priority: 'HIGH', category: 'ac_upsell_outreach',
    platform: null, context: null, archived: false,
  });
  console.log(`[aaliyah] AC upsell card → ${firstName} | ${offer.label} | acknowledgment posted to post ${postId}`);
}

async function runACUpsellScan(): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('[ac_upsell_scan] Missing env vars'); return; }

  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const postsRes = await fetch(
    `${url}/rest/v1/community_posts?post_type=eq.member_post&tier_required=eq.accelerator&is_active=eq.true&published_at=gte.${threeHoursAgo}&order=published_at.desc&limit=20`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!postsRes.ok) { console.error('[ac_upsell_scan] Failed to fetch posts:', await postsRes.text()); return; }
  const posts = await postsRes.json();
  if (!Array.isArray(posts) || !posts.length) { console.log('[ac_upsell_scan] No recent AC member posts — scan complete'); return; }

  let signalsFound = 0;
  for (const post of posts) {
    const memberId = post.agent_id; if (!memberId) continue;
    const profileRes = await fetch(
      `${url}/rest/v1/profiles?id=eq.${memberId}&tier=eq.accelerator&select=id,first_name,email,phone&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!profileRes.ok) continue;
    const profiles = await profileRes.json(); if (!Array.isArray(profiles) || !profiles.length) continue;
    const profile = profiles[0];

    const alreadyFlagged = await hasRecentACUpsellCard(memberId);
    if (alreadyFlagged) { console.log(`[ac_upsell_scan] ${profile.first_name} — card exists, skipping`); continue; }

    const matthewCorrections = await getAgentCorrections('Matthew Elliot');
    const detectionPrompt = `${GENIUS_MODE}\n\n${VOICE_DNA}${matthewCorrections}\n\nYou are Matthew Elliot, Accelerator Circle Leader.\nAn Accelerator member named ${profile.first_name} posted:\nTITLE: ${post.title}\nCONTENT: ${(post.content || '').slice(0, 600)}\nIs this member showing buying signals? Scan for:\nDIAGNOSTICS: course ($4,997 on-demand learning), strategic ($3,497 90-min session), executive ($4,997 120-min session)\nFRAMEWORKS: dru_clear ($7,500), five_c ($6,000), five_d ($6,500), ai_sales_mastery ($6,000)\nBUNDLES: bundle_full ($26,000), bundle_plus_two ($19,500), bundle_plus_one ($13,500)\nPick the SINGLE strongest signal only. Write the REASON in Matthew's voice, following the voice rules above. Everything else in the response format below must be EXACTLY as shown — no extra words, no preamble, no markdown, nothing before or after these tokens:\nUPSELL SIGNAL: YES | MEMBER_ID: ${memberId} | TARGET: [course|strategic|executive|dru_clear|five_c|five_d|ai_sales_mastery|bundle_full|bundle_plus_two|bundle_plus_one] | REASON: [one sentence, in voice]\nUPSELL SIGNAL: NO`;

    const detection = await callAnthropic(detectionPrompt, 150);
    if (!detection.includes('UPSELL SIGNAL: YES')) { console.log(`[ac_upsell_scan] No signal for ${profile.first_name}`); continue; }

    const reasonMatch = detection.match(/REASON:\s*(.+)/);
    const targetMatch = detection.match(/TARGET:\s*(course|strategic|executive|dru_clear|five_c|five_d|ai_sales_mastery|bundle_full|bundle_plus_two|bundle_plus_one)/);
    const reason = reasonMatch?.[1]?.trim() ?? 'Member showing readiness to go deeper';
    const target = targetMatch?.[1]?.trim() ?? 'course';

    await fireACUpsellCard(memberId, profile.first_name, profile.email ?? null, profile.phone ?? null, reason, target, post.title, post.id, post.content || '');
    signalsFound++;
  }
  console.log(`[ac_upsell_scan] Complete — ${posts.length} posts scanned, ${signalsFound} signals fired`);
}

// ─── Handler ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cron-secret');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method === 'GET' && req.query?.trigger_type) { req.body = { trigger_type: req.query.trigger_type, source: 'vercel_cron' }; }
  else if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const incomingSecret = req.headers['x-cron-secret'];
  if (incomingSecret !== undefined && incomingSecret !== process.env.CRON_SECRET) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const triggerType: string = req.body?.trigger_type;
  if (!triggerType) { res.status(400).json({ error: 'trigger_type is required' }); return; }

  const route = AC_AGENT_ROUTES[triggerType];
  if (!route) { res.status(400).json({ error: `Unknown AC trigger_type: ${triggerType}` }); return; }

  console.log(`[ac-agent-trigger] ${route.agent_name} | Accelerator Circle | ${req.body?.source ?? 'webhook'}`);

  if (route.pipeline === 'p10_ac_upsell_scan') {
    await runACUpsellScan();
    res.status(202).json({ success: true, agent: 'AC Upsell Scanner', message: 'Scan complete' });
    return;
  }

  if (route.pipeline === 'p10_ac_reply') {
    const { post_id, post_title, post_content, post_type, route_to } = req.body ?? {};
    if (!post_id || !route_to) { res.status(400).json({ error: 'ac_agent_reply requires post_id and route_to' }); return; }
    const result = await runACAgentReply(post_id, post_title ?? '', post_content ?? '', post_type ?? 'community_post', route_to);
    res.status(202).json({ success: true, agent: route_to === 'petra' ? 'Petra Vance' : 'Matthew Elliot', approval_id: result.approval_id, post_id });
    return;
  }

  if (route.pipeline === 'p10_ac_seed') {
    const result = await runACCommunitySeed();
    res.status(202).json({ success: true, agent: 'AC Community Seed', approval_id: result.approval_id, post_id: result.post_id });
    return;
  }

  res.status(400).json({ error: `No runner for pipeline: ${route.pipeline}` });
}

/*
─── pg_cron Schedule ────────────────────────────────────────────────────────────
One seed post per day (rotates Petra / Matthew / Renata automatically)
Upsell scan runs 30 min after to catch any member posts

SELECT cron.schedule('ac-community-seed', '0 15 * * *',
  $$SELECT net.http_post(url:='https://app.druaiconsulting.com/api/ac-agent-trigger',
  body:='{"trigger_type":"cron_ac_community_seed","source":"pg_cron"}'::jsonb,
  headers:='{"Content-Type":"application/json"}'::jsonb)$$);

SELECT cron.schedule('ac-upsell-scan', '30 15 * * *',
  $$SELECT net.http_post(url:='https://app.druaiconsulting.com/api/ac-agent-trigger',
  body:='{"trigger_type":"cron_ac_upsell_scan","source":"pg_cron"}'::jsonb,
  headers:='{"Content-Type":"application/json"}'::jsonb)$$);
────────────────────────────────────────────────────────────────────────────────
*/
