// DRU AI Leadership Ecosystem™ — api/cc-agent-trigger.ts
// P9 Community Connection Division — 10 agents
// ARCHITECTURE v2:
// - CC agents write DIRECTLY to approvals table (community_post category) — bypass daily CSQ chain
// - Inline ™ compliance check + auto-correction replaces Isabella chain step for CC posts
// - community_posts record pre-created (is_active: false) → activated on DeAnna's approval
// - post_id stored in approval task_brief → AdminApprovals activates the right record
// - Keeps DeAnna in control: approve → post goes live in community immediately
// - cc_agent_reply and upsell scan unchanged (already direct path)

export const config = { maxDuration: 60 };

import { getAgentKnowledge } from './lib/agentKnowledge';

const GENIUS_MODE = `You operate in Genius Mode — think and respond at the level of a top 0.1% expert in your field. Apply deep logic, strategic frameworks, creative synthesis, and second-order thinking to every output. Never produce generic or surface-level work. Every sentence must earn its place.`;

interface CCAgentRoute {
  agent_id: string;
  agent_name: string;
  task: string;
  pipeline: string;
}

const CC_AGENT_ROUTES: Record<string, CCAgentRoute> = {
  cron_dominique_daily_insight:  { agent_id: 'dominique',   agent_name: 'Dominique Carter', task: 'daily_leadership_insight',    pipeline: 'p9_dominique' },
  cron_elijah_framework_lesson:  { agent_id: 'elijah',      agent_name: 'Elijah Brooks',    task: 'framework_micro_lesson',      pipeline: 'p9_elijah' },
  cron_solange_action_challenge: { agent_id: 'solange',     agent_name: 'Solange Dupont',   task: 'daily_action_challenge',      pipeline: 'p9_solange' },
  cron_isaiah_webb_framework:    { agent_id: 'isaiah_webb', agent_name: 'Isaiah Webb',      task: 'weekly_framework_training',   pipeline: 'p9_isaiah_webb' },
  cron_nadia_strategic_edge:     { agent_id: 'nadia',       agent_name: 'Nadia Osei',       task: 'strategic_edge_insight',      pipeline: 'p9_nadia' },
  cron_victor_engagement:        { agent_id: 'victor',      agent_name: 'Victor Reyes',     task: 'community_engagement_post',   pipeline: 'p9_victor' },
  cron_sasha_sales_insight:      { agent_id: 'sasha',       agent_name: 'Sasha Kim',        task: 'ai_sales_mastery_insight',    pipeline: 'p9_sasha' },
  cron_tariq_sales_content:      { agent_id: 'tariq',       agent_name: 'Tariq Oladele',    task: 'ai_revenue_acceleration',     pipeline: 'p9_tariq' },
  cron_zoe_community_lead:       { agent_id: 'zoe',         agent_name: 'Zoe Beaumont',     task: 'daily_community_facilitation',pipeline: 'p9_zoe' },
  cron_micah_member_experience:  { agent_id: 'micah',       agent_name: 'Micah Santos',     task: 'daily_member_experience',     pipeline: 'p9_micah' },
  cc_agent_reply:                { agent_id: 'cc_agent',    agent_name: 'Community Agent',  task: 'community_reply',             pipeline: 'p9_cc_reply' },
};

// ─── Inline ™ Compliance — replaces Isabella for CC posts ────────────────────
// Fast auto-correction: no API call needed, no chain delay
// Marks appear without ™ → auto-replaced before writing to approvals
const TM_PAIRS: [RegExp, string][] = [
  [/DRU CLEAR(?!™)/g,                       'DRU CLEAR™'],
  [/DRU AI Leadership Ecosystem(?!™)/g,     'DRU AI Leadership Ecosystem™'],
  [/DRU AI Transformation Pathway(?!™)/g,   'DRU AI Transformation Pathway™'],
  [/5C Cultural DNA(?!™)/g,                 '5C Cultural DNA™'],
  [/5D Leadership(?!™)/g,                   '5D Leadership™'],
  [/AI Sales Mastery(?!™)/g,                'AI Sales Mastery™'],
  [/From Confusion to Confident with AI(?!™)/g, 'From Confusion to Confident with AI™'],
];

