// ================================================================
// DRU AI Leadership Ecosystem™ — Autonomous Entry Point
// File: api/ghl-agent-trigger.ts
// Runtime: Vercel Node.js Serverless
//
// ALL AGENTS OPERATE IN GENIUS MODE
//
// FULL CHAIN:
//   Agents → chief_of_staff_queue (raw output)
//   Isabella (11:00am CDT) → trademark ™ + Classes 35/41/42 compliance gate
//     └─ Fails → back to agent (up to 2 corrections) → hard reject on 3rd fail
//   Governance Panel (11:10am CDT) → legal, financial, brand, privacy review
//   Command Layer — Priya/Raymond/Travis (11:20am CDT) → executive review
//   AI Twin (11:30am CDT) → synthesizes in DeAnna's voice
//   → approvals table → ONE notification to DeAnna
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
  retry_count?: number;
  correction_notes?: string;
  parent_csq_id?: string;
  raymond_notes?: string;
  raymond_action?: string;
  raymond_priority?: string;
  travis_notes?: string;
  priya_notes?: string;
  governance_notes?: string;
  legal_notes?: string;
  isabella_flags?: string;
  compliance_score?: number;
}

// ─────────────────────────────────────────────────────────────
// Agent Routing Map
// ─────────────────────────────────────────────────────────────

