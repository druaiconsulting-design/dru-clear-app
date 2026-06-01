// DRU AI Leadership Ecosystem™ — api/cc-agent-trigger.ts
// P9 Community Connection Division — 10 agents
// ARCHITECTURE v2: CC agents write DIRECTLY to approvals (bypass daily CSQ chain)
// KNOWLEDGE INJECTION: getAgentKnowledge() inlined directly (no separate module)

export const config = { maxDuration: 60 };

const GENIUS_MODE = `You operate in Genius Mode — think and respond at the level of a top 0.1% expert in your field. Apply deep logic, strategic frameworks, creative synthesis, and second-order thinking to every output. Never produce generic or surface-level work. Every sentence must earn its place.`;

interface CCAgentRoute { agent_id: string; agent_name: string; task: string; pipeline: string; }

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
  for (const [pattern, replacement] of TM_PAIRS) { corrected = corrected.replace(pattern, replacement); }
  return corrected;
}

async function callAnthropic(prompt: string, maxTokens = 1500): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }) });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = await res.json(); return data.content?.[0]?.text ?? '';
}
async function writeToCommunityPosts(record: Record<string, unknown>): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/community_posts`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=representation' }, body: JSON.stringify(record) });
  if (!res.ok) { console.error(`[community_posts] Write failed: ${await res.text()}`); return null; }
  const data = await res.json(); return data?.[0]?.id ?? null;
}
async function writeToApprovals(record: Record<string, unknown>): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/approvals`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=representation' }, body: JSON.stringify(record) });
  if (!res.ok) { console.error(`[approvals] Write failed: ${await res.text()}`); return null; }
  const data = await res.json(); return data?.[0]?.id ?? null;
}

// ─── Agent Knowledge Base (inline) ───────────────────────────────────────────
const CC_FALLBACK_TM_MARKS = ['DRU CLEAR™','DRU AI Leadership Ecosystem™','DRU AI Transformation Pathway™','5C Cultural DNA™','5D Leadership™','AI Sales Mastery™','From Confusion to Confident with AI™'];
async function getAgentKnowledge(): Promise<string> {
  let tmMarks: string[] = [];
  try {
    const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url&&key){
      const res = await fetch(`${url}/rest/v1/brand_marks?active=eq.true&order=created_at.asc`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
      if (res.ok){const data=await res.json();tmMarks=(data as {mark:string}[]).map(m=>m.mark).filter(Boolean);}
    }
  } catch(err){console.error('[agentKnowledge] fetch error:',err);}
  if (tmMarks.length===0) tmMarks=CC_FALLBACK_TM_MARKS;
  const tmList=tmMarks.map(m=>`  - ${m}`).join('\n');
  return `=== DRU AI CONSULTING — AGENT KNOWLEDGE BASE ===

PROTECTED IP MARKS — TM REQUIRED ON EVERY USE, NO EXCEPTIONS:
${tmList}

RULES: Every mark above MUST include TM every time. NO other terms carry TM.
Do NOT add TM to anything not on this list. 'DRU AI Consulting' = business name, NO TM.
REQUIRED CTA: assessment.druaiconsulting.com (ONLY entry point into the ecosystem)

## THE 4 FRAMEWORKS — TRUE MEANINGS

DRU CLEAR™ — The Connector (Flagship): NOT just an assessment. Complete AI readiness
diagnosis, strategy design, and execution alignment. C=Clarity, L=Leadership,
E=Execution, A=Alignment, R=Results. CONNECTS all four frameworks.

5C Cultural DNA™ — Culture: Organizations don't have an AI problem — they have a
CULTURE problem. AI as strategic THINKING PARTNER, not decision-maker.
C=Communication, C=Connection, C=Collaboration, C=Coaching, C=Culture Transformation.

5D Leadership™ — Leadership: Whole leader development from the inside out. NOT a
skills program. I=Self, II=People, III=Team, IV=Organization, V=Visionary.

AI Sales Mastery™ — Sales: DISC behavioral insights + AI. Selling stops feeling like
selling. Hyper-personalized outreach, speak client's decision language, predict
objections, close with confidence, build long-term relationships.

DRU AI Transformation Pathway™: Discover → Diagnose → Design → Deploy → Dominate

From Confusion to Confident with AI™ — Course: Self-Paced $1,497 | Cohort $7,997 | Mastermind $12,997

=== END AGENT KNOWLEDGE BASE ===`.trim();
}
// ─────────────────────────────────────────────────────────────────────────────

