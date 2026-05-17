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
//   AI Twin (11:30am CDT) → ONE card per division + social cards
//   → approvals table → ONE notification per card
//
// APPROVAL CARDS:
//   daily_briefing   — Executive Summary + Decisions Needed + Tomorrow's Priorities
//   revenue_growth   — Pipeline 1 (daily)
//   content_brand    — Pipeline 2 (daily)
//   marketing        — Pipeline 3 (daily)
//   legal_finance    — Pipeline 4 (Tuesdays)
//   ai_governance    — Pipeline 5 (Mondays)
//   hr               — Pipeline 6 (Wednesdays)
//   client_delivery  — Pipeline 7 (daily)
//   customer_support — Pipeline 8 (daily)
//   social           — Content & Brand + Marketing client-facing outputs
// ================================================================

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION_ID = 'gl07I4JnbkGgW8zJprSz';

export const config = { maxDuration: 60 };

// ─────────────────────────────────────────────────────────────
// GENIUS MODE
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
  cron_isabella_review:          { agent_id: 'isabella',      agent_name: 'Isabella Moreno',      division: 'AI Governance',    task: 'trademark_compliance_review',   pipeline: 'cmd_isabella' },
  cron_governance_legal_review:  { agent_id: 'governance',    agent_name: 'Governance Panel',     division: 'AI Governance',    task: 'governance_panel_review',       pipeline: 'cmd_governance' },
  cron_command_layer:            { agent_id: 'command_layer', agent_name: 'Command Layer',        division: 'Command',          task: 'executive_review',              pipeline: 'cmd_command_layer' },
  cron_twin_synthesis:           { agent_id: 'twin',          agent_name: "DeAnna's AI Twin",     division: 'Command',          task: 'daily_synthesis_briefing',      pipeline: 'cmd_twin' },
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
  cron_camila_linkedin_queue:    { agent_id: 'camila',     agent_name: 'Camila Flores',        division: 'Content & Brand',  task: 'generate_weekly_linkedin_queue', pipeline: 'p2_camila' },
  cron_darius_linkedin_post:     { agent_id: 'darius',     agent_name: 'Darius King',          division: 'Content & Brand',  task: 'generate_daily_linkedin_post',   pipeline: 'p2_darius' },
  cron_ravi_design_brief:        { agent_id: 'ravi',       agent_name: 'Ravi Gupta',           division: 'Content & Brand',  task: 'generate_design_brief',          pipeline: 'p2_ravi' },
  cron_yara_localization:        { agent_id: 'yara',       agent_name: 'Yara Mansour',         division: 'Content & Brand',  task: 'spanish_localization',           pipeline: 'p2_yara' },
  cron_ingrid_press_release:     { agent_id: 'ingrid',     agent_name: 'Ingrid Larsen',        division: 'Content & Brand',  task: 'weekly_press_release',           pipeline: 'p2_ingrid' },
  cron_nia_content_daily:        { agent_id: 'nia',        agent_name: 'Nia Robinson',         division: 'Marketing',        task: 'daily_content_creation',         pipeline: 'p3_nia' },
  cron_luca_digital_marketing:   { agent_id: 'luca',       agent_name: 'Luca Romano',          division: 'Marketing',        task: 'digital_marketing_briefing',     pipeline: 'p3_luca' },
  cron_hyunji_analytics:         { agent_id: 'hyunji',     agent_name: 'Hyun-Ji Kim',          division: 'Marketing',        task: 'analytics_roi_briefing',         pipeline: 'p3_hyunji' },
  cron_andre_seo:                { agent_id: 'andre',      agent_name: 'Andre Mitchell',       division: 'Marketing',        task: 'seo_sem_brand_briefing',         pipeline: 'p3_andre' },
  cron_amara_legal_tuesday:      { agent_id: 'amara',      agent_name: 'Amara Okafor',         division: 'Legal & Finance',  task: 'weekly_legal_briefing',          pipeline: 'p4_amara' },
  cron_diego_expense_tuesday:    { agent_id: 'diego',      agent_name: 'Diego Reyes',          division: 'Legal & Finance',  task: 'weekly_expense_report',          pipeline: 'p4_diego' },
  cron_yuki_financial_tuesday:   { agent_id: 'yuki',       agent_name: 'Yuki Tanaka',          division: 'Legal & Finance',  task: 'weekly_financial_report',        pipeline: 'p4_yuki' },
  cron_marcus_tax_tuesday:       { agent_id: 'marcus',     agent_name: 'Marcus Chen',          division: 'Legal & Finance',  task: 'weekly_tax_strategy_briefing',   pipeline: 'p4_marcus' },
  cron_analytics_weekly:         { agent_id: 'analytics',  agent_name: 'Analytics Agent',      division: 'Analytics',        task: 'weekly_performance_summary' },
  lead_created:         { agent_id: 'omar',    agent_name: 'Omar Patel',    division: 'Revenue & Growth', task: 'score_new_lead' },
  contact_updated:      { agent_id: 'ryan',    agent_name: 'Ryan Nakamura', division: 'Revenue & Growth', task: 'process_contact_update' },
  assessment_completed: { agent_id: 'omar',    agent_name: 'Omar Patel',    division: 'Revenue & Growth', task: 'route_assessment_lead' },
  support_ticket:       { agent_id: 'support', agent_name: 'Isaiah Carter', division: 'Customer Support', task: 'handle_support_request' },
};

// ─────────────────────────────────────────────────────────────
// Category Classification
// ─────────────────────────────────────────────────────────────

// Internal operational content — Twin eyes only
const INTERNAL_CATEGORIES = [
  'coaching', 'sales_support', 'lead_intelligence', 'proposals',
  'product_knowledge', 'product_launch', 'digital_marketing',
  'analytics_report', 'seo_sem', 'legal_briefing', 'expense_report',
  'financial_report', 'tax_strategy',
];

// Client-facing / publishable content
const CLIENT_FACING_CATEGORIES = [
  'linkedin_post', 'instagram_post', 'facebook_post', 'twitter_post',
  'tiktok_post', 'youtube_post', 'social_post',
  'email_marketing', 'outreach', 'copywriting', 'press_release',
  'localization', 'design_brief', 'content_creation',
];

// Divisions whose client-facing outputs generate Social Media cards
const SOCIAL_DIVISIONS = ['Content & Brand', 'Marketing'];

// Map division to approval card category
function getDivisionCategory(division: string): string {
  const map: Record<string, string> = {
    'Revenue & Growth': 'revenue_growth',
    'Content & Brand':  'content_brand',
    'Marketing':        'marketing',
    'Legal & Finance':  'legal_finance',
    'AI Governance':    'ai_governance',
    'HR':               'hr',
    'Client Delivery':  'client_delivery',
    'Customer Support': 'customer_support',
  };
  return map[division] ?? 'division_briefing';
}

// Map category to platform badge label
function getPlatformLabel(category: string): string {
  const map: Record<string, string> = {
    linkedin_post:    'LinkedIn',
    instagram_post:   'Instagram',
    facebook_post:    'Facebook',
    twitter_post:     'X',
    tiktok_post:      'TikTok',
    youtube_post:     'YouTube',
    social_post:      'Social',
    content_creation: 'Content',
    press_release:    'Press',
    design_brief:     'Design',
    localization:     'Localization',
    copywriting:      'Copy',
    email_marketing:  'Email',
    outreach:         'Outreach',
  };
  return map[category] ?? 'Social';
}