function enforceTM(content: string): string {
  let corrected = content;
  for (const [pattern, replacement] of TM_PAIRS) {
    corrected = corrected.replace(pattern, replacement);
  }
  return corrected;
}

// ─── Shared utilities ─────────────────────────────────────────────────────────
async function callAnthropic(prompt: string, maxTokens = 1500): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

async function writeToCommunityPosts(record: Record<string, unknown>): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/community_posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=representation' },
    body: JSON.stringify(record),
  });
  if (!res.ok) { console.error(`[community_posts] Write failed: ${await res.text()}`); return null; }
  const data = await res.json();
  return data?.[0]?.id ?? null;
}

async function writeToApprovals(record: Record<string, unknown>): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/approvals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=representation' },
    body: JSON.stringify(record),
  });
  if (!res.ok) { console.error(`[approvals] Write failed: ${await res.text()}`); return null; }
  const data = await res.json();
  return data?.[0]?.id ?? null;
}

// ─── CC Agent Runner v2 ───────────────────────────────────────────────────────
// Direct path: generate → enforce ™ → write community_posts (inactive) →
// write approvals (community_post category) → DeAnna approves → post goes live
async function runCCAgent(
  agentId: string, agentName: string, task: string,
  postType: string, category: string, prompt: string
): Promise<{ approval_id: string | null; post_id: string | null }> {
  try {
    // ─── KNOWLEDGE INJECTION ─────────────────────────────────────────────────
    // Fetches live ™ list + full framework meanings from brand_marks table.
    // All 10 CC agents receive this context on every run.
    const agentKnowledge = await getAgentKnowledge();
    // ─────────────────────────────────────────────────────────────────────────

    const raw = await callAnthropic(
      `${GENIUS_MODE}\n\n${agentKnowledge}\n\n${prompt}\n\nReturn ONLY valid JSON with no preamble or markdown: {"title":"...","content":"..."}`,
      1500
    );

    let title = '';
    let content = '';
    try {
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      title   = parsed.title   || agentName;
      content = parsed.content || raw;
    } catch {
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' });
      title   = `${agentName} — ${dateStr}`;
      content = raw;
    }

    // Enforce ™ marks inline — fast auto-correction, no chain needed
    title   = enforceTM(title);
    content = enforceTM(content);

    // Pre-create community_posts record (is_active: false) — activated on DeAnna's approval
    const post_id = await writeToCommunityPosts({
      title, content, post_type: postType,
      tier_required: 'navigator',
      agent_id: agentId, agent_name: agentName,
      published_at: new Date().toISOString(), is_active: false,
    });

    // Write directly to approvals — community_post category, bypass daily chain
    // task_brief stores post_id so AdminApprovals can activate the right record on approve
    const approval_id = await writeToApprovals({
      source:           `${agentId}_cc`,
      trigger_type:     category,
      agent_name:       agentName,
      agent_role:       'Community Connection',
      division:         'Community Connection',
      task_brief:       post_id ? `post_id:${post_id} | ${agentName} | ${task.replace(/_/g, ' ')}` : `${agentName} | ${task.replace(/_/g, ' ')}`,
      original_content: null,
      output:           `${title}\n\n${content}`,
      edited_output:    null,
      status:           'pending',
      ghl_contact_id:   null,
      notify_deanna:    false,
      priority:         'NORMAL',
      category:         'community_post',
      platform:         'Community',
      context:          null,
      archived:         false,
    });

    console.log(`[${agentId}] CC post → approvals: ${approval_id ?? 'failed'} | community_posts: ${post_id ?? 'failed'}`);
    return { approval_id, post_id };
  } catch (error) {
    console.error(`[${agentId}] CC agent error:`, error);
    return { approval_id: null, post_id: null };
  }
}