const AGENT_ROUTES: Record<string, AgentRoute> = {
  // Command Chain
  cron_isabella_review:          { agent_id: 'isabella',      agent_name: 'Isabella Moreno',      division: 'AI Governance',    task: 'trademark_compliance_review',   pipeline: 'cmd_isabella' },
  cron_governance_legal_review:  { agent_id: 'governance',    agent_name: 'Governance Panel',     division: 'AI Governance',    task: 'governance_panel_review',       pipeline: 'cmd_governance' },
  cron_command_layer:            { agent_id: 'command_layer', agent_name: 'Command Layer',        division: 'Command',          task: 'executive_review',              pipeline: 'cmd_command_layer' },
  cron_twin_synthesis:           { agent_id: 'twin',          agent_name: "DeAnna's AI Twin",     division: 'Command',          task: 'daily_synthesis_briefing',      pipeline: 'cmd_twin' },
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

// ─────────────────────────────────────────────────────────────
// SHARED — Anthropic call (Haiku — all agents and chain)
// ─────────────────────────────────────────────────────────────

async function callAnthropic(prompt: string, maxTokens = 2000): Promise<string> {
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
// SHARED — Anthropic call (Sonnet — Twin only)
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
// SHARED — Write final approval (Twin only)
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

async function runAgentToCSQ(
  agentId: string, agentName: string, division: string, task: string,
  category: string, prompt: string, priority = 'normal',
  retryCount = 0, parentCsqId: string | null = null, maxTokens = 1500
): Promise<string | null> {
  try {
    const output = await callAnthropic(`${GENIUS_MODE}\n\n${prompt}`, maxTokens);
    return await writeToCSQ({
      agent_id: agentId, agent_name: agentName, division, task, category,
      raw_output: output, priority, status: 'pending',
      retry_count: retryCount,
      ...(parentCsqId ? { parent_csq_id: parentCsqId } : {}),
    });
  } catch (error) {
    console.error(`[${agentId}] Error:`, error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// SHARED — Correction agent re-trigger
// Called by Isabella when content fails compliance
// Agent receives their original output + Isabella's exact correction notes
// Creates a NEW CSQ entry so full audit trail is preserved
// ─────────────────────────────────────────────────────────────

async function runCorrectionAgent(item: CSQItem, correctionNotes: string, newRetryCount: number): Promise<void> {
  try {
    const correctionPrompt = `${GENIUS_MODE}

You are ${item.agent_name}, working for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.

Your previous submission for task "${item.task}" was returned by Isabella Moreno, Director of Compliance, with the following corrections required:

ISABELLA'S CORRECTION NOTES:
${correctionNotes}

YOUR PREVIOUS OUTPUT (for reference):
${item.raw_output}

Produce a corrected version that fully addresses every point in Isabella's feedback. This is not a downgrade — it is an upgrade. Maintain full Genius Mode quality.

COMPLIANCE REQUIREMENTS (non-negotiable):
- All DRU framework names MUST include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™
- All content must stay within DRU AI Consulting's service classes:
  Class 35: Business consulting, AI strategy, leadership advisory
  Class 41: Training, coaching, educational services
  Class 42: AI technology consulting, software-related services`;

    const output = await callAnthropic(correctionPrompt, 1500);
    await writeToCSQ({
      agent_id: item.agent_id,
      agent_name: item.agent_name,
      division: item.division,
      task: item.task,
      category: item.category,
      raw_output: output,
      priority: item.priority,
      status: 'pending',
      retry_count: newRetryCount,
      parent_csq_id: item.id,
      correction_notes: correctionNotes,
    });
    console.log(`[isabella] ✅ Correction triggered for ${item.agent_name} (attempt ${newRetryCount})`);
  } catch (error) {
    console.error(`[isabella] Correction agent failed for ${item.agent_name}:`, error);
  }
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
    const text = await callAnthropic(`${GENIUS_MODE}\n\nYou are Omar Patel, Lead Scoring Agent for DRU AI Consulting. Score each lead 1–10 based on seniority, business context, source quality, and engagement.

Every high-intent lead's recommended_action should direct them to the DRU CLEAR™ AI Readiness Scorecard at assessment.druaiconsulting.com — this is where they enter the ecosystem. GHL workflows handle everything after they complete it.

Return ONLY a JSON array:
[{"contact_id":"...","name":"...","email":"...","phone":"...","source":"...","score":8,"intent_level":"high","recommended_action":"Invite to DRU CLEAR™ AI Readiness Scorecard — assessment.druaiconsulting.com","notes":"..."}]
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
    const csq_id = await writeToCSQ({ agent_id: 'ryan', agent_name: 'Ryan Nakamura', division: 'Revenue & Growth', task: 'overnight_crm_sync', category: 'lead_intelligence', raw_output: '**Daily Lead Intelligence — No New Leads**\n\nOmar scanned GHL and found no new contacts in the last 24 hours. No CRM updates required.\n\nNext scan: tomorrow at 8:00am CDT.', priority: 'normal', status: 'pending', retry_count: 0 });
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
Include: executive summary, high-intent leads with specific actions (all directed to assessment.druaiconsulting.com), CRM updates completed, strategic next steps.`);
  const csq_id = await writeToCSQ({ agent_id: 'ryan', agent_name: 'Ryan Nakamura', division: 'Revenue & Growth', task: 'overnight_crm_sync', category: 'lead_intelligence', raw_output: briefing, priority: omarResult.high_intent_leads.length > 0 ? 'high' : 'normal', status: 'pending', retry_count: 0 });
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

Generate 5 LinkedIn posts (Mon–Fri). Day 1: thought_leadership | Day 2: educational | Day 3: engagement | Day 4: story_insight | Day 5: soft_promotional. Each: compelling hook, 150–250 words, one framework, a natural CTA that leads to assessment.druaiconsulting.com, 3–5 hashtags.
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
    postContent = await callAnthropic(`${GENIUS_MODE}\n\nYou are Darius King, Viral Scripter for DRU AI Consulting. Write ONE LinkedIn post that stops executives mid-scroll. Brand: "AI Mastery. Leadership Clarity. Measurable Results." Use a ™ framework. 150–250 words. End with a CTA that naturally points to assessment.druaiconsulting.com. 3–5 hashtags. Sound like DeAnna R. Upshaw — AI Authority.`);
  }
  const csqId = await writeToCSQ({ agent_id: 'darius', agent_name: 'Darius King', division: 'Content & Brand', task: 'generate_daily_linkedin_post', category: 'linkedin_post', raw_output: postContent, priority: 'normal', status: 'pending', retry_count: 0 });
  if (queueId && url && key) {
    await fetch(`${url}/rest/v1/content_queue?id=eq.${queueId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ status: 'submitted', submitted_at: new Date().toISOString() }) });
  }
  return csqId;
}

// ─────────────────────────────────────────────────────────────
// COMMAND CHAIN — ISABELLA MORENO (Director of Compliance)
// First gate — fires at 11:00am CDT
// Checks all pending CSQ items for:
//   1. ™ on every DRU proprietary mark
//   2. Content stays within Classes 35, 41, 42
// Fails → back to agent (up to 2 corrections) → hard reject on 3rd fail
// ─────────────────────────────────────────────────────────────

async function runIsabella(): Promise<{ reviewed: number; cleared: number; sent_back: number; rejected: number }> {
  const pending = await getCSQItems('pending');
  console.log(`[isabella] Reviewing ${pending.length} pending items...`);
  if (pending.length === 0) return { reviewed: 0, cleared: 0, sent_back: 0, rejected: 0 };

  let cleared = 0;
  let sentBack = 0;
  let rejected = 0;

  for (const item of pending) {
    try {
      const raw = await callTwin(
        `${GENIUS_MODE}

You are Isabella Moreno, Director of Compliance for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.

YOUR RESPONSIBILITIES:
1. Verify every DRU proprietary framework name includes the ™ symbol
2. Verify all content stays within DeAnna's registered trademark service classes:
   - Class 35: Business consulting, AI strategy, leadership advisory, business management
   - Class 41: Training, coaching, educational services, workshops, seminars
   - Class 42: AI technology consulting, software-related services, technology strategy
3. Flag any content that steps outside these classes or misrepresents DRU's services

DRU PROPRIETARY MARKS (must always appear with ™):
DRU CLEAR™ | DRU AI Leadership Ecosystem™ | DRU AI Transformation Pathway™ | 5C Cultural DNA™ | 5D Leadership™ | AI Sales Mastery™ | From Confusion to Confident with AI™

CLEARING STANDARD:
- If all DRU marks appear with ™ AND content is within Classes 35/41/42 → cleared:true
- If a DRU mark appears WITHOUT ™ → cleared:false, state exactly which mark and where
- If content falls outside Classes 35/41/42 → cleared:false, state exactly what falls outside

AGENT: ${item.agent_name} | TASK: ${item.task}
CONTENT:
${item.raw_output}

Complete your review internally. Then output ONLY this JSON — nothing before it, nothing after it:
{"cleared":true,"flags":"none","correction_notes":"Content reviewed. All marks correct. Within Classes 35/41/42."}
OR if corrections needed:
{"cleared":false,"flags":"specific issue here","correction_notes":"Exact instruction for the agent to correct this"}`, 600
      );

      const result = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? 'null');

      if (result.cleared) {
        cleared++;
        await updateCSQ(item.id, {
          isabella_flags: result.flags ?? 'none',
          isabella_cleared_at: new Date().toISOString(),
          status: 'isabella_cleared',
        });
      } else {
        const retryCount = item.retry_count ?? 0;
        if (retryCount >= 2) {
          rejected++;
          await updateCSQ(item.id, {
            isabella_flags: result.flags,
            correction_notes: result.correction_notes,
            governance_cleared: false,
            status: 'rejected',
          });
          console.warn(`[isabella] ⛔ HARD REJECT (3rd fail): ${item.agent_name} — ${result.flags}`);
        } else {
          sentBack++;
          await updateCSQ(item.id, {
            isabella_flags: result.flags,
            correction_notes: result.correction_notes,
            status: 'needs_correction',
          });
          await runCorrectionAgent(item, result.correction_notes, retryCount + 1);
          console.log(`[isabella] 🔄 Sent back to ${item.agent_name} (attempt ${retryCount + 1})`);
        }
      }
    } catch (error) {
      console.error(`[isabella] Failed item ${item.id}:`, error);
    }
  }

  console.log(`[isabella] ✅ ${pending.length} reviewed: ${cleared} cleared, ${sentBack} sent back, ${rejected} hard rejected`);
  return { reviewed: pending.length, cleared, sent_back: sentBack, rejected };
}

// ─────────────────────────────────────────────────────────────
// COMMAND CHAIN — GOVERNANCE PANEL (11:10am CDT)
// Processes all isabella_cleared items
// Content type determined by CODE from category field — NOT by Haiku
// Internal categories → 4 blocking conditions only
// Client-facing categories → 5 blocking conditions only
// ─────────────────────────────────────────────────────────────

// Categories the CODE classifies as internal (never published, Twin eyes only)
const INTERNAL_CATEGORIES = [
  'coaching',
  'sales_support',
  'lead_intelligence',
  'proposals',
  'product_knowledge',
  'product_launch',
];

// Categories the CODE classifies as client-facing (published or sent to clients)
const CLIENT_FACING_CATEGORIES = [
  'linkedin_post',
  'email_marketing',
  'outreach',
  'copywriting',
  'press_release',
  'localization',
  'design_brief',
];

async function runGovernancePanel(): Promise<{ reviewed: number; cleared: number; blocked: number }> {
  const items = await getCSQItems('isabella_cleared');
  console.log(`[governance] Reviewing ${items.length} Isabella-cleared items...`);
  if (items.length === 0) return { reviewed: 0, cleared: 0, blocked: 0 };

  let cleared = 0;
  let blocked = 0;
  const updates: Promise<void>[] = [];

  for (const item of items) {
    try {
      // ── Content type determined by CODE — Haiku never decides ──
      const isInternal = INTERNAL_CATEGORIES.includes(item.category);
      const isClientFacing = CLIENT_FACING_CATEGORIES.includes(item.category);

      let rulesBlock = '';

      if (isInternal) {
        rulesBlock = `This is INTERNAL OPERATIONAL CONTENT (category: ${item.category}).
It goes to DeAnna's AI Twin only. It is never published and never sent to clients.

BLOCK ONLY IF one of these four specific conditions is present in the content:
1. A specific factual error that would mislead DeAnna — wrong offer pricing, wrong date, wrong contact information
2. A false credential claim — content states DeAnna holds a certification or affiliation she does not have
3. A named contractual obligation — content makes a binding promise to a specific named person or company
4. A demonstrably false financial figure — a specific dollar amount contradicting known offer pricing:
   Strategic Diagnostic $3,497 | Executive Diagnostic $4,997 | Course $497–$1,497

If NONE of those four conditions are present, you MUST return cleared:true.
Coaching philosophy, motivational language, sales strategy, bold recommendations, and aspirational framing are the intended purpose of this content and SHALL PASS without exception.`;
      } else if (isClientFacing) {
        rulesBlock = `This is CLIENT-FACING CONTENT (category: ${item.category}).
It will be published or sent directly to clients or the public.

BLOCK ONLY IF one of these five specific conditions is present in the content:
1. A specific income guarantee without disclaimer — e.g. "you will earn $X" or "guaranteed results"
2. A false credential claim about DeAnna
3. A named privacy violation — specific personal data of a real identifiable person exposed
4. A specific contractual guarantee creating legal liability to a named party
5. A specific false financial figure contradicting known offer pricing:
   Strategic Diagnostic $3,497 | Executive Diagnostic $4,997 | Course $497–$1,497

If NONE of those five conditions are present, you MUST return cleared:true.`;
      } else {
        // Unknown category — default to internal rules (safe pass)
        rulesBlock = `This content has an unclassified category. Apply internal content rules.

BLOCK ONLY IF one of these four specific conditions is present:
1. A specific factual error that would mislead DeAnna
2. A false credential claim about DeAnna
3. A named contractual obligation to a specific person or company
4. A specific false financial figure contradicting known offer pricing:
   Strategic Diagnostic $3,497 | Executive Diagnostic $4,997 | Course $497–$1,497

If NONE of those conditions are present, you MUST return cleared:true.`;
      }

      const raw = await callAnthropic(
        `${GENIUS_MODE}

You are the AI Governance and Legal & Finance panel for DRU AI Consulting.

CRITICAL: Isabella Moreno has already cleared this content for trademark and service class compliance. Her clearance is FINAL. Do NOT re-check trademarks or class alignment.

${rulesBlock}

AGENT: ${item.agent_name} | DIVISION: ${item.division} | CATEGORY: ${item.category} | TASK: ${item.task}
CONTENT:
${item.raw_output}

Review the content against the blocking conditions above. Then output ONLY this JSON — nothing before it, nothing after it:

If cleared (no blocking condition found):
{"cleared":true,"compliance_score":9,"governance_notes":"Panel reviewed. No blocking conditions present.","legal_notes":"No legal risk detected.","flags":"none"}

If blocked (ONLY if a specific named condition above is present — state exactly which condition number):
{"cleared":false,"compliance_score":3,"governance_notes":"Condition [NUMBER] violated: [exact text from content that triggered this]","legal_notes":"[specific issue]","flags":"[exact phrase from content]"}`, 800
      );

      const result = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? 'null');
      if (!result) throw new Error('Governance response could not be parsed');

      if (result.cleared) {
        cleared++;
        updates.push(updateCSQ(item.id, {
          governance_cleared: true,
          compliance_score: result.compliance_score ?? 8,
          governance_notes: result.governance_notes ?? '',
          legal_notes: result.legal_notes ?? '',
          governance_flags: result.flags ?? 'none',
          governance_cleared_at: new Date().toISOString(),
          status: 'governance_cleared',
        }));
      } else {
        blocked++;
        updates.push(updateCSQ(item.id, {
          governance_cleared: false,
          governance_notes: result.governance_notes ?? 'Blocked by governance panel',
          governance_flags: result.flags ?? 'review_failed',
          governance_cleared_at: new Date().toISOString(),
          status: 'rejected',
        }));
      }
    } catch (error) {
      console.error(`[governance] Failed item ${item.id}:`, error);
      blocked++;
      updates.push(updateCSQ(item.id, {
        governance_cleared: false,
        governance_notes: 'Governance review failed — flagged for manual review.',
        governance_cleared_at: new Date().toISOString(),
        status: 'governance_error',
      }));
    }
  }

  await Promise.all(updates);
  console.log(`[governance] ✅ ${items.length} reviewed: ${cleared} cleared, ${blocked} blocked`);
  return { reviewed: items.length, cleared, blocked };
}

// ─────────────────────────────────────────────────────────────
// COMMAND CHAIN — COMMAND LAYER (11:20am CDT)
// Priya/Raymond/Travis work together on all governance_cleared items
// Raymond: Chief of Staff — strategic priority and direction
// Travis: Assistant Chief of Staff — organizes and packages
// Priya: Executive Assistant — executive context and time-sensitive flags
// ─────────────────────────────────────────────────────────────

async function runCommandLayer(): Promise<{ reviewed: number }> {
  const items = await getCSQItems('governance_cleared');
  console.log(`[command_layer] Reviewing ${items.length} governance-cleared items...`);
  if (items.length === 0) return { reviewed: 0 };

  const updates: Promise<void>[] = [];

  for (const item of items) {
    try {
      const rawRaymond = await callAnthropic(
        `${GENIUS_MODE}

You are Raymond Holloway, Chief of Staff for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. This content has been cleared by Isabella (trademark compliance) and the Governance Panel (legal/financial). Your job is to assess strategic priority and determine how this reaches DeAnna's Twin for synthesis.

AGENT: ${item.agent_name} (${item.division})
TASK: ${item.task}
CONTENT: ${item.raw_output}

Complete your review internally. Then output ONLY this JSON — nothing before it, nothing after it:
{"priority":"normal","action":"route_to_twin","notes":"one strategic sentence for the Twin"}`, 400
      );
      const raymond = JSON.parse(rawRaymond.match(/\{[\s\S]*\}/)?.[0] ?? 'null');

      const rawTravis = await callAnthropic(
        `${GENIUS_MODE}

You are Travis Weston, Assistant Chief of Staff for DRU AI Consulting. Raymond Holloway (Chief of Staff) has assessed this item. Your job is to organize and package it cleanly for the AI Twin's synthesis.

AGENT: ${item.agent_name} | RAYMOND'S NOTES: ${raymond.notes ?? ''}
CONTENT: ${item.raw_output}

Complete your review internally. Then output ONLY this JSON — nothing before it, nothing after it:
{"organized":true,"package_notes":"one sentence describing how this fits into today's briefing"}`, 400
      );
      const travis = JSON.parse(rawTravis.match(/\{[\s\S]*\}/)?.[0] ?? 'null');

      const rawPriya = await callAnthropic(
        `${GENIUS_MODE}

You are Priya Sharma, Executive Assistant to DeAnna R. Upshaw — AI Authority, CEO/Founder of DRU AI Consulting. Raymond and Travis have reviewed this item. Your job is to add executive context — flag anything time-sensitive, note calendar implications, or surface anything DeAnna needs to act on personally today.

AGENT: ${item.agent_name} | TASK: ${item.task}
CONTENT: ${item.raw_output}

In 1–2 sentences, add your executive perspective. Flag if this needs DeAnna's personal attention today.`, 200
      );

      updates.push(updateCSQ(item.id, {
        raymond_reviewed: true,
        raymond_notes: raymond.notes ?? '',
        raymond_priority: raymond.priority ?? 'normal',
        raymond_action: raymond.action ?? 'route_to_twin',
        travis_notes: travis.package_notes ?? '',
        priya_notes: rawPriya.trim(),
        command_approved_at: new Date().toISOString(),
        status: 'command_approved',
        priority: raymond.priority ?? 'normal',
      }));
    } catch (error) {
      console.error(`[command_layer] Failed item ${item.id}:`, error);
    }
  }

  await Promise.all(updates);
  console.log(`[command_layer] ✅ ${items.length} items command-approved`);
  return { reviewed: items.length };
}

// ─────────────────────────────────────────────────────────────
// COMMAND CHAIN — AI TWIN SYNTHESIS (11:30am CDT)
// Reads all command_approved items
// Synthesizes in DeAnna's voice using Sonnet
// Writes ONE consolidated briefing to approvals table
// Sends ONE notification to DeAnna
// ─────────────────────────────────────────────────────────────

async function runTwinSynthesis(): Promise<{ approval_id: string | null; items_synthesized: number }> {
  const items = await getCSQItems('command_approved');
  console.log(`[twin] Synthesizing ${items.length} command-approved items...`);

  if (items.length === 0) {
    console.log('[twin] No command-approved items to synthesize today.');
    return { approval_id: null, items_synthesized: 0 };
  }

  const byDivision: Record<string, CSQItem[]> = {};
  for (const item of items) {
    if (!byDivision[item.division]) byDivision[item.division] = [];
    byDivision[item.division].push(item);
  }

  const divisionSummaries = Object.entries(byDivision).map(([div, divItems]) =>
    `**${div}:**\n${divItems.map(i => `• ${i.agent_name} (${i.task.replace(/_/g, ' ')}): ${i.raw_output.slice(0, 300)}...\n  Raymond: ${i.raymond_notes ?? ''} | Priya: ${i.priya_notes ?? ''}`).join('\n')}`
  ).join('\n\n');

  const synthesis = await callTwin(`You are DeAnna R. Upshaw's AI Twin — the Master Orchestrator of DRU AI Consulting. You speak with authority, clarity, and strategic precision in DeAnna's voice.

Your team has completed today's operations. Isabella cleared all content for trademark compliance and class alignment. The Governance Panel cleared everything legally and financially. Your Command Layer — Raymond, Travis, and Priya — have reviewed, prioritized, and packaged everything. You are now synthesizing the day's work into ONE executive briefing for DeAnna's review and approval.

BRAND PRINCIPLE: "AI Mastery. Leadership Clarity. Measurable Results."
FRAMEWORKS (always ™): DRU CLEAR™ | DRU AI Leadership Ecosystem™ | DRU AI Transformation Pathway™ | 5C Cultural DNA™ | 5D Leadership™ | AI Sales Mastery™ | From Confusion to Confident with AI™

TODAY'S EXACT DATE: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' })} — use this exact date in the briefing header, no other date.

TODAY'S COMMAND-APPROVED OPERATIONS:
${divisionSummaries}

Synthesize into ONE executive briefing in DeAnna's voice:

## Daily Operations Briefing — ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' })}

**Executive Summary** (3–4 sentences in first person — "My team has..." — strategic overview)

**Revenue & Growth** (lead intelligence, sales activity, outreach)

**Content & Brand** (today's content, design, press)

**Decisions Needed** (anything requiring DeAnna's personal action today)

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

  for (const item of items) {
    await updateCSQ(item.id, {
      twin_processed: true,
      twin_synthesis: synthesis.slice(0, 500),
      approval_id: approvalId,
      twin_processed_at: new Date().toISOString(),
      status: 'twin_processed',
    });
  }

  console.log(`[twin] ✅ Daily briefing synthesized | approval_id: ${approvalId}`);
  return { approval_id: approvalId, items_synthesized: items.length };
}

// ─────────────────────────────────────────────────────────────
// Notification — sent ONLY after Twin synthesis
// ─────────────────────────────────────────────────────────────

async function sendTwinNotification(approvalId: string | null, itemsCount: number, triggeredAt: string): Promise<void> {
  const webhookUrl = process.env.GHL_NOTIFICATION_WEBHOOK_URL;
  if (!webhookUrl) return;
  const subject = `DRU AI Ecosystem™ — Your Daily Briefing Is Ready`;
  const sms = `DRU AI™ | Your daily briefing is ready. ${itemsCount} items cleared by Isabella, Governance, and your Command Layer.\n\nReview: app.druaiconsulting.com/admin-approvals`;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'druaiconsulting@gmail.com', phone: '+19796186671',
        first_name: 'DeAnna', last_name: 'Upshaw',
        agent_name: "DeAnna's AI Twin", division: 'Command',
        task: 'daily synthesis briefing',
        cards_created: 1, approval_ids: approvalId ?? 'see queue',
        summary: `Your AI Twin has synthesized today's operations. ${itemsCount} items cleared through Isabella, Governance, and your Command Layer. Your daily briefing is ready for review and approval.`,
        triggered_at: triggeredAt,
        review_url: 'https://app.druaiconsulting.com/admin-approvals',
        sms_body: sms,
        email_subject: subject,
        email_body: `${subject}\n\nYour AI Team completed today's operations. ${itemsCount} items cleared through the full chain.\n\nReview and approve:\nhttps://app.druaiconsulting.com/admin-approvals\n\n— DRU AI Leadership Ecosystem™`,
      }),
    });
    console.log(`[twin] ✅ Notification sent`);
  } catch (error) {
    console.warn('[twin] Notification failed (non-fatal):', error);
  }
}