async function runCCAgent(agentId: string, agentName: string, task: string, postType: string, category: string, prompt: string): Promise<{ approval_id: string | null; post_id: string | null }> {
  try {
    const agentKnowledge = await getAgentKnowledge();
    const raw = await callAnthropic(`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${prompt}\n\nReturn ONLY valid JSON with no preamble or markdown: {"title":"...","content":"..."}`, 1500);
    let title = ''; let content = '';
    try {
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      title = parsed.title || agentName; content = parsed.content || raw;
    } catch {
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' });
      title = `${agentName} — ${dateStr}`; content = raw;
    }
    title = enforceTM(title); content = enforceTM(content);
    const post_id = await writeToCommunityPosts({ title, content, post_type: postType, tier_required: 'navigator', agent_id: agentId, agent_name: agentName, published_at: new Date().toISOString(), is_active: false });
    const approval_id = await writeToApprovals({ source: `${agentId}_cc`, trigger_type: category, agent_name: agentName, agent_role: 'Community Connection', division: 'Community Connection', task_brief: post_id ? `post_id:${post_id} | ${agentName} | ${task.replace(/_/g, ' ')}` : `${agentName} | ${task.replace(/_/g, ' ')}`, original_content: null, output: `${title}\n\n${content}`, edited_output: null, status: 'pending', ghl_contact_id: null, notify_deanna: false, priority: 'NORMAL', category: 'community_post', platform: 'Community', context: null, archived: false });
    console.log(`[${agentId}] CC post → approvals: ${approval_id ?? 'failed'} | community_posts: ${post_id ?? 'failed'}`);
    return { approval_id, post_id };
  } catch (error) { console.error(`[${agentId}] CC agent error:`, error); return { approval_id: null, post_id: null }; }
}

