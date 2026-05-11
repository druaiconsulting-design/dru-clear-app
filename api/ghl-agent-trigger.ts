// ================================================================
// DRU AI Leadership Ecosystem™ — Autonomous Entry Point
// File: api/ghl-agent-trigger.ts
// Runtime: Vercel Node.js Serverless
//
// PIPELINE 1 — Revenue & Growth (10 agents):
//   Omar → Ryan → Aaliyah (chain)
//   Serena, Mateo, Jaylen, Chloe (daily independent)
//   Zara (Mon), Elena (Tue), Kwame (Wed) (weekly independent)
//
// PIPELINE 2 — Content & Brand (5 agents):
//   Camila (Mon) → content_queue
//   Darius (daily) → pulls from queue → approvals
//   Ravi (daily) → design brief → approvals
//   Yara (Sat/Sun) → Spanish localization → approvals
//   Ingrid (Fri) → press release from week's content → approvals
// ================================================================

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION_ID = 'gl07I4JnbkGgW8zJprSz';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface AgentRoute {
  agent_id: string;
  agent_name: string;
  division: string;
  task: string;
  pipeline?: string;
}

interface TriggerPayload {
  trigger_type: string;
  source?: string;
  [key: string]: unknown;
}

interface ScoredLead {
  contact_id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  score: number;
  intent_level: 'high' | 'medium' | 'low';
  recommended_action: string;
  notes: string;
}

interface OmarResult {
  success: boolean;
  total_leads_scanned: number;
  scored_leads: ScoredLead[];
  high_intent_leads: ScoredLead[];
  run_date: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Agent Routing Map
// ─────────────────────────────────────────────────────────────

const AGENT_ROUTES: Record<string, AgentRoute> = {
  // Pipeline 1 — Revenue
  cron_omar_lead_score:     { agent_id: 'omar',     agent_name: 'Omar Patel',       division: 'Revenue & Growth', task: 'scan_score_route_leads',       pipeline: 'p1_omar' },
  cron_ryan_crm_update:     { agent_id: 'ryan',     agent_name: 'Ryan Nakamura',    division: 'Revenue & Growth', task: 'overnight_crm_sync',            pipeline: 'p1_ryan' },
  cron_serena_coaching:     { agent_id: 'serena',   agent_name: 'Serena Jackson',   division: 'Revenue & Growth', task: 'morning_coaching_briefing',     pipeline: 'p1_serena' },
  cron_mateo_sales_support: { agent_id: 'mateo',    agent_name: 'Mateo Gonzalez',   division: 'Revenue & Growth', task: 'sales_pipeline_review',         pipeline: 'p1_mateo' },
  cron_aaliyah_outreach:    { agent_id: 'aaliyah',  agent_name: 'Aaliyah Foster',   division: 'Revenue & Growth', task: 'personalized_outreach_messages', pipeline: 'p1_aaliyah' },
  cron_jaylen_email:        { agent_id: 'jaylen',   agent_name: 'Jaylen Brooks',    division: 'Revenue & Growth', task: 'email_campaign_content',        pipeline: 'p1_jaylen' },
  cron_chloe_copy:          { agent_id: 'chloe',    agent_name: 'Chloe Dubois',     division: 'Revenue & Growth', task: 'daily_copy_asset',              pipeline: 'p1_chloe' },
  cron_zara_product:        { agent_id: 'zara',     agent_name: 'Zara Ahmed',       division: 'Revenue & Growth', task: 'product_launch_readiness',      pipeline: 'p1_zara' },
  cron_elena_knowledge:     { agent_id: 'elena',    agent_name: 'Elena Vasquez',    division: 'Revenue & Growth', task: 'product_knowledge_update',      pipeline: 'p1_elena' },
  cron_kwame_proposal:      { agent_id: 'kwame',    agent_name: 'Kwame Asante',     division: 'Revenue & Growth', task: 'proposal_template_update',      pipeline: 'p1_kwame' },
  // Pipeline 2 — Content & Brand
  cron_camila_linkedin_queue:  { agent_id: 'camila',  agent_name: 'Camila Flores',  division: 'Content & Brand', task: 'generate_weekly_linkedin_queue', pipeline: 'p2_camila' },
  cron_darius_linkedin_post:   { agent_id: 'darius',  agent_name: 'Darius King',    division: 'Content & Brand', task: 'generate_daily_linkedin_post',   pipeline: 'p2_darius' },
  cron_ravi_design_brief:      { agent_id: 'ravi',    agent_name: 'Ravi Gupta',     division: 'Content & Brand', task: 'generate_design_brief',          pipeline: 'p2_ravi' },
  cron_yara_localization:      { agent_id: 'yara',    agent_name: 'Yara Mansour',   division: 'Content & Brand', task: 'spanish_localization',           pipeline: 'p2_yara' },
  cron_ingrid_press_release:   { agent_id: 'ingrid',  agent_name: 'Ingrid Larsen',  division: 'Content & Brand', task: 'weekly_press_release',           pipeline: 'p2_ingrid' },
  // Analytics
  cron_analytics_weekly:    { agent_id: 'analytics', agent_name: 'Analytics Agent', division: 'Analytics',       task: 'weekly_performance_summary' },
  // GHL Webhooks
  lead_created:         { agent_id: 'omar',    agent_name: 'Omar Patel',    division: 'Revenue & Growth', task: 'score_new_lead' },
  contact_updated:      { agent_id: 'ryan',    agent_name: 'Ryan Nakamura', division: 'Revenue & Growth', task: 'process_contact_update' },
  assessment_completed: { agent_id: 'omar',    agent_name: 'Omar Patel',    division: 'Revenue & Growth', task: 'route_assessment_lead' },
  support_ticket:       { agent_id: 'support', agent_name: 'Isaiah Carter', division: 'Customer Support', task: 'handle_support_request' },
};

const CRON_TRIGGER_TYPES = new Set(Object.keys(AGENT_ROUTES).filter(k => k.startsWith('cron_')));

// ─────────────────────────────────────────────────────────────
// SHARED — Anthropic call
// ─────────────────────────────────────────────────────────────

async function callAnthropic(prompt: string, maxTokens = 1500): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!response.ok) throw new Error(`Anthropic error ${response.status}`);
  const data = await response.json();
  return data.content?.[0]?.text ?? '';
}

