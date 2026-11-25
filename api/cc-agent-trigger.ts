// DRU AI Leadership Ecosystem™ — api/cc-agent-trigger.ts
// P9 Community Connection Division — Zoe (Leader) / Micah (Member Experience) / Victor (CC Strategy)
// DAILY POST SCHEDULE (Central time): Mon Victor · Tue Victor · Wed Zoe's Mastermind + Victor · Thu Victor · Fri Victor · Sat Micah · Sun Micah
// Zoe's Monday Weekly Leadership Challenge runs from api/zoe-weekly-challenge.ts
// ARCHITECTURE v3: CC agents write DIRECTLY to approvals (bypass daily CSQ chain)
// KNOWLEDGE INJECTION: getAgentKnowledge() inlined directly (no separate module)
// UPDATED: SMRT agents removed (Dominique, Elijah, Solange, Isaiah Webb, Nadia now live in social-response-trigger.ts)
// UPDATED: Victor Reyes upgraded to CC Strategy — mirrors Renata Cruz (AC) at Navigator depth
// UPDATED: post_type is always 'agent' — daily_insight / strategic_edge belong to Daily Connection only
// UPDATED: Sasha covers full DISC spectrum every run (3x/week: Sun/Tue/Thu)
// UPDATED: Tariq day-specific angles (Mon=Strategy, Wed=Conversion, Sat=Pipeline)
// UPDATED: Bidirectional getPeerCrossRead between Sasha and Tariq (same IP ecosystem)

export const config = { maxDuration: 60 };

import { GENIUS_MODE, VOICE_DNA, getAgentCorrections, fetchBrandCopy } from './_lib/agentKnowledge.js';

interface CCAgentRoute { agent_id: string; agent_name: string; task: string; pipeline: string; }

const CC_AGENT_ROUTES: Record<string, CCAgentRoute> = {
  // ── Daily community seed — follows the weekday schedule in the header ──
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
  [/From Confusion to Confidence with AI(?!™)/g, 'From Confusion to Confidence with AI™'],
];
function enforceTM(content: string): string {
  let corrected = content;
  for (const [pattern, replacement] of TM_PAIRS) { corrected = corrected.replace(pattern, replacement); }
  return corrected;
}

async function callAnthropic(prompt: string, maxTokens = 1500, model = 'claude-haiku-4-5-20251001'): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const startedAt = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }) });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = await res.json();
  await logModelUsage(model, data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0, Date.now() - startedAt).catch(() => {});
  return data.content?.[0]?.text ?? '';
}

// Logs every real API call's actual token usage and cost to Supabase so spend
// is visible in the Intelligence Hub instead of estimated by hand.
async function logModelUsage(model: string, inputTokens: number, outputTokens: number, durationMs: number): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const rate = model.startsWith('claude-sonnet-5') ? { in: 2, out: 10 } : model.startsWith('claude-sonnet') ? { in: 3, out: 15 } : { in: 1, out: 5 };
  const cost_usd = (inputTokens / 1_000_000) * rate.in + (outputTokens / 1_000_000) * rate.out;
  await fetch(`${url}/rest/v1/model_usage_log`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ source_file: 'cc-agent-trigger', model, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd, duration_ms: durationMs }) });
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

// Aaliyah's real, sourced market signals -- actual people and organizations
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
const GENIUS_DEPTH_INSTRUCTION = `DEPTH REQUIREMENT: Ground every insight in DeAnna's own training material and the real market signals below — trace each one back to something specific: a real signal Aaliyah found, a concept from DeAnna's own training content, a pattern across more than one data point. Write the kind of claim that could only come from this specific material, not a generic line that could describe any AI consulting business. Let the material set the length — write as much depth as it actually supports, and stop there. Reason across all four frameworks where the material connects to them (DRU CLEAR™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™) — DISC and sales acceleration are one lens, not the only one.`;


// Added after VOICE_DNA for community writing. The anchor-word line in VOICE_DNA belongs to
// DeAnna's marketing copy; community posts and replies carry her voice through sentence craft.
const CC_COMMUNITY_VOICE = `\nCOMMUNITY WRITING: The voice rules above show up in the sentence craft: a short hook, one sentence that unpacks it, plain words and active voice. The subject of every post is today's topic and what members are living, spoken in everyday leadership language. The word Insight appears where it fits naturally.`;

