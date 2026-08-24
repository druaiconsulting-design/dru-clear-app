// DRU AI Leadership Ecosystem™ — api/cc-agent-trigger.ts
// P9 Community Connection Division — Zoe (Leader) / Micah (Member Experience) / Victor (CC Strategy)
// ARCHITECTURE v3: CC agents write DIRECTLY to approvals (bypass daily CSQ chain)
// KNOWLEDGE INJECTION: getAgentKnowledge() inlined directly (no separate module)
// UPDATED: SMRT agents removed (Dominique, Elijah, Solange, Isaiah Webb, Nadia now live in social-response-trigger.ts)
// UPDATED: Victor Reyes upgraded to CC Strategy — mirrors Renata Cruz (AC) at Navigator depth
// UPDATED: post_type is always 'agent' — daily_insight / strategic_edge belong to Daily Connection only
// UPDATED: Sasha covers full DISC spectrum every run (3x/week: Sun/Tue/Thu)
// UPDATED: Tariq day-specific angles (Mon=Strategy, Wed=Conversion, Sat=Pipeline)
// UPDATED: Bidirectional getPeerCrossRead between Sasha and Tariq (same IP ecosystem)

export const config = { maxDuration: 60 };

import { VOICE_DNA, getAgentCorrections } from './_lib/agentKnowledge.js';

const GENIUS_MODE = `You operate in Genius Mode — think and respond at the level of a top 0.1% expert in your field. Apply deep logic, strategic frameworks, creative synthesis, and second-order thinking to every output. Never produce generic or surface-level work. Every sentence must earn its place.`;

const BRAND_COPY_FALLBACK: Record<string,string> = {
  positioning: 'EQ Meets AI: People-Centered Leadership, AI-Powered Insight',
};
async function fetchBrandCopy(key: string): Promise<string> {
  const url = process.env.VITE_SUPABASE_URL; const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const fallback = BRAND_COPY_FALLBACK[key] || '';
  if (!url||!svcKey) return fallback;
  const res = await fetch(`${url}/rest/v1/brand_copy?key=eq.${key}&select=value`,{headers:{apikey:svcKey,Authorization:`Bearer ${svcKey}`}});
  if (!res.ok) return fallback;
  const data = await res.json(); return (data as {value:string}[])[0]?.value || fallback;
}

interface CCAgentRoute { agent_id: string; agent_name: string; task: string; pipeline: string; }

const CC_AGENT_ROUTES: Record<string, CCAgentRoute> = {
  // ── Daily community seed — rotates Zoe / Micah / Victor (one post per day) ──
  cron_community_seed:     { agent_id: 'community_seed', agent_name: 'Community Seed',  task: 'daily_community_seed',     pipeline: 'p9_community_seed' },
  // ── Sasha Kim — AI Sales Mastery™ DISC intelligence (Sun / Tue / Thu) ────────
  cron_sasha_sales_insight: { agent_id: 'sasha', agent_name: 'Sasha Kim',    task: 'ai_sales_mastery_insight', pipeline: 'p9_sasha' },
  cron_sasha_tuesday:       { agent_id: 'sasha', agent_name: 'Sasha Kim',    task: 'ai_sales_mastery_insight', pipeline: 'p9_sasha' },
  cron_sasha_thursday:      { agent_id: 'sasha', agent_name: 'Sasha Kim',    task: 'ai_sales_mastery_insight', pipeline: 'p9_sasha' },
  // ── Tariq Oladele — Revenue Acceleration (Mon / Wed / Sat) ──────────────────
  cron_tariq_sales_content: { agent_id: 'tariq', agent_name: 'Tariq Oladele', task: 'ai_revenue_acceleration',  pipeline: 'p9_tariq' },
  cron_tariq_wednesday:     { agent_id: 'tariq', agent_name: 'Tariq Oladele', task: 'ai_revenue_acceleration',  pipeline: 'p9_tariq' },
  cron_tariq_saturday:      { agent_id: 'tariq', agent_name: 'Tariq Oladele', task: 'ai_revenue_acceleration',  pipeline: 'p9_tariq' },
  // ── Upsell scan & manual reply ───────────────────────────────────────────────
  cron_cc_upsell_scan:  { agent_id: 'upsell_scan', agent_name: 'Upsell Scanner',  task: 'cc_upsell_scan',   pipeline: 'p9_upsell_scan' },
  cc_agent_reply:       { agent_id: 'cc_agent',    agent_name: 'Community Agent', task: 'community_reply',  pipeline: 'p9_cc_reply'    },
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

// ─── Cross-read: Sasha ↔ Tariq (reads from approvals, not CSQ) ──────────────
// Both write to approvals, not chief_of_staff_queue, so we read from there directly.
async function getPeerCrossRead(source: string, limit = 2): Promise<string> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return '';
  try {
    const query = `${url}/rest/v1/approvals?source=eq.${source}&order=created_at.desc&limit=${limit}&select=agent_name,output,created_at`;
    const res = await fetch(query, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) return '';
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return '';
    return (data as Record<string, string>[]).map(item =>
      `[${item.agent_name} — ${new Date(item.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}]\n${(item.output || '').slice(0, 500)}`
    ).join('\n\n---\n\n');
  } catch { return ''; }
}

// ─── Real material for genius-level thinking ────────────────────────────────
// GENIUS_MODE alone was never enough -- it's an instruction about the bar, not
// the material. These two feeds give Tariq and Sasha something specific and
// current to actually reason about, instead of riffing on static framework
// definitions in a vacuum.