// ─────────────────────────────────────────────────────────────
// SHARED — Write approval card
// ─────────────────────────────────────────────────────────────

async function writeApproval(record: Record<string, unknown>): Promise<string | null> {
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

// ─────────────────────────────────────────────────────────────
// SHARED — Read latest high-intent leads from approvals
// Used by Aaliyah to get Omar's output
// ─────────────────────────────────────────────────────────────

async function getLatestHighIntentLeads(): Promise<string> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return 'No lead data available.';
  const today = new Date().toISOString().split('T')[0];
  const res = await fetch(
    `${url}/rest/v1/approvals?category=eq.lead_intelligence&created_at=gte.${today}&order=created_at.desc&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) return 'No lead data available.';
  const data = await res.json();
  return data?.[0]?.output ?? 'No leads scored today.';
}

// ─────────────────────────────────────────────────────────────
// PIPELINE 1 — OMAR
// ─────────────────────────────────────────────────────────────

async function runOmar(): Promise<OmarResult> {
  const ghlApiKey = process.env.GHL_API_KEY;
  if (!ghlApiKey) return { success: false, total_leads_scanned: 0, scored_leads: [], high_intent_leads: [], run_date: new Date().toISOString(), error: 'Missing GHL_API_KEY' };
  try {
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    const url = `${GHL_API_BASE}/contacts/?locationId=${GHL_LOCATION_ID}&startAfterDate=${encodeURIComponent(yesterday.toISOString())}&limit=100`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${ghlApiKey}`, Version: '2021-07-28' } });
    if (!res.ok) throw new Error(`GHL error ${res.status}`);
    const rawLeads = (await res.json()).contacts ?? [];
    console.log(`[omar] Found ${rawLeads.length} new leads`);
    if (rawLeads.length === 0) return { success: true, total_leads_scanned: 0, scored_leads: [], high_intent_leads: [], run_date: new Date().toISOString() };

    const leadSummary = rawLeads.map((l: any) => ({ id: l.id, name: `${l.firstName ?? ''} ${l.lastName ?? ''}`.trim(), email: l.email ?? '', phone: l.phone ?? '', source: l.source ?? 'unknown', tags: l.tags ?? [] }));

    const text = await callAnthropic(`You are Omar Patel, Lead Scoring Agent for DRU AI Consulting. Score each lead 1–10. Return ONLY a JSON array:
[{"contact_id":"...","name":"...","email":"...","phone":"...","source":"...","score":8,"intent_level":"high","recommended_action":"...","notes":"..."}]
Leads: ${JSON.stringify(leadSummary)}`, 2000);

    const scored: ScoredLead[] = JSON.parse(text.replace(/```json|```/g, '').trim());
    const highIntent = scored.filter(l => l.intent_level === 'high');
    return { success: true, total_leads_scanned: rawLeads.length, scored_leads: scored, high_intent_leads: highIntent, run_date: new Date().toISOString() };
  } catch (error) {
    return { success: false, total_leads_scanned: 0, scored_leads: [], high_intent_leads: [], run_date: new Date().toISOString(), error: String(error) };
  }
}

// ─────────────────────────────────────────────────────────────
// PIPELINE 1 — RYAN
// ─────────────────────────────────────────────────────────────