// Posts a warm acknowledgment directly to the community thread (no approval needed)
async function postAcknowledgmentComment(postId: string, firstName: string, signalContext: string): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    const agentCorrections = await getAgentCorrections('Micah Santos');
    const prompt = `${GENIUS_MODE}\n\n${VOICE_DNA}${CC_COMMUNITY_VOICE}${agentCorrections}\n\nYou are Micah Santos, Member Experience Specialist for DRU AI Consulting's community.\nA community member named ${firstName} has been engaging meaningfully with our AI leadership content.\nContext: "${signalContext}"\n\nWrite a warm, genuine community reply of 60-80 words. Acknowledge their engagement naturally and let them know someone from the DRU AI Consulting team will reach out to share more. Keep the reply centered on their engagement itself: warm, human and community-focused. Return the reply text alone.`;
    const acknowledgment = enforceTM(await callAnthropic(prompt, 200));
    await fetch(`${url}/rest/v1/community_comments`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ post_id: postId, member_id: null, agent_name: 'Micah Santos', content: acknowledgment, is_flagged: false, is_active: true }) });
    console.log(`[micah] Acknowledgment posted to post ${postId} for ${firstName}`);
  } catch (err) { console.error('[acknowledgment] Failed:', err); }
}

// ─── Agent Knowledge Base (inline) ─────────────────────────────────────────
const CC_FALLBACK_TM_MARKS = ['DRU CLEAR™','DRU AI Leadership Ecosystem™','DRU AI Transformation Pathway™','5C Cultural DNA™','5D Leadership™','AI Sales Mastery™','From Confusion to Confidence with AI™'];
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
Course: From Confusion to Confidence with AI™ — Self-Paced $1,497 | Cohort $7,997 | Mastermind $12,997
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
    const agentCorrections = await getAgentCorrections(agentName);
    const raw = await callAnthropic(`${GENIUS_MODE}\n\n${VOICE_DNA}${CC_COMMUNITY_VOICE}${agentCorrections}\n\n${prompt}\n\nReturn valid JSON in exactly this shape, with nothing before or after it: {"title":"...","content":"..."}`, 1500);
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