// DeAnna's own DISC/Sales Copy training material -- whatever she's uploaded
// most recently to the training-materials bucket (auto-extracted to text by
// api/process-training-doc.ts). Capped at ~4 documents / ~12k chars combined
// so the prompt stays a reasonable size.
async function getTrainingMaterial(): Promise<string> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return '';
  try {
    const res = await fetch(
      `${url}/rest/v1/training_materials?status=eq.processed&order=processed_at.desc&limit=4&select=original_filename,extracted_text`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) return '';
    const docs = await res.json() as { original_filename: string; extracted_text: string }[];
    if (!Array.isArray(docs) || docs.length === 0) return '';
    let combined = docs.map(d => `[${d.original_filename}]\n${d.extracted_text}`).join('\n\n---\n\n');
    if (combined.length > 12000) combined = combined.slice(0, 12000) + '\n\n[...truncated]';
    return combined;
  } catch { return ''; }
}

// Kwame's real, sourced market signals -- actual people and organizations
// showing real leadership/AI-adoption pain points, found via live web search.
// Sitting unused in prospect_opportunities until now.
async function getProspectSignals(limit = 8): Promise<string> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return '';
  try {
    const res = await fetch(
      `${url}/rest/v1/prospect_opportunities?order=found_at.desc&limit=${limit}&select=prospect_name,organization,signal_summary,fit_reasoning`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) return '';
    const rows = await res.json() as { prospect_name: string; organization: string; signal_summary: string; fit_reasoning: string }[];
    if (!Array.isArray(rows) || rows.length === 0) return '';
    return rows.map(r => `- ${r.prospect_name} (${r.organization}): ${r.signal_summary} — ${r.fit_reasoning}`).join('\n');
  } catch { return ''; }
}

// The depth instruction both Sasha and Tariq need alongside GENIUS_MODE --
// GENIUS_MODE sets the bar, this makes them actually use the material instead
// of writing generic strategy prose that could apply to any company.
const GENIUS_DEPTH_INSTRUCTION = `DEPTH REQUIREMENT: You have DeAnna's own training material and real market signals below -- use them. Every insight must trace back to something specific in that material: a real signal Kwame found, a concept from DeAnna's own training content, a pattern across more than one data point. A claim that could apply to literally any AI consulting business is a failure, no matter how smart it sounds. If the material below is thin, say less rather than padding with generic strategy language. No artificial length target -- write as much as the material actually supports, and no more.`;


// Posts a warm, non-salesy acknowledgment directly to the community thread (no approval needed)
async function postAcknowledgmentComment(postId: string, firstName: string, signalContext: string): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    const agentCorrections = await getAgentCorrections('Micah Santos');
    const prompt = `${GENIUS_MODE}\n\n${VOICE_DNA}${agentCorrections}\n\nYou are Micah Santos, Member Experience Manager for DRU AI Consulting's community.\nA community member named ${firstName} has been engaging meaningfully with our AI leadership content.\nContext: "${signalContext}"\n\nWrite a warm, genuine community reply (60-80 words). Acknowledge their engagement naturally. Let them know someone from the DRU AI Consulting team will reach out to share more. Do NOT mention products, pricing, services, or include any links. Be warm, human, and community-focused. Write ONLY the reply text.`;
    const acknowledgment = enforceTM(await callAnthropic(prompt, 200));
    await fetch(`${url}/rest/v1/community_comments`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ post_id: postId, member_id: null, agent_name: 'Micah Santos', content: acknowledgment, is_flagged: false, is_active: true }) });
    console.log(`[micah] Acknowledgment posted to post ${postId} for ${firstName}`);
  } catch (err) { console.error('[acknowledgment] Failed:', err); }
}

// ─── Agent Knowledge Base (inline) ─────────────────────────────────────────
const CC_FALLBACK_TM_MARKS = ['DRU CLEAR™','DRU AI Leadership Ecosystem™','DRU AI Transformation Pathway™','5C Cultural DNA™','5D Leadership™','AI Sales Mastery™','From Confusion to Confident with AI™'];
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
- C — CLARITY: Define the AI vision with precision. Where are you going, why does it matter?
- L — LEADERSHIP: AI fluency, executive sponsorship, strategic conviction top-down and inside-out.
- E — EXECUTION: Close the gap between strategy and action. Identify processes and capabilities.
- A — ALIGNMENT: Unify around a single AI strategy. Break silos, synchronize departments.
- R — RESULTS: Define, measure, and demonstrate ROI. What gets measured gets transformed.

### 5C Cultural DNA™ — Culture | $6,000 | 3 sessions x 90 min
Theme: Learn IT. Live IT. Lead IT. Leadership Thinking with AI.
Most organizations don't have an AI problem — they have a CULTURE problem.
Gives leaders a path to use AI as a strategic THINKING PARTNER — not a decision-maker.
- COMMUNICATION: Foundation. How leaders and teams share vision and create clarity around AI.
- CONNECTION: Relational layer. Trust and meaningful relationships that enable collaboration.
- COLLABORATION: Action layer. Breaking silos so AI initiatives flow through the whole organization.
- COACHING: Development layer. Building confidence and competency from the inside out.
- CULTURE TRANSFORMATION: Outcome. From resistance and fear to ownership and strategic adoption.

### 5D Leadership™ — Leadership | $6,500 | 3 sessions x 90 min
Focuses on the WHOLE leader — building from the inside out. NOT a skills program.
An AI-infused methodology where personal mastery and strategic impact develop together.
- I. SELF: Personal mastery. How a leader thinks, decides, and shows up.
- II. PEOPLE: Relational intelligence. Connects with and develops the individuals around them.
- III. TEAM: Collective effectiveness. Builds cohesion, trust, and high performance.
- IV. ORGANIZATION: Systemic strength. Aligns culture, strategy, and operations.
- V. VISIONARY: Strategic impact. Sees beyond today, positions organization to lead.