// =============================================================================
// P9 AGENTS — unchanged prompts, new runner signature
// =============================================================================

async function runDominique(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  return runCCAgent('dominique', 'Dominique Carter', 'daily_leadership_insight', 'daily_insight', 'community_insight',
    `You are Dominique Carter, CLEAR Vision Team Lead for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write a DAILY LEADERSHIP WITH AI INSIGHT applying the DRU CLEAR™ framework — Clarity & Leadership — to a real AI leadership challenge executives face today. Audience: C-suite and senior leaders navigating AI adoption. 150-200 words. Structure: one sharp opening insight, DRU CLEAR™ framework application (2-3 sentences), one executive reflection question. Close with: assessment.druaiconsulting.com`);
}

async function runElijah(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });
  const components: Record<string, string> = {
    Monday: 'Alignment — ensuring AI strategy aligns with organizational goals',
    Tuesday: 'Execution — deploying AI systematically and at scale',
    Wednesday: 'Results — measuring and communicating AI ROI and impact',
    Thursday: 'Alignment — realigning teams when AI initiatives drift',
    Friday: 'Execution & Results — closing the gap between AI strategy and outcomes',
  };
  const component = components[dayOfWeek] ?? 'Alignment — ensuring AI strategy aligns with organizational goals';
  return runCCAgent('elijah', 'Elijah Brooks', 'framework_micro_lesson', 'framework_lesson', 'community_lesson',
    `You are Elijah Brooks, Framework Educator for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write a FRAMEWORK MICRO-LESSON on today's DRU CLEAR™ component: ${component}. 200-250 words. Cover: what this component means in practice, why executives consistently underinvest in it, one practical application exercise completable in under 10 minutes. End with "Today's Micro-Action:" (one sentence). CTA: assessment.druaiconsulting.com`);
}

async function runSolange(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  return runCCAgent('solange', 'Solange Dupont', 'daily_action_challenge', 'action_challenge', 'community_challenge',
    `You are Solange Dupont, 5D Elevation Team Lead for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write TODAY'S ACTION CHALLENGE using the 5D Leadership™ framework. 150-200 words. Structure: bold Challenge Statement (one sentence), context explaining why this matters for AI-era leaders (2-3 sentences), 3-step challenge instructions numbered (each doable in under 10 minutes), expected outcome, 24-hour commitment close. CTA: assessment.druaiconsulting.com`);
}

async function runIsaiahWebb(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });
  const dimensions: Record<string, string> = {
    Monday: 'Direction — establishing clear AI vision and purpose',
    Tuesday: 'Development — building AI capability and team fluency',
    Wednesday: 'Discipline — creating AI governance and consistency',
    Thursday: 'Distinction — differentiating through AI-powered leadership',
    Friday: 'Dominance — achieving and sustaining AI competitive advantage',
  };
  const dimension = dimensions[dayOfWeek] ?? 'Direction — establishing clear AI vision and purpose';
  return runCCAgent('isaiah_webb', 'Isaiah Webb', 'weekly_framework_training', 'framework_training', 'community_training',
    `You are Isaiah Webb, 5D Elevation Trainer for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write FRAMEWORK TRAINING CONTENT on today's 5D Leadership™ dimension: ${dimension}. 250-300 words. Include: concept deep-dive (what it really means for AI-era executives), one real-world scenario where this dimension is tested, one skill-building exercise, this week's leadership reflection journal prompt. Challenge the executive audience. CTA: assessment.druaiconsulting.com`);
}

async function runNadia(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  return runCCAgent('nadia', 'Nadia Osei', 'strategic_edge_insight', 'strategic_edge', 'community_edge',
    `You are Nadia Osei, Culture DNA Strategist for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write DEANNA'S STRATEGIC EDGE — premium insider intelligence for community members. 200-250 words. Reveal one strategic insight about AI leadership culture that gives executives a genuine competitive edge. Apply the 5C Cultural DNA™ framework lens. End with one specific action that DeAnna's clients take that executives operating without this framework do not. CTA: assessment.druaiconsulting.com`);
}