// ─── Victor Reyes — CC Strategy (mirrors Renata Cruz in the Accelerator Circle) ──
async function runVictor(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });

  const lenses: Record<string, string> = {
    Monday:    'AI implementation friction in a growing business',
    Tuesday:   'How AI pressure shows up in team culture',
    Wednesday: 'The gap between AI plans and what actually gets done',
    Thursday:  'Who you are as a leader when AI changes the work',
    Friday:    'Where strategy and culture collide in AI adoption',
  };
  const todayLens = lenses[dayOfWeek] ?? lenses['Monday'];

  return runCCAgent('victor', 'Victor Reyes', 'cc_strategy_insight', 'agent', 'cc_strategy_insight', `You are Victor Reyes, a strategy and culture thinker in DRU AI Consulting's Community Connection. Today: ${today}.
Service classes: all content sits within Classes 35, 41 and 42.
Your readers are in the middle of leading through AI in real situations. They value plain, practical language and grounded, real conversation.
Today's lens: ${todayLens}
Write a mastermind conversation starter of 150-200 words. Your voice is peer-to-peer strategic depth in plain language: you are a fellow leader who sees AI implementation and company culture as one challenge. Share a tension, a pattern or an insight from inside the work, with today's lens as the topic. Close with a genuine question that has no easy answer. The post is a conversation, and its purpose is the room's reply.`);
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
    ? `\n\nAALIYAH'S RECENT REAL-WORLD SIGNALS (actual leaders/organizations showing real AI-adoption pain points, found via live web search — reference specific ones where they sharpen a DISC insight):\n${prospectSignals}\n`
    : '';

  const positioning = await fetchBrandCopy('positioning');
  const agentCorrections = await getAgentCorrections('Sasha Kim');
  const prompt = `${GENIUS_MODE}\n\n${GENIUS_DEPTH_INSTRUCTION}\n\n${agentKnowledge}\n\n${VOICE_DNA}${agentCorrections}\n\nYou are Sasha Kim, AI Sales Mastery™ Intelligence Specialist for DRU AI Consulting — DeAnna R. Upshaw. Her positioning is "${positioning}."
TRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confidence with AI™.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
You are writing EXCLUSIVELY for DeAnna — this is private sales intelligence, not community content. She is not a client -- she is your strategic-thinking partner on this framework, so go as deep as the material below actually supports.
${peerSection}${trainingSection}${signalsSection}
Write a DAILY AI SALES MASTERY™ INTELLIGENCE BRIEF. Apply DISC Behavioral Intelligence across ALL FOUR buyer profiles.

Cover ALL FOUR DISC profiles every brief — one section per profile:

D — DOMINANT: How D-style buyers approach AI consulting decisions. What drives them (speed, ROI, control). One behavioral signal that indicates readiness. One communication strategy DeAnna can deploy immediately.

I — INFLUENTIAL: How I-style buyers engage with AI consulting. What builds their enthusiasm and trust. One behavioral signal that indicates readiness. One communication strategy that resonates with their vision.

S — STEADY: How S-style buyers evaluate AI investments. Their need for certainty, proof, and relational safety. One behavioral signal that indicates readiness. One communication strategy that reduces risk perception.

C — CONSCIENTIOUS: How C-style buyers research AI solutions. Their analytical triggers and what they need to commit. One behavioral signal that indicates readiness. One communication strategy that satisfies their need for detail.

Where Tariq's recent revenue intelligence, DeAnna's training material, or Aaliyah's real signals connect — integrate them naturally and by name. They are both inside the AI Sales Mastery™ framework and their insights should echo each other.
Draw the connection to DRU CLEAR™, 5C Cultural DNA™, or 5D Leadership™ wherever a DISC insight genuinely touches one of them — a D-style buyer's need for control connects to 5D Leadership's SELF dimension, an S-style buyer's need for relational safety connects to 5C's CONNECTION. Make the link only where it's real, not in every section.
Be specific, tactical, and immediately actionable. This is DeAnna's secret weapon.
Return ONLY valid JSON with no preamble or markdown: {"title":"...","content":"..."}`;

  try {
    const raw = await callAnthropic(prompt, 3000, 'claude-sonnet-5-5');
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
    ? `\n\nAALIYAH'S RECENT REAL-WORLD SIGNALS (actual leaders/organizations showing real AI-adoption pain points, found via live web search — reference specific ones where they sharpen the strategy):\n${prospectSignals}\n`
    : '';

  const positioning = await fetchBrandCopy('positioning');
  const agentCorrections = await getAgentCorrections('Tariq Oladele');
  const prompt = `${GENIUS_MODE}\n\n${GENIUS_DEPTH_INSTRUCTION}\n\n${agentKnowledge}\n\n${VOICE_DNA}${agentCorrections}\n\nYou are Tariq Oladele, Revenue Acceleration Intelligence Analyst for DRU AI Consulting — DeAnna R. Upshaw. Her positioning is "${positioning}."
TRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confidence with AI™.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
You are writing EXCLUSIVELY for DeAnna — this is private revenue intelligence, not community content. She is not a client -- she is your strategic-thinking partner on this framework, so go as deep as the material below actually supports.
TODAY'S ANGLE: ${angle.label}
${peerSection}${trainingSection}${signalsSection}
${angle.instruction}
Draw the connection to DRU CLEAR™, 5C Cultural DNA™, or 5D Leadership™ wherever this week's angle genuinely touches one of them — a conversion play often runs through 5D Leadership's PEOPLE dimension, a pipeline move often runs through DRU CLEAR's ALIGNMENT dimension. Make the link only where it's real, not in every section.

Be specific, tactical, and immediately actionable. This is DeAnna's competitive edge — every insight should feel like something she can act on today or this week.
Return ONLY valid JSON with no preamble or markdown: {"title":"...","content":"..."}`;

  try {
    const raw = await callAnthropic(prompt, 3000, 'claude-sonnet-5-5');
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
  let recentPostsSummary = 'No recent community activity available.';
  if (url && key) {
    const since = new Date(); since.setHours(since.getHours() - 48);
    const r = await fetch(`${url}/rest/v1/community_posts?published_at=gte.${since.toISOString()}&order=published_at.desc&limit=10`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (r.ok) { const posts = await r.json(); if (posts.length > 0) recentPostsSummary = posts.map((p: any) => `${p.agent_name}: ${p.title}`).join('\n'); }
  }
  return runCCAgent('zoe', 'Zoe Beaumont', 'daily_community_facilitation', 'agent', 'community_edge', `You are Zoe Beaumont, the leader of Community Connection at DRU AI Consulting. Today: ${today}.
Service classes: all content sits within Classes 35, 41 and 42.
Recent community activity (last 48 hours):
${recentPostsSummary}
Write a mastermind conversation starter of 100-150 words for people navigating AI in their work and leadership. Your voice is warm and peer-to-peer: you are a trusted peer reflecting on something real you have noticed, felt or been sitting with, the way you would open a meaningful conversation at a mastermind table. Build on the recent community activity so the conversation has continuity. Close with a genuine question for the room. The post is a conversation, and its purpose is the room's reply.`);
}
async function runMicah(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let memberContext = 'No recent member data available.';
  if (url && key) {
    const r = await fetch(`${url}/rest/v1/profiles?tier=in.(navigator,accelerator)&order=updated_at.desc&limit=5`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (r.ok) { const members = await r.json(); if (members.length > 0) memberContext = `Active members: ${members.length} navigator/accelerator subscribers.`; }
  }
  return runCCAgent('micah', 'Micah Santos', 'daily_member_experience', 'agent', 'community_engagement', `You are Micah Santos, the Member Experience Specialist in Community Connection at DRU AI Consulting. Today: ${today}.
Service classes: all content sits within Classes 35, 41 and 42.
Member context: ${memberContext}
Write a thought-provoking weekend post of 100-150 words, built around a question. Your voice is warm and human: you are a fellow member who celebrates wins, invites honesty or opens up something real you have been sitting with, like a message to a group chat of people you trust. Invite others to share their own experience. Close with an open, genuine question that makes people think. The post is a conversation, and its purpose is the room's reply.`);
}

// ─── Daily Community Seed — weekday schedule (Central time) ──────────────────
// Mon Victor · Tue Victor · Wed Zoe + Victor · Thu Victor · Fri Victor · Sat Micah · Sun Micah
// Zoe's Monday Weekly Leadership Challenge runs from api/zoe-weekly-challenge.ts.
async function runCommunitySeed(): Promise<{ approval_id: string | null; post_id: string | null }> {
  const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });
  if (weekday === 'Saturday' || weekday === 'Sunday') return runMicah();
  if (weekday === 'Wednesday') {
    const [zoe, victor] = await Promise.all([runZoe(), runVictor()]);
    console.log(`[community_seed] Wednesday — Zoe approval ${zoe.approval_id ?? 'failed'} | Victor approval ${victor.approval_id ?? 'failed'}`);
    return zoe;
  }
  return runVictor();
}

async function runCCAgentReply(postId: string, postTitle: string, postContent: string, postType: string, routeTo: 'zoe' | 'micah'): Promise<{ approval_id: string | null }> {
  const isZoe = routeTo === 'zoe';
  const agentId = isZoe ? 'zoe' : 'micah';
  const agentName = isZoe ? 'Zoe Beaumont' : 'Micah Santos';
  const agentRole = isZoe ? 'Community Division Leader' : 'Member Experience Specialist';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const zoeInstructions = `- Step into the post with the authority of a community leader and the warmth of a mentor\n- Add a strategic insight that elevates the conversation\n- Invite further reflection or engagement\n- Your voice: grounded, clear, purposeful`;
  const micahInstructions = `- Acknowledge the member personally, so they feel genuinely seen\n- Validate their experience with specifics\n- Add warmth, encouragement and a sense of belonging\n- Your voice: warm, engaged, human`;
  const agentCorrections = await getAgentCorrections(agentName);
  const prompt = `${GENIUS_MODE}\n\n${VOICE_DNA}${CC_COMMUNITY_VOICE}${agentCorrections}\n\nYou are ${agentName}, ${isZoe ? 'Community Connection leader' : 'Member Experience Specialist'} for DRU AI Consulting. Today: ${today}.\nPost type: ${postType.replace(/_/g, ' ')}\nPost title: ${postTitle}\nPost content:\n${postContent.slice(0, 800)}\nWrite a reply comment of 100-150 words:\n${isZoe ? zoeInstructions : micahInstructions}\nReturn the reply text alone. ${isZoe ? 'Close with a question or an invitation.' : 'Close with a warm, encouraging line.'} The reply shares knowledge and warmth for the member.`;
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

// ─── Zoe's scan — every 4 hours, all brand products ──────────────────────────
// Zoe reads Community Connection member posts that no scan has read yet and lists every opportunity
// each post shows. Micah acknowledges each member on their thread, then Aaliyah writes one card for
// all the members the scan found and sends it to DeAnna. A member already on an earlier card is not
// listed again. Every post read is recorded in community_scan_log (see COMMUNITY_SCAN_LOG.sql).
const CC_SCAN_PRODUCTS: Record<string, { name: string; signal: string }> = {
  accelerator:      { name: 'Accelerator membership',                    signal: 'readiness for the deeper, peer-level work of the Accelerator Circle' },
  course:           { name: 'From Confusion to Confidence with AI™ course', signal: 'interest in on-demand learning' },
  strategic:        { name: 'Strategic Diagnostic',                      signal: 'interest in a focused 90-minute working session' },
  executive:        { name: 'Executive Diagnostic',                      signal: 'interest in a deeper 120-minute working session' },
  dru_clear:        { name: 'DRU CLEAR™',                                signal: 'clarity, AI readiness, connecting strategy' },
  five_c:           { name: '5C Cultural DNA™',                          signal: 'culture, communication, collaboration, cultural shift' },
  five_d:           { name: '5D Leadership™',                            signal: 'leadership development, team and organizational leadership' },
  ai_sales_mastery: { name: 'AI Sales Mastery™',                         signal: 'sales, DISC, revenue, client relationships' },
  bundle_full:      { name: 'Full Ecosystem Bundle',                     signal: 'the full transformation, the entire program' },
  bundle_plus_two:  { name: 'DRU CLEAR™ + 2 Frameworks',                 signal: 'combining two frameworks' },
  bundle_plus_one:  { name: 'DRU CLEAR™ + 1 Framework',                  signal: 'adding a framework to DRU CLEAR™' },
};

interface ScanOpportunity { product: string; reason: string; }
interface ScanFinding { memberId: string; firstName: string; tier: string; postId: string; postTitle: string; opportunities: ScanOpportunity[]; }

async function detectOpportunities(firstName: string, title: string, content: string, corrections: string): Promise<ScanOpportunity[] | null> {
  const productLines = Object.entries(CC_SCAN_PRODUCTS).map(([key, p]) => `- ${key}: ${p.name}, shown by ${p.signal}`).join('\n');
  const prompt = `${GENIUS_MODE}${corrections}\n\nYou are Zoe Beaumont, leader of Community Connection at DRU AI Consulting.\nA member named ${firstName} posted in the community.\nTitle: ${title}\nContent: ${content.slice(0, 600)}\n\nRead the post for buying interest and list every opportunity it shows from this set:\n${productLines}\n\nGive each opportunity a one-sentence reason drawn from the member's own words.\nReturn valid JSON in exactly this shape, with nothing before or after it: {"opportunities":[{"product":"dru_clear","reason":"..."}]}\nA post that shows no buying interest returns {"opportunities":[]}.`;
  try {
    const raw = await callAnthropic(prompt, 500);
    const cleaned = raw.replace(/```json\s*|```/g, '').trim();
    const parsed = JSON.parse(cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1));
    const list: ScanOpportunity[] = Array.isArray(parsed.opportunities) ? parsed.opportunities : [];
    return list.filter(o => o && CC_SCAN_PRODUCTS[o.product] && typeof o.reason === 'string' && o.reason.trim()).map(o => ({ product: o.product, reason: o.reason.trim() }));
  } catch (err) { console.error('[community_scan] Detection failed:', err); return null; }
}

async function logScannedPost(postId: string, memberId: string, opportunities: ScanOpportunity[]): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  await fetch(`${url}/rest/v1/community_scan_log`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ community: 'cc', post_id: postId, member_id: memberId, found: opportunities.length > 0, opportunities }) });
}

