// ================================================================
// DRU AI Leadership Ecosystem™ — Autonomous Entry Point
// File: api/ghl-agent-trigger.ts
// Runtime: Vercel Node.js Serverless
//
// ALL AGENTS OPERATE IN GENIUS MODE
//
// FULL CHAIN:
//   Agents → chief_of_staff_queue (raw output)
//   Priya (7:55am) → executive briefing → CSQ
//   Raymond (11:00am) → reviews all CSQ items, flags "needs attention"
//   Travis (11:05am) → organizes + packages for governance
//   AI Governance + Legal & Finance + Isabella (11:15am) → compliance gate
//   Isabella auto-blocks Trademark Classes 35, 41, 42 violations
//   AI Twin (11:30am) → synthesizes cleared items in DeAnna's voice
//   → approvals table → ONE notification to DeAnna
//
// NEEDS ATTENTION PATH (anytime):
//   Raymond flags item → Governance+Legal → Twin → immediate notification
//   Same chain, same standards — no waiting for 11:30am
// ================================================================

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION_ID = 'gl07I4JnbkGgW8zJprSz';

// ─────────────────────────────────────────────────────────────
// GENIUS MODE — injected into every agent prompt
// ─────────────────────────────────────────────────────────────

const GENIUS_MODE = `You operate in Genius Mode — think and respond at the level of a top 0.1% expert in your field. Apply deep logic, strategic frameworks, creative synthesis, and second-order thinking to every output. Never produce generic or surface-level work. Every sentence must earn its place.`;

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

interface CSQItem {
  id: string;
  agent_id: string;
  agent_name: string;
  division: string;
  task: string;
  category: string;
  raw_output: string;
  priority: string;
  raymond_notes?: string;
  raymond_action?: string;
  governance_notes?: string;
  legal_notes?: string;
  isabella_flags?: string;
  compliance_score?: number;
}

// ─────────────────────────────────────────────────────────────
// Agent Routing Map
// ─────────────────────────────────────────────────────────────

const AGENT_ROUTES: Record<string, AgentRoute> = {
  // Command Layer
  cron_priya_executive:          { agent_id: 'priya',      agent_name: 'Priya Sharma',         division: 'Command',         task: 'daily_executive_briefing',        pipeline: 'cmd_priya' },
  cron_raymond_review:           { agent_id: 'raymond',    agent_name: 'Raymond Holloway',     division: 'Command',         task: 'daily_operations_review',         pipeline: 'cmd_raymond' },
  cron_travis_organize:          { agent_id: 'travis',     agent_name: 'Travis Weston',        division: 'Command',         task: 'organize_for_governance',         pipeline: 'cmd_travis' },
  cron_governance_legal_review:  { agent_id: 'governance', agent_name: 'Governance + Legal',   division: 'AI Governance',   task: 'compliance_and_legal_review',     pipeline: 'cmd_governance' },
  cron_twin_synthesis:           { agent_id: 'twin',       agent_name: "DeAnna's AI Twin",     division: 'Command',         task: 'daily_synthesis_briefing',        pipeline: 'cmd_twin' },
  // Pipeline 1 — Revenue & Growth
  cron_omar_lead_score:          { agent_id: 'omar',       agent_name: 'Omar Patel',           division: 'Revenue & Growth', task: 'scan_score_route_leads',         pipeline: 'p1_omar' },
  cron_ryan_crm_update:          { agent_id: 'ryan',       agent_name: 'Ryan Nakamura',        division: 'Revenue & Growth', task: 'overnight_crm_sync',             pipeline: 'p1_ryan' },
  cron_serena_coaching:          { agent_id: 'serena',     agent_name: 'Serena Jackson',       division: 'Revenue & Growth', task: 'morning_coaching_briefing',      pipeline: 'p1_serena' },
  cron_mateo_sales_support:      { agent_id: 'mateo',      agent_name: 'Mateo Gonzalez',       division: 'Revenue & Growth', task: 'sales_pipeline_review',          pipeline: 'p1_mateo' },
  cron_aaliyah_outreach:         { agent_id: 'aaliyah',    agent_name: 'Aaliyah Foster',       division: 'Revenue & Growth', task: 'personalized_outreach_messages', pipeline: 'p1_aaliyah' },
  cron_jaylen_email:             { agent_id: 'jaylen',     agent_name: 'Jaylen Brooks',        division: 'Revenue & Growth', task: 'email_campaign_content',         pipeline: 'p1_jaylen' },
  cron_chloe_copy:               { agent_id: 'chloe',      agent_name: 'Chloe Dubois',         division: 'Revenue & Growth', task: 'daily_copy_asset',               pipeline: 'p1_chloe' },
  cron_zara_product:             { agent_id: 'zara',       agent_name: 'Zara Ahmed',           division: 'Revenue & Growth', task: 'product_launch_readiness',       pipeline: 'p1_zara' },
  cron_elena_knowledge:          { agent_id: 'elena',      agent_name: 'Elena Vasquez',        division: 'Revenue & Growth', task: 'product_knowledge_update',       pipeline: 'p1_elena' },
  cron_kwame_proposal:           { agent_id: 'kwame',      agent_name: 'Kwame Asante',         division: 'Revenue & Growth', task: 'proposal_template_update',       pipeline: 'p1_kwame' },
  // Pipeline 2 — Content & Brand
  cron_camila_linkedin_queue:    { agent_id: 'camila',     agent_name: 'Camila Flores',        division: 'Content & Brand',  task: 'generate_weekly_linkedin_queue', pipeline: 'p2_camila' },
  cron_darius_linkedin_post:     { agent_id: 'darius',     agent_name: 'Darius King',          division: 'Content & Brand',  task: 'generate_daily_linkedin_post',   pipeline: 'p2_darius' },
  cron_ravi_design_brief:        { agent_id: 'ravi',       agent_name: 'Ravi Gupta',           division: 'Content & Brand',  task: 'generate_design_brief',          pipeline: 'p2_ravi' },
  cron_yara_localization:        { agent_id: 'yara',       agent_name: 'Yara Mansour',         division: 'Content & Brand',  task: 'spanish_localization',           pipeline: 'p2_yara' },
  cron_ingrid_press_release:     { agent_id: 'ingrid',     agent_name: 'Ingrid Larsen',        division: 'Content & Brand',  task: 'weekly_press_release',           pipeline: 'p2_ingrid' },
  // Analytics
  cron_analytics_weekly:         { agent_id: 'analytics',  agent_name: 'Analytics Agent',      division: 'Analytics',        task: 'weekly_performance_summary' },
  // GHL Webhooks
  lead_created:         { agent_id: 'omar',    agent_name: 'Omar Patel',    division: 'Revenue & Growth', task: 'score_new_lead' },
  contact_updated:      { agent_id: 'ryan',    agent_name: 'Ryan Nakamura', division: 'Revenue & Growth', task: 'process_contact_update' },
  assessment_completed: { agent_id: 'omar',    agent_name: 'Omar Patel',    division: 'Revenue & Growth', task: 'route_assessment_lead' },
  support_ticket:       { agent_id: 'support', agent_name: 'Isaiah Carter', division: 'Customer Support', task: 'handle_support_request' },
};