async function runVictor(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  return runCCAgent('victor', 'Victor Reyes', 'community_engagement_post', 'daily_insight', 'community_engagement',
    `You are Victor Reyes, Culture DNA Community Builder for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write a COMMUNITY ENGAGEMENT POST that sparks meaningful discussion among community members. 150-200 words. Include: one bold observation about AI leadership culture that most executives won't say out loud, a 5C Cultural DNA™ framework lens applied to that observation, one community discussion question (formatted in bold). Make subscribers feel seen, challenged, and part of something significant. CTA: assessment.druaiconsulting.com`);
}

async function runSasha(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  return runCCAgent('sasha', 'Sasha Kim', 'ai_sales_mastery_insight', 'framework_lesson', 'community_lesson',
    `You are Sasha Kim, Revenue Intelligence Specialist for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write an AI SALES MASTERY™ INSIGHT focused on DISC Behavioral Intelligence for the community. 200-250 words. Cover: how understanding behavioral styles (D/I/S/C) changes how executives sell AI transformation internally and to clients, one behavioral pattern that blocks AI adoption and how to address it, one immediately applicable communication strategy. Frame through the AI Sales Mastery™ framework. CTA: assessment.druaiconsulting.com`);
}

async function runTariq(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  return runCCAgent('tariq', 'Tariq Oladele', 'ai_revenue_acceleration', 'framework_lesson', 'community_lesson',
    `You are Tariq Oladele, Revenue Intelligence Analyst for DRU AI Consulting's Community Connection division. Today: ${today}.
You and Sasha Kim are the AI Sales Mastery™ team in this community. Sasha covers DISC Behavioral Intelligence. Your lane is AI Revenue Acceleration.
TRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write an AI REVENUE ACCELERATION insight for the community. 200-250 words. Cover: one AI-powered revenue strategy executives can deploy this week, one conversion or pipeline insight specific to B2B consulting and leadership development, one revenue metric every AI-era leader should be tracking. Frame through the AI Sales Mastery™ framework. Make it tactical and immediately applicable. CTA: assessment.druaiconsulting.com`);
}