async function runRyan(omarResult: OmarResult): Promise<{ approval_id: string | null; cards_created: number; crm_updates: number; high_intent_count: number }> {
  const ghlApiKey = process.env.GHL_API_KEY;
  if (!ghlApiKey) return { approval_id: null, cards_created: 0, crm_updates: 0, high_intent_count: 0 };

  if (omarResult.total_leads_scanned === 0) {
    const id = await writeApproval({ source: 'pg_cron', trigger_type: 'cron_omar_lead_score', agent_name: 'Ryan Nakamura', agent_role: 'CRM Management (GHL)', division: 'Revenue & Growth', task_brief: 'Daily lead intelligence — 0 leads scanned', output: '**Daily Lead Intelligence — No New Leads**\n\nOmar scanned GHL and found no new contacts in the last 24 hours. No CRM updates required.\n\nNext scan: tomorrow at 8:00am CDT.', status: 'pending', notify_deanna: true, priority: 'normal', category: 'lead_intelligence', platform: null });
    return { approval_id: id, cards_created: 1, crm_updates: 0, high_intent_count: 0 };
  }

  let crmUpdates = 0;
  for (const lead of omarResult.scored_leads) {
    if (lead.contact_id) {
      await fetch(`${GHL_API_BASE}/contacts/${lead.contact_id}`, { method: 'PUT', headers: { Authorization: `Bearer ${ghlApiKey}`, Version: '2021-07-28', 'Content-Type': 'application/json' }, body: JSON.stringify({ tags: [`ai-scored`, `intent-${lead.intent_level}`, `score-${lead.score}`] }) });
      crmUpdates++;
    }
  }

  const highIntentSummary = omarResult.high_intent_leads.map(l => `• ${l.name} (Score: ${l.score}/10) — ${l.recommended_action}`).join('\n');
  const briefingCard = await callAnthropic(`You are Ryan Nakamura, CRM Management Agent for DRU AI Consulting. Write an executive briefing card for DeAnna.
DATA: Total leads: ${omarResult.total_leads_scanned} | High-intent: ${omarResult.high_intent_leads.length} | Medium: ${omarResult.scored_leads.filter(l => l.intent_level === 'medium').length} | Low: ${omarResult.scored_leads.filter(l => l.intent_level === 'low').length}
HIGH-INTENT: ${highIntentSummary || 'None today'}
Include: executive summary, high-intent leads with actions, CRM updates completed, recommended approval action.`);

  const id = await writeApproval({ source: 'pg_cron', trigger_type: 'cron_omar_lead_score', agent_name: 'Ryan Nakamura', agent_role: 'CRM Management (GHL)', division: 'Revenue & Growth', task_brief: `Daily lead intelligence — ${omarResult.total_leads_scanned} leads, ${omarResult.high_intent_leads.length} high-intent`, output: briefingCard, status: 'pending', ghl_contact_id: omarResult.high_intent_leads.map(l => l.contact_id).join(',') || null, notify_deanna: true, priority: omarResult.high_intent_leads.length > 0 ? 'high' : 'normal', category: 'lead_intelligence', platform: null });
  return { approval_id: id, cards_created: 1, crm_updates: crmUpdates, high_intent_count: omarResult.high_intent_leads.length };
}

// ─────────────────────────────────────────────────────────────
// PIPELINE 1 — AALIYAH (reads Omar's output, writes outreach)
// ─────────────────────────────────────────────────────────────

async function runAaliyah(): Promise<{ approval_id: string | null; cards_created: number }> {
  const leadIntelligence = await getLatestHighIntentLeads();
  const output = await callAnthropic(`You are Aaliyah Foster, Personalized Outreach Agent for DRU AI Consulting.

Based on today's lead intelligence from Omar, write personalized outreach messages for each high-intent lead. Create BOTH a LinkedIn DM and an email for each lead.

Lead Intelligence:
${leadIntelligence}

For each high-intent lead write:
1. LinkedIn DM (150 words max) — warm, personalized, references their context, soft CTA to book a call
2. Email (subject line + body, 200 words max) — professional, value-focused, references DRU AI Consulting's relevant service

If no high-intent leads today, write a general warm outreach template for future use.

Brand voice: AI Mastery. Leadership Clarity. Measurable Results. DeAnna R. Upshaw — AI Authority.`);

  const id = await writeApproval({ source: 'pg_cron', trigger_type: 'cron_aaliyah_outreach', agent_name: 'Aaliyah Foster', agent_role: 'Personalized Outreach', division: 'Revenue & Growth', task_brief: 'Daily personalized outreach messages for high-intent leads', output, status: 'pending', notify_deanna: true, priority: 'high', category: 'outreach', platform: 'linkedin_email' });
  return { approval_id: id, cards_created: 1 };
}

// ─────────────────────────────────────────────────────────────
// PIPELINE 1 — SERENA (daily coaching briefing)
// ─────────────────────────────────────────────────────────────

async function runSerena(): Promise<{ approval_id: string | null; cards_created: number }> {
  const output = await callAnthropic(`You are Serena Jackson, Business Coach for DRU AI Consulting, led by DeAnna R. Upshaw.

Generate a morning business coaching briefing for DeAnna. Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.

Include:
1. Strategic focus for today (one priority, clearly stated)
2. Business coaching insight (relevant to an AI consulting founder in pre-launch)
3. Mindset anchor (one sentence to carry through the day)
4. One actionable move for today's business growth

Keep it concise, energizing, and strategic. DeAnna is building the DRU AI Leadership Ecosystem™ — every day matters.`);

  const id = await writeApproval({ source: 'pg_cron', trigger_type: 'cron_serena_coaching', agent_name: 'Serena Jackson', agent_role: 'Business Coach', division: 'Revenue & Growth', task_brief: 'Daily morning coaching briefing', output, status: 'pending', notify_deanna: true, priority: 'normal', category: 'coaching', platform: null });
  return { approval_id: id, cards_created: 1 };
}