const CRON_TRIGGER_TYPES = new Set(Object.keys(AGENT_ROUTES).filter(k => k.startsWith('cron_')));

// ─────────────────────────────────────────────────────────────
// SHARED — Anthropic call with Structured Outputs (guaranteed JSON)
// Uses anthropic-beta: structured-outputs-2025-11-13
// Eliminates JSON.parse errors permanently
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// SHARED — Anthropic JSON array call using assistant prefill
// Forces response to start with [ — no beta features needed
// Works on all models, no schema complexity limits, no 400 errors
// Anthropic cookbook recommended approach for reliable JSON arrays
// ─────────────────────────────────────────────────────────────

async function callAnthropicStructured(prompt: string, _schema: Record<string, unknown>, maxTokens = 2000): Promise<any[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [
        { role: 'user', content: prompt },
        { role: 'assistant', content: '[' }, // prefill forces JSON array
      ],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.content?.[0]?.text ?? ']';
  return JSON.parse('[' + text);
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
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

// ─────────────────────────────────────────────────────────────
// SHARED — Anthropic call (Sonnet — Twin only, highest quality)
// ─────────────────────────────────────────────────────────────

async function callTwin(prompt: string, maxTokens = 4000): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Twin Anthropic error ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

// ─────────────────────────────────────────────────────────────
// SHARED — Write to chief_of_staff_queue
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// SHARED — Write final approval (Twin output only)
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
// SHARED — Get CSQ items by status
// ─────────────────────────────────────────────────────────────

async function getCSQItems(status: string): Promise<CSQItem[]> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const res = await fetch(`${url}/rest/v1/chief_of_staff_queue?status=eq.${status}&order=created_at.asc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) return [];
  return await res.json();
}

// ─────────────────────────────────────────────────────────────
// SHARED — Update CSQ item
// ─────────────────────────────────────────────────────────────

async function updateCSQ(id: string, updates: Record<string, unknown>): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  await fetch(`${url}/rest/v1/chief_of_staff_queue?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify(updates),
  });
}

// ─────────────────────────────────────────────────────────────
// SHARED — Generic agent → CSQ runner
// ─────────────────────────────────────────────────────────────