### AI Sales Mastery™ — Sales | $6,000 | 3 sessions x 90 min
Theme: Personality Mastery + AI = Sales That Feel Natural, Trusted, and Effective.
Combines DISC behavioral insights with AI. Selling stops feeling like selling.
- HYPER-PERSONALIZED OUTREACH AT SCALE: Right person, right message, right time — every time.
- SPEAK YOUR CLIENT'S DECISION LANGUAGE: DISC gives you the map. AI gives you the speed.
- PREDICT OBJECTIONS BEFORE THEY HAPPEN: Stop reacting and start anticipating.
- CLOSE WITH CONFIDENCE, NOT PRESSURE: Clarity makes closing a natural next step.
- BUILD LONG-TERM CLIENT RELATIONSHIPS: Not transactions — transformation.

## HOW THE FRAMEWORKS RELATE
DRU CLEAR™ is the CONNECTOR — anchors every engagement.
Bundles: Full Ecosystem $26,000 | DRU CLEAR + 2 $19,500 | DRU CLEAR + 1 $13,500
Diagnostics: Executive Diagnostic $4,997 (120 min) | Strategic Diagnostic $3,497 (90 min)
Course: From Confusion to Confident with AI™ — Self-Paced $1,497 | Cohort $7,997 | Mastermind $12,997
`;
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
  return `=== DRU AI CONSULTING — AGENT KNOWLEDGE BASE ===\n\nPROTECTED IP MARKS — TM REQUIRED ON EVERY USE, NO EXCEPTIONS:\n${tmList}\n\nRULES: Every mark above MUST include TM every time. NO other terms carry TM.\nDo NOT add TM to anything not on this list. 'DRU AI Consulting' = business name, NO TM.\nREQUIRED CTA: assessment.druaiconsulting.com (ONLY entry point into the ecosystem)\n${FRAMEWORK_KNOWLEDGE}\n=== END AGENT KNOWLEDGE BASE ===`.trim();
}
// ─────────────────────────────────────────────────────────────────────────────

async function runCCAgent(agentId: string, agentName: string, task: string, postType: string, category: string, prompt: string): Promise<{ approval_id: string | null; post_id: string | null }> {
  try {
    const agentKnowledge = await getAgentKnowledge();
    const positioning = await fetchBrandCopy('positioning');
    const agentCorrections = await getAgentCorrections(agentName);
    const brandLine = `\nBRAND THEME: Where it fits naturally, let "${positioning}" — DRU AI Consulting's core positioning — come through in how you frame the insight. Never force it in as a tagline.`;
    const raw = await callAnthropic(`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}${agentCorrections}\n\n${prompt}${brandLine}\n\nReturn ONLY valid JSON with no preamble or markdown: {"title":"...","content":"..."}`, 1500);
    let title = ''; let content = ''; let upsellSignal: string | null = null;
    try {
      const cleaned = raw.replace(/```json\s*|```/g, '').trim();
      const firstBrace = cleaned.indexOf('{');
      const lastBrace  = cleaned.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1) throw new Error('No JSON found');
      const jsonStr  = cleaned.slice(firstBrace, lastBrace + 1);
      const afterJson = cleaned.slice(lastBrace + 1).trim();
      const parsed   = JSON.parse(jsonStr);
      title   = parsed.title   || agentName;
      content = parsed.content || raw;
      const upsellMatch = afterJson.match(/UPSELL SIGNAL:\s*([\s\S]+)/);
      upsellSignal = upsellMatch?.[1]?.trim() ?? null;
    } catch {
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' });
      title = `${agentName} — ${dateStr}`; content = raw;
    }
    title = enforceTM(title); content = enforceTM(content);
    const output = upsellSignal ? `${title}\n\n${content}\n\nUPSELL SIGNAL: ${upsellSignal}` : `${title}\n\n${content}`;
    const post_id = await writeToCommunityPosts({ title, content, post_type: postType, tier_required: 'navigator', agent_id: agentId, agent_name: agentName, published_at: new Date().toISOString(), is_active: false });
    const approval_id = await writeToApprovals({ source: `${agentId}_cc`, trigger_type: category, agent_name: agentName, agent_role: 'Community Connection', division: 'Community Connection', task_brief: post_id ? `post_id:${post_id} | ${agentName} | ${task.replace(/_/g, ' ')}` : `${agentName} | ${task.replace(/_/g, ' ')}`, original_content: null, output, edited_output: null, status: 'pending', ghl_contact_id: null, notify_deanna: false, priority: 'NORMAL', category: 'community_post', platform: 'Community', context: null, archived: false });
    console.log(`[${agentId}] CC post → approvals: ${approval_id ?? 'failed'} | community_posts: ${post_id ?? 'failed'}`);
    return { approval_id, post_id };
  } catch (error) { console.error(`[${agentId}] CC agent error:`, error); return { approval_id: null, post_id: null }; }
}