// ─────────────────────────────────────────────────────────────
// PIPELINE 1 — MATEO (sales pipeline review)
// ─────────────────────────────────────────────────────────────

async function runMateo(): Promise<{ approval_id: string | null; cards_created: number }> {
  const output = await callAnthropic(`You are Mateo Gonzalez, Sales Support Agent for DRU AI Consulting.

Generate a daily sales support briefing for DeAnna R. Upshaw. Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.

DRU AI Consulting offers:
- DRU CLEAR™ AI Readiness Scorecard (free assessment)
- Strategic Diagnostic ($3,497)
- Executive Diagnostic ($4,997 — BEST VALUE)
- From Confusion to Confident with AI™ ($497–$1,497)

Include:
1. Sales focus for today
2. Pipeline health check — what stage needs attention
3. Recommended follow-up actions for warm leads
4. One sales tip or strategy relevant to AI consulting sales
5. Objection handling tip for today

Keep it actionable and sales-focused.`);

  const id = await writeApproval({ source: 'pg_cron', trigger_type: 'cron_mateo_sales_support', agent_name: 'Mateo Gonzalez', agent_role: 'Sales Support', division: 'Revenue & Growth', task_brief: 'Daily sales pipeline review and support briefing', output, status: 'pending', notify_deanna: true, priority: 'normal', category: 'sales_support', platform: null });
  return { approval_id: id, cards_created: 1 };
}

// ─────────────────────────────────────────────────────────────
// PIPELINE 1 — JAYLEN (email marketing content)
// ─────────────────────────────────────────────────────────────

async function runJaylen(): Promise<{ approval_id: string | null; cards_created: number }> {
  const output = await callAnthropic(`You are Jaylen Brooks, Email Marketing Agent for DRU AI Consulting.

Generate today's email marketing content for DeAnna R. Upshaw's campaigns.

Brand: DRU AI Consulting — "AI Mastery. Leadership Clarity. Measurable Results."
Audience: Executives, directors, founders navigating AI adoption.
Services: DRU CLEAR™ Scorecard, Strategic Diagnostic ($3,497), Executive Diagnostic ($4,997), From Confusion to Confident with AI™ course.

Today generate ONE of the following (rotate daily):
- A nurture email for leads in the EMERGING tier (just discovered AI)
- A nurture email for leads in the DEVELOPING tier (exploring AI)
- A nurture email for ADVANCING leads (implementing AI)
- A re-engagement email for cold leads
- A promotional email for the Executive Diagnostic

Include: Subject line (with A/B variant), Preview text, Email body (300 words max), CTA button text.

Make it feel personal, not mass-email. DeAnna's voice: authoritative, warm, strategic.`);

  const id = await writeApproval({ source: 'pg_cron', trigger_type: 'cron_jaylen_email', agent_name: 'Jaylen Brooks', agent_role: 'Email Marketing', division: 'Revenue & Growth', task_brief: 'Daily email campaign content', output, status: 'pending', notify_deanna: true, priority: 'normal', category: 'email_marketing', platform: 'email' });
  return { approval_id: id, cards_created: 1 };
}

// ─────────────────────────────────────────────────────────────
// PIPELINE 1 — CHLOE (daily copy asset)
// ─────────────────────────────────────────────────────────────

async function runChloe(): Promise<{ approval_id: string | null; cards_created: number }> {
  const output = await callAnthropic(`You are Chloe Dubois, Copy Writer for DRU AI Consulting.

Generate one copy asset for today. Rotate through these types:
- Facebook/Instagram ad copy (hook + body + CTA)
- LinkedIn sponsored content copy
- Landing page headline + subheadline + hero copy
- CTA button variations (5 options)
- Testimonial prompt template

Brand: DRU AI Consulting — "AI Mastery. Leadership Clarity. Measurable Results."
Voice: Confident, clear, strategic. DeAnna R. Upshaw — AI Authority.
Frameworks: DRU CLEAR™, DRU AI Leadership Ecosystem™, From Confusion to Confident with AI™, DRU AI Transformation Pathway™.
Offers: Scorecard (free), Strategic Diagnostic ($3,497), Executive Diagnostic ($4,997), Course ($497–$1,497).

Write copy that converts executives. No fluff. Every word earns its place.`);

  const id = await writeApproval({ source: 'pg_cron', trigger_type: 'cron_chloe_copy', agent_name: 'Chloe Dubois', agent_role: 'Copy Writer', division: 'Revenue & Growth', task_brief: 'Daily copy asset', output, status: 'pending', notify_deanna: true, priority: 'normal', category: 'copywriting', platform: null });
  return { approval_id: id, cards_created: 1 };
}

// ─────────────────────────────────────────────────────────────
// PIPELINE 1 — ZARA (weekly product launch readiness)
// ─────────────────────────────────────────────────────────────