async function runAgentToCSQ(agentId: string, agentName: string, division: string, task: string, category: string, prompt: string, priority = 'normal'): Promise<string | null> {
  try {
    const output = await callAnthropic(`${GENIUS_MODE}\n\n${prompt}`, 1500);
    return await writeToCSQ({ agent_id: agentId, agent_name: agentName, division, task, category, raw_output: output, priority, status: 'pending' });
  } catch (error) {
    console.error(`[${agentId}] Error:`, error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// COMMAND LAYER — PRIYA SHARMA (Executive Assistant)
// Daily 7:55am — executive briefing to CSQ for Travis to package
// ─────────────────────────────────────────────────────────────

async function runPriya(): Promise<string | null> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return runAgentToCSQ('priya', 'Priya Sharma', 'Command', 'daily_executive_briefing', 'executive_support',
    `You are Priya Sharma, Executive Assistant to DeAnna R. Upshaw — AI Authority, CEO/Founder of DRU AI Consulting.

Today is ${today}.

${GENIUS_MODE}

TRADEMARK REQUIREMENT: When referencing any DRU framework, ALWAYS include the ™ symbol: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.

Generate DeAnna's daily executive briefing. Include:
1. Today's strategic focus (one clear priority aligned to DRU AI Consulting's pre-launch phase)
2. Key follow-up items (correspondence, decisions, or actions that may need attention)
3. Administrative notes (anything time-sensitive for today)
4. Calendar/schedule considerations for this day of the week
5. One executive reminder — something a world-class assistant would flag proactively

Keep it concise, professional, and immediately actionable. DeAnna is building the DRU AI Leadership Ecosystem™ toward her first launch.`);
}

// ─────────────────────────────────────────────────────────────
// PIPELINE 1 — OMAR (Lead Scoring)
// ─────────────────────────────────────────────────────────────

async function runOmar(): Promise<OmarResult> {
  const ghlApiKey = process.env.GHL_API_KEY;
  if (!ghlApiKey) return { success: false, total_leads_scanned: 0, scored_leads: [], high_intent_leads: [], run_date: new Date().toISOString(), error: 'Missing GHL_API_KEY' };
  try {
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    const res = await fetch(`${GHL_API_BASE}/contacts/?locationId=${GHL_LOCATION_ID}&startAfterDate=${encodeURIComponent(yesterday.toISOString())}&limit=100`, { headers: { Authorization: `Bearer ${ghlApiKey}`, Version: '2021-07-28' } });
    if (!res.ok) throw new Error(`GHL error ${res.status}`);
    const rawLeads = (await res.json()).contacts ?? [];
    if (rawLeads.length === 0) return { success: true, total_leads_scanned: 0, scored_leads: [], high_intent_leads: [], run_date: new Date().toISOString() };
    const leadSummary = rawLeads.map((l: any) => ({ id: l.id, name: `${l.firstName ?? ''} ${l.lastName ?? ''}`.trim(), email: l.email ?? '', phone: l.phone ?? '', source: l.source ?? 'unknown', tags: l.tags ?? [] }));
    const text = await callAnthropic(`${GENIUS_MODE}\n\nYou are Omar Patel, Lead Scoring Agent for DRU AI Consulting. Score each lead 1–10 based on seniority, business context, source quality, and engagement. Return ONLY a JSON array:
[{"contact_id":"...","name":"...","email":"...","phone":"...","source":"...","score":8,"intent_level":"high","recommended_action":"...","notes":"..."}]
Leads: ${JSON.stringify(leadSummary)}`, 2000);
    const scored: ScoredLead[] = JSON.parse(text.replace(/```json|```/g, '').trim());
    return { success: true, total_leads_scanned: rawLeads.length, scored_leads: scored, high_intent_leads: scored.filter(l => l.intent_level === 'high'), run_date: new Date().toISOString() };
  } catch (error) {
    return { success: false, total_leads_scanned: 0, scored_leads: [], high_intent_leads: [], run_date: new Date().toISOString(), error: String(error) };
  }
}

// ─────────────────────────────────────────────────────────────
// PIPELINE 1 — RYAN (CRM Management → CSQ)
// ─────────────────────────────────────────────────────────────

async function runRyan(omarResult: OmarResult): Promise<{ csq_id: string | null; crm_updates: number }> {
  const ghlApiKey = process.env.GHL_API_KEY;
  if (!ghlApiKey) return { csq_id: null, crm_updates: 0 };

  if (omarResult.total_leads_scanned === 0) {
    const csq_id = await writeToCSQ({ agent_id: 'ryan', agent_name: 'Ryan Nakamura', division: 'Revenue & Growth', task: 'overnight_crm_sync', category: 'lead_intelligence', raw_output: '**Daily Lead Intelligence — No New Leads**\n\nOmar scanned GHL and found no new contacts in the last 24 hours. No CRM updates required.\n\nNext scan: tomorrow at 8:00am CDT.', priority: 'normal', status: 'pending' });
    return { csq_id, crm_updates: 0 };
  }

  let crmUpdates = 0;
  for (const lead of omarResult.scored_leads) {
    if (lead.contact_id) {
      await fetch(`${GHL_API_BASE}/contacts/${lead.contact_id}`, { method: 'PUT', headers: { Authorization: `Bearer ${ghlApiKey}`, Version: '2021-07-28', 'Content-Type': 'application/json' }, body: JSON.stringify({ tags: [`ai-scored`, `intent-${lead.intent_level}`, `score-${lead.score}`] }) });
      crmUpdates++;
    }
  }

  const highIntentSummary = omarResult.high_intent_leads.map(l => `• ${l.name} (Score: ${l.score}/10) — ${l.recommended_action}`).join('\n');
  const briefing = await callAnthropic(`${GENIUS_MODE}\n\nYou are Ryan Nakamura, CRM Management Agent for DRU AI Consulting. Write a precise lead intelligence briefing.
DATA: Total: ${omarResult.total_leads_scanned} | High-intent: ${omarResult.high_intent_leads.length} | Medium: ${omarResult.scored_leads.filter(l => l.intent_level === 'medium').length} | Low: ${omarResult.scored_leads.filter(l => l.intent_level === 'low').length}
HIGH-INTENT: ${highIntentSummary || 'None today'}
Include: executive summary, high-intent leads with specific actions, CRM updates completed, strategic next steps.`);

  const csq_id = await writeToCSQ({ agent_id: 'ryan', agent_name: 'Ryan Nakamura', division: 'Revenue & Growth', task: 'overnight_crm_sync', category: 'lead_intelligence', raw_output: briefing, priority: omarResult.high_intent_leads.length > 0 ? 'high' : 'normal', status: 'pending' });
  return { csq_id, crm_updates: crmUpdates };
}

// ─────────────────────────────────────────────────────────────
// PIPELINE 2 — CAMILA (Weekly Content Queue)
// ─────────────────────────────────────────────────────────────

async function runCamila(): Promise<number> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return 0;
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1);
  monday.setHours(0, 0, 0, 0);
  const weekOf = monday.toISOString().split('T')[0];
  const days = [1,2,3,4,5].map(d => { const date = new Date(monday); date.setDate(monday.getDate() + d - 1); return { day_number: d, scheduled_for: date.toISOString().split('T')[0] }; });

  const text = await callAnthropic(`${GENIUS_MODE}\n\nYou are Camila Flores, Social Media Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Brand: "AI Mastery. Leadership Clarity. Measurable Results." Frameworks (™): DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™. Audience: Executives, directors, founders navigating AI adoption.
Generate 5 LinkedIn posts (Mon–Fri). Day 1: thought_leadership | Day 2: educational | Day 3: engagement | Day 4: story_insight | Day 5: soft_promotional. Each: compelling hook, 150–250 words, one framework, CTA, 3–5 hashtags.
Return ONLY valid JSON: [{"day_number":1,"framework_covered":"DRU CLEAR™","post_type":"thought_leadership","hook":"...","content":"...","hashtags":"#AILeadership"}]`, 3000);

  const posts = JSON.parse(text.replace(/```json|```/g, '').trim());
  for (const post of posts) {
    const day = days.find(d => d.day_number === post.day_number) ?? days[0];
    await fetch(`${url}/rest/v1/content_queue`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ week_of: weekOf, day_number: post.day_number, scheduled_for: day.scheduled_for, platform: 'linkedin', framework_covered: post.framework_covered, post_type: post.post_type, hook: post.hook, content: post.content, hashtags: post.hashtags, status: 'queued' }) });
  }
  return posts.length;
}

// ─────────────────────────────────────────────────────────────
// PIPELINE 2 — DARIUS (Daily Post → CSQ)
// ─────────────────────────────────────────────────────────────

async function runDarius(): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1);
  const weekOf = monday.toISOString().split('T')[0];

  let postContent = '';
  let queueId: string | null = null;

  if (url && key) {
    const res = await fetch(`${url}/rest/v1/content_queue?week_of=eq.${weekOf}&status=eq.queued&scheduled_for=eq.${today}&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (res.ok) {
      const queue = await res.json();
      if (queue.length > 0) { queueId = queue[0].id; postContent = `${queue[0].hook}\n\n${queue[0].content}\n\n${queue[0].hashtags}`; }
    }
  }

  if (!postContent) {
    postContent = await callAnthropic(`${GENIUS_MODE}\n\nYou are Darius King, Viral Scripter for DRU AI Consulting. Write ONE LinkedIn post that stops executives mid-scroll. Brand: "AI Mastery. Leadership Clarity. Measurable Results." Use a ™ framework. 150–250 words. Strong CTA. 3–5 hashtags. Sound like DeAnna R. Upshaw — AI Authority.`);
  }

  const csqId = await writeToCSQ({ agent_id: 'darius', agent_name: 'Darius King', division: 'Content & Brand', task: 'generate_daily_linkedin_post', category: 'linkedin_post', raw_output: postContent, priority: 'normal', status: 'pending' });

  if (queueId && url && key) {
    await fetch(`${url}/rest/v1/content_queue?id=eq.${queueId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ status: 'submitted', submitted_at: new Date().toISOString() }) });
  }
  return csqId;
}