// ─── Victor Reyes — CC Strategy (mirrors Renata Cruz in AC, Navigator depth) ──
async function runVictor(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });

  const focus: Record<string, { lens: string; framework: string }> = {
    Monday:    { lens: 'AI implementation friction in a growing business',      framework: 'DRU AI Transformation Pathway™ — Deploy phase' },
    Tuesday:   { lens: 'How AI pressure shows up in team culture',              framework: '5C Cultural DNA™ — Culture Transformation dimension' },
    Wednesday: { lens: 'The gap between AI plans and what actually gets done',  framework: 'DRU CLEAR™ — Execution & Results' },
    Thursday:  { lens: 'Who you are as a leader when AI changes the work',      framework: '5D Leadership™ — Organization & Visionary dimensions' },
    Friday:    { lens: 'Where strategy and culture collide in AI adoption',     framework: 'Full DRU AI Leadership Ecosystem™ synthesis' },
  };
  const todayFocus = focus[dayOfWeek] ?? focus['Monday'];

  return runCCAgent('victor', 'Victor Reyes', 'cc_strategy_insight', 'agent', 'cc_strategy_insight', `You are Victor Reyes, a strategy and culture thinker inside the DRU AI Leadership Ecosystem™ community. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™ when referencing: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nSERVICE CLASSES: All content within Classes 35, 41, 42 only.\nAUDIENCE: Business owners and leaders actively navigating AI in their businesses — practical people in the middle of it, not senior enterprise executives. Stay grounded and real. No jargon, no rarified language.\nTODAY'S LENS: ${todayFocus.lens}\nTODAY'S FRAMEWORK: ${todayFocus.framework}\nWrite a MASTERMIND CONVERSATION STARTER. 150-200 words. Voice: peer-to-peer strategic depth in plain language — you are a fellow business owner who sees how AI implementation and company culture are one inseparable challenge. Share a tension, a pattern, or an insight from inside the work. Apply today's framework naturally — as a lens, never a lesson. End with one genuine question that has no easy answer. No calls to action.`);
}

// ─── Sasha Kim — AI Sales Mastery™ Intelligence (Sun / Tue / Thu) ────────────
// Covers ALL FOUR DISC profiles every run. Cross-reads Tariq before writing.
async function runSasha(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const agentKnowledge = await getAgentKnowledge();

  // Cross-read Tariq's most recent briefs — same IP ecosystem, content should flow together
  const tariqContext = await getPeerCrossRead('tariq_revenue_intel', 2);
  const peerSection = tariqContext
    ? `\n\nTARIQ'S RECENT REVENUE INTELLIGENCE (cross-reference where relevant — same AI Sales Mastery™ ecosystem):\n${tariqContext}\n`
    : '';

  // Real material to actually reason about, instead of the static framework
  // definitions alone (see GENIUS_DEPTH_INSTRUCTION above for why this matters).
  const [trainingMaterial, prospectSignals] = await Promise.all([getTrainingMaterial(), getProspectSignals()]);
  const trainingSection = trainingMaterial
    ? `\n\nDEANNA'S CURRENT DISC/SALES COPY TRAINING MATERIAL (what she's actively developing/teaching right now — ground your thinking in this, not just the static framework definitions above):\n${trainingMaterial}\n`
    : '';
  const signalsSection = prospectSignals
    ? `\n\nKWAME'S RECENT REAL-WORLD SIGNALS (actual leaders/organizations showing real AI-adoption pain points, found via live web search — reference specific ones where they sharpen a DISC insight):\n${prospectSignals}\n`
    : '';

  const positioning = await fetchBrandCopy('positioning');
  const agentCorrections = await getAgentCorrections('Sasha Kim');
  const prompt = `${GENIUS_MODE}\n\n${GENIUS_DEPTH_INSTRUCTION}\n\n${agentKnowledge}\n\n${VOICE_DNA}${agentCorrections}\n\nYou are Sasha Kim, AI Sales Mastery™ Intelligence Specialist for DRU AI Consulting — DeAnna R. Upshaw. Her positioning is "${positioning}."
TRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
You are writing EXCLUSIVELY for DeAnna — this is private sales intelligence, not community content. She is not a client -- she is your strategic-thinking partner on this framework, so go as deep as the material below actually supports.
${peerSection}${trainingSection}${signalsSection}
Write a DAILY AI SALES MASTERY™ INTELLIGENCE BRIEF. Apply DISC Behavioral Intelligence across ALL FOUR buyer profiles.

Cover ALL FOUR DISC profiles every brief — one section per profile:

D — DOMINANT: How D-style buyers approach AI consulting decisions. What drives them (speed, ROI, control). One behavioral signal that indicates readiness. One communication strategy DeAnna can deploy immediately.

I — INFLUENTIAL: How I-style buyers engage with AI consulting. What builds their enthusiasm and trust. One behavioral signal that indicates readiness. One communication strategy that resonates with their vision.

S — STEADY: How S-style buyers evaluate AI investments. Their need for certainty, proof, and relational safety. One behavioral signal that indicates readiness. One communication strategy that reduces risk perception.

C — CONSCIENTIOUS: How C-style buyers research AI solutions. Their analytical triggers and what they need to commit. One behavioral signal that indicates readiness. One communication strategy that satisfies their need for detail.

Where Tariq's recent revenue intelligence, DeAnna's training material, or Kwame's real signals connect — integrate them naturally and by name. They are both inside the AI Sales Mastery™ framework and their insights should echo each other.
Be specific, tactical, and immediately actionable. This is DeAnna's secret weapon.
Return ONLY valid JSON with no preamble or markdown: {"title":"...","content":"..."}`;

  try {
    const raw = await callAnthropic(prompt, 3000);
    const cleaned = raw.replace(/```json\s*|```/g, '').trim();
    const firstBrace = cleaned.indexOf('{'); const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) throw new Error('No JSON');
    const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    const title   = enforceTM(parsed.title   || 'Sasha Kim — AI Sales Mastery™ DISC Intelligence');
    const content = enforceTM(parsed.content || raw);
    const approval_id = await writeToApprovals({
      source: 'sasha_sales_intel', trigger_type: 'sales_intelligence',
      agent_name: 'Sasha Kim', agent_role: 'AI Sales Mastery™ Intelligence',
      division: 'Revenue, Growth & Sales',
      task_brief: `DISC Intelligence — All 4 Profiles | ${today}`,
      original_content: null, output: `${title}\n\n${content}`, edited_output: null,
      status: 'pending', ghl_contact_id: null, notify_deanna: false, priority: 'NORMAL',
      category: 'revenue_growth', platform: null, context: null, archived: false,
    });
    console.log(`[sasha] DISC Intelligence card → approvals: ${approval_id ?? 'failed'}`);
    return { approval_id, post_id: null };
  } catch (error) { console.error('[sasha] Sales intel error:', error); return { approval_id: null, post_id: null }; }
}

