// DRU AI Leadership Ecosystem™ — api/cc-agent-trigger.ts
// P9 Community Connection Division — 10 agents
// Separated from ghl-agent-trigger.ts for isolation and maintainability
// All posts write to community_posts (is_active: false) pending DeAnna approval
// tier_required: 'navigator' on all posts = context badge only, not a content gate
// Both Navigator and Accelerator members see all community content

export const config = { maxDuration: 60 };

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
};

// --- Shared utilities ---
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

async function writeToCSQ(record: Record<string, unknown>): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/chief_of_staff_queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=representation' },
    body: JSON.stringify(record),
  });
  if (!res.ok) { console.error(`[csq] Write failed: ${await res.text()}`); return null; }
  const data = await res.json();
  return data?.[0]?.id ?? null;
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

// --- CC Agent runner ---
// All CC posts: tier_required = 'navigator' (badge/context only — both Nav and Acc see all posts)
async function runCCAgent(
  agentId: string, agentName: string, task: string,
  postType: string, category: string, prompt: string
): Promise<{ csq_id: string | null; post_id: string | null }> {
  try {
    const raw = await callAnthropic(
      `${GENIUS_MODE}\n\n${prompt}\n\nReturn ONLY valid JSON with no preamble or markdown: {"title":"...","content":"..."}`,
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
      title   = `${agentName} \u2014 ${dateStr}`;
      content = raw;
    }
    const [csq_id, post_id] = await Promise.all([
      writeToCSQ({
        agent_id: agentId, agent_name: agentName, division: 'Community Connection',
        task, category, raw_output: `${title}\n\n${content}`,
        priority: 'normal', status: 'pending', retry_count: 0,
      }),
      writeToCommunityPosts({
        title, content, post_type: postType,
        tier_required: 'navigator',
        agent_id: agentId, agent_name: agentName,
        published_at: new Date().toISOString(), is_active: false,
      }),
    ]);
    console.log(`[${agentId}] CC post created: ${post_id ?? 'failed'} | CSQ: ${csq_id ?? 'failed'}`);
    return { csq_id, post_id };
  } catch (error) {
    console.error(`[${agentId}] CC agent error:`, error);
    return { csq_id: null, post_id: null };
  }
}

// =============================================================================
// P9 AGENTS
// =============================================================================

async function runDominique(): Promise<{ csq_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  return runCCAgent('dominique', 'Dominique Carter', 'daily_leadership_insight', 'daily_insight', 'community_insight',
    `You are Dominique Carter, CLEAR Vision Team Lead for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write a DAILY LEADERSHIP WITH AI INSIGHT applying the DRU CLEAR\u2122 framework — Clarity & Leadership — to a real AI leadership challenge executives face today. Audience: C-suite and senior leaders navigating AI adoption. 150-200 words. Structure: one sharp opening insight, DRU CLEAR\u2122 framework application (2-3 sentences), one executive reflection question. Close with: assessment.druaiconsulting.com`);
}

async function runElijah(): Promise<{ csq_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });
  const components: Record<string, string> = {
    Monday: 'Alignment \u2014 ensuring AI strategy aligns with organizational goals',
    Tuesday: 'Execution \u2014 deploying AI systematically and at scale',
    Wednesday: 'Results \u2014 measuring and communicating AI ROI and impact',
    Thursday: 'Alignment \u2014 realigning teams when AI initiatives drift',
    Friday: 'Execution & Results \u2014 closing the gap between AI strategy and outcomes',
  };
  const component = components[dayOfWeek] ?? 'Alignment \u2014 ensuring AI strategy aligns with organizational goals';
  return runCCAgent('elijah', 'Elijah Brooks', 'framework_micro_lesson', 'framework_lesson', 'community_lesson',
    `You are Elijah Brooks, Framework Educator for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write a FRAMEWORK MICRO-LESSON on today's DRU CLEAR\u2122 component: ${component}. 200-250 words. Cover: what this component means in practice, why executives consistently underinvest in it, one practical application exercise completable in under 10 minutes. End with "Today's Micro-Action:" (one sentence). CTA: assessment.druaiconsulting.com`);
}

async function runSolange(): Promise<{ csq_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  return runCCAgent('solange', 'Solange Dupont', 'daily_action_challenge', 'action_challenge', 'community_challenge',
    `You are Solange Dupont, 5D Elevation Team Lead for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write TODAY'S ACTION CHALLENGE using the 5D Leadership\u2122 framework. 150-200 words. Structure: bold Challenge Statement (one sentence), context explaining why this matters for AI-era leaders (2-3 sentences), 3-step challenge instructions numbered (each doable in under 10 minutes), expected outcome, 24-hour commitment close. CTA: assessment.druaiconsulting.com`);
}

async function runIsaiahWebb(): Promise<{ csq_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });
  const dimensions: Record<string, string> = {
    Monday: 'Direction \u2014 establishing clear AI vision and purpose',
    Tuesday: 'Development \u2014 building AI capability and team fluency',
    Wednesday: 'Discipline \u2014 creating AI governance and consistency',
    Thursday: 'Distinction \u2014 differentiating through AI-powered leadership',
    Friday: 'Dominance \u2014 achieving and sustaining AI competitive advantage',
  };
  const dimension = dimensions[dayOfWeek] ?? 'Direction \u2014 establishing clear AI vision and purpose';
  return runCCAgent('isaiah_webb', 'Isaiah Webb', 'weekly_framework_training', 'framework_training', 'community_training',
    `You are Isaiah Webb, 5D Elevation Trainer for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write FRAMEWORK TRAINING CONTENT on today's 5D Leadership\u2122 dimension: ${dimension}. 250-300 words. Include: concept deep-dive (what it really means for AI-era executives), one real-world scenario where this dimension is tested, one skill-building exercise, this week's leadership reflection journal prompt. Challenge the executive audience. CTA: assessment.druaiconsulting.com`);
}