// ─────────────────────────────────────────────────────────────
// COMMAND LAYER — RAYMOND HOLLOWAY (Chief of Staff)
// Reviews all pending CSQ items from today
// Adds strategic context, priority, flags "needs attention" items
// ─────────────────────────────────────────────────────────────

async function runRaymond(): Promise<{ reviewed: number; needs_attention: number }> {
  const pending = await getCSQItems('pending');
  console.log(`[raymond] Reviewing ${pending.length} pending items...`);
  if (pending.length === 0) return { reviewed: 0, needs_attention: 0 };

  // Batch review — all items in ONE Anthropic call instead of one per item
  const itemSummaries = pending.map((item, i) =>
    `ITEM ${i + 1} (id: ${item.id}):
Agent: ${item.agent_name} | Division: ${item.division} | Task: ${item.task} | Category: ${item.category}
Output preview: ${item.raw_output.slice(0, 400)}...`
  ).join('\n\n---\n\n');

  // Batch review — structured outputs guarantees valid JSON
  const reviews = await callAnthropicStructured(
    `${GENIUS_MODE}\n\nYou are Raymond Holloway, Chief of Staff for DRU AI Consulting — DeAnna R. Upshaw's most trusted operations lead. You oversee 8 divisions and 36 agents.

Review ALL of these agent outputs in one pass and return your Chief of Staff assessment for each.

${itemSummaries}

For EACH item assess:
- priority: "normal" or "high" (high = needs DeAnna's attention today)
- action: "route_to_governance" or "needs_attention_now"
- notes: what governance and the Twin should know (1–2 sentences)

"needs_attention_now" = cannot wait for 11:30am briefing.`,
    {
      type: 'object',
      properties: {
        id: { type: 'string' },
        priority: { type: 'string' },
        action: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['id', 'priority', 'action', 'notes'],
      additionalProperties: false,
    },
    2000
  );
  let needsAttentionCount = 0;

  // Update all items concurrently — prevents sequential timeout
  await Promise.all(reviews.map(async (review: any) => {
    const isNeedsAttention = review.action === 'needs_attention_now';
    if (isNeedsAttention) needsAttentionCount++;
    if (isNeedsAttention) console.log(`[raymond] ⚡ Needs attention: ${review.id}`);
    await updateCSQ(review.id, {
      raymond_reviewed: true,
      raymond_notes: review.notes,
      raymond_priority: review.priority,
      raymond_action: review.action,
      raymond_reviewed_at: new Date().toISOString(),
      status: 'raymond_reviewed',
      priority: review.priority,
    });
  }));

  return { reviewed: pending.length, needs_attention: needsAttentionCount };
}

// ─────────────────────────────────────────────────────────────
// COMMAND LAYER — TRAVIS WESTON (Assistant Chief of Staff)
// Organizes Raymond-reviewed items for governance gate
// Groups by division, prepares structured package
// ─────────────────────────────────────────────────────────────

async function runTravis(): Promise<number> {
  const reviewed = await getCSQItems('raymond_reviewed');
  // Filter out items already sent via needs_attention_now path
  const toOrganize = reviewed.filter(item => item.raymond_action !== 'needs_attention_now');
  console.log(`[travis] Organizing ${toOrganize.length} items for governance...`);

  for (const item of toOrganize) {
    await updateCSQ(item.id, { status: 'travis_organized' });
  }

  return toOrganize.length;
}

// ─────────────────────────────────────────────────────────────
// GOVERNANCE GATE — Single item review
// Used by both scheduled (11:15am) and needs_attention_now paths
// Includes Isabella Moreno trademark auto-block (Classes 35, 41, 42)
// ─────────────────────────────────────────────────────────────

async function runGovernanceForItem(item: CSQItem): Promise<boolean> {
  try {
    // Isabella Moreno — Trademark Auto-Block (Classes 35, 41, 42)
    const isabellaCheck = await callAnthropic(`${GENIUS_MODE}\n\nYou are Isabella Moreno, Director of Compliance for DRU AI Consulting. Your job is to PROTECT DRU AI Consulting's intellectual property and ensure content does not infringe on OTHERS' trademarks.

IMPORTANT DISTINCTION:
- DRU AI Consulting OWNS and OPERATES in Classes 35, 41, and 42. Content about coaching, training, AI consulting, and business services is DRU AI Consulting's CORE BUSINESS — this is NOT a violation.
- You only block content that: (1) misuses DRU's own ™ marks, OR (2) infringes on a SPECIFIC OTHER COMPANY's registered trademark.

DRU AI Consulting's protected marks (always require ™): DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.

ONLY flag content if:
1. A DRU proprietary framework name appears WITHOUT the ™ symbol
2. Content copies or closely mimics a SPECIFIC named competitor's trademarked phrase or slogan
3. Content makes false claims about certifications, affiliations, or credentials DeAnna does not hold

DO NOT flag content simply because it discusses coaching, training, AI consulting, leadership, or business services — these are DRU AI Consulting's own protected service categories.

Review this content:
${item.raw_output}

Respond ONLY with valid JSON:
{"cleared":true,"flags":"none","isabella_notes":"Content reviewed. No trademark violations detected."}
OR only if a genuine violation exists:
{"cleared":false,"flags":"specific_violation_description","isabella_notes":"Exact violation here. BLOCKED."}`, 600);

    const isabellaResult = JSON.parse(isabellaCheck.replace(/```json|```/g, '').trim());

    if (!isabellaResult.cleared) {
      console.warn(`[isabella] ⛔ BLOCKED: ${item.agent_name} — ${isabellaResult.flags}`);
      await updateCSQ(item.id, {
        governance_cleared: false,
        governance_flags: isabellaResult.flags,
        governance_notes: `BLOCKED BY ISABELLA: ${isabellaResult.isabella_notes}`,
        status: 'rejected',
        governance_cleared_at: new Date().toISOString(),
      });
      return false;
    }

    // Full Governance + Legal review
    const govReview = await callAnthropic(`${GENIUS_MODE}\n\nYou are the AI Governance and Legal & Finance review panel for DRU AI Consulting:
- Khalid Hassan (Disclaimer Writer) — does this content need a legal disclaimer?
- Sofia Petrov (Privacy Policy) — any privacy or data compliance concerns?
- James Osei (Contract Writer) — any legal risk in proposals or agreements?
- Mei Lin (Brand Protection) — is brand voice and positioning consistent?
- Rafael Torres (Continuous Learning) — note any improvement opportunities
- Amara Okafor (Legal Team) — overall legal risk assessment
- Diego Reyes (Expense Manager) — any financial exposure claims?
- Yuki Tanaka (Financial Reporting) — are any financial figures accurate and appropriate?
- Marcus Chen (Tax Strategist) — any tax implications in financial content?

Isabella Moreno has already cleared this content for trademark compliance.

IMPORTANT: If you find NO issues, you MUST return cleared: true. Only return cleared: false if there is a specific, real, articulable legal or compliance risk. Do not fail content without a specific reason.

AGENT: ${item.agent_name} | DIVISION: ${item.division}
RAYMOND'S NOTES: ${item.raymond_notes ?? 'N/A'}
CONTENT:
${item.raw_output}

Respond ONLY with valid JSON:
{"cleared":true,"compliance_score":9,"governance_notes":"Content reviewed by full panel. No compliance issues identified.","legal_notes":"No legal risk detected.","flags":"none"}
OR if a specific real issue exists:
{"cleared":false,"compliance_score":4,"governance_notes":"Specific issue here.","legal_notes":"Specific legal concern here.","flags":"specific_flag"}`, 800);

    const govResult = JSON.parse(govReview.replace(/```json|```/g, '').trim());

    await updateCSQ(item.id, {
      governance_cleared: govResult.cleared,
      governance_notes: govResult.governance_notes,
      legal_notes: govResult.legal_notes,
      governance_flags: govResult.flags,
      compliance_score: govResult.compliance_score,
      isabella_flags: isabellaResult.isabella_notes,
      governance_cleared_at: new Date().toISOString(),
      status: govResult.cleared ? 'governance_cleared' : 'rejected',
    });

    return govResult.cleared;
  } catch (error) {
    console.error(`[governance] Error reviewing item ${item.id}:`, error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// COMMAND LAYER — GOVERNANCE + LEGAL GATE (scheduled 11:15am)
// Processes all travis_organized items
// ─────────────────────────────────────────────────────────────

async function runGovernanceLegal(): Promise<{ reviewed: number; cleared: number; blocked: number }> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { reviewed: 0, cleared: 0, blocked: 0 };

  // Get travis_organized items (normal path)
  const normalRes = await fetch(`${url}/rest/v1/chief_of_staff_queue?status=eq.travis_organized&order=created_at.asc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const normalItems: CSQItem[] = normalRes.ok ? await normalRes.json() : [];

  // Get raymond_reviewed needs_attention items (expedited path)
  const urgentRes = await fetch(`${url}/rest/v1/chief_of_staff_queue?status=eq.raymond_reviewed&raymond_action=eq.needs_attention_now&order=created_at.asc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const urgentItems: CSQItem[] = urgentRes.ok ? await urgentRes.json() : [];

  const allItems = [...urgentItems, ...normalItems];
  console.log(`[governance] Reviewing ${allItems.length} items (${urgentItems.length} needs-attention, ${normalItems.length} normal)...`);
  if (allItems.length === 0) return { reviewed: 0, cleared: 0, blocked: 0 };

  // BATCH STEP 1: Isabella trademark check — structured output guarantees valid JSON
  const isabellaResults = await callAnthropicStructured(
    `${GENIUS_MODE}\n\nYou are Isabella Moreno, Director of Compliance for DRU AI Consulting. You auto-block any output that misuses or omits trademark symbols on DRU's proprietary frameworks, or that infringes on external trademarks.

DRU AI Consulting's protected marks — ALWAYS require ™ symbol:
DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™

HARD BLOCK (cleared: false) if:
1. Any DRU proprietary framework name appears WITHOUT the ™ symbol
2. Content directly copies a specific named external competitor's registered trademark

CLEAR (cleared: true) if:
- All DRU framework names are correctly marked with ™ OR frameworks are not mentioned at all
- No external trademark infringement detected

DEFAULT: If content does not reference any DRU frameworks at all, cleared = true.

${allItems.map((item, i) => `ITEM ${i + 1} (id: ${item.id}):\nAgent: ${item.agent_name}\nContent: ${item.raw_output.slice(0, 300)}...`).join('\n\n---\n\n')}

Review each item and return results.`,
    {
      type: 'object',
      properties: {
        id: { type: 'string' },
        cleared: { type: 'boolean' },
        flags: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['id', 'cleared', 'flags', 'notes'],
      additionalProperties: false,
    },
    1500
  );

  // BATCH STEP 2: Full governance review for Isabella-cleared items — ONE call
  const clearedByIsabella = isabellaResults.filter((r: any) => r.cleared);
  const blockedByIsabella = isabellaResults.filter((r: any) => !r.cleared);

  let govResults: any[] = [];
  if (clearedByIsabella.length > 0) {
    const clearedItems = allItems.filter(item => clearedByIsabella.some((r: any) => r.id === item.id));
    govResults = await callAnthropicStructured(
      `${GENIUS_MODE}\n\nYou are the AI Governance and Legal & Finance panel for DRU AI Consulting (Khalid, Sofia, James, Mei Lin, Rafael, Amara, Diego, Yuki, Marcus). Isabella has cleared these items for trademark compliance. Review for legal risk, privacy, financial accuracy, and brand consistency. Return cleared:true unless there is a specific real issue.

${clearedItems.map((item, i) => `ITEM ${i + 1} (id: ${item.id}):\nAgent: ${item.agent_name} | Division: ${item.division}\nContent: ${item.raw_output.slice(0, 300)}...`).join('\n\n---\n\n')}

Review each item and return results.`,
      {
        type: 'object',
        properties: {
          id: { type: 'string' },
          cleared: { type: 'boolean' },
          compliance_score: { type: 'number' },
          governance_notes: { type: 'string' },
          legal_notes: { type: 'string' },
          flags: { type: 'string' },
        },
        required: ['id', 'cleared', 'compliance_score', 'governance_notes', 'legal_notes', 'flags'],
        additionalProperties: false,
      },
      1500
    );
  }

  // Update all items concurrently
  let cleared = 0;
  let blocked = 0;

  await Promise.all(allItems.map(async (item) => {
    const isabellaResult = isabellaResults.find((r: any) => r.id === item.id);
    if (!isabellaResult?.cleared) {
      blocked++;
      await updateCSQ(item.id, { governance_cleared: false, governance_flags: isabellaResult?.flags ?? 'isabella_blocked', governance_notes: isabellaResult?.notes ?? 'Blocked by Isabella', governance_cleared_at: new Date().toISOString(), status: 'rejected' });
      return;
    }
    const govResult = govResults.find((r: any) => r.id === item.id);
    if (govResult?.cleared) {
      cleared++;
      await updateCSQ(item.id, { governance_cleared: true, compliance_score: govResult.compliance_score, governance_notes: govResult.governance_notes, legal_notes: govResult.legal_notes, governance_flags: govResult.flags, governance_cleared_at: new Date().toISOString(), status: 'governance_cleared' });
    } else {
      blocked++;
      await updateCSQ(item.id, { governance_cleared: false, governance_notes: govResult?.governance_notes ?? 'Review failed', governance_flags: govResult?.flags ?? 'review_failed', governance_cleared_at: new Date().toISOString(), status: 'rejected' });
    }
  }));

  console.log(`[governance] ✅ Reviewed ${allItems.length}: ${cleared} cleared, ${blocked} blocked`);
  return { reviewed: allItems.length, cleared, blocked };
}

// ─────────────────────────────────────────────────────────────
// COMMAND LAYER — AI TWIN SYNTHESIS (11:30am)
// Reads all governance_cleared items
// Synthesizes in DeAnna's voice using Sonnet
// Writes ONE consolidated briefing to approvals table
// Sends ONE notification to DeAnna
// ─────────────────────────────────────────────────────────────

async function runTwinSynthesis(needsAttentionOnly = false): Promise<{ approval_id: string | null; items_synthesized: number }> {
  const status = needsAttentionOnly ? 'needs_attention_cleared' : 'governance_cleared';
  const items = await getCSQItems('governance_cleared');
  console.log(`[twin] Synthesizing ${items.length} cleared items...`);

  if (items.length === 0) {
    console.log('[twin] No cleared items to synthesize today.');
    return { approval_id: null, items_synthesized: 0 };
  }

  // Group items by division for structured synthesis
  const byDivision: Record<string, CSQItem[]> = {};
  for (const item of items) {
    if (!byDivision[item.division]) byDivision[item.division] = [];
    byDivision[item.division].push(item);
  }

  const divisionSummaries = Object.entries(byDivision).map(([div, divItems]) =>
    `**${div}:**\n${divItems.map(i => `• ${i.agent_name} (${i.task.replace(/_/g, ' ')}): ${i.raw_output.slice(0, 300)}...`).join('\n')}`
  ).join('\n\n');

  const synthesis = await callTwin(`You are DeAnna R. Upshaw's AI Twin — the Master Orchestrator of DRU AI Consulting. You speak with authority, clarity, and strategic precision in DeAnna's voice.

Your team has completed today's operations. Raymond reviewed everything. AI Governance + Legal (including Isabella Moreno's trademark clearance) has cleared all items. You are now synthesizing the day's work into an executive briefing for DeAnna's review and approval.

BRAND PRINCIPLE: "AI Mastery. Leadership Clarity. Measurable Results."
FRAMEWORKS (always ™): DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™

TODAY'S CLEARED OPERATIONS:
${divisionSummaries}

RAYMOND'S OVERALL NOTES:
${items.map(i => i.raymond_notes).filter(Boolean).join(' | ')}

Synthesize this into ONE executive briefing in DeAnna's voice. Structure:

## Daily Operations Briefing — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}

**Executive Summary** (3–4 sentences in first person — "My team has..." — strategic overview of today's operations)

**Revenue & Growth** (key highlights, lead intelligence, sales activity)

**Content & Brand** (today's content, design, outreach)

**Administrative** (Priya's executive briefing items)

**Decisions Needed** (anything requiring DeAnna's approval or action)

**Tomorrow's Priorities** (what the team is positioned to execute)

Write as DeAnna would speak to herself — authoritative, clear, action-oriented. This is her mirror.`, 4000);

  const approvalId = await writeApproval({
    source: 'twin_synthesis',
    trigger_type: 'cron_twin_synthesis',
    agent_name: "DeAnna's AI Twin",
    agent_role: 'Master Orchestrator',
    division: 'Command',
    task_brief: `Daily operations briefing — ${items.length} items synthesized across ${Object.keys(byDivision).length} divisions`,
    output: synthesis,
    status: 'pending',
    notify_deanna: true,
    priority: items.some(i => i.priority === 'high') ? 'high' : 'normal',
    category: 'daily_briefing',
    platform: null,
  });

  // Mark all synthesized items
  for (const item of items) {
    await updateCSQ(item.id, { twin_processed: true, twin_synthesis: synthesis.slice(0, 500), approval_id: approvalId, twin_processed_at: new Date().toISOString(), status: 'twin_processed' });
  }

  console.log(`[twin] ✅ Daily briefing synthesized | approval_id: ${approvalId}`);
  return { approval_id: approvalId, items_synthesized: items.length };
}

// ─────────────────────────────────────────────────────────────
// Notification — sent ONLY after Twin synthesis
// ─────────────────────────────────────────────────────────────

async function sendTwinNotification(approvalId: string | null, itemsCount: number, triggeredAt: string, needsAttention = false): Promise<void> {
  const webhookUrl = process.env.GHL_NOTIFICATION_WEBHOOK_URL;
  if (!webhookUrl) return;

  const subject = needsAttention
    ? `DRU AI Ecosystem™ — Your Twin Has Something That Needs Your Attention`
    : `DRU AI Ecosystem™ — Your Daily Briefing Is Ready`;

  const sms = needsAttention
    ? `DRU AI™ | Your Twin flagged something that needs your attention.\n\nReview: app.druaiconsulting.com/admin-approvals`
    : `DRU AI™ | Your daily briefing is ready. ${itemsCount} items synthesized by your Twin.\n\nReview: app.druaiconsulting.com/admin-approvals`;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'druaiconsulting@gmail.com', phone: '+19796186671',
        first_name: 'DeAnna', last_name: 'Upshaw',
        agent_name: "DeAnna's AI Twin", division: 'Command',
        task: needsAttention ? 'needs attention' : 'daily synthesis briefing',
        cards_created: 1, approval_ids: approvalId ?? 'see queue',
        summary: needsAttention
          ? `Your Twin has identified something that needs your attention. Governance and Legal have cleared it. Review in your approval queue.`
          : `Your AI Twin has synthesized today's operations across ${itemsCount} items from your team. Your daily briefing is ready for review and approval.`,
        triggered_at: triggeredAt,
        review_url: 'https://app.druaiconsulting.com/admin-approvals',
        sms_body: sms,
        email_subject: subject,
        email_body: `${subject}\n\n${needsAttention ? 'Your Twin has identified something that needs your attention. It has cleared Governance and Legal review.' : `Your AI Team completed today's operations. Your Twin synthesized ${itemsCount} items across your divisions.`}\n\nReview and approve:\nhttps://app.druaiconsulting.com/admin-approvals\n\n— DRU AI Leadership Ecosystem™`,
      }),
    });
    console.log(`[twin] ✅ Notification sent`);
  } catch (error) {
    console.warn('[twin] Notification failed (non-fatal):', error);
  }
}