async function runZara(): Promise<{ approval_id: string | null; cards_created: number }> {
  const output = await callAnthropic(`You are Zara Ahmed, Product Launch Agent for DRU AI Consulting.

Generate a weekly product launch readiness report for DeAnna R. Upshaw.

Current offers:
- DRU CLEAR™ AI Readiness Scorecard (PWA — live)
- Strategic Diagnostic ($3,497)
- Executive Diagnostic ($4,997)
- From Confusion to Confident with AI™ (Sprint 4 — in development)
- Daily Connections tiers (Free / Navigator $47/mo / Accelerator $147/mo)

This week assess:
1. Launch readiness status for each offer
2. Marketing gaps to address before launch
3. One product/offer improvement recommendation
4. Pricing or positioning insight
5. Next week's launch priority

Be strategic and specific. DeAnna is pre-launch — every recommendation should move her closer to her first paying client.`);

  const id = await writeApproval({ source: 'pg_cron', trigger_type: 'cron_zara_product', agent_name: 'Zara Ahmed', agent_role: 'Product Launch', division: 'Revenue & Growth', task_brief: 'Weekly product launch readiness check', output, status: 'pending', notify_deanna: true, priority: 'normal', category: 'product_launch', platform: null });
  return { approval_id: id, cards_created: 1 };
}

// ─────────────────────────────────────────────────────────────
// PIPELINE 1 — ELENA (weekly product knowledge)
// ─────────────────────────────────────────────────────────────

async function runElena(): Promise<{ approval_id: string | null; cards_created: number }> {
  const output = await callAnthropic(`You are Elena Vasquez, Product Knowledge Agent for DRU AI Consulting.

Generate a weekly product knowledge update for DeAnna's team and sales process.

DRU AI Consulting offers:
- DRU CLEAR™ AI Readiness Scorecard — 4 tiers: Emerging, Developing, Advancing, Leading
- Strategic Diagnostic ($3,497) — for Developing/Advancing leaders
- Executive Diagnostic ($4,997) — BEST VALUE for Advancing/Leading executives
- From Confusion to Confident with AI™ — self-paced $497, live $997, 1:1 $1,497
- Daily Connections — Free, Navigator $47/mo, Accelerator $147/mo

This week generate:
1. Updated FAQ (5 questions executives commonly ask about AI consulting)
2. Offer comparison guide (when to recommend each offer)
3. Common objection + response for each offer
4. One product positioning insight

Keep it sharp and sales-ready.`);

  const id = await writeApproval({ source: 'pg_cron', trigger_type: 'cron_elena_knowledge', agent_name: 'Elena Vasquez', agent_role: 'Product Knowledge', division: 'Revenue & Growth', task_brief: 'Weekly product knowledge update', output, status: 'pending', notify_deanna: true, priority: 'normal', category: 'product_knowledge', platform: null });
  return { approval_id: id, cards_created: 1 };
}

// ─────────────────────────────────────────────────────────────
// PIPELINE 1 — KWAME (weekly proposal update)
// ─────────────────────────────────────────────────────────────

async function runKwame(): Promise<{ approval_id: string | null; cards_created: number }> {
  const output = await callAnthropic(`You are Kwame Asante, Proposal Writer for DRU AI Consulting.

Generate a weekly proposal and executive summary update for DeAnna R. Upshaw.

This week produce:
1. Executive summary template for the Executive Diagnostic ($4,997) — 1 page, McKinsey-style
2. Proposal outline for a hypothetical C-suite client (customize for an executive in financial services or healthcare)
3. Value proposition statement (3 versions: short/medium/long) for DRU AI Consulting
4. One proposal best practice tip

Brand: DRU AI Consulting — "AI Mastery. Leadership Clarity. Measurable Results."
Positioning: DeAnna R. Upshaw, AI Authority — 25+ years IT, 10+ years leadership development, international facilitator.`);

  const id = await writeApproval({ source: 'pg_cron', trigger_type: 'cron_kwame_proposal', agent_name: 'Kwame Asante', agent_role: 'Proposal Writer', division: 'Revenue & Growth', task_brief: 'Weekly proposal template and executive summary update', output, status: 'pending', notify_deanna: true, priority: 'normal', category: 'proposals', platform: null });
  return { approval_id: id, cards_created: 1 };
}

// ─────────────────────────────────────────────────────────────
// PIPELINE 2 — CAMILA (weekly content strategy)
// ─────────────────────────────────────────────────────────────