// Division synthesis instructions
function getDivisionPrompt(division: string, today: string, content: string): string {
  const instructions: Record<string, string> = {
    'Revenue & Growth': `Synthesize the Revenue & Growth division's work for today. Cover: lead intelligence and pipeline health (Omar/Ryan), sales support and objection prep (Mateo), coaching insight (Serena), outreach created (Aaliyah), email campaign (Jaylen), copy asset (Chloe), launch readiness (Zara), product knowledge (Elena), proposal work (Kwame). 250–350 words. First person. Flag any high-intent leads or urgent pipeline actions.`,
    'Content & Brand':  `Synthesize the Content & Brand division's work for today. Cover: weekly content queue strategy (Camila), design brief (Ravi), press release activity (Ingrid), localization work (Yara). Note: Darius King's post and any other publishable content from this division is in the Social Media card. 200–300 words. First person.`,
    'Marketing':        `Synthesize the Marketing division's strategic and analytical work for today. Cover: digital campaign status and recommendations (Luca), analytics and funnel insights (Hyun-Ji), SEO/SEM priorities (Andre). Note: Nia's published content pieces are in the Social Media card. 200–300 words. First person. Flag any campaign decisions needing approval.`,
    'Legal & Finance':  `Synthesize the Legal & Finance division's weekly work. Cover: legal briefing highlights and action items (Amara), expense health and burn rate (Diego), financial projections and MRR tracking (Yuki), tax strategy actions (Marcus). 200–300 words. First person. Flag anything requiring DeAnna's signature or financial decision.`,
    'AI Governance':    `Synthesize the AI Governance division's weekly work. Cover: compliance monitoring activity (Isabella), privacy policy updates (Sofia), disclaimer work (Khalid), contract activity (James), brand protection alerts (Mei Lin), AI landscape intelligence (Rafael). 200–300 words. First person. Flag any compliance risks or IP threats.`,
    'HR':               `Synthesize the HR division's weekly work. Cover: recruiting pipeline status (Naomi), onboarding activity (Aiden), internal helpdesk health (Fatima). 150–250 words. First person. Flag any staffing decisions needed.`,
    'Client Delivery':  `Synthesize the Client Delivery division's work. Cover: client onboarding activity (Keisha), community engagement status (Marco), feedback insights (Leila), creative production status — Jordan orchestrating Simone/Theo/Amelia on course and content builds. 200–300 words. First person. Flag at-risk clients or delivery delays.`,
    'Customer Support': `Synthesize the Customer Support division's work. Cover: support ticket status and resolution metrics (Isaiah), multi-channel communication health (Priscilla). 150–250 words. First person. Flag any unresolved escalations.`,
  };

  const instruction = instructions[division] ?? `Synthesize this division's work. Cover all agents and outputs. 200–300 words. First person.`;

  return `You are DeAnna R. Upshaw's AI Twin synthesizing the ${division} division's work. Today: ${today}.

BRAND: "AI Mastery. Leadership Clarity. Measurable Results."
FRAMEWORKS (always ™): DRU CLEAR™ | DRU AI Leadership Ecosystem™ | DRU AI Transformation Pathway™ | 5C Cultural DNA™ | 5D Leadership™ | AI Sales Mastery™ | From Confusion to Confident with AI™

${division.toUpperCase()} DIVISION — AGENT OUTPUTS:
${content}

${instruction}

Write as DeAnna speaking to herself — authoritative, concise, action-oriented. Start with ## ${division}.`;
}

// ─────────────────────────────────────────────────────────────
// Shared API calls
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

async function callTwin(prompt: string, maxTokens = 2000): Promise<string> {
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

async function fetchBrandMarks(): Promise<string> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return '';
  const res = await fetch(`${url}/rest/v1/brand_marks?active=eq.true&order=created_at.asc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) return '';
  const data = await res.json();
  return (data as { mark: string }[]).map(m => m.mark).join(' | ');
}

async function getCSQItems(status: string): Promise<CSQItem[]> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const res = await fetch(`${url}/rest/v1/chief_of_staff_queue?status=eq.${status}&order=created_at.asc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) return [];
  return await res.json();
}

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

async function runAgentToCSQ(
  agentId: string, agentName: string, division: string, task: string,
  category: string, prompt: string, priority = 'normal',
  retryCount = 0, parentCsqId: string | null = null, maxTokens = 1500
): Promise<string | null> {
  try {
    const output = await callAnthropic(`${GENIUS_MODE}\n\n${prompt}`, maxTokens);
    return await writeToCSQ({ agent_id: agentId, agent_name: agentName, division, task, category, raw_output: output, priority, status: 'pending', retry_count: retryCount, ...(parentCsqId ? { parent_csq_id: parentCsqId } : {}) });
  } catch (error) { console.error(`[${agentId}] Error:`, error); return null; }
}

async function runCorrectionAgent(item: CSQItem, correctionNotes: string, newRetryCount: number): Promise<void> {
  try {
    const output = await callAnthropic(`${GENIUS_MODE}

You are ${item.agent_name}, working for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.

Your previous submission for task "${item.task}" was returned by Isabella Moreno, Director of Compliance, with the following corrections required:

ISABELLA'S CORRECTION NOTES:
${correctionNotes}

YOUR PREVIOUS OUTPUT (for reference):
${item.raw_output}

Produce a corrected version that fully addresses every point in Isabella's feedback. Maintain full Genius Mode quality.

COMPLIANCE REQUIREMENTS:
- All DRU framework names MUST include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™
- All content must stay within Classes 35, 41, 42

OUTPUT RULES: Output ONLY the corrected content. No compliance notes, audit summaries, or metadata.`, 1500);
    await writeToCSQ({ agent_id: item.agent_id, agent_name: item.agent_name, division: item.division, task: item.task, category: item.category, raw_output: output, priority: item.priority, status: 'pending', retry_count: newRetryCount, parent_csq_id: item.id, correction_notes: correctionNotes });
    console.log(`[isabella] ✅ Correction triggered for ${item.agent_name} (attempt ${newRetryCount})`);
  } catch (error) { console.error(`[isabella] Correction agent failed for ${item.agent_name}:`, error); }
}

// ─────────────────────────────────────────────────────────────
// PIPELINE 1 — OMAR + RYAN
// ─────────────────────────────────────────────────────────────

async function runOmar(): Promise<OmarResult> {
  const ghlApiKey = process.env.GHL_API_KEY;
  if (!ghlApiKey) return { success: false, total_leads_scanned: 0, scored_leads: [], high_intent_leads: [], run_date: new Date().toISOString(), error: 'Missing GHL_API_KEY' };
  try {
    const yesterday = new Date(); yesterday.setHours(yesterday.getHours() - 24);
    const res = await fetch(`${GHL_API_BASE}/contacts/?locationId=${GHL_LOCATION_ID}&startAfterDate=${encodeURIComponent(yesterday.toISOString())}&limit=100`, { headers: { Authorization: `Bearer ${ghlApiKey}`, Version: '2021-07-28' } });
    if (!res.ok) throw new Error(`GHL error ${res.status}`);
    const rawLeads = (await res.json()).contacts ?? [];
    if (rawLeads.length === 0) return { success: true, total_leads_scanned: 0, scored_leads: [], high_intent_leads: [], run_date: new Date().toISOString() };
    const leadSummary = rawLeads.map((l: any) => ({ id: l.id, name: `${l.firstName ?? ''} ${l.lastName ?? ''}`.trim(), email: l.email ?? '', phone: l.phone ?? '', source: l.source ?? 'unknown', tags: l.tags ?? [] }));
    const text = await callAnthropic(`${GENIUS_MODE}\n\nYou are Omar Patel, Lead Scoring Agent for DRU AI Consulting. Score each lead 1–10. Every high-intent lead's recommended_action should direct to assessment.druaiconsulting.com.
Return ONLY a JSON array: [{"contact_id":"...","name":"...","email":"...","phone":"...","source":"...","score":8,"intent_level":"high","recommended_action":"Invite to DRU CLEAR™ AI Readiness Scorecard — assessment.druaiconsulting.com","notes":"..."}]
Leads: ${JSON.stringify(leadSummary)}`, 2000);
    const scored: ScoredLead[] = JSON.parse(text.replace(/```json|```/g, '').trim());
    return { success: true, total_leads_scanned: rawLeads.length, scored_leads: scored, high_intent_leads: scored.filter(l => l.intent_level === 'high'), run_date: new Date().toISOString() };
  } catch (error) { return { success: false, total_leads_scanned: 0, scored_leads: [], high_intent_leads: [], run_date: new Date().toISOString(), error: String(error) }; }
}