// ─────────────────────────────────────────────────────────────
// Standard dispatch to Travis Router (non-pipeline agents)
// ─────────────────────────────────────────────────────────────

async function dispatchToTravisRouter(route: AgentRoute, payload: TriggerPayload, triggeredAt: string, sourceLabel: string): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    await fetch(`${url}/functions/v1/travis-router`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ agent_id: route.agent_id, agent_name: route.agent_name, division: route.division, task: route.task, trigger_type: payload.trigger_type, source: sourceLabel, payload, triggered_at: triggeredAt }), signal: controller.signal });
    clearTimeout(timeout);
  } catch (error: unknown) {
    clearTimeout(timeout);
    if (!(error instanceof Error && error.name === 'AbortError')) console.error('[travis-router] Error:', error);
  }
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
  console.log(`[ghl-agent-trigger] ✅ ${route.agent_name} | ${route.division} | ${sourceLabel}`);

  // ── Command Layer ─────────────────────────────────────────
  if (route.pipeline === 'cmd_priya') {
    const csqId = await runPriya();
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: csqId, message: 'Priya executive briefing written to chief of staff queue' });

  } else if (route.pipeline === 'cmd_raymond') {
    const result = await runRaymond();
    res.status(202).json({ success: true, agent: route.agent_name, ...result, message: `Raymond reviewed ${result.reviewed} items, flagged ${result.needs_attention} for immediate attention` });

  } else if (route.pipeline === 'cmd_travis') {
    const organized = await runTravis();
    res.status(202).json({ success: true, agent: route.agent_name, organized, message: `Travis organized ${organized} items for governance review` });

  } else if (route.pipeline === 'cmd_governance') {
    const result = await runGovernanceLegal();
    res.status(202).json({ success: true, agent: route.agent_name, ...result, message: `Governance+Legal reviewed ${result.reviewed} items: ${result.cleared} cleared, ${result.blocked} blocked by Isabella` });

  } else if (route.pipeline === 'cmd_twin') {
    const result = await runTwinSynthesis();
    if (result.approval_id) {
      await sendTwinNotification(result.approval_id, result.items_synthesized, triggeredAt, false);
    }
    res.status(202).json({ success: true, agent: route.agent_name, ...result, message: `Twin synthesized ${result.items_synthesized} items into daily briefing` });

  // ── Pipeline 1 — Revenue ──────────────────────────────────
  } else if (route.pipeline === 'p1_omar') {
    const omar = await runOmar();
    const ryan = await runRyan(omar);
    res.status(202).json({ success: true, agent: route.agent_name, leads_scanned: omar.total_leads_scanned, high_intent: omar.high_intent_leads.length, crm_updates: ryan.crm_updates, message: 'Omar scored leads, Ryan updated CRM — output in chief of staff queue' });

  } else if (route.pipeline === 'p1_serena') {
    const id = await runAgentToCSQ('serena', 'Serena Jackson', 'Revenue & Growth', 'morning_coaching_briefing', 'coaching', `${GENIUS_MODE}\n\nYou are Serena Jackson, Business Coach for DRU AI Consulting — DeAnna R. Upshaw, AI Authority, CEO/Founder.

TRADEMARK REQUIREMENT: When referencing any DRU framework, ALWAYS include the ™ symbol: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™ (Discover→Diagnose→Design→Deploy→Dominate), 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.

Generate DeAnna's morning business coaching briefing. Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}. Include: strategic focus, coaching insight, mindset anchor, one actionable growth move. DeAnna is building the DRU AI Leadership Ecosystem™ toward launch.`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  } else if (route.pipeline === 'p1_mateo') {
    const id = await runAgentToCSQ('mateo', 'Mateo Gonzalez', 'Revenue & Growth', 'sales_pipeline_review', 'sales_support', `${GENIUS_MODE}\n\nYou are Mateo Gonzalez, Sales Support Agent for DRU AI Consulting. Generate a daily sales support briefing. Offers: Scorecard (free), Strategic Diagnostic ($3,497), Executive Diagnostic ($4,997), Course ($497–$1,497). Include: sales focus, pipeline health, follow-up actions, sales tip, objection handling.`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  } else if (route.pipeline === 'p1_aaliyah') {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    let leadContext = 'No lead data available today.';
    if (url && key) {
      const today = new Date().toISOString().split('T')[0];
      const r = await fetch(`${url}/rest/v1/chief_of_staff_queue?run_date=eq.${today}&agent_id=eq.ryan&order=created_at.desc&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      if (r.ok) { const d = await r.json(); if (d?.[0]?.raw_output) leadContext = d[0].raw_output; }
    }
    const id = await runAgentToCSQ('aaliyah', 'Aaliyah Foster', 'Revenue & Growth', 'personalized_outreach_messages', 'outreach', `${GENIUS_MODE}\n\nYou are Aaliyah Foster, Personalized Outreach Agent for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Brand: "AI Mastery. Leadership Clarity. Measurable Results."\n\nLead Intelligence from today:\n${leadContext}\n\nWrite personalized outreach for each high-intent lead — both a LinkedIn DM (150 words max) and an email (subject + 200 word body). If no high-intent leads, write a general warm outreach template.`, 'high');
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  } else if (route.pipeline === 'p1_jaylen') {
    const id = await runAgentToCSQ('jaylen', 'Jaylen Brooks', 'Revenue & Growth', 'email_campaign_content', 'email_marketing', `${GENIUS_MODE}\n\nYou are Jaylen Brooks, Email Marketing Agent for DRU AI Consulting. Generate today's email marketing content. Audience: executives navigating AI. Offers: DRU CLEAR™ Scorecard (free), Strategic Diagnostic ($3,497), Executive Diagnostic ($4,997), Course ($497–$1,497). Rotate daily: nurture email (Emerging/Developing/Advancing tier), re-engagement, or promotional. Include: subject line + A/B variant, preview text, body (300 words max), CTA. Personal tone, not mass-email. DeAnna's voice: authoritative, warm, strategic.`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  } else if (route.pipeline === 'p1_chloe') {
    const id = await runAgentToCSQ('chloe', 'Chloe Dubois', 'Revenue & Growth', 'daily_copy_asset', 'copywriting', `${GENIUS_MODE}\n\nYou are Chloe Dubois, Copy Writer for DRU AI Consulting. Generate one copy asset today. Rotate: ad copy (Facebook/Instagram/LinkedIn), landing page headline+subhead+hero, CTA button variations (5 options), or testimonial prompt template. Brand: "AI Mastery. Leadership Clarity. Measurable Results." Every word earns its place.`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  } else if (route.pipeline === 'p1_zara') {
    const id = await runAgentToCSQ('zara', 'Zara Ahmed', 'Revenue & Growth', 'product_launch_readiness', 'product_launch', `${GENIUS_MODE}\n\nYou are Zara Ahmed, Product Launch Agent for DRU AI Consulting. Generate weekly product launch readiness report. Offers: DRU CLEAR™ Scorecard (live), Strategic Diagnostic ($3,497), Executive Diagnostic ($4,997), From Confusion to Confident with AI™ (Sprint 4), Daily Connections tiers. Assess: launch readiness, marketing gaps, one improvement recommendation, pricing/positioning insight, next week priority.`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  } else if (route.pipeline === 'p1_elena') {
    const id = await runAgentToCSQ('elena', 'Elena Vasquez', 'Revenue & Growth', 'product_knowledge_update', 'product_knowledge', `${GENIUS_MODE}\n\nYou are Elena Vasquez, Product Knowledge Agent for DRU AI Consulting. Generate weekly product knowledge update. Include: 5 executive FAQs, offer comparison guide (when to recommend each), objection + response per offer, one positioning insight. Sales-ready, sharp, immediately usable.`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  } else if (route.pipeline === 'p1_kwame') {
    const id = await runAgentToCSQ('kwame', 'Kwame Asante', 'Revenue & Growth', 'proposal_template_update', 'proposals', `${GENIUS_MODE}\n\nYou are Kwame Asante, Proposal Writer for DRU AI Consulting. Generate weekly proposal update. Include: executive summary template for Executive Diagnostic ($4,997) in McKinsey-style, proposal outline for a C-suite client (financial services or healthcare), value proposition (3 versions: short/medium/long), one proposal best practice. Brand: DeAnna R. Upshaw — 25+ years IT, 10+ years leadership development, AI Authority.`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  // ── Pipeline 2 — Content & Brand ─────────────────────────
  } else if (route.pipeline === 'p2_camila') {
    const count = await runCamila();
    res.status(202).json({ success: true, agent: route.agent_name, posts_generated: count, message: `Camila generated ${count} posts in content_queue` });

  } else if (route.pipeline === 'p2_darius') {
    const id = await runDarius();
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  } else if (route.pipeline === 'p2_ravi') {
    const today = new Date().toISOString().split('T')[0];
    const id = await runAgentToCSQ('ravi', 'Ravi Gupta', 'Content & Brand', 'generate_design_brief', 'design_brief', `${GENIUS_MODE}\n\nYou are Ravi Gupta, Graphic Designer for DRU AI Consulting. Brand: Navy #0A2342, Gold #D4AF37, Magenta #C2185B. Fonts: Playfair Display (headlines), Inter (body). Generate creative design brief for today's LinkedIn visual. Include: visual concept, layout recommendation, color palette, image/illustration direction, typography guidance, AI image generation prompt (Midjourney/DALL-E ready). Today: ${today}. Scroll-stopping and brand-consistent.`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  } else if (route.pipeline === 'p2_yara') {
    const url2 = process.env.VITE_SUPABASE_URL;
    const key2 = process.env.SUPABASE_SERVICE_ROLE_KEY;
    let topPost = '';
    if (url2 && key2) {
      const monday = new Date(); monday.setDate(monday.getDate() - monday.getDay() + 1);
      const weekOf = monday.toISOString().split('T')[0];
      const r = await fetch(`${url2}/rest/v1/content_queue?week_of=eq.${weekOf}&status=neq.queued&order=day_number.asc&limit=1`, { headers: { apikey: key2, Authorization: `Bearer ${key2}` } });
      if (r.ok) { const q = await r.json(); if (q.length > 0) topPost = `${q[0].hook}\n\n${q[0].content}\n\n${q[0].hashtags}`; }
    }
    const id = await runAgentToCSQ('yara', 'Yara Mansour', 'Content & Brand', 'spanish_localization', 'localization', `${GENIUS_MODE}\n\nYou are Yara Mansour, Translator for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${topPost ? `Translate and localize this LinkedIn post for LATAM executives (Costa Rica, Dominican Republic, broader LATAM):\n\n${topPost}\n\nProvide: full Spanish translation, localization notes, translated hashtags.` : 'Write an original LinkedIn post in Spanish for LATAM executives navigating AI adoption.'}`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  } else if (route.pipeline === 'p2_ingrid') {
    const url3 = process.env.VITE_SUPABASE_URL;
    const key3 = process.env.SUPABASE_SERVICE_ROLE_KEY;
    let weekContent = '';
    if (url3 && key3) {
      const monday = new Date(); monday.setDate(monday.getDate() - monday.getDay() + 1);
      const weekOf = monday.toISOString().split('T')[0];
      const r = await fetch(`${url3}/rest/v1/content_queue?week_of=eq.${weekOf}&order=day_number.asc`, { headers: { apikey: key3, Authorization: `Bearer ${key3}` } });
      if (r.ok) { const posts = await r.json(); weekContent = posts.map((p: any) => `Day ${p.day_number} (${p.framework_covered}): ${p.hook}`).join('\n'); }
    }
    const id = await runAgentToCSQ('ingrid', 'Ingrid Larsen', 'Content & Brand', 'weekly_press_release', 'press_release', `${GENIUS_MODE}\n\nYou are Ingrid Larsen, Press Release Writer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority, CEO/Founder. This week's content: ${weekContent || 'AI leadership, DRU frameworks, executive AI adoption'}. Write a professional AP-style press release from the strongest story. Include: FOR IMMEDIATE RELEASE / Headline / Subheadline / Lead paragraph / Body (2-3 paragraphs with DeAnna quotes) / Boilerplate / Contact: druaiconsulting@gmail.com`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  // ── Standard dispatch ─────────────────────────────────────
  } else {
    await dispatchToTravisRouter(route, payload, triggeredAt, sourceLabel);
    res.status(202).json({ success: true, agent: route.agent_name, division: route.division, task: route.task, source: sourceLabel });
  }
}