async function writeScanCard(findings: ScanFinding[]): Promise<void> {
  const sections = findings.map(f => `${f.firstName} (${f.tier})\nPost: "${f.postTitle}"\n${f.opportunities.map(o => `- ${CC_SCAN_PRODUCTS[o.product].name}: ${o.reason}`).join('\n')}`);
  await writeToApprovals({
    source: 'aaliyah_opportunity', trigger_type: 'community_opportunity',
    agent_name: 'Aaliyah Foster', agent_role: 'Opportunity Intelligence', division: 'Community Connection',
    task_brief: `Community Connection scan | ${findings.length} member${findings.length === 1 ? '' : 's'} | ${findings.map(f => f.firstName).join(', ')}`,
    original_content: null, output: sections.join('\n\n'), edited_output: null,
    status: 'pending', ghl_contact_id: null, notify_deanna: true,
    priority: 'HIGH', category: 'community_opportunity', platform: null, context: null, archived: false,
  });
}

async function runCommunityScan(): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('[community_scan] Missing env vars'); return; }
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  // Community Connection posts are every post outside the Accelerator Circle
  const postsRes = await fetch(`${url}/rest/v1/community_posts?post_type=eq.member_post&is_active=eq.true&or=(tier_required.is.null,tier_required.neq.accelerator)&order=published_at.asc&limit=200`, { headers });
  if (!postsRes.ok) { console.error('[community_scan] Failed to fetch posts:', await postsRes.text()); return; }
  const allPosts = await postsRes.json();
  if (!Array.isArray(allPosts) || !allPosts.length) { console.log('[community_scan] No member posts — scan complete'); return; }

  // Posts already read by an earlier scan
  const ids = allPosts.map((p: any) => p.id).join(',');
  const readRes = await fetch(`${url}/rest/v1/community_scan_log?community=eq.cc&post_id=in.(${ids})&select=post_id`, { headers });
  const readIds = new Set<string>(readRes.ok ? (await readRes.json()).map((r: any) => r.post_id) : []);
  const posts = allPosts.filter((p: any) => !readIds.has(p.id)).slice(0, 20);
  if (!posts.length) { console.log('[community_scan] No new member posts — scan complete'); return; }

  // Members already on an earlier card
  const memberIds = Array.from(new Set(posts.map((p: any) => p.agent_id).filter(Boolean)));
  const foundRes = memberIds.length ? await fetch(`${url}/rest/v1/community_scan_log?community=eq.cc&found=eq.true&member_id=in.(${memberIds.join(',')})&select=member_id`, { headers }) : null;
  const alreadyFound = new Set<string>(foundRes && foundRes.ok ? (await foundRes.json()).map((r: any) => r.member_id) : []);

  const corrections = await getAgentCorrections('Zoe Beaumont');
  const findings: ScanFinding[] = [];
  for (const post of posts) {
    const memberId = post.agent_id;
    if (!memberId) { await logScannedPost(post.id, 'unknown', []); continue; }
    if (alreadyFound.has(memberId)) { await logScannedPost(post.id, memberId, []); continue; }
    const profileRes = await fetch(`${url}/rest/v1/profiles?id=eq.${memberId}&tier=in.(navigator,accelerator)&select=id,first_name,tier&limit=1`, { headers });
    const profiles = profileRes.ok ? await profileRes.json() : [];
    if (!Array.isArray(profiles) || !profiles.length) { await logScannedPost(post.id, memberId, []); continue; }
    const profile = profiles[0];
    const opportunities = await detectOpportunities(profile.first_name, post.title ?? '', post.content ?? '', corrections);
    if (opportunities === null) continue; // read again on the next scan
    await logScannedPost(post.id, memberId, opportunities);
    if (!opportunities.length) { console.log(`[community_scan] No opportunity for ${profile.first_name}`); continue; }
    alreadyFound.add(memberId);
    await postAcknowledgmentComment(post.id, profile.first_name, opportunities.map(o => o.reason).join(' '));
    findings.push({ memberId, firstName: profile.first_name, tier: profile.tier ?? 'navigator', postId: post.id, postTitle: post.title ?? '', opportunities });
  }
  if (findings.length) await writeScanCard(findings);
  console.log(`[community_scan] Complete — ${posts.length} posts read, ${findings.length} members on the card`);
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
    if (route.pipeline === 'p9_upsell_scan') { await runCommunityScan(); res.status(202).json({ success: true, agent: 'Upsell Scanner', message: 'Scan complete' }); return; }
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