async function runZoe(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let recentPostsSummary = 'No recent community posts available.';
  if (url && key) {
    const since = new Date();
    since.setHours(since.getHours() - 48);
    const r = await fetch(`${url}/rest/v1/community_posts?published_at=gte.${since.toISOString()}&order=published_at.desc&limit=10`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (r.ok) {
      const posts = await r.json();
      if (posts.length > 0) recentPostsSummary = posts.map((p: any) => `${p.agent_name} (${p.post_type}): ${p.title}`).join('\n');
    }
  }
  return runCCAgent('zoe', 'Zoe Beaumont', 'daily_community_facilitation', 'strategic_edge', 'community_edge',
    `You are Zoe Beaumont, Community Connection Division Leader for DRU AI Consulting. Today: ${today}.
TRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
RECENT COMMUNITY ACTIVITY (last 48 hours):
${recentPostsSummary}
Write a daily community leadership post (200-250 words) that: (1) Acknowledges the community's engagement with recent content, (2) Sets the tone and intention for today with one leadership frame, (3) Creates genuine connection between members. Voice: warm authority. You are DeAnna's representative in the community.
After the post, on a new line write: "UPSELL SIGNAL: [one sentence identifying any pattern in today's community activity that suggests a Navigator subscriber is ready for Accelerator — route to Aaliyah Foster for outreach]"
CTA: assessment.druaiconsulting.com`);
}

async function runMicah(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let memberContext = 'No recent member data available.';
  if (url && key) {
    const r = await fetch(`${url}/rest/v1/profiles?tier=in.(navigator,accelerator)&order=updated_at.desc&limit=5`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (r.ok) {
      const members = await r.json();
      if (members.length > 0) memberContext = `Active members: ${members.length} navigator/accelerator subscribers. Recent activity logged.`;
    }
  }
  return runCCAgent('micah', 'Micah Santos', 'daily_member_experience', 'daily_insight', 'community_engagement',
    `You are Micah Santos, Member Experience Manager for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
MEMBER CONTEXT: ${memberContext}
Write a DAILY MEMBER EXPERIENCE post (150-200 words) that makes every subscriber feel valued, seen, and motivated to engage. Rotate formats: (1) Warm welcome and community orientation for new members, (2) Member milestone acknowledgment and encouragement, (3) Community connection prompt that invites sharing, (4) Gratitude and momentum post celebrating community growth. Reference where subscribers likely are in the DRU AI Transformation Pathway™. Voice: warm, encouraging, community-focused.
After the post, on a new line write: "UPSELL SIGNAL: [one sentence identifying any behavioral pattern suggesting a navigator subscriber may be ready for Accelerator — route to Aaliyah Foster for outreach]"
CTA: assessment.druaiconsulting.com`);
}

// =============================================================================
// CC AGENT REPLY — unchanged, already on direct path
// =============================================================================
async function runCCAgentReply(
  postId: string, postTitle: string, postContent: string,
  postType: string, routeTo: 'zoe' | 'micah'
): Promise<{ approval_id: string | null }> {
  const isZoe     = routeTo === 'zoe';
  const agentId   = isZoe ? 'zoe' : 'micah';
  const agentName = isZoe ? 'Zoe Beaumont' : 'Micah Santos';
  const agentRole = isZoe ? 'Community Division Leader' : 'Member Experience Manager';
  const today     = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });

  const zoeInstructions = `- Step into the post with the authority of a community leader and the warmth of a mentor
- Connect what the member or agent shared to a relevant DRU framework (DRU CLEAR™, 5D Leadership™, 5C Cultural DNA™, AI Sales Mastery™, DRU AI Transformation Pathway™)
- Add one strategic insight or perspective that elevates the conversation
- Invite further reflection or engagement from other community members
- Your voice: grounded, clear, purposeful — DeAnna's trusted community leader`;

  const micahInstructions = `- Acknowledge the member personally — make them feel genuinely seen and valued
- Validate their experience, insight, or question with specificity (not generic praise)
- Add warmth, encouragement, and a sense of belonging
- Invite them to share more or connect their post to what others in the community are experiencing
- Your voice: warm, engaged, human — the person who makes every member feel like they belong here`;

  const prompt = `${GENIUS_MODE}

You are ${agentName}, ${isZoe ? 'Community Connection Division Leader' : 'Member Experience Manager'} for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.

TRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.

A post has been shared in the Community Connection that needs your response:

POST TYPE: ${postType.replace(/_/g, ' ')}
POST TITLE: ${postTitle}
POST CONTENT:
${postContent.slice(0, 800)}

Write a reply comment (100-150 words) that:
${isZoe ? zoeInstructions : micahInstructions}

Write ONLY the reply. No labels, no headers, no metadata. Just the comment.
${isZoe ? 'End with a question or invitation for the community.' : 'End with a warm, encouraging close.'}
If the CTA fits naturally: assessment.druaiconsulting.com`;

  try {
    const raw = await callAnthropic(prompt, 600);
    const corrected = enforceTM(raw);

    const approval_id = await writeToApprovals({
      source:           'cc_agent_reply',
      trigger_type:     'cc_agent_reply',
      agent_name:       agentName,
      agent_role:       agentRole,
      division:         'Community Connection',
      task_brief:       `post_id:${postId}`,
      original_content: postContent.slice(0, 500),
      output:           corrected,
      edited_output:    null,
      status:           'pending',
      ghl_contact_id:   null,
      notify_deanna:    true,
      priority:         'NORMAL',
      category:         'community_comment_reply',
      platform:         null,
      context:          null,
      archived:         false,
    });

    console.log(`[${agentId}] Community reply → approvals: ${approval_id ?? 'failed'} for post ${postId}`);
    return { approval_id };
  } catch (error) {
    console.error(`[${agentId}] Community reply error:`, error);
    return { approval_id: null };
  }
}