async function runRyan(omarResult: OmarResult): Promise<{ csq_id: string | null; crm_updates: number }> {
  const ghlApiKey = process.env.GHL_API_KEY;
  if (!ghlApiKey) return { csq_id: null, crm_updates: 0 };
  if (omarResult.total_leads_scanned === 0) {
    const csq_id = await writeToCSQ({ agent_id: 'ryan', agent_name: 'Ryan Nakamura', division: 'Revenue & Growth', task: 'overnight_crm_sync', category: 'lead_intelligence', raw_output: '**Daily Lead Intelligence — No New Leads**\n\nOmar scanned GHL and found no new contacts in the last 24 hours. No CRM updates required.\n\nNext scan: tomorrow at 8:00am CDT.', priority: 'normal', status: 'pending', retry_count: 0 });
    return { csq_id, crm_updates: 0 };
  }
  let crmUpdates = 0;
  for (const lead of omarResult.scored_leads) {
    if (lead.contact_id) { await fetch(`${GHL_API_BASE}/contacts/${lead.contact_id}`, { method: 'PUT', headers: { Authorization: `Bearer ${ghlApiKey}`, Version: '2021-07-28', 'Content-Type': 'application/json' }, body: JSON.stringify({ tags: [`ai-scored`, `intent-${lead.intent_level}`, `score-${lead.score}`] }) }); crmUpdates++; }
  }
  const highIntentSummary = omarResult.high_intent_leads.map(l => `• ${l.name} (Score: ${l.score}/10) — ${l.recommended_action}`).join('\n');
  const briefing = await callAnthropic(`${GENIUS_MODE}\n\nYou are Ryan Nakamura, CRM Management Agent for DRU AI Consulting. Write a precise lead intelligence briefing.
DATA: Total: ${omarResult.total_leads_scanned} | High-intent: ${omarResult.high_intent_leads.length} | Medium: ${omarResult.scored_leads.filter(l => l.intent_level === 'medium').length} | Low: ${omarResult.scored_leads.filter(l => l.intent_level === 'low').length}
HIGH-INTENT: ${highIntentSummary || 'None today'}
Include: executive summary, high-intent leads with actions (all directed to assessment.druaiconsulting.com), CRM updates completed, strategic next steps.`);
  const csq_id = await writeToCSQ({ agent_id: 'ryan', agent_name: 'Ryan Nakamura', division: 'Revenue & Growth', task: 'overnight_crm_sync', category: 'lead_intelligence', raw_output: briefing, priority: omarResult.high_intent_leads.length > 0 ? 'high' : 'normal', status: 'pending', retry_count: 0 });
  return { csq_id, crm_updates: crmUpdates };
}

// ─────────────────────────────────────────────────────────────
// PIPELINE 2 — CAMILA + DARIUS
// ─────────────────────────────────────────────────────────────

async function runCamila(): Promise<number> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return 0;
  const now = new Date(); const monday = new Date(now); monday.setDate(now.getDate() - now.getDay() + 1); monday.setHours(0,0,0,0);
  const weekOf = monday.toISOString().split('T')[0];
  const days = [1,2,3,4,5].map(d => { const date = new Date(monday); date.setDate(monday.getDate() + d - 1); return { day_number: d, scheduled_for: date.toISOString().split('T')[0] }; });
  const text = await callAnthropic(`${GENIUS_MODE}\n\nYou are Camila Flores, Social Media Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Brand: "AI Mastery. Leadership Clarity. Measurable Results." Frameworks (™): DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.
Generate 5 LinkedIn posts (Mon–Fri). Day 1: thought_leadership | Day 2: educational | Day 3: engagement | Day 4: story_insight | Day 5: soft_promotional. Each: compelling hook, 150–250 words, one framework, CTA to assessment.druaiconsulting.com, 3–5 hashtags.
Return ONLY valid JSON: [{"day_number":1,"framework_covered":"DRU CLEAR™","post_type":"thought_leadership","hook":"...","content":"...","hashtags":"#AILeadership"}]`, 3000);
  const posts = JSON.parse(text.replace(/```json|```/g, '').trim());
  for (const post of posts) {
    const day = days.find(d => d.day_number === post.day_number) ?? days[0];
    await fetch(`${url}/rest/v1/content_queue`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ week_of: weekOf, day_number: post.day_number, scheduled_for: day.scheduled_for, platform: 'linkedin', framework_covered: post.framework_covered, post_type: post.post_type, hook: post.hook, content: post.content, hashtags: post.hashtags, status: 'queued' }) });
  }
  return posts.length;
}

async function runDarius(): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const today = new Date().toISOString().split('T')[0];
  const now = new Date(); const monday = new Date(now); monday.setDate(now.getDate() - now.getDay() + 1);
  const weekOf = monday.toISOString().split('T')[0];
  let postContent = ''; let queueId: string | null = null;
  if (url && key) {
    const res = await fetch(`${url}/rest/v1/content_queue?week_of=eq.${weekOf}&status=eq.queued&scheduled_for=eq.${today}&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (res.ok) { const queue = await res.json(); if (queue.length > 0) { queueId = queue[0].id; postContent = `${queue[0].hook}\n\n${queue[0].content}\n\n${queue[0].hashtags}`; } }
  }
  if (!postContent) {
    const brandMarks = await fetchBrandMarks();
    postContent = await callAnthropic(`${GENIUS_MODE}\n\nYou are Darius King, Viral Scripter for DRU AI Consulting. Write ONE LinkedIn post that stops executives mid-scroll. Brand: "AI Mastery. Leadership Clarity. Measurable Results."
TRADEMARK RULES: Only use frameworks listed below with ™. Never invent framework names.
APPROVED FRAMEWORKS: ${brandMarks}
SERVICE CLASS RULES: Write within Classes 35, 41, 42 only. No financial investment language.
FORMAT: 150–250 words. Strong hook. CTA pointing to assessment.druaiconsulting.com. 3–5 hashtags. Sound like DeAnna R. Upshaw — AI Authority.`);
  }
  const csqId = await writeToCSQ({ agent_id: 'darius', agent_name: 'Darius King', division: 'Content & Brand', task: 'generate_daily_linkedin_post', category: 'linkedin_post', raw_output: postContent, priority: 'normal', status: 'pending', retry_count: 0 });
  if (queueId && url && key) { await fetch(`${url}/rest/v1/content_queue?id=eq.${queueId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ status: 'submitted', submitted_at: new Date().toISOString() }) }); }
  return csqId;
}

// ─────────────────────────────────────────────────────────────
// PIPELINE 3 — NIA, LUCA, HYUN-JI, ANDRE
// ─────────────────────────────────────────────────────────────

async function runNia(): Promise<string | null> {
  const brandMarks = await fetchBrandMarks();
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });
  const contentTypeMap: Record<string, string> = { Monday: 'thought_leadership_article', Tuesday: 'framework_explainer', Wednesday: 'executive_faq_guide', Thursday: 'client_transformation_story', Friday: 'trend_analysis_piece' };
  const contentType = contentTypeMap[dayOfWeek] ?? 'thought_leadership_article';
  const contentInstructions: Record<string, string> = {
    thought_leadership_article: `Write a 600–800 word thought leadership article positioning DeAnna R. Upshaw as the AI Authority. Topic: the hidden cost of AI adoption without leadership clarity. Compelling headline, 3–4 sections with subheadings, one DRU framework reference, CTA to assessment.druaiconsulting.com.`,
    framework_explainer: `Write a 500–700 word framework explainer for one of DeAnna's proprietary frameworks. What it is, why it matters, core components, real-world application, CTA to assessment.druaiconsulting.com.`,
    executive_faq_guide: `Write a 600–800 word FAQ guide answering the 5 most pressing executive questions about AI adoption. Question as subheading, 2–3 paragraph answer each, weave in one DRU framework per answer. End with CTA to assessment.druaiconsulting.com.`,
    client_transformation_story: `Write a 500–700 word composite client transformation story (no real names) using the DRU AI Transformation Pathway™. Before state, intervention, transformation, outcomes, CTA to assessment.druaiconsulting.com.`,
    trend_analysis_piece: `Write a 600–800 word trend analysis on a current AI leadership trend. Position DeAnna as the authority. The trend, why it matters, strategic implication, what leaders should do, CTA to assessment.druaiconsulting.com.`,
  };
  return await runAgentToCSQ('nia', 'Nia Robinson', 'Marketing', 'daily_content_creation', 'content_creation',
    `You are Nia Robinson, Content Creation Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.
TRADEMARK RULES: Only use frameworks listed below with ™. APPROVED: ${brandMarks}
SERVICE CLASS RULES: Classes 35, 41, 42 only. No financial investment language.
AUDIENCE: Senior executives, directors, C-suite leaders.
TODAY'S CONTENT TYPE: ${contentType}
${contentInstructions[contentType]}
ASSESSMENT CTA RULE: Every piece must include assessment.druaiconsulting.com as the primary CTA.`, 'normal', 0, null, 2000);
}