// ─────────────────────────────────────────────────────────────
// Standard dispatch to Travis Router (fallback)
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cron-secret');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
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

  // ── Command Chain ─────────────────────────────────────────
  if (route.pipeline === 'cmd_isabella') {
    const result = await runIsabella();
    res.status(202).json({ success: true, agent: route.agent_name, ...result, message: `Isabella reviewed ${result.reviewed} items: ${result.cleared} cleared, ${result.sent_back} sent back for correction, ${result.rejected} hard rejected` });

  } else if (route.pipeline === 'cmd_governance') {
    const result = await runGovernancePanel();
    res.status(202).json({ success: true, agent: route.agent_name, ...result, message: `Governance Panel reviewed ${result.reviewed} items: ${result.cleared} cleared, ${result.blocked} blocked` });

  } else if (route.pipeline === 'cmd_command_layer') {
    const result = await runCommandLayer();
    res.status(202).json({ success: true, agent: route.agent_name, ...result, message: `Command Layer (Priya/Raymond/Travis) reviewed ${result.reviewed} items` });

  } else if (route.pipeline === 'cmd_twin') {
    const result = await runTwinSynthesis();
    if (result.approval_id) {
      await sendTwinNotification(result.approval_id, result.items_synthesized, triggeredAt);
    }
    res.status(202).json({ success: true, agent: route.agent_name, ...result, message: `Twin synthesized ${result.items_synthesized} items into daily briefing` });

  // ── Pipeline 1 — Revenue ──────────────────────────────────
  } else if (route.pipeline === 'p1_omar') {
    const omar = await runOmar();
    const ryan = await runRyan(omar);
    res.status(202).json({ success: true, agent: route.agent_name, leads_scanned: omar.total_leads_scanned, high_intent: omar.high_intent_leads.length, crm_updates: ryan.crm_updates, message: 'Omar scored leads, Ryan updated CRM — output in chief of staff queue' });

  } else if (route.pipeline === 'p1_serena') {
    const id = await runAgentToCSQ('serena', 'Serena Jackson', 'Revenue & Growth', 'morning_coaching_briefing', 'coaching',
      `You are Serena Jackson, Business Coach for DRU AI Consulting — DeAnna R. Upshaw, AI Authority, CEO/Founder.
TRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™ (Discover→Diagnose→Design→Deploy→Dominate), 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.
Generate DeAnna's morning business coaching briefing. Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' })}. Include: strategic focus, coaching insight, mindset anchor, one actionable growth move. DeAnna is building the DRU AI Leadership Ecosystem™ toward launch.`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  } else if (route.pipeline === 'p1_mateo') {
    const id = await runAgentToCSQ('mateo', 'Mateo Gonzalez', 'Revenue & Growth', 'sales_pipeline_review', 'sales_support',
      `You are Mateo Gonzalez, Sales Support Agent for DRU AI Consulting. Generate a daily sales support briefing.

TERMINOLOGY (use precisely):
- Assessment: the tool clients take at assessment.druaiconsulting.com to evaluate their AI readiness
- DRU CLEAR™ Scorecard: the personalized results report clients receive after completing the assessment
- Diagnostics (Strategic Diagnostic $3,497 / Executive Diagnostic $4,997): components of DeAnna's consulting services, not standalone products

OFFERS (frame all as consulting service components):
- DRU CLEAR™ AI Readiness Assessment (free) — entry point at assessment.druaiconsulting.com
- Strategic Diagnostic ($3,497) — consulting engagement component
- Executive Diagnostic ($4,997) — consulting engagement component
- From Confusion to Confident with AI™ Course ($497–$1,497) — educational service component

Include: sales focus, pipeline health, follow-up actions, sales tip, objection handling. All new leads directed to assessment.druaiconsulting.com first.`, 'normal', 0, null, 3000);
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
    const id = await runAgentToCSQ('aaliyah', 'Aaliyah Foster', 'Revenue & Growth', 'personalized_outreach_messages', 'outreach',
      `You are Aaliyah Foster, Personalized Outreach Agent for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Brand: "AI Mastery. Leadership Clarity. Measurable Results."
Write personalized outreach for each high-intent lead — both a LinkedIn DM (150 words max) and an email (subject + 200 word body). Use your creative voice to connect genuinely. Each message should naturally mention the DRU CLEAR™ AI Readiness Scorecard and include assessment.druaiconsulting.com as the next step. If no high-intent leads, write a warm outreach template.
Lead Intelligence from today:\n${leadContext}`, 'high');
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  } else if (route.pipeline === 'p1_jaylen') {
    const id = await runAgentToCSQ('jaylen', 'Jaylen Brooks', 'Revenue & Growth', 'email_campaign_content', 'email_marketing',
      `You are Jaylen Brooks, Email Marketing Agent for DRU AI Consulting. Generate today's email marketing content. Audience: executives navigating AI. Offers: DRU CLEAR™ Scorecard (free), Strategic Diagnostic ($3,497), Executive Diagnostic ($4,997), Course ($497–$1,497).
Rotate daily: nurture email (Emerging/Developing/Advancing tier), re-engagement, or promotional. Include: subject line + A/B variant, preview text, body (300 words max). Use your creative voice — each email should feel personal, not mass-market. Naturally work in the DRU CLEAR™ AI Readiness Scorecard and assessment.druaiconsulting.com as the CTA. DeAnna's voice: authoritative, warm, strategic.`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  } else if (route.pipeline === 'p1_chloe') {
    const id = await runAgentToCSQ('chloe', 'Chloe Dubois', 'Revenue & Growth', 'daily_copy_asset', 'copywriting',
      `You are Chloe Dubois, Copy Writer for DRU AI Consulting. Generate one copy asset today. Rotate: ad copy (Facebook/Instagram/LinkedIn), landing page headline+subhead+hero, CTA button variations (5 options), or testimonial prompt template. Brand: "AI Mastery. Leadership Clarity. Measurable Results." Use your full creative range — sharp, distinctive, nothing generic. Naturally include assessment.druaiconsulting.com as the destination. Every word earns its place.`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  } else if (route.pipeline === 'p1_zara') {
    const id = await runAgentToCSQ('zara', 'Zara Ahmed', 'Revenue & Growth', 'product_launch_readiness', 'product_launch',
      `You are Zara Ahmed, Product Launch Agent for DRU AI Consulting. Generate weekly product launch readiness report. Offers: DRU CLEAR™ Scorecard (live at assessment.druaiconsulting.com — primary funnel entry), Strategic Diagnostic ($3,497), Executive Diagnostic ($4,997), From Confusion to Confident with AI™ (Sprint 4), Daily Connections tiers. Assess: launch readiness, marketing gaps, one improvement recommendation, pricing/positioning insight, next week priority.`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  } else if (route.pipeline === 'p1_elena') {
    const id = await runAgentToCSQ('elena', 'Elena Vasquez', 'Revenue & Growth', 'product_knowledge_update', 'product_knowledge',
      `You are Elena Vasquez, Product Knowledge Agent for DRU AI Consulting. Generate weekly product knowledge update. Include: 5 executive FAQs, offer comparison guide (when to recommend each — all starting with assessment.druaiconsulting.com as the entry point), objection + response per offer, one positioning insight. Sales-ready, sharp, immediately usable.`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  } else if (route.pipeline === 'p1_kwame') {
    const id = await runAgentToCSQ('kwame', 'Kwame Asante', 'Revenue & Growth', 'proposal_template_update', 'proposals',
      `You are Kwame Asante, Proposal Writer for DRU AI Consulting. Generate weekly proposal update. Include: executive summary template for Executive Diagnostic ($4,997) in McKinsey-style, proposal outline for a C-suite client (financial services or healthcare), value proposition (3 versions: short/medium/long), one proposal best practice. Brand: DeAnna R. Upshaw — 25+ years IT, 10+ years leadership development, AI Authority.`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  // ── Pipeline 2 — Content & Brand ─────────────────────────
  } else if (route.pipeline === 'p2_camila') {
    const count = await runCamila();
    res.status(202).json({ success: true, agent: route.agent_name, posts_generated: count, message: `Camila generated ${count} posts in content_queue` });

  } else if (route.pipeline === 'p2_darius') {
    const id = await runDarius();
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  } else if (route.pipeline === 'p2_ravi') {
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
    const id = await runAgentToCSQ('ravi', 'Ravi Gupta', 'Content & Brand', 'generate_design_brief', 'design_brief',
      `You are Ravi Gupta, Graphic Designer for DRU AI Consulting. Brand: Navy #0A2342, Gold #D4AF37, Magenta #C2185B. Fonts: Playfair Display (headlines), Inter (body). Generate creative design brief for today's LinkedIn visual. Include: visual concept, layout recommendation, color palette, image/illustration direction, typography guidance, AI image generation prompt (Midjourney/DALL-E ready). Today: ${today}. Use your full creative freedom — scroll-stopping and brand-consistent. In the CTA section of the brief, include assessment.druaiconsulting.com as the destination.`);
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
    const id = await runAgentToCSQ('yara', 'Yara Mansour', 'Content & Brand', 'spanish_localization', 'localization',
      `You are Yara Mansour, Translator for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${topPost ? `Translate and localize this LinkedIn post for LATAM executives (Costa Rica, Dominican Republic, broader LATAM):\n\n${topPost}\n\nProvide: full Spanish translation, localization notes, translated hashtags. Ensure assessment.druaiconsulting.com remains in the translated CTA.` : 'Write an original LinkedIn post in Spanish for LATAM executives navigating AI adoption. Include assessment.druaiconsulting.com as the CTA.'}`);
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
    const id = await runAgentToCSQ('ingrid', 'Ingrid Larsen', 'Content & Brand', 'weekly_press_release', 'press_release',
      `You are Ingrid Larsen, Press Release Writer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority, CEO/Founder. This week's content: ${weekContent || 'AI leadership, DRU frameworks, executive AI adoption'}. Write a professional AP-style press release from the strongest story. Include: FOR IMMEDIATE RELEASE / Headline / Subheadline / Lead paragraph / Body (2-3 paragraphs with DeAnna quotes) / Boilerplate mentioning assessment.druaiconsulting.com / Contact: druaiconsulting@gmail.com`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  // ── Standard dispatch ─────────────────────────────────────
  } else {
    await dispatchToTravisRouter(route, payload, triggeredAt, sourceLabel);
    res.status(202).json({ success: true, agent: route.agent_name, division: route.division, task: route.task, source: sourceLabel });
  }
}