async function runCamila(): Promise<{ posts_generated: number; week_of: string }> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { posts_generated: 0, week_of: '' };

  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1);
  monday.setHours(0, 0, 0, 0);
  const weekOf = monday.toISOString().split('T')[0];
  const days = [1,2,3,4,5].map(d => { const date = new Date(monday); date.setDate(monday.getDate() + d - 1); return { day_number: d, scheduled_for: date.toISOString().split('T')[0] }; });

  const text = await callAnthropic(`You are Camila Flores, Social Media Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.

Brand: "AI Mastery. Leadership Clarity. Measurable Results."
Frameworks (always ™): DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™ (Discover→Diagnose→Design→Deploy→Dominate), 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.
Audience: Executives, directors, founders navigating AI adoption.

Generate 5 LinkedIn posts for this week (Mon–Fri). Mix types:
Day 1: Thought leadership | Day 2: Educational | Day 3: Engagement question | Day 4: Story/insight | Day 5: Soft promotional

Each post: compelling hook (stops scroll), 150–250 words, one framework, clear CTA, 3–5 hashtags. Sound like DeAnna.

Return ONLY valid JSON array:
[{"day_number":1,"framework_covered":"DRU CLEAR™","post_type":"thought_leadership","hook":"...","content":"...","hashtags":"#AILeadership"}]`, 3000);

  const posts = JSON.parse(text.replace(/```json|```/g, '').trim());

  for (const post of posts) {
    const day = days.find(d => d.day_number === post.day_number) ?? days[0];
    await fetch(`${url}/rest/v1/content_queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ week_of: weekOf, day_number: post.day_number, scheduled_for: day.scheduled_for, platform: 'linkedin', framework_covered: post.framework_covered, post_type: post.post_type, hook: post.hook, content: post.content, hashtags: post.hashtags, status: 'queued' }),
    });
  }

  console.log(`[camila] ✅ ${posts.length} posts written to content_queue`);
  return { posts_generated: posts.length, week_of: weekOf };
}

// ─────────────────────────────────────────────────────────────
// PIPELINE 2 — DARIUS (daily LinkedIn post)
// ─────────────────────────────────────────────────────────────

async function runDarius(): Promise<{ approval_id: string | null; cards_created: number; framework_covered: string }> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1);
  const weekOf = monday.toISOString().split('T')[0];

  let postContent = '';
  let frameworkCovered = 'Mixed';
  let queueId: string | null = null;

  if (url && key) {
    const res = await fetch(`${url}/rest/v1/content_queue?week_of=eq.${weekOf}&status=eq.queued&scheduled_for=eq.${today}&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (res.ok) {
      const queue = await res.json();
      if (queue.length > 0) {
        queueId = queue[0].id;
        frameworkCovered = queue[0].framework_covered;
        postContent = `${queue[0].hook}\n\n${queue[0].content}\n\n${queue[0].hashtags}`;
      }
    }
  }

  if (!postContent) {
    postContent = await callAnthropic(`You are Darius King, Viral Scripter for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.

Write ONE LinkedIn post that stops executives mid-scroll. Brand: "AI Mastery. Leadership Clarity. Measurable Results."
Frameworks (™): DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.

Hook that stops the scroll. 150–250 words. One framework. Strong CTA. 3–5 hashtags. Sound like DeAnna.`);
    frameworkCovered = 'Mixed';
  }

  const id = await writeApproval({ source: 'pg_cron', trigger_type: 'cron_darius_linkedin_post', agent_name: 'Darius King', agent_role: 'Viral Scripter', division: 'Content & Brand', task_brief: `Daily LinkedIn post — ${frameworkCovered} — ${today}`, output: postContent, status: 'pending', notify_deanna: true, priority: 'normal', category: 'linkedin_post', platform: 'linkedin' });

  if (queueId && url && key) {
    await fetch(`${url}/rest/v1/content_queue?id=eq.${queueId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ status: 'submitted', approval_id: id, submitted_at: new Date().toISOString() }) });
  }

  return { approval_id: id, cards_created: 1, framework_covered: frameworkCovered };
}

// ─────────────────────────────────────────────────────────────
// PIPELINE 2 — RAVI (design brief)
// ─────────────────────────────────────────────────────────────

async function runRavi(): Promise<{ approval_id: string | null; cards_created: number }> {
  const today = new Date().toISOString().split('T')[0];
  const output = await callAnthropic(`You are Ravi Gupta, Graphic Designer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.

Brand colors: Navy #0A2342, Gold #D4AF37, Magenta #C2185B. Fonts: Playfair Display (headlines), Inter (body).

Generate a creative design brief for today's LinkedIn post visual. Be creative — not every post needs the same treatment.

Include:
1. Visual concept (what should this graphic communicate at a glance)
2. Layout recommendation (text overlay, split image, abstract, data viz, quote card, etc.)
3. Color palette for this specific post
4. Image/illustration direction (what to show or generate)
5. Typography guidance (what text to feature, if any)
6. AI image generation prompt (ready to use in Midjourney or DALL-E)

Today: ${today}. Make it scroll-stopping and brand-consistent.`);

  const id = await writeApproval({ source: 'pg_cron', trigger_type: 'cron_ravi_design_brief', agent_name: 'Ravi Gupta', agent_role: 'Graphic Designer', division: 'Content & Brand', task_brief: `Daily design brief — ${today}`, output, status: 'pending', notify_deanna: true, priority: 'normal', category: 'design_brief', platform: 'linkedin' });
  return { approval_id: id, cards_created: 1 };
}

// ─────────────────────────────────────────────────────────────
// PIPELINE 2 — YARA (Spanish localization)
// ─────────────────────────────────────────────────────────────

async function runYara(): Promise<{ approval_id: string | null; cards_created: number }> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let topPost = '';

  if (url && key) {
    const monday = new Date();
    monday.setDate(monday.getDate() - monday.getDay() + 1);
    const weekOf = monday.toISOString().split('T')[0];
    const res = await fetch(`${url}/rest/v1/content_queue?week_of=eq.${weekOf}&status=neq.queued&order=day_number.asc&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (res.ok) {
      const queue = await res.json();
      if (queue.length > 0) topPost = `${queue[0].hook}\n\n${queue[0].content}\n\n${queue[0].hashtags}`;
    }
  }

  const output = await callAnthropic(`You are Yara Mansour, Translator and Localization Agent for DRU AI Consulting.

${topPost ? `Translate and localize this LinkedIn post for Spanish-speaking executive audiences (Latin America focus — Costa Rica, Dominican Republic, broader LATAM):

ORIGINAL POST:
${topPost}

Provide:
1. Full Spanish translation (natural, professional, not literal)
2. Localization notes (cultural adaptations made)
3. Translated hashtags (Spanish equivalents)
4. Any frameworks that need explanation for LATAM audience` : `Generate an original LinkedIn post in Spanish for DRU AI Consulting targeting LATAM executives navigating AI adoption. Brand: "AI Mastery. Leadership Clarity. Measurable Results." — DeAnna R. Upshaw. Include relevant Spanish hashtags.`}`);

  const id = await writeApproval({ source: 'pg_cron', trigger_type: 'cron_yara_localization', agent_name: 'Yara Mansour', agent_role: 'Translator / Localization', division: 'Content & Brand', task_brief: 'Weekend Spanish localization post', output, status: 'pending', notify_deanna: true, priority: 'normal', category: 'localization', platform: 'linkedin' });
  return { approval_id: id, cards_created: 1 };
}

// ─────────────────────────────────────────────────────────────
// PIPELINE 2 — INGRID (Friday press release)
// ─────────────────────────────────────────────────────────────

async function runIngrid(): Promise<{ approval_id: string | null; cards_created: number }> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let weekContent = '';

  if (url && key) {
    const monday = new Date();
    monday.setDate(monday.getDate() - monday.getDay() + 1);
    const weekOf = monday.toISOString().split('T')[0];
    const res = await fetch(`${url}/rest/v1/content_queue?week_of=eq.${weekOf}&order=day_number.asc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (res.ok) {
      const posts = await res.json();
      weekContent = posts.map((p: any) => `Day ${p.day_number} (${p.framework_covered}): ${p.hook}`).join('\n');
    }
  }

  const output = await callAnthropic(`You are Ingrid Larsen, Press Release Writer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority, CEO/Founder.

This week's content themes:
${weekContent || 'AI leadership, DRU CLEAR™ framework, executive AI adoption'}

Write a professional press release based on the strongest story from this week's content. Pick the angle that positions DRU AI Consulting most powerfully.

Format:
FOR IMMEDIATE RELEASE
Headline (AP style)
Subheadline

City, Date — [Lead paragraph — who, what, when, where, why]

[Body — 2–3 paragraphs with quotes from DeAnna R. Upshaw]

[Boilerplate about DRU AI Consulting]

About DRU AI Consulting:
DeAnna R. Upshaw — AI Authority, CEO/Founder of DRU AI Consulting (DBA Dimensional Solns, LLC). 25+ years IT experience, 10+ years leadership development, Certified International Corporate Facilitator, Keynote Speaker, Executive Coach. Creator of the DRU AI Leadership Ecosystem™.

###

Contact: druaiconsulting@gmail.com`);

  const id = await writeApproval({ source: 'pg_cron', trigger_type: 'cron_ingrid_press_release', agent_name: 'Ingrid Larsen', agent_role: 'Press Release', division: 'Content & Brand', task_brief: "Friday press release from week's strongest content", output, status: 'pending', notify_deanna: true, priority: 'normal', category: 'press_release', platform: null });
  return { approval_id: id, cards_created: 1 };
}

// ─────────────────────────────────────────────────────────────
// Dispatch to Travis Router (non-pipeline agents)
// ─────────────────────────────────────────────────────────────

async function dispatchToTravisRouter(route: AgentRoute, payload: TriggerPayload, triggeredAt: string, sourceLabel: string): Promise<{ approval_id?: string; cards_created?: number }> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return {};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${url}/functions/v1/travis-router`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ agent_id: route.agent_id, agent_name: route.agent_name, division: route.division, task: route.task, trigger_type: payload.trigger_type, source: sourceLabel, payload, triggered_at: triggeredAt }), signal: controller.signal });
    clearTimeout(timeout);
    const text = await res.text();
    if (!res.ok) { console.error(`[travis-router] ${res.status}: ${text}`); return {}; }
    try { return JSON.parse(text); } catch { return {}; }
  } catch (error: unknown) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') console.warn('[travis-router] Timed out after 8s');
    else console.error('[travis-router] Error:', error);
    return {};
  }
}