async function runLuca(): Promise<string | null> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  return await runAgentToCSQ('luca', 'Luca Romano', 'Marketing', 'digital_marketing_briefing', 'digital_marketing',
    `You are Luca Romano, Digital Marketing Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}. All campaign objectives → assessment.druaiconsulting.com.
OFFER LADDER: DRU CLEAR™ Scorecard (free, primary) → Strategic Diagnostic ($3,497) → Executive Diagnostic ($4,997) → From Confusion to Confident with AI™ ($497–$1,497).
TARGET: Senior executives, C-suite. Platforms: LinkedIn (primary), Meta (secondary), Google (brand/intent).
**Campaign Status & Recommendations** — LinkedIn Ads: campaign type, targeting, budget, one ad copy variation. Meta Ads: retargeting strategy. Google Ads: brand keyword priorities, one keyword cluster.
**Funnel Optimization Focus** — One landing page improvement for assessment.druaiconsulting.com. One A/B test hypothesis.
**Retargeting Intelligence** — Sequence for assessment completers who haven't purchased. Sequence for visitors who didn't start assessment.
**This Week's Priority Action** — One highest-impact move with rationale.`, 'normal', 0, null, 2000);
}

async function runHyunJi(): Promise<string | null> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });
  const reportType = dayOfWeek === 'Monday' ? 'weekly_recap' : 'daily_operational';
  const reportInstructions = reportType === 'weekly_recap'
    ? `Today is Monday — produce weekly analytics recap AND week-ahead priorities.
**Last Week's Performance Summary** — Assessment funnel benchmarks, LinkedIn engagement benchmarks, email open rate targets (34%), paid ROAS benchmarks.
**Week-Ahead Measurement Priorities** — 3 KPIs with targets. One analytics question to answer by Friday. One data gap to close.`
    : `Daily analytics and ROI operational briefing.
**Funnel Health Check** — What to monitor at assessment.druaiconsulting.com today. One metric that, if moved 10%, would most impact revenue.
**Channel Performance Snapshot** — LinkedIn benchmarks, email targets, paid signals.
**Conversion Intelligence** — One assessment-to-diagnostic conversion insight. One attribution improvement.
**Today's Analytics Priority** — The single most important number to check and what action it triggers.`;
  return await runAgentToCSQ('hyunji', 'Hyun-Ji Kim', 'Marketing', 'analytics_roi_briefing', 'analytics_report',
    `You are Hyun-Ji Kim, Analytics & ROI Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}. Every metric connects to assessment completions, diagnostic conversions, or retention.
OFFER LADDER: DRU CLEAR™ (free) → Strategic Diagnostic $3,497 → Executive Diagnostic $4,997 → Course $497–$1,497 → Daily Connections Free/Navigator $47/mo/Accelerator $147/mo.
REPORT TYPE: ${reportType}
${reportInstructions}`, 'normal', 0, null, 2000);
}

async function runAndre(): Promise<string | null> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });
  const focusType = dayOfWeek === 'Tuesday' ? 'technical_seo' : dayOfWeek === 'Friday' ? 'weekly_search_recap' : 'daily_operational';
  const focusInstructions: Record<string, string> = {
    daily_operational: `**Brand Keyword Protection** — Protect: "DRU AI Consulting", "DeAnna Upshaw", "DRU CLEAR", "AI Leadership Consulting". One competitor threat and defensive strategy.
**Organic Search Priorities** — Top 3 keyword clusters with intent. One content gap for Nia. Internal linking for assessment.druaiconsulting.com.
**Paid Search Recommendation** — One Google Ads structure. Landing page: assessment.druaiconsulting.com. One negative keyword category.
**Today's SEO Priority Action** — One immediately actionable move.`,
    technical_seo: `**Site Health Priorities** — Core Web Vitals targets for assessment + app subdomains. Subdomain SEO strategy. One crawlability recommendation.
**Schema & Structured Data** — Recommended schema for services, courses, DeAnna's author profile. One rich snippet opportunity.
**Local & Entity SEO** — Google Knowledge Panel optimization for "DeAnna R. Upshaw AI Authority". One citation strategy.
**This Week's Technical Priority** — Single highest-impact technical fix.`,
    weekly_search_recap: `**Organic Search Performance** — Benchmark targets. One keyword to monitor. Content type performance.
**Paid Search Performance** — Brand campaign health. One search query theme from competitor analysis.
**Next Week's Search Priorities** — 3 actions ranked by impact. One keyword for Luca. One content piece for Nia.`,
  };
  return await runAgentToCSQ('andre', 'Andre Mitchell', 'Marketing', 'seo_sem_brand_briefing', 'seo_sem',
    `You are Andre Mitchell, SEO/SEM Brand Manager for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}. Primary conversion destination: assessment.druaiconsulting.com.
WEB PROPERTIES: druaiconsulting.com | assessment.druaiconsulting.com | app.druaiconsulting.com
TARGET AUDIENCE: Executives searching for AI consulting, AI leadership strategy, organizational AI adoption.
FOCUS TYPE: ${focusType}
${focusInstructions[focusType]}`, 'normal', 0, null, 2000);
}

// ─────────────────────────────────────────────────────────────
// PIPELINE 4 — AMARA, DIEGO, YUKI, MARCUS
// ─────────────────────────────────────────────────────────────

async function runAmara(): Promise<string | null> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  return await runAgentToCSQ('amara', 'Amara Okafor', 'Legal & Finance', 'weekly_legal_briefing', 'legal_briefing',
    `You are Amara Okafor, Legal Advisor for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.
Generate this week's legal briefing. Classes 35, 41, 42. Pre-launch phase — assessment.druaiconsulting.com live.
OFFER LADDER: DRU CLEAR™ (free) → Strategic Diagnostic ($3,497) → Executive Diagnostic ($4,997) → Course ($497–$1,497) → 90-Day Journey ($20K–$25K+).
**Contract Readiness** — Essential contracts before first client, critical AI consulting clause, payment plan liability approach.
**IP Protection Status** — Trademark monitoring priority, one proactive action, usage guidelines.
**AI Consulting Liability** — One specific liability risk + contractual protection, recommended AI-generated content disclaimer, one emerging AI regulation development.
**Pre-Launch Legal Checklist** — 3 items required before first paying client. One post-launch item to calendar.
Flag anything requiring immediate action.`, 'normal', 0, null, 2000);
}

async function runDiego(): Promise<string | null> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  return await runAgentToCSQ('diego', 'Diego Reyes', 'Legal & Finance', 'weekly_expense_report', 'expense_report',
    `You are Diego Reyes, Expense Manager for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.
KNOWN EXPENSES: Vercel ~$20/mo | Supabase free tier | Anthropic API usage-based (Haiku ~$0.25/1M input, ~$1.25/1M output) | GHL monthly | Make.com Pro $16/mo | Stripe/Klarna/Afterpay/Elective.com pending.
**Weekly Operating Cost Summary** — Estimated monthly total, cost-per-agent Anthropic estimate for 39 agents, one cost optimization opportunity.
**Vendor Payment Status** — Recurring payments due this week or next. One vendor to review for value alignment.
**Pre-Revenue Financial Health** — Monthly burn rate and first-client impact, break-even calculation, one financial hygiene action.
**Payment Infrastructure Cost Projection** — Transaction fees across payment methods at $10K/$25K/$50K/mo. Priority recommendation for DeAnna's price points.
Flag anything needing DeAnna's attention this week.`, 'normal', 0, null, 2000);
}