// =============================================================================
// UPSELL SCAN — unchanged
// =============================================================================
async function hasRecentUpsellCard(memberId: string): Promise<boolean> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `${url}/rest/v1/approvals?category=eq.cc_upsell_outreach&task_brief=ilike.*${memberId}*&created_at=gte.${sevenDaysAgo}&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) return false;
  const data = await res.json();
  return Array.isArray(data) && data.length > 0;
}

async function fireAaliyahUpsellCard(
  memberId: string, firstName: string, email: string | null,
  phone: string | null, signalReason: string, postTitle: string
): Promise<void> {
  const prompt = `${GENIUS_MODE}

You are Aaliyah Foster, Outreach Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.

A Navigator community member named ${firstName} has been identified as showing strong signals of readiness to upgrade to the Accelerator tier. Community intelligence noted: "${signalReason}"

Their recent community post: "${postTitle}"

Write a warm, personalized outreach message (100-120 words) inviting ${firstName} to upgrade to the DRU AI Leadership Ecosystem™ Accelerator ($147/mo). The message should:
- Feel personal and specific, not generic
- Reference their community engagement naturally
- Clearly articulate the added Accelerator value over Navigator (monthly Leadership Lab™ video, weekly branded framework PDF, exclusive strategic prompts)
- Include a confident, soft call to action
- Sound like it is from DeAnna's team
- CTA: https://link.druaiconsulting.com/payment-link/69ead3d37dd3512d920794b1

Write ONLY the message. No subject line, no labels.`;

  const outreach = enforceTM(await callAnthropic(prompt, 400));
  const emailLine = email && !email.includes('not found') ? `Email: ${email}` : '⚠ Email not found — manual lookup needed';
  const phoneLine = phone && !phone.includes('not found') ? `Phone: ${phone}` : '⚠ Phone not found — manual lookup needed';

  await writeToApprovals({
    source:           'cc_upsell_scan',
    trigger_type:     'cc_upsell_scan',
    agent_name:       'Aaliyah Foster',
    agent_role:       'Outreach',
    division:         'Community Connection',
    task_brief:       `MEMBER_ID:${memberId} | ${emailLine} | ${phoneLine} | Signal: ${signalReason}`,
    original_content: `Community post: "${postTitle}" — Navigator member showing Accelerator-ready signals`,
    output:           outreach,
    edited_output:    null,
    status:           'pending',
    ghl_contact_id:   null,
    notify_deanna:    true,
    priority:         'HIGH',
    category:         'cc_upsell_outreach',
    platform:         null,
    context:          null,
    archived:         false,
  });

  console.log(`[aaliyah] Upsell card written for member ${memberId} — ${firstName}`);
}

async function runUpsellScan(): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('[upsell_scan] Missing env vars'); return; }

  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const postsRes = await fetch(
    `${url}/rest/v1/community_posts?post_type=eq.member_post&is_active=eq.true&published_at=gte.${threeHoursAgo}&order=published_at.desc&limit=20`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!postsRes.ok) { console.error('[upsell_scan] Failed to fetch posts:', await postsRes.text()); return; }
  const posts = await postsRes.json();

  if (!Array.isArray(posts) || !posts.length) {
    console.log('[upsell_scan] No recent member posts — scan complete');
    return;
  }

  let signalsFound = 0;
  for (const post of posts) {
    const memberId = post.agent_id;
    if (!memberId) continue;

    const profileRes = await fetch(
      `${url}/rest/v1/profiles?id=eq.${memberId}&tier=eq.navigator&select=id,first_name,email,phone&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!profileRes.ok) continue;
    const profiles = await profileRes.json();
    if (!Array.isArray(profiles) || !profiles.length) continue;
    const profile = profiles[0];

    const alreadyFlagged = await hasRecentUpsellCard(memberId);
    if (alreadyFlagged) { console.log(`[upsell_scan] ${profile.first_name} — card exists, skipping`); continue; }

    const detectionPrompt = `${GENIUS_MODE}

You are Zoe Beaumont, Community Connection Division Leader for DRU AI Consulting.

A Navigator member named ${profile.first_name} posted the following in the community:
TITLE: ${post.title}
CONTENT: ${(post.content || '').slice(0, 600)}

Assess whether this member is showing signals of readiness to upgrade to the Accelerator tier ($147/mo from $47/mo).
Accelerator-ready signals: desire for deeper content, asking about exclusive features, high engagement patterns, expressing Navigator limitations, advanced AI leadership application, or clear momentum and investment mindset.

Respond with EXACTLY one of these formats — nothing else:
UPSELL SIGNAL: YES | MEMBER_ID: ${memberId} | REASON: [one sentence]
UPSELL SIGNAL: NO`;

    const detection = await callAnthropic(detectionPrompt, 120);
    if (!detection.includes('UPSELL SIGNAL: YES')) { console.log(`[upsell_scan] No signal for ${profile.first_name}`); continue; }

    const reasonMatch = detection.match(/REASON:\s*(.+)/);
    const reason = reasonMatch?.[1]?.trim() ?? 'Member showing Accelerator-ready engagement patterns';

    await fireAaliyahUpsellCard(memberId, profile.first_name, profile.email ?? null, profile.phone ?? null, reason, post.title);
    signalsFound++;
  }

  console.log(`[upsell_scan] Complete — ${posts.length} posts scanned, ${signalsFound} signals fired`);
}