// ─── Tariq Oladele — Revenue Acceleration (Mon / Wed / Sat) ──────────────────
// Day-specific angles. Cross-reads Sasha before writing.
async function runTariq(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });
  const agentKnowledge = await getAgentKnowledge();

  // Cross-read Sasha's most recent briefs — same IP ecosystem
  const sashaContext = await getPeerCrossRead('sasha_sales_intel', 2);
  const peerSection = sashaContext
    ? `\n\nSASHA'S RECENT DISC INTELLIGENCE (cross-reference where relevant — same AI Sales Mastery™ ecosystem):\n${sashaContext}\n`
    : '';

  // Day-specific angle
  const angleMap: Record<string, { label: string; instruction: string }> = {
    Monday: {
      label: 'Revenue Strategy',
      instruction: `Write a REVENUE STRATEGY BRIEF — the big picture move DeAnna should be making or recommending to clients this week. One AI-powered revenue strategy at the strategic level. Why it matters now. How to position it. What result it produces. Connect to Sasha's DISC intelligence where it strengthens the strategy.`,
    },
    Wednesday: {
      label: 'Conversion Intelligence',
      instruction: `Write a CONVERSION INTELLIGENCE BRIEF — what moves high-ticket clients from interest to commitment in executive AI consulting. One DISC-informed conversion insight that connects directly to how different buyer profiles decide. Reference Sasha's DISC intelligence and show how the conversion play plays differently for D, I, S, or C buyers.`,
    },
    Saturday: {
      label: 'Pipeline & Application',
      instruction: `Write a PIPELINE & APPLICATION BRIEF — what DeAnna should deploy in the coming week. One pipeline metric to watch. One concrete application move (conversation, follow-up, positioning play). One forward-looking insight about next week's revenue opportunities. Bring Sasha's DISC intelligence forward — how does it shape pipeline action this week?`,
    },
  };

  const angle = angleMap[dayOfWeek] ?? angleMap['Monday'];

  // Real material to actually reason about, instead of the static framework
  // definitions alone (see GENIUS_DEPTH_INSTRUCTION above for why this matters).
  const [trainingMaterial, prospectSignals] = await Promise.all([getTrainingMaterial(), getProspectSignals()]);
  const trainingSection = trainingMaterial
    ? `\n\nDEANNA'S CURRENT DISC/SALES COPY TRAINING MATERIAL (what she's actively developing/teaching right now — ground your thinking in this, not just the static framework definitions above):\n${trainingMaterial}\n`
    : '';
  const signalsSection = prospectSignals
    ? `\n\nKWAME'S RECENT REAL-WORLD SIGNALS (actual leaders/organizations showing real AI-adoption pain points, found via live web search — reference specific ones where they sharpen the strategy):\n${prospectSignals}\n`
    : '';

  const positioning = await fetchBrandCopy('positioning');
  const agentCorrections = await getAgentCorrections('Tariq Oladele');
  const prompt = `${GENIUS_MODE}\n\n${GENIUS_DEPTH_INSTRUCTION}\n\n${agentKnowledge}\n\n${VOICE_DNA}${agentCorrections}\n\nYou are Tariq Oladele, Revenue Acceleration Intelligence Analyst for DRU AI Consulting — DeAnna R. Upshaw. Her positioning is "${positioning}."
TRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
You are writing EXCLUSIVELY for DeAnna — this is private revenue intelligence, not community content. She is not a client -- she is your strategic-thinking partner on this framework, so go as deep as the material below actually supports.
TODAY'S ANGLE: ${angle.label}
${peerSection}${trainingSection}${signalsSection}
${angle.instruction}

Be specific, tactical, and immediately actionable. This is DeAnna's competitive edge — every insight should feel like something she can act on today or this week.
Return ONLY valid JSON with no preamble or markdown: {"title":"...","content":"..."}`;

  try {
    const raw = await callAnthropic(prompt, 3000);
    const cleaned = raw.replace(/```json\s*|```/g, '').trim();
    const firstBrace = cleaned.indexOf('{'); const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) throw new Error('No JSON');
    const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    const title   = enforceTM(parsed.title   || `Tariq Oladele — ${angle.label}`);
    const content = enforceTM(parsed.content || raw);
    const approval_id = await writeToApprovals({
      source: 'tariq_revenue_intel', trigger_type: 'sales_intelligence',
      agent_name: 'Tariq Oladele', agent_role: 'Revenue Acceleration Intelligence',
      division: 'Revenue, Growth & Sales',
      task_brief: `${angle.label} | ${today}`,
      original_content: null, output: `${title}\n\n${content}`, edited_output: null,
      status: 'pending', ghl_contact_id: null, notify_deanna: false, priority: 'NORMAL',
      category: 'revenue_growth', platform: null, context: null, archived: false,
    });
    console.log(`[tariq] ${angle.label} card → approvals: ${approval_id ?? 'failed'}`);
    return { approval_id, post_id: null };
  } catch (error) { console.error('[tariq] Revenue intel error:', error); return { approval_id: null, post_id: null }; }
}