async function runYuki(): Promise<string | null> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  return await runAgentToCSQ('yuki', 'Yuki Tanaka', 'Legal & Finance', 'weekly_financial_report', 'financial_report',
    `You are Yuki Tanaka, Financial Reporting Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.
EXACT PRICING (do not deviate): DRU CLEAR™ (free) | Strategic Diagnostic $3,497 | Executive Diagnostic $4,997 (BEST VALUE) | 90-Day Journey $20K–$25K+ | Course $497/$997/$1,497 | Daily Connections Free/Navigator $47/mo/Accelerator $147/mo.
**Revenue Projection Model** — Month 1 conservative, Month 3 target, Month 6 goal, break-even estimate.
**MRR Growth Framework** — Daily Connections MRR at 10/25/50 Navigator vs Accelerator. Subscription % at each milestone. Churn impact.
**Key Financial Metrics to Track** — 5 KPIs once revenue begins, reporting cadence, one leading vs one lagging indicator.
**Financial Intelligence Summary** — Highest revenue/hour product, one financial risk in first 90 days, one financial strength to amplify.
Label all figures as projections or actuals. Every insight decision-ready.`, 'normal', 0, null, 2000);
}

async function runMarcus(): Promise<string | null> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  return await runAgentToCSQ('marcus', 'Marcus Chen', 'Legal & Finance', 'weekly_tax_strategy_briefing', 'tax_strategy',
    `You are Marcus Chen, Tax Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.
Entity: LLC (DBA Dimensional Solns, LLC) — Texas. Solo founder, pre-revenue, AI consulting + digital products + subscriptions.
DISCLAIMER: All guidance is strategic and for planning purposes only. Final decisions require a licensed CPA or tax attorney.
**Entity & Structure** — LLC vs S-Corp election at projected revenue, Texas advantages, white label licensing structure (Sprint 5).
**Deduction Opportunities** — Top 5 deductible expenses (flag DeAnna's known expenses), home office deduction method + docs, AI tool/SaaS categorization, international facilitation deductions (Costa Rica, Dominican Republic, Papua New Guinea).
**Quarterly Estimated Tax Planning** — 2025/2026 schedule and safe harbor, recommended set-aside %, cash flow strategy.
**Pre-Revenue Tax Actions** — 3 actions to take NOW, one commonly missed deduction, record-keeping system from day one.
Flag any time-sensitive tax action clearly.`, 'normal', 0, null, 2000);
}

// ─────────────────────────────────────────────────────────────
// COMMAND CHAIN — ISABELLA
// ─────────────────────────────────────────────────────────────

async function runIsabella(): Promise<{ reviewed: number; cleared: number; sent_back: number; rejected: number }> {
  const pending = await getCSQItems('pending');
  console.log(`[isabella] Reviewing ${pending.length} pending items...`);
  if (pending.length === 0) return { reviewed: 0, cleared: 0, sent_back: 0, rejected: 0 };
  let cleared = 0; let sentBack = 0; let rejected = 0;
  for (const item of pending) {
    try {
      const raw = await callTwin(`${GENIUS_MODE}

You are Isabella Moreno, Director of Compliance for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.

RESPONSIBILITIES:
1. Every DRU proprietary framework name must include ™
2. Content stays within Classes 35 (business consulting, AI strategy, leadership advisory), 41 (training, coaching, education), 42 (AI technology consulting, software services)
3. Flag content outside these classes

DRU PROPRIETARY MARKS (always ™): DRU CLEAR™ | DRU AI Leadership Ecosystem™ | DRU AI Transformation Pathway™ | 5C Cultural DNA™ | 5D Leadership™ | AI Sales Mastery™ | From Confusion to Confident with AI™

CLEARING STANDARD:
- All marks with ™ AND content within Classes 35/41/42 → cleared:true
- Missing ™ → cleared:false, state exactly which mark and where
- Outside classes → cleared:false, state exactly what

AGENT: ${item.agent_name} | TASK: ${item.task}
CONTENT: ${item.raw_output}

Output ONLY this JSON:
{"cleared":true,"flags":"none","correction_notes":"Content reviewed. All marks correct. Within Classes 35/41/42."}
OR: {"cleared":false,"flags":"specific issue","correction_notes":"Exact correction instruction"}`, 600);
      const result = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? 'null');
      if (result.cleared) {
        cleared++;
        await updateCSQ(item.id, { isabella_flags: result.flags ?? 'none', isabella_cleared_at: new Date().toISOString(), status: 'isabella_cleared' });
      } else {
        const retryCount = item.retry_count ?? 0;
        if (retryCount >= 2) {
          rejected++;
          await updateCSQ(item.id, { isabella_flags: result.flags, correction_notes: result.correction_notes, governance_cleared: false, status: 'rejected' });
          console.warn(`[isabella] ⛔ HARD REJECT: ${item.agent_name} — ${result.flags}`);
        } else {
          sentBack++;
          await updateCSQ(item.id, { isabella_flags: result.flags, correction_notes: result.correction_notes, status: 'needs_correction' });
          await runCorrectionAgent(item, result.correction_notes, retryCount + 1);
        }
      }
    } catch (error) { console.error(`[isabella] Failed item ${item.id}:`, error); }
  }
  console.log(`[isabella] ✅ ${pending.length} reviewed: ${cleared} cleared, ${sentBack} sent back, ${rejected} rejected`);
  return { reviewed: pending.length, cleared, sent_back: sentBack, rejected };
}

// ─────────────────────────────────────────────────────────────
// COMMAND CHAIN — GOVERNANCE PANEL
// ─────────────────────────────────────────────────────────────

async function runGovernancePanel(): Promise<{ reviewed: number; cleared: number; blocked: number }> {
  const items = await getCSQItems('isabella_cleared');
  console.log(`[governance] Reviewing ${items.length} Isabella-cleared items...`);
  if (items.length === 0) return { reviewed: 0, cleared: 0, blocked: 0 };
  let cleared = 0; let blocked = 0;
  const updates: Promise<void>[] = [];
  for (const item of items) {
    try {
      const isInternal    = INTERNAL_CATEGORIES.includes(item.category);
      const isClientFacing = CLIENT_FACING_CATEGORIES.includes(item.category);
      let rulesBlock = '';
      if (isInternal) {
        rulesBlock = `INTERNAL OPERATIONAL CONTENT (category: ${item.category}). Goes to AI Twin only. Never published.
BLOCK ONLY IF: (1) specific factual error misleading DeAnna — wrong pricing/date/contact, (2) false credential claim about DeAnna, (3) named contractual obligation to a specific person/company, (4) false financial figure vs known pricing: Strategic Diagnostic $3,497 | Executive Diagnostic $4,997 | Course $497–$1,497.
If NONE present, MUST return cleared:true. Bold recommendations, aspirational framing SHALL PASS.`;
      } else if (isClientFacing) {
        rulesBlock = `CLIENT-FACING CONTENT (category: ${item.category}). Will be published or sent to clients/public.
BLOCK ONLY IF: (1) income guarantee without disclaimer, (2) false credential claim, (3) named privacy violation, (4) contractual guarantee creating legal liability to a named party, (5) false financial figure vs known pricing.
If NONE present, MUST return cleared:true.`;
      } else {
        rulesBlock = `Unclassified category. Apply internal rules. BLOCK ONLY IF: (1) factual error misleading DeAnna, (2) false credential claim, (3) named contractual obligation, (4) false financial figure. If NONE, MUST return cleared:true.`;
      }
      const raw = await callAnthropic(`${GENIUS_MODE}
You are the AI Governance and Legal & Finance panel for DRU AI Consulting. Isabella has already cleared trademark and service class compliance — FINAL. Do NOT re-check.
${rulesBlock}
AGENT: ${item.agent_name} | DIVISION: ${item.division} | CATEGORY: ${item.category} | TASK: ${item.task}
CONTENT: ${item.raw_output}
Output ONLY this JSON:
If cleared: {"cleared":true,"compliance_score":9,"governance_notes":"Panel reviewed. No blocking conditions present.","legal_notes":"No legal risk detected.","flags":"none"}
If blocked: {"cleared":false,"compliance_score":3,"governance_notes":"Condition [NUMBER] violated: [exact text]","legal_notes":"[issue]","flags":"[exact phrase]"}`, 800);
      const result = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? 'null');
      if (!result) throw new Error('Governance response unparseable');
      if (result.cleared) {
        cleared++;
        updates.push(updateCSQ(item.id, { governance_cleared: true, compliance_score: result.compliance_score ?? 8, governance_notes: result.governance_notes ?? '', legal_notes: result.legal_notes ?? '', governance_flags: result.flags ?? 'none', governance_cleared_at: new Date().toISOString(), status: 'governance_cleared' }));
      } else {
        blocked++;
        updates.push(updateCSQ(item.id, { governance_cleared: false, governance_notes: result.governance_notes ?? 'Blocked', governance_flags: result.flags ?? 'review_failed', governance_cleared_at: new Date().toISOString(), status: 'rejected' }));
      }
    } catch (error) {
      console.error(`[governance] Failed item ${item.id}:`, error);
      blocked++;
      updates.push(updateCSQ(item.id, { governance_cleared: false, governance_notes: 'Governance review failed — flagged for manual review.', governance_cleared_at: new Date().toISOString(), status: 'governance_error' }));
    }
  }
  await Promise.all(updates);
  console.log(`[governance] ✅ ${items.length} reviewed: ${cleared} cleared, ${blocked} blocked`);
  return { reviewed: items.length, cleared, blocked };
}