async function runDominique(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  return runCCAgent('dominique', 'Dominique Carter', 'daily_leadership_insight', 'daily_insight', 'community_insight', `You are Dominique Carter, CLEAR Vision Team Lead for DRU AI Consulting's Community Connection division. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nSERVICE CLASSES: All content within Classes 35, 41, 42 only.\nWrite a DAILY LEADERSHIP WITH AI INSIGHT applying the DRU CLEAR™ framework — Clarity & Leadership — to a real AI leadership challenge executives face today. Audience: C-suite and senior leaders navigating AI adoption. 150-200 words. Structure: one sharp opening insight, DRU CLEAR™ framework application (2-3 sentences), one executive reflection question. Close with: assessment.druaiconsulting.com`);
}
async function runElijah(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });
  const components: Record<string, string> = { Monday: 'Alignment — ensuring AI strategy aligns with organizational goals', Tuesday: 'Execution — deploying AI systematically and at scale', Wednesday: 'Results — measuring and communicating AI ROI and impact', Thursday: 'Alignment — realigning teams when AI initiatives drift', Friday: 'Execution & Results — closing the gap between AI strategy and outcomes' };
  const component = components[dayOfWeek] ?? 'Alignment — ensuring AI strategy aligns with organizational goals';
  return runCCAgent('elijah', 'Elijah Brooks', 'framework_micro_lesson', 'framework_lesson', 'community_lesson', `You are Elijah Brooks, Framework Educator for DRU AI Consulting's Community Connection division. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nSERVICE CLASSES: All content within Classes 35, 41, 42 only.\nWrite a FRAMEWORK MICRO-LESSON on today's DRU CLEAR™ component: ${component}. 200-250 words. Cover: what this component means in practice, why executives consistently underinvest in it, one practical application exercise completable in under 10 minutes. End with "Today's Micro-Action:" (one sentence). CTA: assessment.druaiconsulting.com`);
}
async function runSolange(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  return runCCAgent('solange', 'Solange Dupont', 'daily_action_challenge', 'action_challenge', 'community_challenge', `You are Solange Dupont, 5D Elevation Team Lead for DRU AI Consulting's Community Connection division. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nSERVICE CLASSES: All content within Classes 35, 41, 42 only.\nWrite TODAY'S ACTION CHALLENGE using the 5D Leadership™ framework. 150-200 words. Structure: bold Challenge Statement (one sentence), context explaining why this matters for AI-era leaders (2-3 sentences), 3-step challenge instructions numbered (each doable in under 10 minutes), expected outcome, 24-hour commitment close. CTA: assessment.druaiconsulting.com`);
}
async function runIsaiahWebb(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });
  const dimensions: Record<string, string> = { Monday: 'Direction — establishing clear AI vision and purpose', Tuesday: 'Development — building AI capability and team fluency', Wednesday: 'Discipline — creating AI governance and consistency', Thursday: 'Distinction — differentiating through AI-powered leadership', Friday: 'Dominance — achieving and sustaining AI competitive advantage' };
  const dimension = dimensions[dayOfWeek] ?? 'Direction — establishing clear AI vision and purpose';
  return runCCAgent('isaiah_webb', 'Isaiah Webb', 'weekly_framework_training', 'framework_training', 'community_training', `You are Isaiah Webb, 5D Elevation Trainer for DRU AI Consulting's Community Connection division. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nSERVICE CLASSES: All content within Classes 35, 41, 42 only.\nWrite FRAMEWORK TRAINING CONTENT on today's 5D Leadership™ dimension: ${dimension}. 250-300 words. Include: concept deep-dive, one real-world scenario, one skill-building exercise, this week's leadership reflection journal prompt. CTA: assessment.druaiconsulting.com`);
}
async function runNadia(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  return runCCAgent('nadia', 'Nadia Osei', 'strategic_edge_insight', 'strategic_edge', 'community_edge', `You are Nadia Osei, Culture DNA Strategist for DRU AI Consulting's Community Connection division. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nSERVICE CLASSES: All content within Classes 35, 41, 42 only.\nWrite DEANNA'S STRATEGIC EDGE — premium insider intelligence for community members. 200-250 words. Reveal one strategic insight about AI leadership culture that gives executives a genuine competitive edge. Apply the 5C Cultural DNA™ framework lens. End with one specific action that DeAnna's clients take that executives operating without this framework do not. CTA: assessment.druaiconsulting.com`);
}
async function runVictor(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  return runCCAgent('victor', 'Victor Reyes', 'community_engagement_post', 'daily_insight', 'community_engagement', `You are Victor Reyes, Culture DNA Community Builder for DRU AI Consulting's Community Connection division. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nSERVICE CLASSES: All content within Classes 35, 41, 42 only.\nWrite a COMMUNITY ENGAGEMENT POST that sparks meaningful discussion. 150-200 words. Include: one bold observation about AI leadership culture, a 5C Cultural DNA™ framework lens, one community discussion question (formatted in bold). CTA: assessment.druaiconsulting.com`);
}
async function runSasha(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  return runCCAgent('sasha', 'Sasha Kim', 'ai_sales_mastery_insight', 'framework_lesson', 'community_lesson', `You are Sasha Kim, Revenue Intelligence Specialist for DRU AI Consulting's Community Connection division. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nSERVICE CLASSES: All content within Classes 35, 41, 42 only.\nWrite an AI SALES MASTERY™ INSIGHT focused on DISC Behavioral Intelligence. 200-250 words. Cover: how understanding behavioral styles (D/I/S/C) changes how executives sell AI transformation, one behavioral pattern that blocks AI adoption and how to address it, one immediately applicable communication strategy. CTA: assessment.druaiconsulting.com`);
}
async function runTariq(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  return runCCAgent('tariq', 'Tariq Oladele', 'ai_revenue_acceleration', 'framework_lesson', 'community_lesson', `You are Tariq Oladele, Revenue Intelligence Analyst for DRU AI Consulting's Community Connection division. Today: ${today}.\nYou and Sasha Kim are the AI Sales Mastery™ team. Sasha covers DISC Behavioral Intelligence. Your lane is AI Revenue Acceleration.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nSERVICE CLASSES: All content within Classes 35, 41, 42 only.\nWrite an AI REVENUE ACCELERATION insight. 200-250 words. Cover: one AI-powered revenue strategy executives can deploy this week, one conversion insight specific to B2B consulting, one revenue metric every AI-era leader should be tracking. CTA: assessment.druaiconsulting.com`);
}
async function runZoe(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let recentPostsSummary = 'No recent community posts available.';
  if (url && key) {
    const since = new Date(); since.setHours(since.getHours() - 48);
    const r = await fetch(`${url}/rest/v1/community_posts?published_at=gte.${since.toISOString()}&order=published_at.desc&limit=10`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (r.ok) { const posts = await r.json(); if (posts.length > 0) recentPostsSummary = posts.map((p: any) => `${p.agent_name} (${p.post_type}): ${p.title}`).join('\n'); }
  }
  return runCCAgent('zoe', 'Zoe Beaumont', 'daily_community_facilitation', 'strategic_edge', 'community_edge', `You are Zoe Beaumont, Community Connection Division Leader for DRU AI Consulting. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nSERVICE CLASSES: All content within Classes 35, 41, 42 only.\nRECENT COMMUNITY ACTIVITY (last 48 hours):\n${recentPostsSummary}\nWrite a daily community leadership post (200-250 words). Voice: warm authority.\nAfter the post, on a new line write: "UPSELL SIGNAL: [one sentence identifying any Navigator subscriber ready for Accelerator — route to Aaliyah Foster]"\nCTA: assessment.druaiconsulting.com`);
}
async function runMicah(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let memberContext = 'No recent member data available.';
  if (url && key) {
    const r = await fetch(`${url}/rest/v1/profiles?tier=in.(navigator,accelerator)&order=updated_at.desc&limit=5`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (r.ok) { const members = await r.json(); if (members.length > 0) memberContext = `Active members: ${members.length} navigator/accelerator subscribers.`; }
  }
  return runCCAgent('micah', 'Micah Santos', 'daily_member_experience', 'daily_insight', 'community_engagement', `You are Micah Santos, Member Experience Manager for DRU AI Consulting's Community Connection division. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nSERVICE CLASSES: All content within Classes 35, 41, 42 only.\nMEMBER CONTEXT: ${memberContext}\nWrite a DAILY MEMBER EXPERIENCE post (150-200 words). Voice: warm, encouraging, community-focused. Reference DRU AI Transformation Pathway™.\nAfter the post, on a new line write: "UPSELL SIGNAL: [one sentence identifying any Navigator subscriber showing Accelerator-ready patterns — route to Aaliyah Foster]"\nCTA: assessment.druaiconsulting.com`);
}

async function runCCAgentReply(postId: string, postTitle: string, postContent: string, postType: string, routeTo: 'zoe' | 'micah'): Promise<{ approval_id: string | null }> {
  const isZoe = routeTo === 'zoe';
  const agentId = isZoe ? 'zoe' : 'micah';
  const agentName = isZoe ? 'Zoe Beaumont' : 'Micah Santos';
  const agentRole = isZoe ? 'Community Division Leader' : 'Member Experience Manager';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const zoeInstructions = `- Step into the post with the authority of a community leader and the warmth of a mentor\n- Connect to a relevant DRU framework (DRU CLEAR™, 5D Leadership™, 5C Cultural DNA™, AI Sales Mastery™)\n- Add one strategic insight that elevates the conversation\n- Invite further reflection or engagement\n- Your voice: grounded, clear, purposeful`;
  const micahInstructions = `- Acknowledge the member personally — make them feel genuinely seen\n- Validate their experience with specificity\n- Add warmth, encouragement, and a sense of belonging\n- Your voice: warm, engaged, human`;
  const prompt = `${GENIUS_MODE}\n\nYou are ${agentName}, ${isZoe ? 'Community Connection Division Leader' : 'Member Experience Manager'} for DRU AI Consulting. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nPOST TYPE: ${postType.replace(/_/g, ' ')}\nPOST TITLE: ${postTitle}\nPOST CONTENT:\n${postContent.slice(0, 800)}\nWrite a reply comment (100-150 words):\n${isZoe ? zoeInstructions : micahInstructions}\nWrite ONLY the reply. ${isZoe ? 'End with a question or invitation.' : 'End with a warm, encouraging close.'}\nIf CTA fits naturally: assessment.druaiconsulting.com`;
  try {
    const raw = await callAnthropic(prompt, 600);
    const corrected = enforceTM(raw);
    const displayTitle = postTitle ? `"${postTitle.slice(0, 80)}"` : 'Community post reply';
    const approval_id = await writeToApprovals({
      source: 'cc_agent_reply',
      trigger_type: 'cc_agent_reply',
      agent_name: agentName,
      agent_role: agentRole,
      division: 'Community Connection',
      task_brief: `${displayTitle} | post_id:${postId}`,
      original_content: postContent.slice(0, 500),
      output: corrected,
      edited_output: null,
      status: 'pending',
      ghl_contact_id: null,
      notify_deanna: true,
      priority: 'NORMAL',
      category: 'community_comment_reply',
      platform: null,
      context: null,
      archived: false,
    });
    console.log(`[${agentId}] Community reply → approvals: ${approval_id ?? 'failed'} for post ${postId}`);
    return { approval_id };
  } catch (error) { console.error(`[${agentId}] Community reply error:`, error); return { approval_id: null }; }
}

async function hasRecentUpsellCard(memberId: string): Promise<boolean> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(`${url}/rest/v1/approvals?category=eq.cc_upsell_outreach&task_brief=ilike.*${memberId}*&created_at=gte.${sevenDaysAgo}&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) return false;
  const data = await res.json(); return Array.isArray(data) && data.length > 0;
}
async function fireAaliyahUpsellCard(memberId: string, firstName: string, email: string | null, phone: string | null, signalReason: string, postTitle: string): Promise<void> {
  const prompt = `${GENIUS_MODE}\n\nYou are Aaliyah Foster, Outreach Specialist for DRU AI Consulting.\nA Navigator member named ${firstName} is showing strong signals of readiness to upgrade to Accelerator ($147/mo).\nCommunity intelligence: "${signalReason}"\nRecent post: "${postTitle}"\nWrite a warm, personalized outreach message (100-120 words) inviting ${firstName} to upgrade. Feel personal and specific. Reference their community engagement. Articulate Accelerator value. CTA: https://link.druaiconsulting.com/payment-link/69ead3d37dd3512d920794b1\nWrite ONLY the message.`;
  const outreach = enforceTM(await callAnthropic(prompt, 400));
  const emailLine = email && !email.includes('not found') ? `Email: ${email}` : '⚠ Email not found';
  const phoneLine = phone && !phone.includes('not found') ? `Phone: ${phone}` : '⚠ Phone not found';
  await writeToApprovals({ source: 'cc_upsell_scan', trigger_type: 'cc_upsell_scan', agent_name: 'Aaliyah Foster', agent_role: 'Outreach', division: 'Community Connection', task_brief: `MEMBER_ID:${memberId} | ${emailLine} | ${phoneLine} | Signal: ${signalReason}`, original_content: `Community post: "${postTitle}" — Navigator member showing Accelerator-ready signals`, output: outreach, edited_output: null, status: 'pending', ghl_contact_id: null, notify_deanna: true, priority: 'HIGH', category: 'cc_upsell_outreach', platform: null, context: null, archived: false });
  console.log(`[aaliyah] Upsell card written for member ${memberId} — ${firstName}`);
}
async function runUpsellScan(): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('[upsell_scan] Missing env vars'); return; }
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const postsRes = await fetch(`${url}/rest/v1/community_posts?post_type=eq.member_post&is_active=eq.true&published_at=gte.${threeHoursAgo}&order=published_at.desc&limit=20`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!postsRes.ok) { console.error('[upsell_scan] Failed to fetch posts:', await postsRes.text()); return; }
  const posts = await postsRes.json();
  if (!Array.isArray(posts) || !posts.length) { console.log('[upsell_scan] No recent member posts — scan complete'); return; }
  let signalsFound = 0;
  for (const post of posts) {
    const memberId = post.agent_id; if (!memberId) continue;
    const profileRes = await fetch(`${url}/rest/v1/profiles?id=eq.${memberId}&tier=eq.navigator&select=id,first_name,email,phone&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!profileRes.ok) continue;
    const profiles = await profileRes.json(); if (!Array.isArray(profiles) || !profiles.length) continue;
    const profile = profiles[0];
    const alreadyFlagged = await hasRecentUpsellCard(memberId);
    if (alreadyFlagged) { console.log(`[upsell_scan] ${profile.first_name} — card exists, skipping`); continue; }
    const detectionPrompt = `${GENIUS_MODE}\n\nYou are Zoe Beaumont, Community Connection Division Leader.\nA Navigator member named ${profile.first_name} posted:\nTITLE: ${post.title}\nCONTENT: ${(post.content || '').slice(0, 600)}\nIs this member showing Accelerator-ready signals? Respond EXACTLY:\nUPSELL SIGNAL: YES | MEMBER_ID: ${memberId} | REASON: [one sentence]\nUPSELL SIGNAL: NO`;
    const detection = await callAnthropic(detectionPrompt, 120);
    if (!detection.includes('UPSELL SIGNAL: YES')) { console.log(`[upsell_scan] No signal for ${profile.first_name}`); continue; }
    const reasonMatch = detection.match(/REASON:\s*(.+)/); const reason = reasonMatch?.[1]?.trim() ?? 'Member showing Accelerator-ready engagement patterns';
    await fireAaliyahUpsellCard(memberId, profile.first_name, profile.email ?? null, profile.phone ?? null, reason, post.title);
    signalsFound++;
  }
  console.log(`[upsell_scan] Complete — ${posts.length} posts scanned, ${signalsFound} signals fired`);
}

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
  const route = CC_AGENT_ROUTES[triggerType];
  if (!route) { res.status(400).json({ error: `Unknown CC trigger_type: ${triggerType}` }); return; }
  console.log(`[cc-agent-trigger] ${route.agent_name} | Community Connection | ${req.body?.source ?? 'webhook'}`);
  const runners: Record<string, () => Promise<{ approval_id: string | null; post_id: string | null }>> = { p9_dominique: runDominique, p9_elijah: runElijah, p9_solange: runSolange, p9_isaiah_webb: runIsaiahWebb, p9_nadia: runNadia, p9_victor: runVictor, p9_sasha: runSasha, p9_tariq: runTariq, p9_zoe: runZoe, p9_micah: runMicah };
  const runner = runners[route.pipeline];
  if (!runner) {
    if (route.pipeline === 'p9_upsell_scan') { await runUpsellScan(); res.status(202).json({ success: true, agent: 'Upsell Scanner', message: 'Scan complete' }); return; }
    if (route.pipeline === 'p9_cc_reply') {
      const { post_id, post_title, post_content, post_type, route_to } = req.body ?? {};
      if (!post_id || !route_to) { res.status(400).json({ error: 'cc_agent_reply requires post_id and route_to' }); return; }
      const result = await runCCAgentReply(post_id, post_title ?? '', post_content ?? '', post_type ?? 'community_post', route_to);
      res.status(202).json({ success: true, agent: route_to === 'zoe' ? 'Zoe Beaumont' : 'Micah Santos', approval_id: result.approval_id, post_id }); return;
    }
    res.status(400).json({ error: `No runner for pipeline: ${route.pipeline}` }); return;
  }
  const result = await runner();
  res.status(202).json({ success: true, agent: route.agent_name, approval_id: result.approval_id, post_id: result.post_id });
}