async function runZoe(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let recentPostsSummary = 'No recent community posts available.';
  if (url && key) {
    const since = new Date(); since.setHours(since.getHours() - 48);
    const r = await fetch(`${url}/rest/v1/community_posts?published_at=gte.${since.toISOString()}&order=published_at.desc&limit=10`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (r.ok) { const posts = await r.json(); if (posts.length > 0) recentPostsSummary = posts.map((p: any) => `${p.agent_name}: ${p.title}`).join('\n'); }
  }
  return runCCAgent('zoe', 'Zoe Beaumont', 'daily_community_facilitation', 'agent', 'community_edge', `You are Zoe Beaumont, a community leader and fellow business owner inside the DRU AI Leadership Ecosystem™. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™ when referencing: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nSERVICE CLASSES: All content within Classes 35, 41, 42 only.\nRECENT COMMUNITY ACTIVITY:\n${recentPostsSummary}\nWrite a MASTERMIND CONVERSATION STARTER for a community of business owners navigating AI in their businesses. 100-150 words. Voice: warm peer-to-peer — you are a trusted peer reflecting on something real you've noticed, felt, or been sitting with. NOT a coach, NOT educational content. Like what you'd say to open a meaningful conversation at a mastermind table. Where relevant, build naturally off recent community activity to create continuity. End with one genuine question for the room. No calls to action.`);
}
async function runMicah(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let memberContext = 'No recent member data available.';
  if (url && key) {
    const r = await fetch(`${url}/rest/v1/profiles?tier=in.(navigator,accelerator)&order=updated_at.desc&limit=5`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (r.ok) { const members = await r.json(); if (members.length > 0) memberContext = `Active members: ${members.length} navigator/accelerator subscribers.`; }
  }
  return runCCAgent('micah', 'Micah Santos', 'daily_member_experience', 'agent', 'community_engagement', `You are Micah Santos, a member of the DRU AI Leadership Ecosystem™ community. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™ when referencing: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nSERVICE CLASSES: All content within Classes 35, 41, 42 only.\nMEMBER CONTEXT: ${memberContext}\nWrite a MASTERMIND CONVERSATION STARTER for a community of business owners navigating AI in their businesses. 100-150 words. Voice: warm and human — you are a fellow business owner who wants to celebrate wins, invite honesty, or open up something real you've been sitting with. NOT educational. NOT a coach post. Like a message you'd send to a group chat of people you trust. Invite others to share their own experience. End with one open, genuine question. No calls to action.`);
}

// ─── Daily Community Seed — rotates Zoe / Micah / Victor (one post per day) ──
async function runCommunitySeed(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const slot = new Date().getDate() % 3;
  if (slot === 0) return runZoe();
  if (slot === 1) return runMicah();
  return runVictor();
}

async function runCCAgentReply(postId: string, postTitle: string, postContent: string, postType: string, routeTo: 'zoe' | 'micah'): Promise<{ approval_id: string | null }> {
  const isZoe = routeTo === 'zoe';
  const agentId = isZoe ? 'zoe' : 'micah';
  const agentName = isZoe ? 'Zoe Beaumont' : 'Micah Santos';
  const agentRole = isZoe ? 'Community Division Leader' : 'Member Experience Manager';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const zoeInstructions = `- Step into the post with the authority of a community leader and the warmth of a mentor\n- Connect to a relevant DRU framework (DRU CLEAR™, 5D Leadership™, 5C Cultural DNA™, AI Sales Mastery™)\n- Add one strategic insight that elevates the conversation\n- Invite further reflection or engagement\n- Your voice: grounded, clear, purposeful`;
  const micahInstructions = `- Acknowledge the member personally — make them feel genuinely seen\n- Validate their experience with specificity\n- Add warmth, encouragement, and a sense of belonging\n- Your voice: warm, engaged, human`;
  const agentCorrections = await getAgentCorrections(agentName);
  const prompt = `${GENIUS_MODE}\n\n${VOICE_DNA}${agentCorrections}\n\nYou are ${agentName}, ${isZoe ? 'Community Connection Division Leader' : 'Member Experience Manager'} for DRU AI Consulting. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nPOST TYPE: ${postType.replace(/_/g, ' ')}\nPOST TITLE: ${postTitle}\nPOST CONTENT:\n${postContent.slice(0, 800)}\nWrite a reply comment (100-150 words):\n${isZoe ? zoeInstructions : micahInstructions}\nWrite ONLY the reply. ${isZoe ? 'End with a question or invitation.' : 'End with a warm, encouraging close.'} Pure education — no calls to action.`;
  try {
    const raw = await callAnthropic(prompt, 600);
    const corrected = enforceTM(raw);
    const displayTitle = postTitle ? `"${postTitle.slice(0, 80)}"` : 'Community post reply';
    const approval_id = await writeToApprovals({
      source: 'cc_agent_reply', trigger_type: 'cc_agent_reply', agent_name: agentName, agent_role: agentRole,
      division: 'Community Connection', task_brief: `${displayTitle} | post_id:${postId}`,
      original_content: postContent.slice(0, 500), output: corrected, edited_output: null,
      status: 'pending', ghl_contact_id: null, notify_deanna: true, priority: 'NORMAL',
      category: 'community_comment_reply', platform: null, context: null, archived: false,
    });
    console.log(`[${agentId}] Community reply → approvals: ${approval_id ?? 'failed'} for post ${postId}`);
    return { approval_id };
  } catch (error) { console.error(`[${agentId}] Community reply error:`, error); return { approval_id: null }; }
}

// ─── Scan 1: Navigator → Accelerator upgrade ─────────────────────────────────
async function hasRecentUpsellCard(memberId: string): Promise<boolean> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(`${url}/rest/v1/approvals?category=eq.community_opportunity&task_brief=ilike.*${memberId}*&created_at=gte.${sevenDaysAgo}&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) return false;
  const data = await res.json(); return Array.isArray(data) && data.length > 0;
}
async function fireAaliyahUpsellCard(memberId: string, firstName: string, email: string | null, phone: string | null, signalReason: string, postTitle: string, postId: string, postContent: string): Promise<void> {
  const emailLine = email && !email.includes('not found') ? `Email: ${email}` : '⚠ Email not found';
  const phoneLine = phone && !phone.includes('not found') ? `Phone: ${phone}` : '⚠ Phone not found';
  await postAcknowledgmentComment(postId, firstName, signalReason);
  await writeToApprovals({
    source: 'aaliyah_opportunity', trigger_type: 'community_opportunity',
    agent_name: 'Aaliyah Foster', agent_role: 'Opportunity Intelligence',
    division: 'Community Connection',
    task_brief: `${firstName} · Navigator → Accelerator | ${emailLine} | ${phoneLine}`,
    original_content: `Post: "${postTitle}"\nSignal: ${signalReason}`,
    output: `OPPORTUNITY — ${firstName}\n\nSignal: ${signalReason}\n\nPost: "${postTitle}"\n\nExcerpt: "${postContent.slice(0, 400)}"\n\n${emailLine} | ${phoneLine}\n\nAcknowledgment posted to their community thread. Ready for your personal outreach.`,
    edited_output: null, status: 'pending', ghl_contact_id: null, notify_deanna: true,
    priority: 'HIGH', category: 'community_opportunity', platform: null, context: null, archived: false,
  });
  console.log(`[aaliyah] Opportunity card written for ${firstName} | acknowledgment posted to post ${postId}`);
}

// ─── Scan 2: Framework & Bundle signals — all members ────────────────────────
async function hasRecentFrameworkCard(memberId: string): Promise<boolean> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(`${url}/rest/v1/approvals?category=eq.community_opportunity&task_brief=ilike.*${memberId}*&created_at=gte.${sevenDaysAgo}&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) return false;
  const data = await res.json(); return Array.isArray(data) && data.length > 0;
}
async function fireFrameworkBundleCard(memberId: string, firstName: string, tier: string, email: string | null, phone: string | null, signalReason: string, target: string, postTitle: string, postId: string, postContent: string): Promise<void> {
  const offerMap: Record<string, { label: string }> = {
    dru_clear:        { label: 'DRU CLEAR™' },
    five_c:           { label: '5C Cultural DNA™' },
    five_d:           { label: '5D Leadership™' },
    ai_sales_mastery: { label: 'AI Sales Mastery™' },
    bundle_full:      { label: 'Full Ecosystem Bundle' },
    bundle_plus_two:  { label: 'DRU CLEAR™ + 2 Frameworks' },
    bundle_plus_one:  { label: 'DRU CLEAR™ + 1 Framework' },
  };
  const offer = offerMap[target] ?? offerMap['dru_clear'];
  const emailLine = email && !email.includes('not found') ? `Email: ${email}` : '⚠ Email not found';
  const phoneLine = phone && !phone.includes('not found') ? `Phone: ${phone}` : '⚠ Phone not found';
  await postAcknowledgmentComment(postId, firstName, signalReason);
  await writeToApprovals({
    source: 'cc_framework_scan', trigger_type: 'community_opportunity',
    agent_name: 'Aaliyah Foster', agent_role: 'Opportunity Intelligence',
    division: 'Community Connection',
    task_brief: `${firstName} · ${tier} | Interest: ${offer.label} | ${emailLine} | ${phoneLine}`,
    original_content: `Post: "${postTitle}"\nSignal: ${signalReason}`,
    output: `OPPORTUNITY — ${firstName}\n\nFramework Interest: ${offer.label}\nSignal: ${signalReason}\n\nPost: "${postTitle}"\n\nExcerpt: "${postContent.slice(0, 400)}"\n\n${emailLine} | ${phoneLine}\n\nAcknowledgment posted to their community thread. Ready for your personal outreach.`,
    edited_output: null, status: 'pending', ghl_contact_id: null, notify_deanna: true,
    priority: 'HIGH', category: 'community_opportunity', platform: null, context: null, archived: false,
  });
  console.log(`[aaliyah] Framework opportunity card written for ${firstName} | ${offer.label} | acknowledgment posted to post ${postId}`);
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
  const zoeCorrections = await getAgentCorrections('Zoe Beaumont');

  for (const post of posts) {
    const memberId = post.agent_id; if (!memberId) continue;
    const profileRes = await fetch(`${url}/rest/v1/profiles?id=eq.${memberId}&tier=in.(navigator,accelerator)&select=id,first_name,email,phone,tier&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!profileRes.ok) continue;
    const profiles = await profileRes.json(); if (!Array.isArray(profiles) || !profiles.length) continue;
    const profile = profiles[0];
    const tier: string = profile.tier ?? 'navigator';

    if (tier === 'navigator') {
      const alreadyFlagged = await hasRecentUpsellCard(memberId);
      if (!alreadyFlagged) {
        const detectionPrompt = `${GENIUS_MODE}\n\n${VOICE_DNA}${zoeCorrections}\n\nYou are Zoe Beaumont, Community Connection Division Leader.\nA Navigator member named ${profile.first_name} posted:\nTITLE: ${post.title}\nCONTENT: ${(post.content || '').slice(0, 600)}\nIs this member showing Accelerator-ready signals?\nWrite the REASON in Zoe's voice, following the voice rules above. Everything else in the response format below must be EXACTLY as shown — no extra words, no preamble, no markdown, nothing before or after these tokens:\nUPSELL SIGNAL: YES | MEMBER_ID: ${memberId} | REASON: [one sentence, in voice]\nUPSELL SIGNAL: NO`;
        const detection = await callAnthropic(detectionPrompt, 120);
        if (detection.includes('UPSELL SIGNAL: YES')) {
          const reasonMatch = detection.match(/REASON:\s*(.+)/); const reason = reasonMatch?.[1]?.trim() ?? 'Member showing Accelerator-ready engagement patterns';
          await fireAaliyahUpsellCard(memberId, profile.first_name, profile.email ?? null, profile.phone ?? null, reason, post.title, post.id, post.content || '');
          signalsFound++;
        } else { console.log(`[upsell_scan] No Accelerator signal for ${profile.first_name}`); }
      } else { console.log(`[upsell_scan] ${profile.first_name} — Accelerator card exists, skipping`); }
    }

    const alreadyFrameworkFlagged = await hasRecentFrameworkCard(memberId);
    if (!alreadyFrameworkFlagged) {
      const frameworkPrompt = `${GENIUS_MODE}\n\n${VOICE_DNA}${zoeCorrections}\n\nYou are Zoe Beaumont, Community Connection Division Leader.\nA ${tier} member named ${profile.first_name} posted:\nTITLE: ${post.title}\nCONTENT: ${(post.content || '').slice(0, 600)}\nIs this member showing buying signals for any DRU AI Consulting framework or bundle? Scan for signals of:\nFRAMEWORKS (a la carte):\n- dru_clear: DRU CLEAR™ ($7,500) — mentions clarity framework, AI readiness, connecting strategy\n- five_c: 5C Cultural DNA™ ($6,000) — mentions culture, communication, collaboration, cultural shift\n- five_d: 5D Leadership™ ($6,500) — mentions leadership development, team, organizational leadership\n- ai_sales_mastery: AI Sales Mastery™ ($6,000) — mentions sales, DISC, revenue, client relationships\nBUNDLES:\n- bundle_full: Full Ecosystem $26,000 — mentions full transformation, entire program, everything\n- bundle_plus_two: DRU CLEAR + 2 frameworks $19,500 — mentions combining two frameworks\n- bundle_plus_one: DRU CLEAR + 1 framework $13,500 — mentions adding a framework to DRU CLEAR\nPick the single strongest signal only. Write the REASON in Zoe's voice, following the voice rules above. Everything else in the response format below must be EXACTLY as shown — no extra words, no preamble, no markdown, nothing before or after these tokens. Respond in one of these formats:\nFRAMEWORK SIGNAL: YES | MEMBER_ID: ${memberId} | TARGET: dru_clear | REASON: [one sentence, in voice]\nFRAMEWORK SIGNAL: YES | MEMBER_ID: ${memberId} | TARGET: five_c | REASON: [one sentence, in voice]\nFRAMEWORK SIGNAL: YES | MEMBER_ID: ${memberId} | TARGET: five_d | REASON: [one sentence, in voice]\nFRAMEWORK SIGNAL: YES | MEMBER_ID: ${memberId} | TARGET: ai_sales_mastery | REASON: [one sentence, in voice]\nFRAMEWORK SIGNAL: YES | MEMBER_ID: ${memberId} | TARGET: bundle_full | REASON: [one sentence, in voice]\nFRAMEWORK SIGNAL: YES | MEMBER_ID: ${memberId} | TARGET: bundle_plus_two | REASON: [one sentence, in voice]\nFRAMEWORK SIGNAL: YES | MEMBER_ID: ${memberId} | TARGET: bundle_plus_one | REASON: [one sentence, in voice]\nFRAMEWORK SIGNAL: NO`;
      const frameworkDetection = await callAnthropic(frameworkPrompt, 150);
      if (frameworkDetection.includes('FRAMEWORK SIGNAL: YES')) {
        const reasonMatch  = frameworkDetection.match(/REASON:\s*(.+)/);
        const targetMatch  = frameworkDetection.match(/TARGET:\s*(dru_clear|five_c|five_d|ai_sales_mastery|bundle_full|bundle_plus_two|bundle_plus_one)/);
        const reason  = reasonMatch?.[1]?.trim()  ?? 'Member showing framework interest';
        const target  = targetMatch?.[1]?.trim()  ?? 'dru_clear';
        await fireFrameworkBundleCard(memberId, profile.first_name, tier, profile.email ?? null, profile.phone ?? null, reason, target, post.title, post.id, post.content || '');
        signalsFound++;
      } else { console.log(`[upsell_scan] No framework signal for ${profile.first_name}`); }
    } else { console.log(`[upsell_scan] ${profile.first_name} — framework card exists, skipping`); }
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
  const runners: Record<string, () => Promise<{ approval_id: string | null; post_id: string | null }>> = {
    p9_community_seed: runCommunitySeed,
    p9_sasha:          runSasha,
    p9_tariq:          runTariq,
  };
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