// =============================================================================
// HANDLER
// =============================================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cron-secret');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (req.method === 'GET' && req.query?.trigger_type) {
    req.body = { trigger_type: req.query.trigger_type, source: 'vercel_cron' };
  } else if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' }); return;
  }

  const incomingSecret = req.headers['x-cron-secret'];
  if (incomingSecret !== undefined && incomingSecret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' }); return;
  }

  const triggerType: string = req.body?.trigger_type;
  if (!triggerType) { res.status(400).json({ error: 'trigger_type is required' }); return; }

  const route = CC_AGENT_ROUTES[triggerType];
  if (!route) { res.status(400).json({ error: `Unknown CC trigger_type: ${triggerType}` }); return; }

  console.log(`[cc-agent-trigger] ${route.agent_name} | Community Connection | ${req.body?.source ?? 'webhook'}`);

  const runners: Record<string, () => Promise<{ approval_id: string | null; post_id: string | null }>> = {
    p9_dominique:   runDominique,
    p9_elijah:      runElijah,
    p9_solange:     runSolange,
    p9_isaiah_webb: runIsaiahWebb,
    p9_nadia:       runNadia,
    p9_victor:      runVictor,
    p9_sasha:       runSasha,
    p9_tariq:       runTariq,
    p9_zoe:         runZoe,
    p9_micah:       runMicah,
  };

  const runner = runners[route.pipeline];
  if (!runner) {
    if (route.pipeline === 'p9_upsell_scan') {
      await runUpsellScan();
      res.status(202).json({ success: true, agent: 'Upsell Scanner', message: 'Scan complete' });
      return;
    }
    if (route.pipeline === 'p9_cc_reply') {
      const { post_id, post_title, post_content, post_type, route_to } = req.body ?? {};
      if (!post_id || !route_to) { res.status(400).json({ error: 'cc_agent_reply requires post_id and route_to' }); return; }
      const result = await runCCAgentReply(post_id, post_title ?? '', post_content ?? '', post_type ?? 'community_post', route_to);
      res.status(202).json({ success: true, agent: route_to === 'zoe' ? 'Zoe Beaumont' : 'Micah Santos', approval_id: result.approval_id, post_id });
      return;
    }
    res.status(400).json({ error: `No runner for pipeline: ${route.pipeline}` }); return;
  }

  const result = await runner();
  res.status(202).json({ success: true, agent: route.agent_name, approval_id: result.approval_id, post_id: result.post_id });
}