// ─────────────────────────────────────────────────────────────
// Digest Notification
// ─────────────────────────────────────────────────────────────

async function sendDigestNotification(agentName: string, task: string, division: string, cardsCreated: number, approvalId: string | null | undefined, triggeredAt: string, summary?: string): Promise<void> {
  const webhookUrl = process.env.GHL_NOTIFICATION_WEBHOOK_URL;
  if (!webhookUrl) return;
  const cardWord = cardsCreated !== 1 ? 'cards' : 'card';
  const taskReadable = task.replace(/_/g, ' ');
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'druaiconsulting@gmail.com', phone: '+19796186671', first_name: 'DeAnna', last_name: 'Upshaw',
        agent_name: agentName, division, task: taskReadable, cards_created: cardsCreated,
        approval_ids: approvalId ?? 'see queue',
        summary: summary ?? `${agentName} completed the ${taskReadable} task and dropped ${cardsCreated} ${cardWord} into your approval queue.`,
        triggered_at: triggeredAt, review_url: 'https://app.druaiconsulting.com/admin-approvals',
        sms_body: `DRU AI™ | ${agentName} dropped ${cardsCreated} ${cardWord} in your queue.\n\nTask: ${taskReadable}\nReview: app.druaiconsulting.com/admin-approvals`,
        email_subject: `DRU AI Ecosystem™ — ${agentName} Queue Update`,
        email_body: `Your AI Ecosystem ran on schedule.\n\nAgent: ${agentName}\nDivision: ${division}\nTask: ${taskReadable}\nCards: ${cardsCreated}\n\n${summary ?? ''}\n\nReview: https://app.druaiconsulting.com/admin-approvals\n\n— DRU AI Leadership Ecosystem™`,
      }),
    });
  } catch (error) { console.warn('[notification] Failed (non-fatal):', error); }
}