// ─────────────────────────────────────────────────────────────
// COMMAND CHAIN — COMMAND LAYER
// ─────────────────────────────────────────────────────────────

async function runCommandLayer(): Promise<{ reviewed: number }> {
  const items = await getCSQItems('governance_cleared');
  console.log(`[command_layer] Reviewing ${items.length} governance-cleared items...`);
  if (items.length === 0) return { reviewed: 0 };
  const updates: Promise<void>[] = [];
  for (const item of items) {
    try {
      const rawRaymond = await callAnthropic(`${GENIUS_MODE}
You are Raymond Holloway, Chief of Staff for DRU AI Consulting. Content cleared by Isabella and Governance. Assess strategic priority.
AGENT: ${item.agent_name} (${item.division}) | TASK: ${item.task}
CONTENT: ${item.raw_output}
Output ONLY this JSON: {"priority":"normal","action":"route_to_twin","notes":"one strategic sentence for the Twin"}`, 400);
      const raymond = JSON.parse(rawRaymond.match(/\{[\s\S]*\}/)?.[0] ?? 'null');
      const rawTravis = await callAnthropic(`${GENIUS_MODE}
You are Travis Weston, Assistant Chief of Staff for DRU AI Consulting. Package this for the AI Twin.
AGENT: ${item.agent_name} | RAYMOND'S NOTES: ${raymond.notes ?? ''}
CONTENT: ${item.raw_output}
Output ONLY this JSON: {"organized":true,"package_notes":"one sentence on how this fits today's briefing"}`, 400);
      const travis = JSON.parse(rawTravis.match(/\{[\s\S]*\}/)?.[0] ?? 'null');
      const rawPriya = await callAnthropic(`${GENIUS_MODE}
You are Priya Sharma, Executive Assistant to DeAnna R. Upshaw. Add executive context — flag anything time-sensitive or requiring DeAnna's personal action today.
AGENT: ${item.agent_name} | TASK: ${item.task}
CONTENT: ${item.raw_output}
In 1–2 sentences, add your executive perspective.`, 200);
      updates.push(updateCSQ(item.id, { raymond_reviewed: true, raymond_notes: raymond.notes ?? '', raymond_priority: raymond.priority ?? 'normal', raymond_action: raymond.action ?? 'route_to_twin', travis_notes: travis.package_notes ?? '', priya_notes: rawPriya.trim(), command_approved_at: new Date().toISOString(), status: 'command_approved', priority: raymond.priority ?? 'normal' }));
    } catch (error) { console.error(`[command_layer] Failed item ${item.id}:`, error); }
  }
  await Promise.all(updates);
  console.log(`[command_layer] ✅ ${items.length} items command-approved`);
  return { reviewed: items.length };
}

// ─────────────────────────────────────────────────────────────
// COMMAND CHAIN — AI TWIN SYNTHESIS
// Fires at 11:30am CDT. Creates ONE card per division + Social Media
// cards for client-facing outputs from Content & Brand and Marketing.
// Sends ONE notification per card.
// ─────────────────────────────────────────────────────────────

async function sendDivisionNotification(division: string, approvalId: string, agentCount: number, triggeredAt: string): Promise<void> {
  const webhookUrl = process.env.GHL_NOTIFICATION_WEBHOOK_URL;
  if (!webhookUrl) return;
  const label    = division === 'Command' ? 'Daily Briefing' : `${division} Briefing`;
  const subject  = `DRU AI™ — ${label} Ready for Review`;
  const sms      = `DRU AI™ | ${label} is ready. ${agentCount} agent${agentCount > 1 ? 's' : ''} cleared through the full chain.\n\nReview: app.druaiconsulting.com/admin-approvals`;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'druaiconsulting@gmail.com', phone: '+19796186671',
        first_name: 'DeAnna', last_name: 'Upshaw',
        agent_name: "DeAnna's AI Twin", division,
        task: label,
        approval_id: approvalId,
        summary: `${label} is ready for your review. ${agentCount} agent output${agentCount > 1 ? 's' : ''} cleared through Isabella, Governance, and your Command Layer.`,
        triggered_at: triggeredAt,
        review_url: 'https://app.druaiconsulting.com/admin-approvals',
        sms_body: sms,
        email_subject: subject,
        email_body: `${subject}\n\n${agentCount} agent output${agentCount > 1 ? 's' : ''} cleared through the full chain.\n\nReview and approve:\nhttps://app.druaiconsulting.com/admin-approvals\n\n— DRU AI Leadership Ecosystem™`,
      }),
    });
  } catch (error) { console.warn(`[twin] Notification failed for ${division} (non-fatal):`, error); }
}