async function runNadia(): Promise<{ csq_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  return runCCAgent('nadia', 'Nadia Osei', 'strategic_edge_insight', 'strategic_edge', 'community_edge',
    `You are Nadia Osei, Culture DNA Strategist for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write DEANNA'S STRATEGIC EDGE \u2014 premium insider intelligence for community members. 200-250 words. Reveal one strategic insight about AI leadership culture that gives executives a genuine competitive edge. Apply the 5C Cultural DNA\u2122 framework lens. End with one specific action that DeAnna's clients take that executives operating without this framework do not. CTA: assessment.druaiconsulting.com`);
}

async function runVictor(): Promise<{ csq_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  return runCCAgent('victor', 'Victor Reyes', 'community_engagement_post', 'daily_insight', 'community_engagement',
    `You are Victor Reyes, Culture DNA Community Builder for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write a COMMUNITY ENGAGEMENT POST that sparks meaningful discussion among community members. 150-200 words. Include: one bold observation about AI leadership culture that most executives won't say out loud, a 5C Cultural DNA\u2122 framework lens applied to that observation, one community discussion question (formatted in bold). Make subscribers feel seen, challenged, and part of something significant. CTA: assessment.druaiconsulting.com`);
}

async function runSasha(): Promise<{ csq_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  return runCCAgent('sasha', 'Sasha Kim', 'ai_sales_mastery_insight', 'framework_lesson', 'community_lesson',
    `You are Sasha Kim, Revenue Intelligence Specialist for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write an AI SALES MASTERY\u2122 INSIGHT focused on DISC Behavioral Intelligence for the community. 200-250 words. Cover: how understanding behavioral styles (D/I/S/C) changes how executives sell AI transformation internally and to clients, one behavioral pattern that blocks AI adoption and how to address it, one immediately applicable communication strategy. Frame through the AI Sales Mastery\u2122 framework. CTA: assessment.druaiconsulting.com`);
}

async function runTariq(): Promise<{ csq_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  return runCCAgent('tariq', 'Tariq Oladele', 'ai_revenue_acceleration', 'framework_lesson', 'community_lesson',
    `You are Tariq Oladele, Revenue Intelligence Analyst for DRU AI Consulting's Community Connection division. Today: ${today}.
You and Sasha Kim are the AI Sales Mastery\u2122 team in this community. Sasha covers DISC Behavioral Intelligence. Your lane is AI Revenue Acceleration.
TRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write an AI REVENUE ACCELERATION insight for the community. 200-250 words. Cover: one AI-powered revenue strategy executives can deploy this week, one conversion or pipeline insight specific to B2B consulting and leadership development, one revenue metric every AI-era leader should be tracking. Frame through the AI Sales Mastery\u2122 framework. Make it tactical and immediately applicable. CTA: assessment.druaiconsulting.com`);
}

async function runZoe(): Promise<{ csq_id: string | null; post_id: string | null }> {
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
TRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
RECENT COMMUNITY ACTIVITY (last 48 hours):
${recentPostsSummary}
Write a daily community leadership post (200-250 words) that: (1) Acknowledges the community's engagement with recent content, (2) Sets the tone and intention for today with one leadership frame, (3) Creates genuine connection between members. Voice: warm authority. You are DeAnna's representative in the community.
After the post, on a new line write: "UPSELL SIGNAL: [one sentence identifying any pattern in today's community activity that suggests a Navigator subscriber is ready for Accelerator \u2014 route to Aaliyah Foster for outreach]"
CTA: assessment.druaiconsulting.com`);
}

async function runMicah(): Promise<{ csq_id: string | null; post_id: string | null }> {
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
TRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
MEMBER CONTEXT: ${memberContext}
Write a DAILY MEMBER EXPERIENCE post (150-200 words) that makes every subscriber feel valued, seen, and motivated to engage. Rotate formats: (1) Warm welcome and community orientation for new members, (2) Member milestone acknowledgment and encouragement, (3) Community connection prompt that invites sharing, (4) Gratitude and momentum post celebrating community growth. Reference where subscribers likely are in the DRU AI Transformation Pathway\u2122. Voice: warm, encouraging, community-focused.
After the post, on a new line write: "UPSELL SIGNAL: [one sentence identifying any behavioral pattern suggesting a navigator subscriber may be ready for Accelerator \u2014 route to Aaliyah Foster for outreach]"
CTA: assessment.druaiconsulting.com`);
}

// =============================================================================
// MAIN HANDLER
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

  const runners: Record<string, () => Promise<{ csq_id: string | null; post_id: string | null }>> = {
    p9_dominique:  runDominique,
    p9_elijah:     runElijah,
    p9_solange:    runSolange,
    p9_isaiah_webb: runIsaiahWebb,
    p9_nadia:      runNadia,
    p9_victor:     runVictor,
    p9_sasha:      runSasha,
    p9_tariq:      runTariq,
    p9_zoe:        runZoe,
    p9_micah:      runMicah,
  };

  const runner = runners[route.pipeline];
  if (!runner) { res.status(400).json({ error: `No runner for pipeline: ${route.pipeline}` }); return; }

  const result = await runner();
  res.status(202).json({ success: true, agent: route.agent_name, csq_id: result.csq_id, post_id: result.post_id });
}