// ─────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const incomingSecret = req.headers['x-cron-secret'];
  if (incomingSecret !== undefined && incomingSecret !== process.env.CRON_SECRET) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const payload: TriggerPayload = req.body;
  if (!payload?.trigger_type) { res.status(400).json({ error: 'trigger_type is required' }); return; }

  const route = AGENT_ROUTES[payload.trigger_type];
  if (!route) { res.status(400).json({ error: `Unknown trigger_type: ${payload.trigger_type}` }); return; }

  const sourceLabel = payload.source ?? 'webhook';
  const triggeredAt = new Date().toISOString();
  const isCronSource = CRON_TRIGGER_TYPES.has(payload.trigger_type);

  console.log(`[ghl-agent-trigger] ✅ ${route.agent_name} | ${route.division} | ${sourceLabel}`);

  let approvalId: string | null = null;
  let cardsCreated = 0;
  let summary: string | undefined;

  // ── Pipeline 1 — Revenue ──────────────────────────────────
  if (route.pipeline === 'p1_omar') {
    const omar = await runOmar();
    const ryan = await runRyan(omar);
    approvalId = ryan.approval_id; cardsCreated = ryan.cards_created;
    summary = `Pipeline 1: ${omar.total_leads_scanned} leads scored, ${ryan.high_intent_count} high-intent, ${ryan.crm_updates} CRM updates`;

  } else if (route.pipeline === 'p1_aaliyah') {
    const r = await runAaliyah(); approvalId = r.approval_id; cardsCreated = r.cards_created;
  } else if (route.pipeline === 'p1_serena') {
    const r = await runSerena(); approvalId = r.approval_id; cardsCreated = r.cards_created;
  } else if (route.pipeline === 'p1_mateo') {
    const r = await runMateo(); approvalId = r.approval_id; cardsCreated = r.cards_created;
  } else if (route.pipeline === 'p1_jaylen') {
    const r = await runJaylen(); approvalId = r.approval_id; cardsCreated = r.cards_created;
  } else if (route.pipeline === 'p1_chloe') {
    const r = await runChloe(); approvalId = r.approval_id; cardsCreated = r.cards_created;
  } else if (route.pipeline === 'p1_zara') {
    const r = await runZara(); approvalId = r.approval_id; cardsCreated = r.cards_created;
  } else if (route.pipeline === 'p1_elena') {
    const r = await runElena(); approvalId = r.approval_id; cardsCreated = r.cards_created;
  } else if (route.pipeline === 'p1_kwame') {
    const r = await runKwame(); approvalId = r.approval_id; cardsCreated = r.cards_created;

  // ── Pipeline 2 — Content & Brand ─────────────────────────
  } else if (route.pipeline === 'p2_camila') {
    const r = await runCamila(); cardsCreated = r.posts_generated;
    summary = `Camila generated ${r.posts_generated} LinkedIn posts for week of ${r.week_of}`;
  } else if (route.pipeline === 'p2_darius') {
    const r = await runDarius(); approvalId = r.approval_id; cardsCreated = r.cards_created;
  } else if (route.pipeline === 'p2_ravi') {
    const r = await runRavi(); approvalId = r.approval_id; cardsCreated = r.cards_created;
  } else if (route.pipeline === 'p2_yara') {
    const r = await runYara(); approvalId = r.approval_id; cardsCreated = r.cards_created;
  } else if (route.pipeline === 'p2_ingrid') {
    const r = await runIngrid(); approvalId = r.approval_id; cardsCreated = r.cards_created;

  // ── Standard dispatch ─────────────────────────────────────
  } else {
    const r = await dispatchToTravisRouter(route, payload, triggeredAt, sourceLabel);
    approvalId = r.approval_id ?? null; cardsCreated = r.cards_created ?? 1;
  }

  if (isCronSource) {
    await sendDigestNotification(route.agent_name, route.task, route.division, cardsCreated, approvalId, triggeredAt, summary);
  }

  res.status(202).json({ success: true, agent: route.agent_name, division: route.division, task: route.task, pipeline: route.pipeline ?? null, source: sourceLabel, triggered_at: triggeredAt, approval_id: approvalId, cards_created: cardsCreated, summary: summary ?? null });
}