async function runTwinSynthesis(): Promise<{ cards_created: number; items_synthesized: number }> {
  const items = await getCSQItems('command_approved');
  console.log(`[twin] Synthesizing ${items.length} command-approved items...`);
  if (items.length === 0) { console.log('[twin] No items to synthesize today.'); return { cards_created: 0, items_synthesized: 0 }; }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });

  // Group by division
  const byDivision: Record<string, CSQItem[]> = {};
  for (const item of items) {
    if (!byDivision[item.division]) byDivision[item.division] = [];
    byDivision[item.division].push(item);
  }

  const triggeredAt = new Date().toISOString();
  const approvalMap: Record<string, string> = {}; // division → approval_id

  // ── 1. Daily Briefing card (all items for context) ─────────
  const allSummary = items.map(i =>
    `${i.agent_name} (${i.division}): ${i.raw_output.slice(0, 150)}... Raymond: ${i.raymond_notes ?? ''} | Priya: ${i.priya_notes ?? ''}`
  ).join('\n');

  const dailyBriefingPromises: Promise<void>[] = [];

  const dailySynthesisPromise = callTwin(`You are DeAnna R. Upshaw's AI Twin. Today: ${today}.

Today's team completed work across all active divisions. Write the Daily Briefing card with ONLY these three sections — concise, first person, decision-ready:

## Daily Briefing — ${today}

**Executive Summary**
3–4 sentences ("My team has...") — what was accomplished today across all divisions.

**Decisions Needed**
Bullet list of anything requiring DeAnna's personal action, approval, or signature today. If none: "No decisions required today — team is executing."

**Tomorrow's Priorities**
3–5 specific bullets of what the team is positioned to execute tomorrow.

No division details here — those are in separate division cards.

TODAY'S TEAM WORK:
${allSummary}`, 1200)
    .then(async synthesis => {
      const id = await writeApproval({
        source: 'twin_synthesis', trigger_type: 'cron_twin_synthesis',
        agent_name: "DeAnna's AI Twin", agent_role: 'Master Orchestrator',
        division: 'Command', task_brief: `Daily Briefing — ${today}`,
        output: synthesis, status: 'pending', notify_deanna: true,
        priority: items.some(i => i.priority === 'high') ? 'high' : 'normal',
        category: 'daily_briefing', platform: null,
      });
      if (id) {
        approvalMap['Command'] = id;
        await sendDivisionNotification('Command', id, items.length, triggeredAt);
      }
      console.log(`[twin] ✅ Daily Briefing card written`);
    })
    .catch(err => { console.error('[twin] Daily Briefing synthesis failed:', err); });

  // ── 2. Division cards in parallel ─────────────────────────
  const divisionSynthesisPromises = Object.entries(byDivision).map(async ([division, divItems]) => {
    const content = divItems.map(i =>
      `**${i.agent_name}** (${i.task.replace(/_/g, ' ')}):\n${i.raw_output}\nRaymond: ${i.raymond_notes ?? ''} | Travis: ${i.travis_notes ?? ''} | Priya: ${i.priya_notes ?? ''}`
    ).join('\n\n---\n\n');

    try {
      const synthesis = await callTwin(getDivisionPrompt(division, today, content), 1500);
      const id = await writeApproval({
        source: 'twin_synthesis', trigger_type: 'cron_twin_synthesis',
        agent_name: "DeAnna's AI Twin", agent_role: 'Master Orchestrator',
        division, task_brief: `${division} — ${divItems.length} agent${divItems.length > 1 ? 's' : ''} | ${today}`,
        output: synthesis, status: 'pending', notify_deanna: true,
        priority: divItems.some(i => i.priority === 'high') ? 'high' : 'normal',
        category: getDivisionCategory(division), platform: null,
      });
      if (id) {
        approvalMap[division] = id;
        await sendDivisionNotification(division, id, divItems.length, triggeredAt);
        console.log(`[twin] ✅ ${division} card written`);
      }
    } catch (err) { console.error(`[twin] ${division} synthesis failed:`, err); }
  });

  // Run Daily Briefing + all division cards in parallel
  await Promise.all([dailySynthesisPromise, ...divisionSynthesisPromises]);

  // ── 3. Social Media cards ──────────────────────────────────
  // Client-facing outputs from Content & Brand and Marketing only
  for (const item of items) {
    if (
      SOCIAL_DIVISIONS.includes(item.division) &&
      CLIENT_FACING_CATEGORIES.includes(item.category)
    ) {
      try {
        let postContent = item.raw_output;

        // Clean compliance artifacts from content
        const complianceCutoffs = [
          '## COMPLIANCE AUDIT', 'COMPLIANCE AUDIT', 'COMPLIANCE CERTIFICATION',
          '## Isabella', 'CORRECTION REQUIRED', "Isabella's", '\n---\n', '---\n',
        ];
        for (const cutoff of complianceCutoffs) {
          const idx = postContent.indexOf(cutoff);
          if (idx !== -1) postContent = postContent.slice(0, idx).trim();
        }
        postContent = postContent.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
        postContent = postContent.split(/\n{2,}/).map((p: string) => p.replace(/\n/g, ' ').trim()).filter((p: string) => p.length > 0).join('\n\n');

        const platformLabel = getPlatformLabel(item.category);

        await writeApproval({
          source:        `${item.agent_id}_social`,
          trigger_type:  item.category,
          agent_name:    item.agent_name,
          agent_role:    item.division,
          division:      item.division,
          task_brief:    `${platformLabel} — ${item.agent_name} | ${today}`,
          output:        postContent,
          status:        'pending',
          notify_deanna: false,
          priority:      'normal',
          category:      'social',
          platform:      platformLabel,
        });
        console.log(`[twin] ✅ Social card written: ${item.agent_name} → ${platformLabel}`);
      } catch (err) { console.error(`[twin] Social card failed for ${item.agent_name}:`, err); }
    }
  }

  // ── 4. Mark all CSQ items as twin_processed ────────────────
  for (const item of items) {
    const divisionApprovalId = approvalMap[item.division] ?? null;
    await updateCSQ(item.id, {
      twin_processed: true,
      twin_synthesis: `Division card: ${item.division}`,
      approval_id: divisionApprovalId,
      twin_processed_at: new Date().toISOString(),
      status: 'twin_processed',
    });
  }

  const cardsCreated = Object.keys(approvalMap).length;
  console.log(`[twin] ✅ Synthesis complete — ${cardsCreated + 1} division cards + social cards written`);
  return { cards_created: cardsCreated + 1, items_synthesized: items.length };
}

// ─────────────────────────────────────────────────────────────
// Standard dispatch to Travis Router (fallback)
// ─────────────────────────────────────────────────────────────

async function dispatchToTravisRouter(route: AgentRoute, payload: TriggerPayload, triggeredAt: string, sourceLabel: string): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    await fetch(`${url}/functions/v1/travis-router`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ agent_id: route.agent_id, agent_name: route.agent_name, division: route.division, task: route.task, trigger_type: payload.trigger_type, source: sourceLabel, payload, triggered_at: triggeredAt }), signal: controller.signal });
    clearTimeout(timeout);
  } catch (error: unknown) { clearTimeout(timeout); if (!(error instanceof Error && error.name === 'AbortError')) console.error('[travis-router] Error:', error); }
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

  if (route.pipeline === 'cmd_isabella') {
    const result = await runIsabella();
    res.status(202).json({ success: true, agent: route.agent_name, ...result });
  } else if (route.pipeline === 'cmd_governance') {
    const result = await runGovernancePanel();
    res.status(202).json({ success: true, agent: route.agent_name, ...result });
  } else if (route.pipeline === 'cmd_command_layer') {
    const result = await runCommandLayer();
    res.status(202).json({ success: true, agent: route.agent_name, ...result });
  } else if (route.pipeline === 'cmd_twin') {
    const result = await runTwinSynthesis();
    res.status(202).json({ success: true, agent: route.agent_name, ...result, message: `Twin created ${result.cards_created} division cards from ${result.items_synthesized} items` });

  } else if (route.pipeline === 'p1_omar') {
    const omar = await runOmar(); const ryan = await runRyan(omar);
    res.status(202).json({ success: true, agent: route.agent_name, leads_scanned: omar.total_leads_scanned, high_intent: omar.high_intent_leads.length, crm_updates: ryan.crm_updates });
  } else if (route.pipeline === 'p1_serena') {
    const id = await runAgentToCSQ('serena', 'Serena Jackson', 'Revenue & Growth', 'morning_coaching_briefing', 'coaching',
      `You are Serena Jackson, Business Coach for DRU AI Consulting — DeAnna R. Upshaw, AI Authority, CEO/Founder.
TRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™ (Discover→Diagnose→Design→Deploy→Dominate), 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.
Generate DeAnna's morning business coaching briefing. Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' })}. Include: strategic focus, coaching insight, mindset anchor, one actionable growth move.`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });
  } else if (route.pipeline === 'p1_mateo') {
    const id = await runAgentToCSQ('mateo', 'Mateo Gonzalez', 'Revenue & Growth', 'sales_pipeline_review', 'sales_support',
      `You are Mateo Gonzalez, Sales Support Agent for DRU AI Consulting.
TERMINOLOGY: Assessment = tool at assessment.druaiconsulting.com | DRU CLEAR™ Scorecard = personalized results | Diagnostics = consulting service components.
OFFERS: DRU CLEAR™ AI Readiness Assessment (free) | Strategic Diagnostic ($3,497) | Executive Diagnostic ($4,997) | From Confusion to Confident with AI™ Course ($497–$1,497).
Include: sales focus, pipeline health, follow-up actions, sales tip, objection handling. All leads → assessment.druaiconsulting.com first.`, 'normal', 0, null, 3000);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });
  } else if (route.pipeline === 'p1_aaliyah') {
    const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY; let leadContext = 'No lead data available today.';
    if (url && key) { const today = new Date().toISOString().split('T')[0]; const r = await fetch(`${url}/rest/v1/chief_of_staff_queue?run_date=eq.${today}&agent_id=eq.ryan&order=created_at.desc&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }); if (r.ok) { const d = await r.json(); if (d?.[0]?.raw_output) leadContext = d[0].raw_output; } }
    const id = await runAgentToCSQ('aaliyah', 'Aaliyah Foster', 'Revenue & Growth', 'personalized_outreach_messages', 'outreach',
      `You are Aaliyah Foster, Personalized Outreach Agent for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.
Write personalized outreach for each high-intent lead — LinkedIn DM (150 words max) and email (subject + 200 word body). Naturally mention DRU CLEAR™ AI Readiness Scorecard and assessment.druaiconsulting.com. If no high-intent leads, write a warm outreach template.
Lead Intelligence:\n${leadContext}`, 'high');
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });
  } else if (route.pipeline === 'p1_jaylen') {
    const id = await runAgentToCSQ('jaylen', 'Jaylen Brooks', 'Revenue & Growth', 'email_campaign_content', 'email_marketing',
      `You are Jaylen Brooks, Email Marketing Agent for DRU AI Consulting. Generate today's email marketing content. Audience: executives navigating AI. Offers: DRU CLEAR™ (free), Strategic Diagnostic ($3,497), Executive Diagnostic ($4,997), Course ($497–$1,497).
Rotate: nurture email (tier-based), re-engagement, or promotional. Include: subject line + A/B variant, preview text, body (300 words max). CTA: assessment.druaiconsulting.com.`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });
  } else if (route.pipeline === 'p1_chloe') {
    const id = await runAgentToCSQ('chloe', 'Chloe Dubois', 'Revenue & Growth', 'daily_copy_asset', 'copywriting',
      `You are Chloe Dubois, Copy Writer for DRU AI Consulting. Generate one copy asset today. Rotate: ad copy, landing page headline+subhead+hero, CTA button variations (5 options), or testimonial prompt template. Brand: "AI Mastery. Leadership Clarity. Measurable Results." CTA destination: assessment.druaiconsulting.com. Every word earns its place.`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });
  } else if (route.pipeline === 'p1_zara') {
    const id = await runAgentToCSQ('zara', 'Zara Ahmed', 'Revenue & Growth', 'product_launch_readiness', 'product_launch',
      `You are Zara Ahmed, Product Launch Agent for DRU AI Consulting. Generate weekly product launch readiness report. Offers: DRU CLEAR™ (assessment.druaiconsulting.com), Strategic Diagnostic ($3,497), Executive Diagnostic ($4,997), From Confusion to Confident with AI™ (Sprint 4), Daily Connections tiers. Assess: launch readiness, marketing gaps, one improvement recommendation, pricing insight, next week priority.`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });
  } else if (route.pipeline === 'p1_elena') {
    const id = await runAgentToCSQ('elena', 'Elena Vasquez', 'Revenue & Growth', 'product_knowledge_update', 'product_knowledge',
      `You are Elena Vasquez, Product Knowledge Agent for DRU AI Consulting. Generate weekly product knowledge update. Include: 5 executive FAQs, offer comparison guide (all starting with assessment.druaiconsulting.com), objection + response per offer, one positioning insight.`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });
  } else if (route.pipeline === 'p1_kwame') {
    const id = await runAgentToCSQ('kwame', 'Kwame Asante', 'Revenue & Growth', 'proposal_template_update', 'proposals',
      `You are Kwame Asante, Proposal Writer for DRU AI Consulting. Generate weekly proposal update. Include: executive summary template for Executive Diagnostic ($4,997) in McKinsey-style, proposal outline for C-suite client, value proposition (3 versions: short/medium/long), one proposal best practice. Brand: DeAnna R. Upshaw — 25+ years IT, 10+ years leadership development, AI Authority.`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  } else if (route.pipeline === 'p2_camila') {
    const count = await runCamila();
    res.status(202).json({ success: true, agent: route.agent_name, posts_generated: count });
  } else if (route.pipeline === 'p2_darius') {
    const id = await runDarius();
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });
  } else if (route.pipeline === 'p2_ravi') {
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
    const id = await runAgentToCSQ('ravi', 'Ravi Gupta', 'Content & Brand', 'generate_design_brief', 'design_brief',
      `You are Ravi Gupta, Graphic Designer for DRU AI Consulting. Brand: Navy #0A2342, Gold #D4AF37, Magenta #C2185B. Fonts: Playfair Display (headlines), Inter (body). Generate creative design brief for today's LinkedIn visual. Include: visual concept, layout, color palette, image direction, typography, AI image generation prompt. Today: ${today}. CTA destination: assessment.druaiconsulting.com.`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });
  } else if (route.pipeline === 'p2_yara') {
    const url2 = process.env.VITE_SUPABASE_URL; const key2 = process.env.SUPABASE_SERVICE_ROLE_KEY; let topPost = '';
    if (url2 && key2) { const monday = new Date(); monday.setDate(monday.getDate() - monday.getDay() + 1); const weekOf = monday.toISOString().split('T')[0]; const r = await fetch(`${url2}/rest/v1/content_queue?week_of=eq.${weekOf}&status=neq.queued&order=day_number.asc&limit=1`, { headers: { apikey: key2, Authorization: `Bearer ${key2}` } }); if (r.ok) { const q = await r.json(); if (q.length > 0) topPost = `${q[0].hook}\n\n${q[0].content}\n\n${q[0].hashtags}`; } }
    const id = await runAgentToCSQ('yara', 'Yara Mansour', 'Content & Brand', 'spanish_localization', 'localization',
      `You are Yara Mansour, Translator for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. ${topPost ? `Translate and localize for LATAM executives (Costa Rica, Dominican Republic, broader LATAM):\n\n${topPost}\n\nFull Spanish translation, localization notes, translated hashtags. Keep assessment.druaiconsulting.com in CTA.` : 'Write an original LinkedIn post in Spanish for LATAM executives. Include assessment.druaiconsulting.com as CTA.'}`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });
  } else if (route.pipeline === 'p2_ingrid') {
    const url3 = process.env.VITE_SUPABASE_URL; const key3 = process.env.SUPABASE_SERVICE_ROLE_KEY; let weekContent = '';
    if (url3 && key3) { const monday = new Date(); monday.setDate(monday.getDate() - monday.getDay() + 1); const weekOf = monday.toISOString().split('T')[0]; const r = await fetch(`${url3}/rest/v1/content_queue?week_of=eq.${weekOf}&order=day_number.asc`, { headers: { apikey: key3, Authorization: `Bearer ${key3}` } }); if (r.ok) { const posts = await r.json(); weekContent = posts.map((p: any) => `Day ${p.day_number} (${p.framework_covered}): ${p.hook}`).join('\n'); } }
    const id = await runAgentToCSQ('ingrid', 'Ingrid Larsen', 'Content & Brand', 'weekly_press_release', 'press_release',
      `You are Ingrid Larsen, Press Release Writer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority, CEO/Founder. This week's content: ${weekContent || 'AI leadership, DRU frameworks, executive AI adoption'}. Write AP-style press release. Include: FOR IMMEDIATE RELEASE / Headline / Subheadline / Lead paragraph / Body (2-3 paragraphs with DeAnna quotes) / Boilerplate mentioning assessment.druaiconsulting.com / Contact: druaiconsulting@gmail.com`);
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  } else if (route.pipeline === 'p3_nia') {
    const id = await runNia();
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });
  } else if (route.pipeline === 'p3_luca') {
    const id = await runLuca();
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });
  } else if (route.pipeline === 'p3_hyunji') {
    const id = await runHyunJi();
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });
  } else if (route.pipeline === 'p3_andre') {
    const id = await runAndre();
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  } else if (route.pipeline === 'p4_amara') {
    const id = await runAmara();
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });
  } else if (route.pipeline === 'p4_diego') {
    const id = await runDiego();
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });
  } else if (route.pipeline === 'p4_yuki') {
    const id = await runYuki();
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });
  } else if (route.pipeline === 'p4_marcus') {
    const id = await runMarcus();
    res.status(202).json({ success: true, agent: route.agent_name, csq_id: id });

  } else {
    await dispatchToTravisRouter(route, payload, triggeredAt, sourceLabel);
    res.status(202).json({ success: true, agent: route.agent_name, division: route.division, task: route.task, source: sourceLabel });
  }
}
