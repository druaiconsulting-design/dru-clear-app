// api/ghl-agent-trigger.ts
// 44 agents · 8 divisions (P9 Community Connection in cc-agent-trigger.ts)
// Command chain split to separate files:
//   Isabella  → api/cmd-isabella.ts
//   Governance → api/cmd-governance.ts
//   Command Layer → api/cmd-command-layer.ts
//   Twin Synthesis → api/cmd-twin.ts

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION_ID = 'gl07I4JnbkGgW8zJprSz';
export const config = { maxDuration: 300 };
import { waitUntil } from '@vercel/functions';
import { GENIUS_MODE, VOICE_DNA, getAgentKnowledge, getAgentCorrections } from './_lib/agentKnowledge.js';

interface AgentRoute { agent_id: string; agent_name: string; division: string; task: string; pipeline?: string; }
interface TriggerPayload { trigger_type: string; source?: string; [key: string]: unknown; }
interface ScoredLead { contact_id: string; name: string; email: string; phone: string; source: string; recommended_action: string; notes: string; }
interface OmarResult { success: boolean; total_leads_scanned: number; scored_leads: ScoredLead[]; run_date: string; error?: string; already_purchased_skipped?: number; }
interface CSQItem { id: string; agent_id: string; agent_name: string; division: string; task: string; category: string; raw_output: string; priority: string; retry_count?: number; correction_notes?: string; parent_csq_id?: string; raymond_notes?: string; raymond_action?: string; raymond_priority?: string; travis_notes?: string; priya_notes?: string; governance_notes?: string; legal_notes?: string; isabella_flags?: string; compliance_score?: number; }

const AGENT_ROUTES: Record<string, AgentRoute> = {
  cron_omar_lead_score:           { agent_id: 'omar',     agent_name: 'Omar Patel',        division: 'Revenue, Growth & Sales', task: 'scan_score_route_leads',        pipeline: 'p1_omar' },
  cron_ryan_crm_update:           { agent_id: 'ryan',     agent_name: 'Ryan Nakamura',     division: 'Revenue, Growth & Sales', task: 'overnight_crm_sync',            pipeline: 'p1_ryan' },
  cron_serena_coaching:           { agent_id: 'serena',   agent_name: 'Serena Jackson',    division: 'Revenue, Growth & Sales', task: 'morning_coaching_briefing',     pipeline: 'p1_serena' },
  cron_mateo_sales_support:       { agent_id: 'mateo',    agent_name: 'Mateo Gonzalez',    division: 'Revenue, Growth & Sales', task: 'sales_pipeline_review',         pipeline: 'p1_mateo' },
  cron_aaliyah_outreach:          { agent_id: 'aaliyah',  agent_name: 'Aaliyah Foster',    division: 'Revenue, Growth & Sales', task: 'personalized_outreach_messages',pipeline: 'p1_aaliyah' },
  cron_aaliyah_prospect_scout:    { agent_id: 'aaliyah',  agent_name: 'Aaliyah Foster',    division: 'Revenue, Growth & Sales', task: 'prospect_scout',                pipeline: 'p1_aaliyah_scout' },
  cron_jaylen_email:              { agent_id: 'jaylen',   agent_name: 'Jaylen Brooks',     division: 'Revenue, Growth & Sales', task: 'email_campaign_content',        pipeline: 'p1_jaylen' },
  cron_chloe_copy:                { agent_id: 'chloe',    agent_name: 'Chloe Dubois',      division: 'Revenue, Growth & Sales', task: 'daily_copy_asset',              pipeline: 'p1_chloe' },
  cron_zara_product:              { agent_id: 'zara',     agent_name: 'Zara Ahmed',        division: 'Client Delivery', task: 'acc_weekly_pdf_content',        pipeline: 'p1_zara' },
  cron_elena_knowledge:           { agent_id: 'elena',    agent_name: 'Elena Vasquez',     division: 'Revenue, Growth & Sales', task: 'product_knowledge_update',      pipeline: 'p1_elena' },
  cron_kwame_proposal:            { agent_id: 'kwame',    agent_name: 'Kwame Asante',      division: 'Revenue, Growth & Sales', task: 'proposal_template_update',      pipeline: 'p1_kwame' },
  manual_kwame_grant_draft:       { agent_id: 'kwame',    agent_name: 'Kwame Asante',      division: 'Revenue, Growth & Sales', task: 'grant_application_draft',       pipeline: 'p1_kwame_grants' },
  cron_adaeze_grant_scout:        { agent_id: 'adaeze',   agent_name: 'Adaeze Nwosu',      division: 'Revenue, Growth & Sales', task: 'weekly_grant_scout',            pipeline: 'p1_adaeze_scout' },
  cron_camila_linkedin_queue:     { agent_id: 'camila',   agent_name: 'Camila Flores',     division: 'Content & Brand',  task: 'generate_weekly_linkedin_queue',pipeline: 'p2_camila' },
  cron_darius_linkedin_post:      { agent_id: 'darius',   agent_name: 'Darius King',       division: 'Content & Brand',  task: 'generate_daily_linkedin_post',  pipeline: 'p2_darius' },
  cron_ravi_design_brief:         { agent_id: 'ravi',     agent_name: 'Ravi Gupta',        division: 'Content & Brand',  task: 'generate_design_brief',         pipeline: 'p2_ravi' },
  cron_yara_localization:         { agent_id: 'yara',     agent_name: 'Yara Mansour',      division: 'Content & Brand',  task: 'spanish_localization',          pipeline: 'p2_yara' },
  cron_ingrid_press_release:      { agent_id: 'ingrid',   agent_name: 'Ingrid Larsen',     division: 'Content & Brand',  task: 'weekly_press_release',          pipeline: 'p2_ingrid' },
  cron_nia_content_daily:         { agent_id: 'nia',      agent_name: 'Nia Robinson',      division: 'Marketing',        task: 'daily_content_creation',        pipeline: 'p3_nia' },
  cron_luca_digital_marketing:    { agent_id: 'luca',     agent_name: 'Luca Romano',       division: 'Marketing',        task: 'digital_marketing_briefing',    pipeline: 'p3_luca' },
  cron_hyunji_analytics:          { agent_id: 'hyunji',   agent_name: 'Hyun-Ji Kim',       division: 'Marketing',        task: 'analytics_roi_briefing',        pipeline: 'p3_hyunji' },
  cron_andre_seo:                 { agent_id: 'andre',    agent_name: 'Andre Mitchell',    division: 'Marketing',        task: 'seo_sem_brand_briefing',        pipeline: 'p3_andre' },
  cron_amara_legal_tuesday:       { agent_id: 'amara',    agent_name: 'Amara Okafor',      division: 'Legal & Finance',  task: 'weekly_legal_briefing',         pipeline: 'p4_amara' },
  cron_diego_expense_tuesday:     { agent_id: 'diego',    agent_name: 'Diego Reyes',       division: 'Legal & Finance',  task: 'weekly_expense_report',         pipeline: 'p4_diego' },
  cron_yuki_financial_tuesday:    { agent_id: 'yuki',     agent_name: 'Yuki Tanaka',       division: 'Legal & Finance',  task: 'weekly_financial_report',       pipeline: 'p4_yuki' },
  cron_marcus_tax_tuesday:        { agent_id: 'marcus',   agent_name: 'Marcus Chen',       division: 'Legal & Finance',  task: 'weekly_tax_strategy_briefing',  pipeline: 'p4_marcus' },
  cron_khalid_disclaimer_daily:   { agent_id: 'khalid',   agent_name: 'Khalid Hassan',     division: 'AI Governance',    task: 'daily_disclaimer_review',       pipeline: 'p5_khalid' },
  cron_sofia_privacy_daily:       { agent_id: 'sofia',    agent_name: 'Sofia Petrov',      division: 'AI Governance',    task: 'daily_privacy_compliance',      pipeline: 'p5_sofia' },
  cron_james_contract_daily:      { agent_id: 'james',    agent_name: 'James Osei',        division: 'AI Governance',    task: 'daily_contract_readiness',      pipeline: 'p5_james' },
  cron_meilin_brand_daily:        { agent_id: 'meilin',   agent_name: 'Mei Lin',           division: 'AI Governance',    task: 'daily_brand_protection',        pipeline: 'p5_meilin' },
  cron_rafael_learning_daily:     { agent_id: 'rafael',   agent_name: 'Rafael Torres',     division: 'AI Governance',    task: 'daily_ai_intelligence',         pipeline: 'p5_rafael' },
  cron_naomi_recruiting_daily:    { agent_id: 'naomi',    agent_name: 'Naomi Williams',    division: 'HR',               task: 'daily_recruiting_status',       pipeline: 'p6_naomi' },
  cron_aiden_onboarding_daily:    { agent_id: 'aiden',    agent_name: 'Aiden Park',        division: 'HR',               task: 'daily_onboarding_readiness',    pipeline: 'p6_aiden' },
  cron_fatima_helpdesk_daily:     { agent_id: 'fatima',   agent_name: 'Fatima Al-Rashid',  division: 'HR',               task: 'daily_internal_helpdesk',       pipeline: 'p6_fatima' },
  cron_keisha_onboarding_daily:   { agent_id: 'keisha',   agent_name: 'Keisha Thompson',   division: 'Client Delivery',  task: 'daily_client_onboarding',       pipeline: 'p7_keisha' },
  cron_marco_community_daily:     { agent_id: 'marco',    agent_name: 'Marco Silva',       division: 'Client Delivery',  task: 'daily_community_management',    pipeline: 'p7_marco' },
  cron_leila_feedback_daily:      { agent_id: 'leila',    agent_name: 'Leila Nasser',      division: 'Client Delivery',  task: 'daily_feedback_coaching',       pipeline: 'p7_leila' },
  cron_jordan_creative_daily:     { agent_id: 'jordan',   agent_name: 'Jordan Hayes',      division: 'Client Delivery',  task: 'daily_creative_direction',      pipeline: 'p7_jordan' },
  cron_simone_course_daily:       { agent_id: 'simone',   agent_name: 'Simone Laurent',    division: 'Client Delivery',  task: 'daily_course_architecture',     pipeline: 'p7_simone' },
  cron_theo_presentation_daily:   { agent_id: 'theo',     agent_name: 'Theo Nguyen',       division: 'Client Delivery',  task: 'daily_presentation_design',     pipeline: 'p7_theo' },
  cron_amelia_video_daily:        { agent_id: 'amelia',   agent_name: 'Amelia Santos',     division: 'Client Delivery',  task: 'daily_video_production',        pipeline: 'p7_amelia' },
  cron_isaiah_support_daily:      { agent_id: 'isaiah',   agent_name: 'Isaiah Carter',     division: 'Customer Support', task: 'daily_issue_resolution',        pipeline: 'p8_isaiah' },
  cron_priscilla_comms_daily:     { agent_id: 'priscilla',agent_name: 'Priscilla Okonkwo', division: 'Customer Support', task: 'daily_multichannel_comms',      pipeline: 'p8_priscilla' },

  lead_created:         { agent_id: 'omar',    agent_name: 'Omar Patel',     division: 'Revenue, Growth & Sales', task: 'score_new_lead' },
  contact_updated:      { agent_id: 'ryan',    agent_name: 'Ryan Nakamura',  division: 'Revenue, Growth & Sales', task: 'process_contact_update' },
  assessment_completed: { agent_id: 'omar',    agent_name: 'Omar Patel',     division: 'Revenue, Growth & Sales', task: 'route_assessment_lead', pipeline: 'p1_omar_realtime' },
  support_ticket:       { agent_id: 'isaiah',  agent_name: 'Isaiah Carter',  division: 'Customer Support', task: 'handle_support_request' },
  cc_upsell_signal:     { agent_id: 'aaliyah', agent_name: 'Aaliyah Foster', division: 'Revenue, Growth & Sales', task: 'cc_upsell_outreach' },
};

const AALIYAH_CC_ROUTING: Record<string, string> = {
  navigator_upgrade:   'https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/u4dd3zsaVRZUW73wMc5t',
  accelerator_upgrade: 'https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/AlZQHDN7D7PIvApW0qDF',
  diagnostic_interest: 'https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/ec61ce1a-faf0-481f-9404-d6269fbda861',
  course_interest:     'https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/EDVsKWuDioWGDHaI1K7S',
};

async function callAnthropic(prompt: string, maxTokens = 2000, model = 'claude-haiku-4-5-20251001'): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const startedAt = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify({model,max_tokens:maxTokens,messages:[{role:'user',content:prompt}]})});
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
  const rate = model.startsWith('claude-sonnet') ? { in: 3, out: 15 } : { in: 1, out: 5 };
  const cost_usd = (inputTokens / 1_000_000) * rate.in + (outputTokens / 1_000_000) * rate.out;
  await fetch(`${url}/rest/v1/model_usage_log`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ source_file: 'ghl-agent-trigger', model, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd, duration_ms: durationMs }) });
}
// Web-search-enabled Anthropic call — used only by Adaeze's weekly grant scout.
// max_uses hard-caps search calls per run (cost control after the July on-demand
// cascade incident); Anthropic bills web search at $10/1,000 searches, so a cap
// of 6 keeps a weekly run to a few cents regardless of what Claude tries to do.
async function callAnthropicWithWebSearch(prompt: string, maxTokens = 3000, maxSearches = 6, label = 'web_search'): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:maxTokens,messages:[{role:'user',content:prompt}],tools:[{type:'web_search_20250305',name:'web_search',max_uses:maxSearches}]})});
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = await res.json();
  const blocks = (data.content ?? []) as Array<{type:string;text?:string;name?:string;input?:{query?:string};content?:Array<{url?:string;title?:string}>}>;

  // Previously discarded entirely -- only text blocks were kept, so there was
  // no way to see what was actually searched. Logs every query issued and how
  // many results came back for it.
  const queries = blocks.filter(b => b.type === 'server_tool_use' && b.name === 'web_search').map(b => b.input?.query ?? '(no query)');
  const resultBlocks = blocks.filter(b => b.type === 'web_search_tool_result');
  const resultCounts = resultBlocks.map(b => Array.isArray(b.content) ? b.content.length : 0);
  if (queries.length > 0) {
    queries.forEach((q, i) => {
      console.log(`[${label}] Searched: "${q}" — ${resultCounts[i] ?? '?'} result(s)`);
      // Diagnostic (Aug 25, 2026): log each result's title so we can see WHAT was
      // found, not just how many — needed to tell "genuinely nothing out there"
      // apart from "results came back but didn't name a specific person/org."
      const titles = (resultBlocks[i]?.content ?? []).map(r => r.title ?? '(no title)');
      titles.forEach(t => console.log(`[${label}]   - ${t}`));
    });
  } else {
    console.log(`[${label}] No web searches were issued for this run.`);
  }

  return blocks.filter(b=>b.type==='text').map(b=>b.text ?? '').join('\n').trim();
}

// Finds the first complete top-level JSON object in a text blob, ignoring any
// commentary Claude wraps around it. Mirrors the extractor pattern already used
// in api/process-on-demand.ts.
function extractJSONObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); }
        catch { return null; }
      }
    }
  }
  return null;
}

async function writeGrantOpportunities(items: Record<string,unknown>[]): Promise<number> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key||items.length===0) return 0;
  const res = await fetch(`${url}/rest/v1/grant_opportunities`,{method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`,Prefer:'return=representation'},body:JSON.stringify(items)});
  if (!res.ok){console.error(`[adaeze] grant_opportunities write failed: ${await res.text()}`);return 0;}
  const data = await res.json(); return Array.isArray(data)?data.length:0;
}

// Fuzzy dedup — catches the SAME grant re-found with a reworded name across different
// scout runs (was exact-match only, which let ~130 duplicate rows through over 6 weeks
// -- cleaned up Aug 28, 2026). Strips filler words/punctuation, compares remaining
// significant words; 60%+ overlap counts as already known.
const GRANT_DEDUP_STOPWORDS = new Set(['the','grant','grants','program','small','business','businesses','for','women','owned','of','and','monthly','quarterly','award','awards','a','initiative','fund','fellowship']);
function grantNameTokens(name: string): Set<string> {
  const cleaned = String(name || '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9 ]/g, ' ');
  return new Set(cleaned.split(/\s+/).filter(w => w.length > 1 && !GRANT_DEDUP_STOPWORDS.has(w)));
}
async function getKnownGrantTokenSets(): Promise<Set<string>[]> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key) return [];
  const res = await fetch(`${url}/rest/v1/grant_opportunities?select=opportunity_name`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  if (!res.ok) return [];
  const rows = await res.json() as {opportunity_name:string}[];
  return rows.map(r => grantNameTokens(r.opportunity_name));
}
function isKnownGrant(name: string, knownSets: Set<string>[]): boolean {
  const tokens = grantNameTokens(name);
  if (tokens.size === 0) return false;
  for (const known of knownSets) {
    if (known.size === 0) continue;
    let overlap = 0;
    for (const t of tokens) if (known.has(t)) overlap++;
    if (overlap / Math.min(tokens.size, known.size) >= 0.6) return true;
  }
  return false;
}

async function runAdaezeScout(): Promise<{count:number;csqId:string|null}> {
  try {
    const agentKnowledge = await getAgentKnowledge();
    const agentCorrections = await getAgentCorrections('Adaeze Nwosu');
    const prompt = `${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}${agentCorrections}\n\nYou are Adaeze Nwosu, Grant Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority, Founder/CEO of Dimensional Solns, LLC (a FOR-PROFIT AI leadership & culture consulting business, not a nonprofit). Brand fit: AI adoption/leadership training, women-owned business, 5C Cultural DNA™, 5D Leadership™, DRU CLEAR™ AI Readiness frameworks.\n\nSearch the web broadly (no certification status assumed — search as if broadly eligible) for CURRENTLY OPEN small-business grants, grant contests, or funding programs a for-profit consulting/leadership-training business could realistically apply to. Do NOT include federal grants.gov-style research/nonprofit grants — those don't fit a for-profit LLC. Focus on: corporate small-business grant programs, women-owned/minority-owned business grant contests, and small-business funding competitions with open or upcoming application windows.\n\nRespond with ONLY a single JSON object, no preamble, no markdown fences:\n{\n  \"opportunities\": [\n    {\n      \"opportunity_name\": string,\n      \"funder\": string,\n      \"amount_range\": string,\n      \"eligibility\": string,\n      \"deadline\": string (YYYY-MM-DD if known, else best available description),\n      \"source_url\": string,\n      \"fit_score\": number (1-10, how well this fits DeAnna's brand/business),\n      \"fit_reasoning\": string (1-2 sentences)\n    }\n  ]\n}\nOnly include opportunities you found real, current information on. If you find none, return {\"opportunities\": []}.`;
    const [raw, knownSets] = await Promise.all([callAnthropicWithWebSearch(prompt), getKnownGrantTokenSets()]);
    const parsed = extractJSONObject(raw);
    const allFound = Array.isArray(parsed?.opportunities) ? parsed!.opportunities as Record<string,unknown>[] : [];
    // Dedup — fuzzy token-overlap match against every grant already on file, plus
    // within this same run's results (catches reworded re-finds either way)
    const notAlreadyKnown = allFound.filter(o => !isKnownGrant(String(o.opportunity_name||''), knownSets));
    const seenThisRun: Set<string>[] = [];
    const newOnes = notAlreadyKnown.filter(o => {
      const name = String(o.opportunity_name||'');
      if (isKnownGrant(name, seenThisRun)) return false;
      seenThisRun.push(grantNameTokens(name));
      return true;
    });
    if (newOnes.length === 0) return { count: 0, csqId: null }; // nothing new — no card, no noise

    // Filter out expired grants — if the deadline is a past YYYY-MM-DD date, skip it.
    // Rolling/quarterly/descriptive deadlines are kept (no parseable date = still open).
    const todayDate = new Date(); todayDate.setHours(0,0,0,0);
    const activeOnes = newOnes.filter(o => {
      const dl = String(o.deadline ?? '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(dl)) {
        return new Date(dl) >= todayDate;
      }
      return true; // "Rolling", "Quarterly", etc. — keep
    });
    if (activeOnes.length === 0) return { count: 0, csqId: null };

    const rows = activeOnes.map(o => ({...o, status:'new', found_at:new Date().toISOString()}));
    const written = await writeGrantOpportunities(rows);
    // Every opportunity found today, not just a top-5 slice -- DeAnna reviews and
    // picks herself; no funder link in the text itself, the card's own layout
    // (source: adaeze_grants_full_list) puts a "View Funder Page" link and a
    // "Have Kwame Draft This" button directly under each entry.
    const allToday = activeOnes.map((o:any) => {
      // Clean up opportunity_name if it already embeds the funder name in parens — prevents double display
      const cleanName = String(o.opportunity_name ?? '').replace(
        new RegExp(`\\s*\\(${String(o.funder ?? '').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\)`, 'gi'), ''
      ).trim();
      const lines = [
        `**${cleanName}** — ${o.funder}`,
        `Fit: ${o.fit_score}/10 | Amount: ${o.amount_range ?? 'See link'} | Deadline: ${o.deadline}`,
        `Why it fits: ${o.fit_reasoning ?? 'Strong brand alignment'}`,
      ];
      return lines.join('\n');
    }).join('\n\n---\n\n');
    // Write directly to approvals — bypasses CSQ → command layer → Raymond chain
    // which was adding a full day of delay for no benefit (Raymond passes grants through untouched).
    const approvalId = await writeApprovalDirect({
      source: 'adaeze_grants_full_list',
      trigger_type: 'grants',
      agent_name: 'Adaeze Nwosu',
      agent_role: 'Revenue, Growth & Sales',
      division: 'Revenue, Growth & Sales',
      task_brief: `Daily Grant Scout — Adaeze Nwosu | ${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}`,
      output: allToday,
      status: 'pending',
      notify_deanna: false,
      priority: 'normal',
      category: 'grants',
      platform: null,
    });
    return { count: written, csqId: approvalId };
  } catch(error){ console.error('[adaeze] Scout error:',error); return { count:0, csqId:null }; }
}

async function getGrantOpportunityByName(name: string): Promise<Record<string,unknown>|null> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key) return null;
  const res = await fetch(`${url}/rest/v1/grant_opportunities?opportunity_name=ilike.${encodeURIComponent(name)}&limit=1`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  if (!res.ok) return null;
  const rows = await res.json() as Record<string,unknown>[];
  return rows[0] ?? null;
}
async function getOrgProfile(): Promise<Record<string,unknown>|null> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key) return null;
  const res = await fetch(`${url}/rest/v1/org_profile?limit=1`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  if (!res.ok) return null;
  const rows = await res.json() as Record<string,unknown>[];
  return rows[0] ?? null;
}
async function markGrantOpportunity(id: string, fields: Record<string,unknown>): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key) return;
  await fetch(`${url}/rest/v1/grant_opportunities?id=eq.${id}`,{method:'PATCH',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`},body:JSON.stringify(fields)});
}

// ─── On-demand chain helpers (grant drafts only) ──────────────────────────────
// Copied from twin-on-demand.ts's existing on-demand pattern -- same lock, same
// daily spend cap, same api/process-on-demand.ts endpoint Twin's chat-triggered
// tasks already use. This lets a manually-triggered grant draft reach Approvals
// in real time instead of waiting for tomorrow's daily cron cycle. Best-effort
// only: if the lock is busy or the spend cap is reached, this is skipped and the
// draft just falls back to the normal daily cron -- it is never lost either way.

async function acquireOnDemandLock(agentName: string): Promise<boolean> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key) return true; // fail open only if Supabase env vars are missing entirely
  const staleCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const res = await fetch(
    `${url}/rest/v1/on_demand_lock?id=eq.1&or=(is_locked.eq.false,locked_at.lt.${staleCutoff})`,
    { method:'PATCH', headers:{ 'Content-Type':'application/json', apikey:key, Authorization:`Bearer ${key}`, Prefer:'return=representation' },
      body: JSON.stringify({ is_locked:true, locked_at:new Date().toISOString(), locked_by:agentName }) }
  );
  if (!res.ok) return false; // fail closed on error -- safer than risking a second fire
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function releaseOnDemandLock(): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key) return;
  await fetch(`${url}/rest/v1/on_demand_lock?id=eq.1`,{method:'PATCH',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`},body:JSON.stringify({is_locked:false,locked_by:null})})
    .catch((err) => console.error('[kwame-grants] releaseOnDemandLock failed:', err));
}

const ON_DEMAND_CHAIN_COST_ESTIMATE = 0.15; // conservative per-fire estimate, matches twin-on-demand.ts

async function checkAndReserveOnDemandSpend(): Promise<{ ok: boolean; totalSpent?: number; cap?: number }> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key) return { ok: true };
  const today = new Date().toISOString().slice(0, 10);
  await fetch(`${url}/rest/v1/daily_spend_cap`,{method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`,Prefer:'resolution=ignore-duplicates'},body:JSON.stringify({spend_date:today})}).catch(()=>{});
  const readRes = await fetch(`${url}/rest/v1/daily_spend_cap?spend_date=eq.${today}&select=total_spent,cap_amount`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  if (!readRes.ok) return { ok: false };
  const rows = await readRes.json();
  const row = rows[0] ?? { total_spent: 0, cap_amount: 10.0 };
  if (Number(row.total_spent) + ON_DEMAND_CHAIN_COST_ESTIMATE > Number(row.cap_amount)) {
    console.error(`[kwame-grants] Daily spend cap reached: $${row.total_spent}/$${row.cap_amount}`);
    return { ok: false, totalSpent: Number(row.total_spent), cap: Number(row.cap_amount) };
  }
  await fetch(`${url}/rest/v1/daily_spend_cap?spend_date=eq.${today}`,{method:'PATCH',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`},body:JSON.stringify({total_spent:Number(row.total_spent)+ON_DEMAND_CHAIN_COST_ESTIMATE,updated_at:new Date().toISOString()})});
  return { ok: true, totalSpent: Number(row.total_spent) + ON_DEMAND_CHAIN_COST_ESTIMATE, cap: Number(row.cap_amount) };
}
// Kwame's second job: Grant Writer. Drafts the ONE opportunity DeAnna names --
// no automatic selection, no fit_score ranking, no cron. She researches the funder
// herself and tells Claude/the admin which opportunity to draft; that name is passed
// in as opportunityName. Goes through the normal CSQ -> Isabella -> Governance ->
// Raymond pipeline (not the direct-to-approvals bypass Adaeze/Aaliyah use for
// scouting), since DeAnna wants compliance review on actual application drafts
// before they reach her.
async function writeAgentCorrection(agentName: string, note: string, source: string, task?: string): Promise<void> {
  if (!note) return;
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key) return;
  await fetch(`${url}/rest/v1/agent_corrections`,{method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`,Prefer:'return=minimal'},body:JSON.stringify({agent_name:agentName,correction_note:note,source,...(task?{task}:{})})})
    .catch((err) => console.error(`[kwame-grants] writeAgentCorrection failed for ${agentName}:`, err));
}

async function runKwameGrantWriter(opportunityName: string): Promise<{count:number;csqId:string|null}> {
  try {
    if (!opportunityName || !opportunityName.trim()) { console.error('[kwame] Grant Writer: no opportunity name given'); return { count: 0, csqId: null }; }
    const [opportunity, orgProfile] = await Promise.all([getGrantOpportunityByName(opportunityName.trim()), getOrgProfile()]);
    if (!opportunity) { console.error(`[kwame] Grant Writer: no opportunity matching "${opportunityName}" found`); return { count: 0, csqId: null }; }
    if (!orgProfile) { console.error('[kwame] Grant Writer: org_profile is empty, cannot draft without real facts'); return { count: 0, csqId: null }; }
    const agentKnowledge = await getAgentKnowledge();
    const agentCorrections = await getAgentCorrections('Kwame Asante', 'grant_application_draft');
    const factsBlock = `MISSION: ${orgProfile.mission_statement ?? 'Not provided'}\nBIO/CREDENTIALS: ${orgProfile.bio_credentials ?? 'Not provided'}\nTRACK RECORD: ${orgProfile.track_record ?? 'Not provided'}\nBUDGET CATEGORIES: ${orgProfile.standard_budget_categories ?? 'Not provided'}\nPERSONAL STORY: ${opportunity.personal_story ?? 'Not provided'}\nTESTIMONIALS/SUCCESS STORIES: ${opportunity.testimonials_success_stories ?? 'Not provided'}`;
    const realStandard = `R-ELATABLE: Connect your proposal to the needs and interests of the grantor by demonstrating an understanding of their mission, goals, and priorities.\nE-DUCATIONAL: Clearly explain the impact and outcomes of your project or business, including how it addresses the needs of your target audience or community.\nA-CTIONABLE: Outline concrete steps and strategies for achieving your goals, including a detailed plan for how grant funds will be utilized and managed.\nL-OVABLE: Infuse passion and authenticity into your proposal to make it stand out to grant reviewers. Share personal anecdotes, testimonials, or success stories that demonstrate your commitment to your business's mission and goals.`;
    const answerThatWins = `\"Artificial intelligence is transforming every industry, yet only 54% of workers have used AI in their jobs over the past year, and just 14% use it daily, leaving millions of entrepreneurs and small businesses without the skills needed to compete in today's digital economy.\n\nOur mission as Certified AI Consultants is to close that gap by providing accessible AI education, business coaching, and financial empowerment programs that help underserved communities embrace technology, increase productivity, and build sustainable businesses.\n\nA $50,000 grant will allow us to expand free AI workshops, educational courses, financial literacy resources, and community partnerships that create lasting economic opportunity. Our passion comes from seeing how AI transformed our own business—saving time, increasing efficiency, and opening doors we never thought possible. Now, our goal is to ensure every entrepreneur, regardless of their background, has the opportunity to succeed in the AI economy.\"`;
    const prompt = `${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}${agentCorrections}\n\nYou are Kwame Asante, Grant Writer for DRU AI Consulting (Dimensional Solns, LLC) — DeAnna R. Upshaw, Leadership Strategist and AI Authority.\n\nGround every specific claim in these real facts about the business:\n${factsBlock}\n\nDraft an application for this specific grant opportunity, which DeAnna has personally reviewed and selected:\nOPPORTUNITY: ${opportunity.opportunity_name}\nFUNDER: ${opportunity.funder}\nAMOUNT: ${opportunity.amount_range}\nELIGIBILITY: ${opportunity.eligibility}\nDEADLINE: ${opportunity.deadline}\nSOURCE: ${opportunity.source_url}\n\nWrite this application to satisfy the R.E.A.L. standard:\n${realStandard}\n\nHere is a real, funded example that received a yes, showing what hitting R.E.A.L. actually looks like in practice -- use it as your reference point for the standard to reach, and write fully original content in your own words for this specific funder:\n${answerThatWins}\n\nUse the mission, track record, budget categories, personal story, and testimonials/success stories given above as the real facts behind each R.E.A.L. element -- search the web to find the funder's own stated mission, goals, and priorities at the source URL to ground R-elatable in this specific funder. Write every sentence describing what a client experienced, reported, or achieved by drawing directly from the testimonials and track record given above. Describe what the frameworks are designed to deliver in forward-looking language. Build the closing from whichever facts are strongest among personal story, testimonials, mission, track record, and budget categories.\n\nSearch the web if needed to confirm the funder's actual application questions/format at the source URL. Write the application content in plain text, matching exactly what that funder's own application asks for -- their specific sections and questions when the source describes them.\n\nAlso determine how this grant is actually submitted: if the funder's own page states a direct application email address, extract it exactly. Otherwise (a web portal, online form, or third-party platform), mark it as a portal submission.\n\nRespond with ONLY a single JSON object, no preamble, no markdown fences:\n{\n  \"application_draft\": string (the full application content, plain text, ready for DeAnna to review),\n  \"submission_method\": \"email\" | \"portal\",\n  \"submission_email\": string or null (only if submission_method is \"email\" and a real address was found)\n}`;
    const raw = await callAnthropicWithWebSearch(prompt, 3000, 4, 'kwame');
    const parsed = extractJSONObject(raw) as Record<string,unknown> | null;
    if (!parsed?.application_draft) { console.error('[kwame] Grant Writer: no draft returned'); return { count: 0, csqId: null }; }
    const method = parsed.submission_method === 'email' && parsed.submission_email ? 'email' : 'portal';
    const cleanName = String(opportunity.opportunity_name ?? '').replace(
      new RegExp(`\\s*\\(${String(opportunity.funder ?? '').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\)`, 'gi'), ''
    ).trim();
    const submissionLine = method === 'email'
      ? `**Submission (email):** [Click to open a pre-filled email to ${parsed.submission_email}](mailto:${encodeURIComponent(String(parsed.submission_email))}?subject=${encodeURIComponent(`Grant Application — DRU AI Consulting — ${cleanName}`)}&body=${encodeURIComponent(String(parsed.application_draft))}) -- review before sending, nothing sends automatically.`
      : `**Submission (portal):** This funder takes applications through their own site, not email. Apply directly here: ${opportunity.source_url ?? 'source URL not found'}`;

    // Chloe/Kwame R.E.A.L. loop -- up to 3 total review passes, matching
    // Isabella's own 3-strike shape. A real gap logs a correction for Kwame
    // immediately and triggers one automatic rewrite; if it still doesn't hit
    // R.E.A.L. on the 3rd pass, this hard-rejects in the same shape Isabella's
    // on-demand hard-rejects use, so it surfaces via the existing addressable-
    // block UI automatically -- nothing new needed there. DeAnna only ever
    // sees the final result: either a clean draft, or a rejected block she can
    // talk to Kwame about directly.
    let currentDraft = String(parsed.application_draft);
    let chloeFlags = 'none';
    let chloeNotes = '';
    let hitsReal = false;

    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        const chloeCorrections = await getAgentCorrections('Chloe Dubois');
        const chloePrompt = `${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}${chloeCorrections}\n\nYou are Chloe Dubois, Copy Writer for DRU AI Consulting (Dimensional Solns, LLC). Kwame Asante, the Grant Writer, just finished the grant application draft below. Judge it specifically against the R.E.A.L. standard:\n\n${realStandard}\n\nHere is a real, funded example that received a yes, showing what hitting R.E.A.L. actually looks like in practice -- use it as your reference point for the standard to reach:\n${answerThatWins}\n\nGRANT OPPORTUNITY:\nFUNDER: ${opportunity.funder}\nAMOUNT: ${opportunity.amount_range}\n\nKWAME'S DRAFT:\n${currentDraft}\n\nRespond with ONLY a single JSON object, no preamble, no markdown fences:\n{\n  \"hits_real\": boolean (true only if the draft fully satisfies all four R.E.A.L. elements),\n  \"correction_notes\": string (specific, actionable instructions Kwame can act on to close exactly what's missing -- empty string if hits_real is true)\n}`;
        const chloeRaw = await callAnthropic(chloePrompt, 1000);
        const chloeParsed = extractJSONObject(chloeRaw) as {hits_real?: boolean; correction_notes?: string} | null;
        hitsReal = chloeParsed?.hits_real === true;
        chloeNotes = String(chloeParsed?.correction_notes ?? '');
        chloeFlags = hitsReal ? 'none' : (chloeNotes || 'Did not fully satisfy the R.E.A.L. standard.');
      } catch (error) {
        // A Chloe failure never blocks Kwame's draft -- same guarantee the
        // original single-pass review had. Let the current draft through
        // rather than letting one bad API call silently kill the whole thing.
        console.error('[chloe] R.E.A.L. review error, letting current draft through unblocked:', error);
        hitsReal = true;
        chloeNotes = '';
        chloeFlags = 'none';
      }

      if (hitsReal) break;

      await writeAgentCorrection('Kwame Asante', chloeNotes, 'chloe_real_review', 'grant_application_draft');

      if (attempt === 2) break;

      try {
        const rewritePrompt = `${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}${agentCorrections}\n\nYou are Kwame Asante, Grant Writer for DRU AI Consulting (Dimensional Solns, LLC). Chloe Dubois, your Copy Writer, reviewed your draft against the R.E.A.L. standard and found gaps. Revise your draft to close them fully.\n\nHER NOTES:\n${chloeNotes}\n\nYOUR PREVIOUS DRAFT:\n${currentDraft}\n\nGround every specific claim in these real facts about the business:\n${factsBlock}\n\nGRANT OPPORTUNITY:\nFUNDER: ${opportunity.funder}\nAMOUNT: ${opportunity.amount_range}\n\nRespond with ONLY a single JSON object, no preamble, no markdown fences:\n{\n  \"application_draft\": string (your fully revised application, closing every gap Chloe found)\n}`;
        const rewriteRaw = await callAnthropic(rewritePrompt, 3000);
        const rewriteParsed = extractJSONObject(rewriteRaw) as {application_draft?: string} | null;
        if (rewriteParsed?.application_draft) currentDraft = String(rewriteParsed.application_draft);
      } catch (error) {
        // Keep the previous draft rather than losing everything to one failed rewrite call.
        console.error('[kwame] Rewrite error, keeping previous draft and continuing:', error);
      }
    }

    await markGrantOpportunity(String(opportunity.id), { status: 'drafted', submission_method: method, submission_email: parsed.submission_email ?? null });

    if (!hitsReal) {
      const csqId = await writeToCSQ({
        agent_id: 'kwame', agent_name: 'Kwame Asante', division: 'Revenue, Growth & Sales',
        task: 'grant_application_draft', category: 'grant_applications', context: cleanName,
        raw_output: currentDraft, priority: 'normal', status: 'rejected',
        isabella_flags: chloeFlags, correction_notes: chloeNotes, retry_count: 3,
      });
      console.log(`[kwame-grants] Chloe hard-rejected after 3 passes, CSQ: ${csqId}`);
      return { count: 0, csqId: null };
    }

    const output = `**${cleanName}** — ${opportunity.funder}\nAmount: ${opportunity.amount_range ?? 'See link'} | Deadline: ${opportunity.deadline}\n\n---\n\n${currentDraft}\n\n---\n\n${submissionLine}`;
    const csqId = await writeToCSQ({
      agent_id: 'kwame', agent_name: 'Kwame Asante', division: 'Revenue, Growth & Sales',
      task: 'grant_application_draft', category: 'grant_applications', context: cleanName,
      raw_output: output, priority: 'normal', status: 'pending', retry_count: 0,
    });
    return { count: 1, csqId };
  } catch(error){ console.error('[kwame] Grant Writer error:',error); return { count:0, csqId:null }; }
}

async function getKnownProspectKeys(): Promise<Set<string>> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key) return new Set();
  const res = await fetch(`${url}/rest/v1/prospect_opportunities?select=prospect_name,organization`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  if (!res.ok) return new Set();
  const rows = await res.json() as {prospect_name:string;organization:string}[];
  return new Set(rows.map(r => `${(r.prospect_name||'').trim().toLowerCase()}|${(r.organization||'').trim().toLowerCase()}`));
}

async function writeProspectOpportunities(items: Record<string,unknown>[]): Promise<number> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key||items.length===0) return 0;
  const res = await fetch(`${url}/rest/v1/prospect_opportunities`,{method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`,Prefer:'return=representation'},body:JSON.stringify(items)});
  if (!res.ok){console.error(`[prospect-scout] prospect_opportunities write failed: ${await res.text()}`);return 0;}
  const data = await res.json(); return Array.isArray(data)?data.length:0;
}

// Aaliyah's job: Prospect Scout. Reassigned from Kwame Asante Aug 27, 2026 --
// same approved prompt, word for word, just running under Aaliyah Foster.
// Signal-only — deliberately no demographic, title, company-size, or industry
// filter, per DeAnna's direction. Mirrors runAdaezeScout()'s exact pattern
// (web-search-enabled call, dedup against known rows, write to a dedicated
// table, surface top picks).
async function runAaliyahProspectScout(): Promise<{count:number;csqId:string|null}> {
  try {
    const positioning = await fetchBrandCopy('positioning');
    const agentKnowledge = await getAgentKnowledge();
    const agentCorrections = await getAgentCorrections('Aaliyah Foster');
    const prompt = `${GENIUS_MODE}\n\n${agentKnowledge}${agentCorrections}\n\nYou are Aaliyah Foster, Prospect Scout for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Her positioning is "${positioning}."\n\nWHO YOU ARE LOOKING FOR: your complete, standalone definition of who qualifies is below, independent of any client or framework description elsewhere in this prompt. A real, named person responsible for other people getting results. Any setting, any title, any size, all qualify equally: a crew lead, a unit manager, a school principal, a founder with three employees, a nonprofit director, a department head, a shop owner. Signal-only: what qualifies someone is the real signal they put out, regardless of title, company size, industry, or demographic.\n\nWHAT THE SIGNAL LOOKS LIKE: the person is expressing real pain, in whatever words they use for it. Angry, exhausted, defeated, lost, done trying, at the end of what they know how to do. The pain shows up in areas like these:\n- Confused about AI: overwhelmed, unsure where to start, watching others move while they stand still\n- Their team needs leadership they don't have to give right now\n- Silos: teams that don't talk to each other, and they're carrying the cost\n- Culture problems: trust breaking down, turnover, conflict they can't resolve\n- Any other people-and-AI struggle in this same pattern\n\nSomeone publicly reaching for growth in these same areas qualifies too. Same bar: a real person, their own words, a real stake.\n\nWHERE TO LOOK: search where people speak in their own words, and where a real name is attached to what they said. Interviews, podcast transcripts, quoted case studies in industry press, personal blogs and newsletters, local news, LinkedIn posts and comments.\n\nSEARCH SPREAD: run at least one of your searches aimed specifically at a small-scale or non-corporate setting — a local business, a school, a small nonprofit, a small team. Large, well-known companies are easy to find and fill the other searches on their own; this one exists to reach the settings that don't show up by default.\n\nHARD REQUIREMENT — REAL NAMED INDIVIDUAL: prospect_name is a real, specific, named human being (or organization is a real, specific, named company), grounded in a real quote, post, article, or interview you actually found.\n\nIDENTITY-LEVEL STAKE, NOT TOPIC-LEVEL: the signal shows what the struggle costs this person personally — their trust, their clarity, their confidence, their control, the respect they hold. Example only, not exact wording to search for: a broad statement about a company looking into AI is topic-level; a specific, personal statement about how it's costing them is identity-level.\n\nRespond with ONLY a single JSON object, no preamble, no markdown fences:\n{\n  \"opportunities\": [\n    {\n      \"prospect_name\": string (a real, named individual),\n      \"organization\": string (a real, named company or group),\n      \"stake_word\": string (a single word for the personal stake — e.g. "Trust," "Clarity," "Confidence," "Respect"),\n      \"signal_summary\": string (what the person actually said, close to their own words, and the situation around it — quote directly where you can, plain text, no interpretation added on top of what they said),\n      \"source_url\": string,\n      \"status\": \"new\"\n    }\n  ]\n}\nInclude prospects that pass both requirements above with real, current information you found. A genuine zero-result day is a normal, expected outcome — if nothing clears both bars, return {\"opportunities\": []}. Zero is always a complete, correct answer.`;
    const [raw, knownKeys] = await Promise.all([callAnthropicWithWebSearch(prompt, 3000, 6, 'aaliyah'), getKnownProspectKeys()]);
    const parsed = extractJSONObject(raw);
    const allFound = Array.isArray(parsed?.opportunities) ? parsed!.opportunities as Record<string,unknown>[] : [];
    // Claude's web-search-grounded output can carry raw <cite> markup in its text --
    // strip it from every string field before this ever reaches the table or the card.
    const stripCiteTags = (s: string) => s.replace(/<\/?cite[^>]*>/g, '').replace(/[ \t]{2,}/g, ' ').trim();
    allFound.forEach(o => {
      for (const k of Object.keys(o)) {
        if (typeof o[k] === 'string') o[k] = stripCiteTags(o[k] as string);
      }
    });
    const newOnes = allFound.filter(o => {
      const nameKey = `${String(o.prospect_name||'').trim().toLowerCase()}|${String(o.organization||'').trim().toLowerCase()}`;
      return !knownKeys.has(nameKey);
    });
    console.log(`[aaliyah] Found ${allFound.length} total, ${newOnes.length} new after dedup.`);
    if (newOnes.length === 0) return { count: 0, csqId: null };

    const rows = newOnes.map(o => ({...o, found_at:new Date().toISOString()}));
    const written = await writeProspectOpportunities(rows);
    const top = newOnes.slice(0,5).map((o:any) => [
      `**${o.prospect_name}** — ${o.organization}`,
      `Stake: ${o.stake_word ?? 'n/a'}`,
      `Signal: ${o.signal_summary}`,
      `Source: ${o.source_url ?? 'URL not found'}`,
    ].join('\n')).join('\n\n---\n\n');
    const approvalId = await writeApprovalDirect({
      source: 'aaliyah_prospect_scout',
      trigger_type: 'prospects',
      agent_name: 'Aaliyah Foster',
      agent_role: 'Revenue, Growth & Sales',
      division: 'Revenue, Growth & Sales',
      task_brief: `Prospect Scout — Aaliyah Foster | ${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}`,
      output: `Found ${written} new prospect signal(s):\n\n${top}\n\nFull list stored in the prospect_opportunities table.`,
      status: 'pending',
      notify_deanna: true,
      priority: 'normal',
      category: 'prospects',
      platform: null,
    });
    // SMS/email notification (Aug 24, 2026) -- same GHL webhook Raymond's Daily Briefing
    // uses, fired separately here since this scout bypasses that chain entirely and nothing
    // else would ever trigger it for the card. Only fires when it actually finds something
    // new -- no text on a zero-result day.
    if (written > 0) {
      const webhookUrl = process.env.GHL_NOTIFICATION_WEBHOOK_URL;
      if (webhookUrl) {
        try {
          const label = `${written} new lead${written > 1 ? 's' : ''} found by Aaliyah's Prospect Scout.`;
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'druaiconsulting@gmail.com', phone: '+19796186671',
              first_name: 'DeAnna', last_name: 'Upshaw',
              agent_name: 'Aaliyah Foster', task: 'Prospect Scout',
              approval_id: approvalId, summary: label, triggered_at: new Date().toISOString(),
              review_url: 'https://app.druaiconsulting.com/admin-approvals',
              sms_body: `DRU AI Consulting | ${label}\n\nReview: app.druaiconsulting.com/admin-approvals`,
              email_subject: `DRU AI Consulting — New Leads Found`,
              email_body: `${label}\n\nReview:\nhttps://app.druaiconsulting.com/admin-approvals\n\n— DRU AI Leadership Ecosystem™`,
            }),
          });
          console.log('[aaliyah] Lead notification sent');
        } catch (err) { console.error('[aaliyah] Notification failed (non-fatal):', err); }
      }
    }
    return { count: written, csqId: approvalId };
  } catch(error){ console.error('[aaliyah] Prospect Scout error:',error); return { count:0, csqId:null }; }
}

async function writeApprovalDirect(record: Record<string, unknown>): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const res = await fetch(`${url}/rest/v1/approvals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=representation' },
    body: JSON.stringify(record),
  });
  if (!res.ok) { console.error(`[adaeze] Direct approvals write failed: ${await res.text()}`); return null; }
  const data = await res.json();
  return data?.[0]?.id ?? null;
}

async function writeToCSQ(record: Record<string,unknown>): Promise<string|null> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key) return null;
  const res = await fetch(`${url}/rest/v1/chief_of_staff_queue`,{method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`,Prefer:'return=representation'},body:JSON.stringify(record)});
  if (!res.ok){console.error(`[csq] Write failed: ${await res.text()}`);return null;}
  const data = await res.json(); return data?.[0]?.id ?? null;
}
async function fetchBrandMarks(): Promise<string> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key) return '';
  const res = await fetch(`${url}/rest/v1/brand_marks?active=eq.true&order=created_at.asc`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  if (!res.ok) return '';
  const data = await res.json(); return (data as {mark:string}[]).map(m=>m.mark).join(' | ');
}
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
async function getCSQItems(status: string, limit?: number, afterDate?: string): Promise<CSQItem[]> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key) return [];
  let query = `${url}/rest/v1/chief_of_staff_queue?status=eq.${status}&order=created_at.asc`;
  if (afterDate) query += `&created_at=gte.${afterDate}`;
  if (limit) query += `&limit=${limit}`;
  const res = await fetch(query,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  if (!res.ok) return []; return await res.json();
}
async function updateCSQ(id: string, updates: Record<string,unknown>): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key) return;
  await fetch(`${url}/rest/v1/chief_of_staff_queue?id=eq.${id}`,{method:'PATCH',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`},body:JSON.stringify(updates)});
}


// CROSS-READ HELPER — reads recent CSQ outputs from specified agents
// Used by Camila and Nia to ground their outputs in live ecosystem intelligence
async function getCrossRead(agentIds: string[], days = 7): Promise<string> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return '';
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceDate = since.toISOString().split('T')[0];
    const idList = agentIds.join(',');
    const query = `${url}/rest/v1/chief_of_staff_queue?agent_id=in.(${idList})&run_date=gte.${sinceDate}&order=created_at.desc&limit=12&select=agent_name,division,raw_output,run_date`;
    const res = await fetch(query, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) return '';
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return '';
    return (data as Record<string, string>[]).map(item =>
      `[${item.agent_name} — ${item.run_date}]\n${(item.raw_output || '').slice(0, 450)}`
    ).join('\n\n---\n\n');
  } catch { return ''; }
}

// Content theme log (Aug 24, 2026) -- shared running record of what Darius and Nia have
// each actually published this week, so they can reference/build on each other's real
// output instead of just following the same abstract weekly theme in parallel. Replaces
// the dead content_queue dependency Darius previously read from (nothing has written to
// content_queue since the CSQ migration -- see runDarius below).
async function getContentThemeLog(days = 7): Promise<string> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return '';
  try {
    const since = new Date(); since.setDate(since.getDate() - days);
    const sinceDate = since.toISOString().split('T')[0];
    const res = await fetch(`${url}/rest/v1/content_theme_log?created_at=gte.${sinceDate}&order=created_at.desc&limit=20&select=agent_name,format,theme,framework_covered,hook,created_at`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) return '';
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return '';
    return rows.map((r:any) => {
      const day = new Date(r.created_at).toLocaleDateString('en-US',{weekday:'long',timeZone:'America/Chicago'});
      return `[${r.agent_name} — ${r.format} — ${day}] ${r.theme}${r.framework_covered ? ` (${r.framework_covered})` : ''}${r.hook ? ` | Hook: "${r.hook}"` : ''}`;
    }).join('\n');
  } catch { return ''; }
}

async function writeContentThemeLog(agentId:string, agentName:string, format:string, theme:string, hook?:string|null, frameworkCovered?:string|null): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/content_theme_log`, { method:'POST', headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`,Prefer:'return=minimal'}, body: JSON.stringify([{ agent_id: agentId, agent_name: agentName, format, theme: (theme||'').slice(0,300), hook: hook ? hook.slice(0,300) : null, framework_covered: frameworkCovered || null }]) });
  } catch(err){ console.error('[content_theme_log] write failed:', err); }
}

async function runAgentToCSQ(agentId:string,agentName:string,division:string,task:string,category:string,prompt:string,priority='normal',retryCount=0,parentCsqId:string|null=null,maxTokens=1500,model='claude-haiku-4-5-20251001'): Promise<string|null> {
  try {
    const agentKnowledge = await getAgentKnowledge();
    const agentCorrections = await getAgentCorrections(agentName);
    const output = await callAnthropic(`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${prompt}${agentCorrections}`,maxTokens,model);
    return await writeToCSQ({agent_id:agentId,agent_name:agentName,division,task,category,raw_output:output,priority,status:'pending',retry_count:retryCount,...(parentCsqId?{parent_csq_id:parentCsqId}:{})});
  } catch(error){console.error(`[${agentId}] Error:`,error);return null;}
}

// P1
async function runOmar(): Promise<OmarResult> {
  const ghlApiKey = process.env.GHL_API_KEY;
  if (!ghlApiKey) return {success:false,total_leads_scanned:0,scored_leads:[],run_date:new Date().toISOString(),error:'Missing GHL_API_KEY'};
  try {
    const yesterday = new Date(); yesterday.setHours(yesterday.getHours()-24);
    const res = await fetch(`${GHL_API_BASE}/contacts/?locationId=${GHL_LOCATION_ID}&startAfterDate=${encodeURIComponent(yesterday.toISOString())}&limit=100`,{headers:{Authorization:`Bearer ${ghlApiKey}`,Version:'2021-07-28'}});
    if (!res.ok) throw new Error(`GHL error ${res.status}`);
    const rawLeads = (await res.json()).contacts??[];
    if (rawLeads.length===0) return {success:true,total_leads_scanned:0,scored_leads:[],run_date:new Date().toISOString()};
    // Purchase-suppression (Aug 23, 2026) -- same tags the purchase webhook already writes
    // (diagnostic-purchased, 90-day-purchased, 90-day-completed). Anyone already carrying
    // one of these never gets logged or written up -- no wasted call, no stale pitch to
    // someone who's already bought.
    const PURCHASED_TAGS = new Set(['diagnostic-purchased','90-day-purchased','90-day-completed']);
    const activeLeads = rawLeads.filter((l:any) => !(Array.isArray(l.tags) && l.tags.some((t:string) => PURCHASED_TAGS.has(t))));
    const alreadyPurchasedSkipped = rawLeads.length - activeLeads.length;
    if (activeLeads.length===0) return {success:true,total_leads_scanned:rawLeads.length,scored_leads:[],run_date:new Date().toISOString(),already_purchased_skipped:alreadyPurchasedSkipped};
    const leadSummary = activeLeads.map((l:any)=>({id:l.id,name:`${l.firstName??''} ${l.lastName??''}`.trim(),email:l.email??'',phone:l.phone??'',source:l.source??'unknown',tags:l.tags??[]}));
    const agentKnowledge = await getAgentKnowledge();
    const agentCorrections = await getAgentCorrections('Omar Patel');
    const text = await callAnthropic(`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}${agentCorrections}\n\nYou are Omar Patel, Lead Intelligence Agent for DRU AI Consulting. Every lead is valued equally -- no ranking, no scoring, no intent tiers. For each lead, write one recommended_action inviting them to the DRU CLEAR™ AI Readiness Assessment (assessment.druaiconsulting.com) and one note on what's known about how they came in.\nReturn ONLY JSON array: [{"contact_id":"...","name":"...","email":"...","phone":"...","source":"...","recommended_action":"Invite to DRU CLEAR™ AI Readiness Assessment — assessment.druaiconsulting.com","notes":"..."}]\nLeads: ${JSON.stringify(leadSummary)}`,2000);
    const scored:ScoredLead[] = JSON.parse(text.replace(/\`\`\`json|\`\`\`/g,'').trim());
    return {success:true,total_leads_scanned:rawLeads.length,scored_leads:scored,run_date:new Date().toISOString(),already_purchased_skipped:alreadyPurchasedSkipped};
  } catch(error){return {success:false,total_leads_scanned:0,scored_leads:[],run_date:new Date().toISOString(),error:String(error)};}
}
async function runRyan(omarResult:OmarResult): Promise<{csq_id:string|null;crm_updates:number}> {
  const ghlApiKey = process.env.GHL_API_KEY;
  if (!ghlApiKey) return {csq_id:null,crm_updates:0};
  if (omarResult.total_leads_scanned===0){
    const csq_id = await writeToCSQ({agent_id:'ryan',agent_name:'Ryan Nakamura',division:'Revenue, Growth & Sales',task:'overnight_crm_sync',category:'lead_intelligence',raw_output:'**Daily Lead Intelligence — No New Leads**\n\nOmar scanned GHL and found no new contacts in the last 24 hours. No CRM updates required.',priority:'normal',status:'pending',retry_count:0});
    return {csq_id,crm_updates:0};
  }
  let crmUpdates=0;
  for (const lead of omarResult.scored_leads){if (lead.contact_id){await fetch(`${GHL_API_BASE}/contacts/${lead.contact_id}`,{method:'PUT',headers:{Authorization:`Bearer ${ghlApiKey}`,Version:'2021-07-28','Content-Type':'application/json'},body:JSON.stringify({tags:[`ai-reviewed`]})});crmUpdates++;}}
  // Enrich each lead with its original campaign source from `submissions`, joined on
  // ghl_contact_id first (the real identity spine), falling back to email for older rows.
  // This lookup now feeds BOTH the durable lead_scoring_events record (for Aaliyah/Client
  // Delivery) AND Ryan's narrative briefing below (Aug 23, 2026 fix -- previously the
  // source was captured in the database but never actually surfaced in the text DeAnna
  // reads, so content-to-lead attribution was invisible day to day).
  const sbUrlEvents=process.env.VITE_SUPABASE_URL; const sbKeyEvents=process.env.SUPABASE_SERVICE_ROLE_KEY;
  let sourceByContactId: Record<string, string> = {}; let sourceByEmail: Record<string, string> = {};
  if (sbUrlEvents&&sbKeyEvents&&omarResult.scored_leads.length>0){
    try{
      const contactIds=omarResult.scored_leads.map(l=>l.contact_id).filter(Boolean);
      const emails=omarResult.scored_leads.map(l=>l.email).filter(Boolean);
      if (contactIds.length>0){
        const r=await fetch(`${sbUrlEvents}/rest/v1/submissions?ghl_contact_id=in.(${contactIds.join(',')})&select=ghl_contact_id,email,utm_campaign`,{headers:{apikey:sbKeyEvents,Authorization:`Bearer ${sbKeyEvents}`}});
        if (r.ok){const rows=await r.json();for (const row of rows){if (row.ghl_contact_id && row.utm_campaign) sourceByContactId[row.ghl_contact_id]=row.utm_campaign;}}
      }
      if (emails.length>0){
        const r=await fetch(`${sbUrlEvents}/rest/v1/submissions?email=in.(${emails.join(',')})&select=email,utm_campaign&order=created_at.desc`,{headers:{apikey:sbKeyEvents,Authorization:`Bearer ${sbKeyEvents}`}});
        if (r.ok){const rows=await r.json();for (const row of rows){if (row.email && row.utm_campaign && !(row.email in sourceByEmail)) sourceByEmail[row.email]=row.utm_campaign;}}
      }
      const events=omarResult.scored_leads.map(l=>({
        ghl_contact_id: l.contact_id || null,
        name: l.name, email: l.email,
        recommended_action: l.recommended_action,
        source_campaign: (l.contact_id && sourceByContactId[l.contact_id]) || sourceByEmail[l.email] || null,
        run_date: new Date().toISOString().split('T')[0],
      }));
      await fetch(`${sbUrlEvents}/rest/v1/lead_scoring_events`,{method:'POST',headers:{'Content-Type':'application/json',apikey:sbKeyEvents,Authorization:`Bearer ${sbKeyEvents}`,Prefer:'return=minimal'},body:JSON.stringify(events)});
    } catch(err){console.error('[runRyan] lead_scoring_events write failed:',err);}
  }
  // Every lead is treated equally (Aug 23, 2026 -- no more high/medium/low tiering).
  // Each line now names the source campaign so DeAnna can see which content is actually
  // producing leads, not just that leads exist.
  const leadSummary = omarResult.scored_leads.map(l=>{
    const source = (l.contact_id && sourceByContactId[l.contact_id]) || sourceByEmail[l.email] || 'unknown';
    return `* ${l.name} — ${l.recommended_action} (source: ${source})`;
  }).join('\n');
  const agentKnowledge = await getAgentKnowledge();
  const agentCorrections = await getAgentCorrections('Ryan Nakamura');
  const briefing = await callAnthropic(`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}${agentCorrections}\n\nYou are Ryan Nakamura, CRM Management Agent for DRU AI Consulting. Write a precise lead intelligence briefing. Every lead is valued equally here -- do not rank, score, or tier them.\nDATA: Total new leads today: ${omarResult.total_leads_scanned} | Already purchased, skipped: ${omarResult.already_purchased_skipped ?? 0}\nLEADS: ${leadSummary||'None today'}\nInclude: each lead with its recommended action (all directed to assessment.druaiconsulting.com) AND the source campaign shown for it in LEADS -- never drop or omit this, DeAnna needs to see which content brought each lead in. If several leads share the same source campaign, note that pattern explicitly. CRM updates completed, strategic next steps. Do not use "Briefing," "Brief," or "Executive Summary" as a heading.`);
  const csq_id = await writeToCSQ({agent_id:'ryan',agent_name:'Ryan Nakamura',division:'Revenue, Growth & Sales',task:'overnight_crm_sync',category:'lead_intelligence',raw_output:briefing,priority:omarResult.total_leads_scanned>0?'high':'normal',status:'pending',retry_count:0});
  const sbUrl=process.env.VITE_SUPABASE_URL; const sbKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (sbUrl&&sbKey){
    await Promise.all([
      fetch(`${sbUrl}/rest/v1/stats?id=eq.leads_scored_today`,{method:'PATCH',headers:{'Content-Type':'application/json',apikey:sbKey,Authorization:`Bearer ${sbKey}`,Prefer:'return=minimal'},body:JSON.stringify({value:omarResult.total_leads_scanned})}),
    ]);
  }
  return {csq_id,crm_updates:crmUpdates};
}

// Real-time single-lead path (Aug 23, 2026) -- fires the instant someone completes the
// assessment, via the "Agent Trigger — Assessment Completed" webhook in DeAnna's GHL
// workflow. Does NOT call runOmar()'s batch scan -- that would just re-scan every GHL
// contact redundantly. Instead processes exactly the one lead this webhook fired for,
// straight from GHL's own webhook payload. The daily 8am batch Omar scan stays live as a
// safety net for anyone whose webhook call fails for any reason.
async function runOmarRealtime(payload:any): Promise<{success:boolean;contact_id:string|null;skipped_reason?:string}> {
  // GHL sends the real contact ID automatically as part of every webhook's "standard
  // data" -- checking every commonly-seen location defensively, same pattern already
  // used in ghl-purchase-webhook.ts, since the exact shape hasn't been confirmed live yet.
  const contactId:string|null = payload?.contact_id ?? payload?.contactId ?? payload?.contact?.id ?? payload?.ghl_contact_id ?? null;
  const firstName = payload?.contact?.first_name ?? payload?.['contact first name'] ?? payload?.first_name ?? '';
  const lastName  = payload?.contact?.last_name  ?? payload?.['contact last name']  ?? payload?.last_name  ?? '';
  const name = `${firstName} ${lastName}`.trim() || payload?.contact?.full_name || payload?.full_name || 'Unknown';
  const email = payload?.contact?.email ?? payload?.email ?? '';
  const tags:string[] = Array.isArray(payload?.contact?.tags) ? payload.contact.tags : (Array.isArray(payload?.tags) ? payload.tags : []);

  if (!contactId) {
    console.error('[runOmarRealtime] No contact_id found anywhere in webhook payload -- skipping. Check Vercel logs for the actual payload shape.');
    return {success:false,contact_id:null,skipped_reason:'no_contact_id_in_payload'};
  }

  // Same purchase-suppression as the batch scan -- if this contact already bought
  // (shouldn't normally happen right after an assessment, but a returning contact could),
  // skip entirely rather than logging or tagging them again.
  const PURCHASED_TAGS = new Set(['diagnostic-purchased','90-day-purchased','90-day-completed']);
  if (tags.some(t => PURCHASED_TAGS.has(t))) {
    return {success:true,contact_id:contactId,skipped_reason:'already_purchased'};
  }

  const sbUrl=process.env.VITE_SUPABASE_URL; const sbKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ghlApiKey = process.env.GHL_API_KEY;

  // Look up this contact's own submissions row (should exist -- they just completed the
  // assessment) for the real UTM/campaign source, same join Ryan's batch path already does.
  let sourceCampaign:string|null = null;
  if (sbUrl && sbKey) {
    try {
      const r = await fetch(`${sbUrl}/rest/v1/submissions?ghl_contact_id=eq.${contactId}&select=utm_campaign&order=created_at.desc&limit=1`,{headers:{apikey:sbKey,Authorization:`Bearer ${sbKey}`}});
      if (r.ok){const rows=await r.json();sourceCampaign = rows?.[0]?.utm_campaign ?? null;}
    } catch(err){console.error('[runOmarRealtime] submissions lookup failed:',err);}
  }

  // One recommended_action + note for this single lead, same voice as the batch path --
  // no scoring, no ranking, every lead treated equally.
  let recommendedAction = 'Reviewed after completing the DRU CLEAR™ AI Readiness Assessment.';
  let notes = '';
  try {
    const agentKnowledge = await getAgentKnowledge();
    const agentCorrections = await getAgentCorrections('Omar Patel');
    const text = await callAnthropic(`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}${agentCorrections}\n\nYou are Omar Patel, Lead Intelligence Agent for DRU AI Consulting. This person just completed the DRU CLEAR™ AI Readiness Assessment -- they do not need to be invited to take it again. Write one recommended_action for following up with them personally (not another assessment invite) and one note on what's known about how they came in.\nReturn ONLY a JSON object, no preamble, no markdown fences: {"recommended_action":"...","notes":"..."}\nLead: ${JSON.stringify({name,email,source_campaign:sourceCampaign})}`,500);
    const parsed = JSON.parse(text.replace(/\`\`\`json|\`\`\`/g,'').trim());
    recommendedAction = parsed.recommended_action || recommendedAction;
    notes = parsed.notes || '';
  } catch(err){console.error('[runOmarRealtime] recommended_action generation failed, using default:',err);}

  // Tag in GHL immediately -- same neutral tag the batch path uses, no ranking language.
  if (ghlApiKey) {
    try {
      await fetch(`${GHL_API_BASE}/contacts/${contactId}`,{method:'PUT',headers:{Authorization:`Bearer ${ghlApiKey}`,Version:'2021-07-28','Content-Type':'application/json'},body:JSON.stringify({tags:[`ai-reviewed`]})});
    } catch(err){console.error('[runOmarRealtime] GHL tag failed:',err);}
  }

  // Write the lead_scoring_events row immediately -- real time, not waiting for tomorrow's batch.
  if (sbUrl && sbKey) {
    try {
      await fetch(`${sbUrl}/rest/v1/lead_scoring_events`,{method:'POST',headers:{'Content-Type':'application/json',apikey:sbKey,Authorization:`Bearer ${sbKey}`,Prefer:'return=minimal'},body:JSON.stringify([{
        ghl_contact_id: contactId, name, email, recommended_action: recommendedAction,
        source_campaign: sourceCampaign, run_date: new Date().toISOString().split('T')[0],
      }])});
    } catch(err){console.error('[runOmarRealtime] lead_scoring_events write failed:',err);}
  }

  return {success:true,contact_id:contactId};
}

// P2
// FIXED: Camila now writes to CSQ like all other agents — full chain (Isabella → Governance → Command Layer → Twin)
// PHASE 3: Reads ecosystem intelligence from Revenue, Client Delivery, and Analytics before generating
// content_queue write removed — everything flows through CSQ
async function runCamila(): Promise<string|null> {
  const ecosystemIntel = await getCrossRead(['ryan','serena','keisha','leila','hyunji']);
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const positioning=await fetchBrandCopy('positioning');
  const agentKnowledge = await getAgentKnowledge();
  return await runAgentToCSQ(
    'camila','Camila Flores','Content & Brand','generate_weekly_linkedin_queue','content_strategy',
    `${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Camila Flores, Social Media Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Her positioning is "${positioning}." Today: ${today}.

ECOSYSTEM INTELLIGENCE THIS WEEK — use these real signals to inform content themes, angles, and language. Do not invent scenarios when real ones are available:
${ecosystemIntel || 'No prior intelligence available — use framework rotation.'}

Generate this week's FULL CONTENT STRATEGY BRIEF covering both Darius King (social posts) and Nia Robinson (thought leadership, articles, blog content). They must tell one cohesive story across all formats.

## WEEKLY THEME & POSITIONING
- This week's overarching theme and positioning angle based on ecosystem signals
- Core message that runs through ALL content this week
- Framework rotation plan ensuring all 4 frameworks get coverage (DRU CLEAR™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™)

## DARIUS KING — Daily Social Posts (Mon/Tue/Thu/Fri)
Day-by-day direction for Darius:
- Monday: post type, framework focus, hook direction, audience angle
- Tuesday: post type, framework focus, hook direction, audience angle
- Thursday: post type, framework focus, hook direction, audience angle
- Friday: post type, framework focus, hook direction, audience angle
CTA alignment: all posts drive to assessment.druaiconsulting.com

## NIA ROBINSON — Thought Leadership & Newsletter (Wed/Thu/Fri/Sat/Sun)
- Wednesday LinkedIn post angle (200-300 words, educational)
- Thursday LEAD, CLARITY, WIN! Newsletter theme for all 3 editions:
  · Non-member edition: what problem to surface, how deep to go, hook direction
  · Navigator edition: which framework concept to apply, what action step to suggest
  · Accelerator edition: which strategic implementation angle to take
- Friday native article topic and angle (500-700 words)
- Saturday LinkedIn post angle (framework spotlight direction)
- Sunday LinkedIn post angle (executive insight direction)

## KEY MESSAGES TO AMPLIFY
Based on Revenue, Client Delivery, and Analytics signals — what should dominate messaging this week.

Be specific about angles, not generic. Every framework reference must include ™.`,
    'normal',0,null,2500
  );
}

// PHASE 2 UPDATED: Darius generates 3 platform-native versions as structured JSON
async function runDarius(): Promise<string|null> {
  const brandMarks=await fetchBrandMarks();
  const positioning=await fetchBrandCopy('positioning');
  const agentKnowledge=await getAgentKnowledge();
  const agentCorrections=await getAgentCorrections('Darius King');
  // Aug 24, 2026 fix: previously read from content_queue, a table nothing has written to
  // since the CSQ migration -- topicBrief was always empty and Darius silently fell back
  // to a generic prompt, disconnected from Camila's weekly theme and Nia's actual output.
  // Now reads Camila's weekly Content Strategy Brief (same cross-read Nia already uses)
  // plus the shared content theme log, so today's post is grounded in what's real.
  const camilaBrief = await getCrossRead(['camila']);
  const themeLog = await getContentThemeLog();
  const weeklyContext = camilaBrief
    ? `\nWEEKLY CONTENT STRATEGY (from Camila Flores, Social Media Strategist) — align today's post with this week's direction:\n${camilaBrief}`
    : '';
  const logContext = themeLog
    ? `\nWHAT'S ALREADY BEEN PUBLISHED THIS WEEK (yours and Nia Robinson's) — reference or build on this, don't repeat it:\n${themeLog}`
    : '';
  const topicContext = `Generate a thought leadership topic on ${positioning} using one of these frameworks: ${brandMarks}.${weeklyContext}${logContext}`;
  const structuredOutput=await callAnthropic(
    `${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}${agentCorrections}\n\nYou are Darius King, Viral Scripter for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Her positioning is "${positioning}."\n\nTODAY'S TOPIC BRIEF: ${topicContext}\n\nIf WHAT'S ALREADY BEEN PUBLISHED THIS WEEK shows real entries, your hook and content must explicitly build on, reference, or advance one of those pieces — name the connection naturally (e.g. "Building on this week's theme...") rather than starting a disconnected new topic.\n\nWrite 3 platform-native versions of this topic. Same core message, 3 different audience voices:\n\nLINKEDIN (VP+ executives, authority, framework-forward): 150-300 words, opening line MUST be a standalone punch line under 8 words, one framework reference, CTA to assessment.druaiconsulting.com, 3-5 hashtags.\nFACEBOOK (warm community tone, outcome-focused, relatable): 100-200 words, CTA to assessment.druaiconsulting.com.\nINSTAGRAM (visual-first, punchy, short): 50-80 words, 5-8 hashtags, ends with assessment.druaiconsulting.com.\n\nCount the words in your opening line before writing the rest. Follow the HOOK/QUESTION RULE above for the hook and every opening line — open-ended and declarative, never yes/no, never "X or Y."\n\nReturn ONLY valid JSON — no markdown fences, no preamble, no explanation:\n{"linkedin_content":"...","facebook_content":"...","instagram_caption":"...","hook":"single strongest opening line","content_type":"thought_leadership"}`,
    2500
  );
  const csqId=await writeToCSQ({agent_id:'darius',agent_name:'Darius King',division:'Content & Brand',task:'generate_daily_linkedin_post',category:'linkedin_post',raw_output:structuredOutput,priority:'normal',status:'pending',retry_count:0});
  // Log this piece to the shared content theme log so Nia (and tomorrow's Darius) can see
  // exactly what went out today, not just the abstract weekly plan.
  try {
    const parsed = JSON.parse(structuredOutput.replace(/```json|```/g,'').trim());
    await writeContentThemeLog('darius','Darius King','linkedin_post', parsed.content_type ? `${parsed.content_type} — ${positioning}` : positioning, parsed.hook || null, null);
  } catch(err){ console.error('[runDarius] content_theme_log write failed:', err); }
  return csqId;
}


// P2 UPDATED: Ravi reads Darius's post from CSQ before generating brief
// Visual must support and reinforce today's copy — not a separate concept
async function runRavi(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const todayDate=new Date().toISOString().split('T')[0];
  const url=process.env.VITE_SUPABASE_URL; const key=process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Read today's Darius post from CSQ — align design brief with the actual copy
  let dariusContent=''; let dariusHook='';
  if (url&&key){
    const r=await fetch(`${url}/rest/v1/chief_of_staff_queue?agent_id=eq.darius&created_at=gte.${todayDate}T00:00:00&order=created_at.desc&limit=1`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
    if (r.ok){
      const data=await r.json();
      if (data?.[0]?.raw_output){
        try {
          const parsed=JSON.parse(data[0].raw_output);
          dariusContent=parsed.linkedin_content||data[0].raw_output;
          dariusHook=parsed.hook||'';
        } catch { dariusContent=data[0].raw_output.slice(0,600); }
      }
    }
  }

  const postContext=dariusContent
    ? `TODAY\'S POST FROM DARIUS — your brief must visually support this exact message:\n\n${dariusContent}\n${dariusHook?`HOOK: ${dariusHook}`:''}`
    : 'No Darius post found today — generate a general DRU CLEAR™ diagnostic theme brief.';

  const agentKnowledge = await getAgentKnowledge();
  return await runAgentToCSQ(
    'ravi','Ravi Gupta','Content & Brand','generate_design_brief','design_brief',
    `${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Ravi Gupta, Graphic Designer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Brand: Navy #0A2342, Gold #D4AF37, Magenta #C2185B. Fonts: Playfair Display (headlines), Inter (body). Today: ${today}. CTA destination: assessment.druaiconsulting.com.\n\n${postContext}\n\nGenerate a complete LinkedIn visual design brief (1200×627px) where the visual DIRECTLY SUPPORTS and VISUALLY REINFORCES today\'s post. The image and copy must tell the same story — not separate concepts.\n\nInclude:\n- STRATEGIC INTENT (aligned to today\'s post theme and audience)\n- VISUAL CONCEPT (concept name + metaphor that matches the post message)\n- LAYOUT ARCHITECTURE (canvas 1200×627px, bifurcated left/right, bottom CTA strip)\n- COLOR PALETTE with application logic (Navy #0A2342, Gold #D4AF37, Magenta #C2185B)\n- IMAGE DIRECTION (left hemisphere: problem/chaos state matching post theme; right hemisphere: clarity/solution state)\n- TYPOGRAPHY HIERARCHY (headline pulled from or inspired by today\'s hook; subheadline; body copy; CTA button)\n- AI IMAGE GENERATION PROMPTS (left hemisphere, right hemisphere, combined scene — ready to paste into Creator Studio)\n- DESIGN SPECIFICATIONS (PNG 1200×627px @ 300DPI, RGB, optimized <500KB)`,
    'normal',0,null,2500
  );
}

// Internal-reasoning marker (Aug 2026 fix) — closes off private reasoning behind one exact,
// consistent line instead of whatever heading the agent picks. Raymond splits on this in
// raymond.ts: sendable content stays in `output` (what gets approved/sent), everything after
// the marker is pulled into `original_content` and shown on the card as "Internal Notes — Not
// Sent." Applied to all of Nia's prompts (LinkedIn + newsletters) — this is where her cards
// were leaking strategic-rationale text into sendable content.
const INTERNAL_NOTES_INSTRUCTION = `\nIf you want to explain your reasoning, strategic intent, or why you made a particular choice, put ONLY that explanation after a line containing exactly:\n===INTERNAL NOTES===\nEverything after that exact line is kept private for DeAnna and is NEVER sent or posted. Only use it if you actually have something worth explaining — most of the time you won't need it. Never put real content that should be sent/posted after this marker.`;

// EQ Meets AI brand line (Aug 2026) — added to all 4 newsletter editions per DeAnna's
// confirmation. Not added to LinkedIn posts/articles — newsletter-only per this build.
const EQ_BRAND_LINE = `\nBRAND THEME: Work "EQ Meets AI: People-Centered Leadership, AI-Powered Insight" naturally into this newsletter — it's DRU AI Consulting's core positioning line.`;

// P3
// NIA ROBINSON — Content Strategist
// Schedule: Wed/Sat/Sun = LinkedIn posts | Thu = LEAD, CLARITY, WIN! Newsletter x4 | Fri = LinkedIn native article
// Mon/Tue = Darius days, Nia returns null
// Reads Camila's weekly brief for strategic alignment before writing anything
async function runNia(): Promise<string|null> {
  const agentKnowledge = await getAgentKnowledge();
  const clientIntel  = await getCrossRead(['keisha','leila','ryan']);
  const camilaBrief  = await getCrossRead(['camila']);
  const themeLog     = await getContentThemeLog();
  const today        = new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const dayOfWeek    = new Date().toLocaleDateString('en-US',{weekday:'long',timeZone:'America/Chicago'});
  const niaPrefix    = `${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\n`;
  // Aug 24, 2026 fix: previously Nia only saw the abstract weekly plan, never what Darius
  // had actually published. logContext folds his real output (and her own) from the shared
  // log into strategyContext once here, so every prompt below picks it up automatically.
  const logContext = themeLog
    ? `\nWHAT'S ALREADY BEEN PUBLISHED THIS WEEK (Darius King's posts and your own) — reference or build on this where it fits naturally, don't repeat it:\n${themeLog}`
    : '';
  const strategyContext = (camilaBrief
    ? `\nWEEKLY CONTENT STRATEGY (from Camila Flores, Social Media Strategist) — align your content with this week's direction:\n${camilaBrief}`
    : '\nNo weekly strategy brief available — draw from framework rotation and ecosystem signals.') + logContext;
  const intelContext = clientIntel
    ? `\nCLIENT & ECOSYSTEM INTELLIGENCE — ground examples in real signals:\n${clientIntel}`
    : '\nNo prior intelligence — draw from framework-based scenarios.';

  // ── WEDNESDAY / SATURDAY / SUNDAY — LinkedIn Post (200-300 words) ──────────
  if (['Wednesday','Saturday','Sunday'].includes(dayOfWeek)) {
    const postTypeMap:Record<string,string> = { Wednesday:'thought_leadership', Saturday:'framework_spotlight', Sunday:'executive_insight' };
    const postInstructions:Record<string,string> = {
      thought_leadership: `Write a 200-300 word LinkedIn post positioning DeAnna R. Upshaw as the AI Authority. Strong hook on line one — no fluff. One sharp insight executives need about AI leadership today. One DRU framework reference (™). End with: assessment.druaiconsulting.com. Max 3 relevant hashtags.`,
      framework_spotlight: `Write a 200-300 word LinkedIn post spotlighting one proprietary framework (™). Hook: the problem it solves. Body: what shifts when leaders apply it. One concrete real-world example. CTA: assessment.druaiconsulting.com. Max 3 hashtags.`,
      executive_insight:   `Write a 200-300 word LinkedIn post on one AI leadership mistake executives are making in 2026. Position DeAnna as the authority who sees it clearly. Confident, direct. One framework reference (™). CTA: assessment.druaiconsulting.com. Max 3 hashtags.`,
    };
    const csqId = await runAgentToCSQ('nia','Nia Robinson','Marketing','linkedin_post','linkedin_post',
      `${niaPrefix}You are Nia Robinson, Content Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\n${strategyContext}\n${postInstructions[postTypeMap[dayOfWeek]]}\n${intelContext}${INTERNAL_NOTES_INSTRUCTION}`,
      'normal',0,null,800);
    await writeContentThemeLog('nia','Nia Robinson','linkedin_post', postTypeMap[dayOfWeek], null, null);
    return csqId;
  }

  // ── FRIDAY — LinkedIn Native Article (500-700 words, ARTICLE FORMAT) ────────
  if (dayOfWeek === 'Friday') {
    const topics = ['ai_changes_leadership','framework_deep_dive','transformation_story','executive_ai_mistakes','ai_culture_shift'];
    const topic  = topics[new Date().getDate() % topics.length];
    const articleInstructions:Record<string,string> = {
      ai_changes_leadership: `Write a 500-700 word LinkedIn native article on how AI is reshaping executive leadership in 2026. Scroll-stopping headline. Strong intro. 3-4 sections with subheadings. One DRU framework (™). Closing CTA: "Start your AI readiness assessment → assessment.druaiconsulting.com".`,
      framework_deep_dive:   `Write a 500-700 word LinkedIn native article doing a deep dive on one proprietary framework (™). What it is, why it exists, what changes when leaders apply it, real-world impact. CTA: assessment.druaiconsulting.com.`,
      transformation_story:  `Write a 500-700 word LinkedIn native article as a composite client transformation story using the DRU AI Transformation Pathway™. Before → intervention → transformation → measurable shift. Real, not salesy. CTA: assessment.druaiconsulting.com.`,
      executive_ai_mistakes: `Write a 500-700 word LinkedIn native article on the top mistakes executives make implementing AI. DeAnna as the authority who's seen it firsthand. One framework (™) as the solution lens. CTA: assessment.druaiconsulting.com.`,
      ai_culture_shift:      `Write a 500-700 word LinkedIn native article on why AI transformation is a culture problem before it's a technology problem. Reference 5C Cultural DNA™. Real examples, executive framing. CTA: assessment.druaiconsulting.com.`,
    };
    const csqId = await runAgentToCSQ('nia','Nia Robinson','Marketing','linkedin_article','linkedin_article',
      `## ARTICLE FORMAT — LinkedIn Native Article\n${niaPrefix}You are Nia Robinson, Content Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\n${strategyContext}\n${articleInstructions[topic]}\n${intelContext}${INTERNAL_NOTES_INSTRUCTION}`,
      'normal',0,null,1500);
    await writeContentThemeLog('nia','Nia Robinson','linkedin_article', topic, null, null);
    return csqId;
  }

  // ── THURSDAY — LEAD, CLARITY, WIN! Newsletter × 4 tiers ─────────────────────
  if (dayOfWeek === 'Thursday') {
    const topic = camilaBrief
      ? `This week's theme from your content strategy brief — align the Newsletter to the week's direction`
      : `AI leadership insight grounded in one DRU framework (™) — ${today}`;

    // Non-member edition — true non-members, GHL tag "non-member"
    await runAgentToCSQ('nia','Nia Robinson','Marketing','newsletter_nonmember','newsletter_nonmember',
      `## LEAD, CLARITY, WIN! Newsletter — Non-Member Edition\n${niaPrefix}You are Nia Robinson, Content Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nAUDIENCE: Executives who have NOT yet joined DRU AI Consulting.\n${EQ_BRAND_LINE}\n${strategyContext}\nDEPTH: Surface — reveal the problem clearly, hint at the solution, stop before delivering it. Hook them on the promise.\nFORMAT: Line 1 is the actual subject text ONLY — never write a label like "Subject:" or "SUBJECT LINE:". The email content begins immediately on the next line — never write "Body:" as a label, and never insert a divider line of dashes/underscores between the subject and the content. | Opening hook (2-3 sentences that stop them) | The problem (1 paragraph — they should feel seen) | A glimpse of what's possible (1 paragraph — tease, do NOT teach) | CTA\nCTA: "Your AI transformation starts with one assessment. → assessment.druaiconsulting.com"\nTOPIC: ${topic}\nDo NOT give away framework IP. No framework detail — name only.${INTERNAL_NOTES_INSTRUCTION}`,
      'high',0,null,1000);

    // Free-Tier edition — joined the portal, hasn't upgraded, GHL tag "free-tier"
    await runAgentToCSQ('nia','Nia Robinson','Marketing','newsletter_freetier','newsletter_freetier',
      `## LEAD, CLARITY, WIN! Newsletter — Free-Tier Edition\n${niaPrefix}You are Nia Robinson, Content Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nAUDIENCE: Free-tier members — executives who completed the assessment and joined the DRU AI Leadership Ecosystem™, but haven't upgraded yet.\n${EQ_BRAND_LINE}\n${strategyContext}\nDEPTH: Between surface and medium — give them real value, but hold back enough that leveling up still matters. Do not teach full framework application.\nFORMAT: Line 1 is the actual subject text ONLY — never write a label like "Subject:" or "SUBJECT LINE:". The email content begins immediately on the next line — never write "Body:" as a label, and never insert a divider line of dashes/underscores between the subject and the content. | Opening (acknowledge they're already part of the community) | One valuable insight, held at partial depth | What's waiting for them at the next level | CTA\nCTA: "Ready to go deeper? Join Navigator — that's how you unlock the full community. → https://link.druaiconsulting.com/payment-link/69ead3017dd3512d920794b0"\nTOPIC: ${topic}${INTERNAL_NOTES_INSTRUCTION}`,
      'high',0,null,1000);

    // Navigator edition
    await runAgentToCSQ('nia','Nia Robinson','Marketing','newsletter_navigator','newsletter_navigator',
      `## LEAD, CLARITY, WIN! Newsletter — Navigator Edition\n${niaPrefix}You are Nia Robinson, Content Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nAUDIENCE: Navigator members ($97/mo) — executives who completed the assessment and joined.\n${EQ_BRAND_LINE}\n${strategyContext}\nDEPTH: Medium — apply one framework concept to a real leadership challenge. Give real value but leave the full system for the 90-Day Journey.\nFORMAT: Line 1 is the actual subject text ONLY — never write a label like "Subject:" or "SUBJECT LINE:". The email content begins immediately on the next line — never write "Body:" as a label, and never insert a divider line of dashes/underscores between the subject and the content. | Opening (acknowledge where they are as executives) | One framework concept + one action step they can take this week | What becomes possible when they go deeper | CTA\nCTA: "Ready to go all in? Start your 90-Day Transformation Pathway. → frameworks.druaiconsulting.com"\nTOPIC: ${topic}${INTERNAL_NOTES_INSTRUCTION}`,
      'high',0,null,1000);

    // Accelerator edition
    const csqId = await runAgentToCSQ('nia','Nia Robinson','Marketing','newsletter_accelerator','newsletter_accelerator',
      `## LEAD, CLARITY, WIN! Newsletter — Accelerator Edition\n${niaPrefix}You are Nia Robinson, Content Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nAUDIENCE: Accelerator members ($197/mo) — executive leaders in active transformation.\n${EQ_BRAND_LINE}\n${strategyContext}\nDEPTH: Deeper — one framework at strategic implementation level. Executive stakes, real complexity.\nFORMAT: Line 1 is the actual subject text ONLY — never write a label like "Subject:" or "SUBJECT LINE:". The email content begins immediately on the next line — never write "Body:" as a label, and never insert a divider line of dashes/underscores between the subject and the content. | Opening (meet them at their executive level) | Strategic insight — one framework, implementation angle, the hard question they're avoiding | The gap they're likely sitting in right now | CTA\nCTA: "Activate your 90-Day Pathway. The full transformation is waiting. → frameworks.druaiconsulting.com"\nTOPIC: ${topic}${INTERNAL_NOTES_INSTRUCTION}`,
      'high',0,null,1000);
    // One log entry represents the whole newsletter (all 4 tiers share the same theme).
    await writeContentThemeLog('nia','Nia Robinson','newsletter', topic, null, null);
    return csqId;
  }

  return null; // Monday, Tuesday — Darius days
}

// ─── JAYLEN BROOKS — Email Marketing (Revenue, Growth & Sales) ────────────────
// Runs daily via cron_jaylen_email. Three jobs, every run:
//   1. Non-member 5-email welcome sequence — checks who's due for their next email today
//      (Day 0/3/7/10/14 from their own signup date), generates ONE piece of content per
//      stage that has at least one contact due (not one card per contact — the dispatch
//      side sends that same content to everyone currently due for that stage).
//   2. Deploy -> Dominate auto-promotion — pure date math, Day 91 exactly, no content
//      generation, just tag/database housekeeping.
//   3. Tuesday only — weekly email to Free-Tier/Navigator/Accelerator (Nia has Wed-Sun).
// Aug 2026 build.

const JAYLEN_GHL_API_BASE = 'https://services.leadconnectorhq.com';
const JAYLEN_GHL_LOCATION_ID = 'gl07I4JnbkGgW8zJprSz';
const JAYLEN_GHL_VERSION = '2021-07-28';

const SEQUENCE_DAY_OFFSETS: Record<number, number> = { 1: 0, 2: 3, 3: 7, 4: 10, 5: 14 };
const SEQUENCE_STAGE_NAMES: Record<number, string> = {
  1: 'Welcome', 2: 'Value Piece / Pain Point', 3: 'Proof / Story', 4: 'Honest', 5: 'The Ask',
};
const JAYLEN_SIGNATURE = `\n\nEvery email closes with this exact signature, verbatim:\nAll the Best,\n-DeAnna R Upshaw, Your AI Authority and Partner!`;
const JAYLEN_PERSONALIZATION = `\nPERSONALIZATION: Open with GHL's merge tag exactly as written — Hi {{contact.first_name}}, — do not substitute a placeholder name or write it any other way; GHL fills in the real first name at send time using this exact tag.`;

// GHL's official upsert endpoint — finds-or-creates by email using GHL's own duplicate
// detection, replacing the unverified advanced-search approach entirely.
// https://marketplace.gohighlevel.com/docs/ghl/contacts/upsert-contact
async function jaylenFindContactIdByEmail(email: string, apiKey: string): Promise<string | null> {
  const res = await fetch(`${JAYLEN_GHL_API_BASE}/contacts/upsert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Version: JAYLEN_GHL_VERSION },
    body: JSON.stringify({ locationId: JAYLEN_GHL_LOCATION_ID, email }),
  });
  if (!res.ok) { console.error(`[runJaylen] Contact upsert failed: ${res.status} ${await res.text()}`); return null; }
  const data = await res.json();
  return data.contact?.id ?? null;
}

async function jaylenAddTags(contactId: string, tags: string[], apiKey: string): Promise<boolean> {
  const res = await fetch(`${JAYLEN_GHL_API_BASE}/contacts/${contactId}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Version: JAYLEN_GHL_VERSION },
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) console.error(`[runJaylen] Add tags failed for ${contactId}: ${res.status} ${await res.text()}`);
  return res.ok;
}

async function jaylenRemoveTags(contactId: string, tags: string[], apiKey: string): Promise<boolean> {
  if (tags.length === 0) return true;
  const res = await fetch(`${JAYLEN_GHL_API_BASE}/contacts/${contactId}/tags`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Version: JAYLEN_GHL_VERSION },
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) console.error(`[runJaylen] Remove tags failed for ${contactId}: ${res.status} ${await res.text()}`);
  return res.ok;
}

// Returns which of the 5 sequence stages (1-5) have at least one non-member contact due
// today, so content only gets generated for stages actually needed.
async function getDueSequenceStages(): Promise<number[]> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('[runJaylen] Supabase env vars missing — skipping sequence check'); return []; }
  const res = await fetch(`${url}/rest/v1/jaylen_sequence_progress?select=current_email_number,signup_date&sequence_complete=eq.false`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) { console.error('[runJaylen] Failed to fetch sequence progress'); return []; }
  const rows: Array<{ current_email_number: number; signup_date: string }> = await res.json();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dueStages = new Set<number>();
  for (const row of rows) {
    const nextStage = row.current_email_number + 1;
    if (nextStage > 5) continue;
    const signup = new Date(row.signup_date + 'T00:00:00');
    const daysSince = Math.floor((today.getTime() - signup.getTime()) / 86400000);
    if (daysSince >= SEQUENCE_DAY_OFFSETS[nextStage]) dueStages.add(nextStage);
  }
  return Array.from(dueStages).sort((a, b) => a - b);
}

// Pure date math — anyone in Deploy for 91+ days (using the dedicated deploy_started_at
// timestamp, not profiles.updated_at, which gets touched by unrelated edits) gets promoted
// to Dominate. No content, no approval card — just tag and database housekeeping.
async function promoteDeployToDominate(): Promise<number> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.GHL_PRIVATE_INTEGRATIONS_KEY;
  if (!url || !key) { console.error('[runJaylen] Supabase env vars missing — skipping Dominate promotion'); return 0; }
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 91);
  const res = await fetch(`${url}/rest/v1/profiles?select=id,email,deploy_started_at&pathway_stage=eq.Deploy&deploy_started_at=lte.${cutoff.toISOString()}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) { console.error('[runJaylen] Failed to fetch Deploy-stage profiles'); return 0; }
  const rows: Array<{ id: string; email: string; deploy_started_at: string }> = await res.json();
  let promoted = 0;
  for (const row of rows) {
    const updateRes = await fetch(`${url}/rest/v1/profiles?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ pathway_stage: 'Dominate', updated_at: new Date().toISOString() }),
    });
    if (!updateRes.ok) { console.error(`[runJaylen] Failed to promote ${row.email} to Dominate`); continue; }
    if (apiKey) {
      const contactId = await jaylenFindContactIdByEmail(row.email, apiKey);
      if (contactId) {
        await jaylenAddTags(contactId, ['90-day-completed'], apiKey);
        await jaylenRemoveTags(contactId, ['90-day-purchased', 'diagnostic-purchased'], apiKey);
      } else {
        console.error(`[runJaylen] No GHL contact found for ${row.email} — Dominate tag sync skipped`);
      }
    }
    promoted++;
    console.log(`[runJaylen] ${row.email} promoted Deploy -> Dominate (91 days since ${row.deploy_started_at})`);
  }
  return promoted;
}

async function runJaylen(): Promise<{ sequence_emails_generated: number; dominate_promotions: number; weekly_emails_generated: number }> {
  const agentKnowledge = await getAgentKnowledge();
  const jaylenPrefix = `${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\n`;
  const brandLine = `\nBRAND THEME: Work "EQ Meets AI: People-Centered Leadership, AI-Powered Insight" naturally into this email — it's DRU AI Consulting's core positioning line.`;
  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });

  // ── 1. Non-member sequence — one card per due stage, not per contact ─────────
  const dueStages = await getDueSequenceStages();
  for (const stage of dueStages) {
    await runAgentToCSQ('jaylen', 'Jaylen Brooks', 'Revenue, Growth & Sales', `jaylen_sequence_${stage}`, 'email_marketing',
      `${jaylenPrefix}You are Jaylen Brooks, Email Marketing Agent for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.\nAUDIENCE: Non-members who signed up for LEAD, CLARITY, WIN! Newsletter — this is email ${stage} of 5 in their welcome sequence.\nSTAGE: ${SEQUENCE_STAGE_NAMES[stage]}\n${brandLine}${JAYLEN_PERSONALIZATION}\nWrite an email that fits this stage of a relationship-building welcome sequence: build trust, show real value, and move naturally toward the free assessment as the next step. Do not repeat what earlier emails in this sequence would already have said — this is stage ${stage}, write for where the reader is at this point, not from scratch.\nFORMAT: Line 1 is the actual subject text ONLY — never write a label like "Subject:" or "SUBJECT LINE:". The email content begins immediately on the next line — never write "Body:" as a label, and never insert a divider line of dashes/underscores between the subject and the content.${JAYLEN_SIGNATURE}\nCTA: assessment.druaiconsulting.com`,
      'high', 0, null, 1000);
  }

  // ── 2. Deploy -> Dominate promotion (silent, no content) ─────────────────────
  const promotions = await promoteDeployToDominate();

  // ── 3. Tuesday — weekly email to Free-Tier/Navigator/Accelerator ─────────────
  let weeklyCount = 0;
  if (dayOfWeek === 'Tuesday') {
    const tiers = [
      { trigger: 'jaylen_weekly_freetier', label: 'Free-Tier', audience: 'Free-tier members — joined the portal, have not upgraded yet' },
      { trigger: 'jaylen_weekly_navigator', label: 'Navigator', audience: 'Navigator members ($97/mo)' },
      { trigger: 'jaylen_weekly_accelerator', label: 'Accelerator', audience: 'Accelerator members ($197/mo)' },
    ];
    for (const t of tiers) {
      await runAgentToCSQ('jaylen', 'Jaylen Brooks', 'Revenue, Growth & Sales', t.trigger, 'email_marketing',
        `${jaylenPrefix}You are Jaylen Brooks, Email Marketing Agent for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.\nAUDIENCE: ${t.audience}.\n${brandLine}${JAYLEN_PERSONALIZATION}\nThis is direct sales/relationship-maintenance email — different job from Nia's Thursday newsletter to the same people, which is educational content. Yours should be a genuine, direct nudge, not more value content.\nWrite so it reads right for a reader at any point in their journey: reference that unlocking the diagnostic (Strategic $3,497 or Executive $4,997) is the next step for anyone who hasn't done one yet, AND that the 90-Day Journey bundles are the next step for anyone who's already done their diagnostic — the reader will recognize which applies to them.\nFORMAT: Line 1 is the actual subject text ONLY — never write a label like "Subject:" or "SUBJECT LINE:". The email content begins immediately on the next line — never write "Body:" as a label, and never insert a divider line of dashes/underscores between the subject and the content.${JAYLEN_SIGNATURE}\nCTA: frameworks.druaiconsulting.com`,
        'high', 0, null, 1000);
      weeklyCount++;
    }
  }

  return { sequence_emails_generated: dueStages.length, dominate_promotions: promotions, weekly_emails_generated: weeklyCount };
}

// ─── Marketing Data Fetch ────────────────────────────────────────────────────
// Pulls real platform data from Supabase for Andre, Hyun-Ji, and Luca.
// All three agents receive this snapshot so they report actual numbers —
// never invented traffic, campaign spend, or conversion rates.
async function fetchMarketingData(): Promise<string> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return 'Platform data unavailable.';
  try {
    const [subRes, statsRes, socialRes] = await Promise.all([
      fetch(`${url}/rest/v1/submissions?select=id,total_score,tier,score_category,top_gaps,utm_source,utm_medium,utm_campaign,role,company,created_at&order=created_at.desc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
      fetch(`${url}/rest/v1/stats?select=id,value`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
      fetch(`${url}/rest/v1/social_assets?select=title,platform,used_count,last_used_at,is_active&is_active=eq.true&order=used_count.desc&limit=10`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
    ]);
    const [subs, stats, social]: [any[], any[], any[]] = await Promise.all([subRes.json(), statsRes.json(), socialRes.json()]);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentSubs = subs.filter((s: any) => s.created_at >= sevenDaysAgo);
    const tiers: Record<string, number> = {};
    const utmSources: Record<string, number> = {};
    const topGaps: string[] = [];
    for (const s of subs) {
      if (s.tier) tiers[s.tier] = (tiers[s.tier] || 0) + 1;
      if (s.utm_source) utmSources[s.utm_source] = (utmSources[s.utm_source] || 0) + 1;
      if (s.top_gaps) topGaps.push(s.top_gaps);
    }
    const statsMap: Record<string, number> = {};
    for (const s of stats) statsMap[s.id] = s.value;
    const lines = [
      `REAL PLATFORM DATA — use only these numbers, never invent or estimate:`,
      `Assessments completed (all time): ${subs.length}`,
      `Assessments completed (last 7 days): ${recentSubs.length}`,
      `Tier breakdown: ${Object.entries(tiers).map(([k,v]) => `${k}: ${v}`).join(', ') || 'none yet'}`,
      `Traffic sources (UTM): ${Object.entries(utmSources).map(([k,v]) => `${k}: ${v}`).join(', ') || 'none tracked yet'}`,
      `Diagnostics sold: ${statsMap['diagnostics_sold'] ?? 0}`,
      `Sessions booked: ${statsMap['sessions_booked'] ?? 0}`,
      `Leads captured: ${statsMap['leads_captured'] ?? 0}`,
      `Top gaps reported by assessees: ${topGaps.length > 0 ? topGaps.slice(0,3).join(' | ') : 'none yet'}`,
      `Active social assets in library: ${Array.isArray(social) ? social.length : 0}`,
      Array.isArray(social) && social.length > 0 ? `Most used: ${social.slice(0,3).map((a: any) => `${a.title} (${a.platform}, used ${a.used_count}x)`).join('; ')}` : '',
    ].filter(Boolean);
    return lines.join('\n');
  } catch {
    return 'Platform data unavailable.';
  }
}

async function runLuca(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const marketingData = await fetchMarketingData();
  const agentKnowledge = await getAgentKnowledge();
  return await runAgentToCSQ('luca','Luca Romano','Marketing','digital_marketing_briefing','digital_marketing',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Luca Romano, Digital Marketing Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}. All objectives point to assessment.druaiconsulting.com.\n\nREAL PLATFORM DATA (use only these numbers):\n${marketingData}\n\nHARD RULES — read before writing a single word:\n1. Every number you write must appear verbatim in the data above. If it is not in the data, do not write it.\n2. Do not estimate, project, extrapolate, or use phrases like \"approximately,\" \"roughly,\" or \"based on typical benchmarks.\" Real numbers only.\n3. If assessments completed = 0 and all stats = 0, open with: \"Platform is pre-traffic. No funnel data to report yet.\" Then give one setup action we can take TODAY to start capturing real data.\n4. If there IS real data, open with a DATA SNAPSHOT block that quotes the exact numbers from above — no rounding, no reframing.\n5. Writing any number not found in the data above is a fabrication. DeAnna will compare your output to the raw data table.\n\nAfter your opening (data snapshot or pre-traffic statement), write:\n**Campaign Priority** — One platform to activate or optimize this week, grounded only in what the data shows about traffic source or funnel stage. If no data, recommend the single first campaign to run and why.\n**This Week\'s Action** — One specific move with clear rationale tied only to real numbers or acknowledged gaps.\n\nDo not use \"Briefing\" or \"Brief\" as a heading. Write in first person as Luca.`,'normal',0,null,2000);
}
async function runHyunJi(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const dayOfWeek=new Date().toLocaleDateString('en-US',{weekday:'long',timeZone:'America/Chicago'});
  const reportType=dayOfWeek==='Monday'?'weekly_recap':'daily_operational';
  const marketingData = await fetchMarketingData();
  const agentKnowledge = await getAgentKnowledge();
  const reportInstructions=reportType==='weekly_recap'
    ?`Weekly analytics recap using ONLY the real data provided above. What does the data actually show? What is the week-ahead priority based on real numbers? Set 3 KPI targets that make sense for this launch stage.`
    :`Daily analytics update using ONLY the real data provided above. What does the funnel actually show right now? Which single metric, if moved, would have the most impact on revenue? One insight about the assessment-to-diagnostic path grounded in real numbers.`;
  return await runAgentToCSQ('hyunji','Hyun-Ji Kim','Marketing','analytics_roi_briefing','analytics_report',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Hyun-Ji Kim, Analytics & ROI Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\n\nREAL PLATFORM DATA (use only these numbers):\n${marketingData}\n\nHARD RULES — read before writing a single word:\n1. Every number you write must come directly from the data above, quoted exactly. If it is not in the data, do not write it.\n2. No estimates, no projections, no revenue calculations, no conversion rate math. Real numbers only.\n3. If assessments completed = 0 and all stats = 0, open with: \"Zero activity to report. Platform is pre-traffic.\" Then name the single metric we should focus on activating first and why.\n4. If there IS real data, your first section must be a DATA SNAPSHOT that mirrors the exact figures above before any analysis.\n5. Writing any number not found in the data above is a fabrication and a trust violation. DeAnna checks your output against the raw table.\n\nREPORT TYPE: ${reportType}\n${reportInstructions}\n\nDo not use \"Briefing\" or \"Brief\" as a heading. Write in first person as Hyun-Ji.`,'normal',0,null,2000);
}
async function runAndre(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const dayOfWeek=new Date().toLocaleDateString('en-US',{weekday:'long',timeZone:'America/Chicago'});
  const focusType=dayOfWeek==='Tuesday'?'technical_seo':dayOfWeek==='Friday'?'weekly_search_recap':'daily_operational';
  const marketingData = await fetchMarketingData();
  const agentKnowledge = await getAgentKnowledge();
  const focusInstructions:Record<string,string>={
    daily_operational:`**Brand Keyword Protection** — Protect: "DRU AI Consulting", "DeAnna Upshaw", "DRU CLEAR™". Recommend organic defense strategy grounded in platform launch stage. Do not fabricate competitor threats — note if none are confirmed. **Organic Search** — Top 3 keyword clusters to target given the real UTM data above. One content gap for Nia grounded in actual traffic sources or assessment top gaps. **Today's SEO Action** — One immediately actionable move tied to real data.`,
    technical_seo:`**Site Health** — Core Web Vitals targets for assessment.druaiconsulting.com and app.druaiconsulting.com. One crawlability recommendation. **Schema** — Recommended schema markup for services and courses. **This Week's Technical Priority** — Single highest-impact fix.`,
    weekly_search_recap:`**Organic Search** — Benchmark targets appropriate for this launch stage. One keyword to prioritize based on real UTM sources above. **Paid Search** — Brand campaign recommendations. **Next Week's Priorities** — 3 actions ranked by impact for an early-stage platform.`
  };
  return await runAgentToCSQ('andre','Andre Mitchell','Marketing','seo_sem_brand_briefing','seo_sem',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Andre Mitchell, SEO/SEM Brand Manager for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}. Primary conversion destination: assessment.druaiconsulting.com.\n\nIMPORTANT: The platform launched July 7, 2026. You have access to REAL platform data below. Use UTM sources and assessment data to inform your recommendations — do not invent competitor activity, traffic volumes, or search rankings.\n\n${marketingData}\n\nFOCUS TYPE: ${focusType}\n${focusInstructions[focusType]}\n\nDo not use "Briefing" or "Brief" as a heading. Write in first person as Andre.`,'normal',0,null,2000);
}

// Pulls real pipeline and revenue data from Supabase for Amara, Yuki, and Marcus.
// All three agents receive this snapshot so they report actual business state,
// never invented revenue figures, fabricated client counts, or assumed contract needs.
async function fetchLegalFinanceData(): Promise<string> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return 'Pipeline data unavailable.';
  try {
    // Real revenue lives in profiles.pathway_stage / amount_paid now (Aug 23, 2026 fix) --
    // the automated system tied to the DRU AI Transformation Pathway(TM), not the old
    // client_journey_stages manual table, which had no confirmed writer and no identity spine.
    const [clientRes, statsRes, subRes] = await Promise.all([
      fetch(`${url}/rest/v1/profiles?pathway_stage=in.(Diagnose,Design,Deploy,Dominate)&select=first_name,last_name,pathway_stage,amount_paid,updated_at&order=updated_at.desc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
      fetch(`${url}/rest/v1/stats?select=id,value`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
      fetch(`${url}/rest/v1/submissions?select=id,total_score,tier,role,company,created_at&order=created_at.desc&limit=10`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
    ]);
    const [clients, stats, subs]: [any[], any[], any[]] = await Promise.all([clientRes.json(), statsRes.json(), subRes.json()]);
    const statsMap: Record<string, number> = {};
    for (const s of stats) statsMap[s.id] = s.value;
    const totalRevenue = Array.isArray(clients) ? clients.reduce((sum: number, c: any) => sum + (parseFloat(c.amount_paid) || 0), 0) : 0;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentSubs = Array.isArray(subs) ? subs.filter((s: any) => s.created_at >= sevenDaysAgo) : [];
    const clientList = Array.isArray(clients) && clients.length > 0
      ? clients.map((c: any) => {
          const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Unknown';
          return `  - ${name} | Stage: ${c.pathway_stage} | Paid: $${c.amount_paid ?? 0} | Updated: ${c.updated_at?.slice(0,10) ?? 'unknown'}`;
        }).join('\n')
      : '  (none)';
    const lines = [
      'REAL PIPELINE DATA — use only these numbers, never invent or estimate:',
      `Clients in journey: ${Array.isArray(clients) ? clients.length : 0}`,
      `Client list:\n${clientList}`,
      `Total revenue collected: $${totalRevenue.toFixed(2)}`,
      `Diagnostics sold: ${statsMap['diagnostics_sold'] ?? 0}`,
      `Sessions booked: ${statsMap['sessions_booked'] ?? 0}`,
      `Leads captured: ${statsMap['leads_captured'] ?? 0}`,
      `Assessment completions (all time): ${Array.isArray(subs) ? subs.length : 0}`,
      `Assessment completions (last 7 days): ${recentSubs.length}`,
    ];
    return lines.join('\n');
  } catch {
    return 'Pipeline data unavailable.';
  }
}

// P4
async function runAmara(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const pipelineData = await fetchLegalFinanceData();
  const agentKnowledge = await getAgentKnowledge();
  return await runAgentToCSQ('amara','Amara Okafor','Legal & Finance','weekly_legal_briefing','legal_briefing',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Amara Okafor, Legal Advisor for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\n\nREAL PIPELINE DATA (use only this — do not invent client counts, contract needs, or revenue figures):\n${pipelineData}\n\nHARD RULES:\n1. Every client-facing statement must be grounded in the pipeline data above. If clients in journey = 0 and diagnostics sold = 0, open with: \"No clients in pipeline. No contract actions required this week.\"\n2. Do not repeat the same MSA/trademark checklist if nothing in the pipeline has changed. Acknowledge what stage we are at based on real data.\n3. If there ARE clients in the pipeline, identify each one by name and stage, and state exactly what legal action their stage requires.\n4. One standing legal readiness item is acceptable — but only if it is stage-appropriate and not already covered last week.\n5. Flag anything genuinely time-sensitive. If nothing is time-sensitive, say so.\n\nFormat: 150 words or fewer. Write in first person as Amara.`,'normal',0,null,600);
}
async function runDiego(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const pipelineData = await fetchLegalFinanceData();
  const agentKnowledge = await getAgentKnowledge();
  return await runAgentToCSQ('diego','Diego Reyes','Legal & Finance','weekly_expense_report','expense_report',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Diego Reyes, Expense Manager for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\n\nKNOWN FIXED EXPENSES (these are real — report them as-is):\nVercel Pro: $20/mo | Anthropic API: usage-based (variable) | GHL: ~$40—$60/mo | HeyGen Creator: $31/mo | Bunny Stream: $1—$5/mo\n\nREAL PIPELINE DATA (use only these numbers for revenue-side reporting):\n${pipelineData}\n\nHARD RULES:\n1. Known fixed expenses above are real — report them accurately. Do not invent additional costs.\n2. For the revenue side, use ONLY the total revenue collected figure from the pipeline data above.\n3. If total revenue collected = $0.00, state that clearly: \"Revenue collected: $0. Operating at a loss of [known expenses] this month.\" Do not calculate break-even as if revenue exists.\n4. If revenue exists, show actual P&L: revenue collected minus known monthly expenses = net position. Name the clients and amounts.\n5. One cost optimization item is acceptable — but only if it is actionable this week, not a repeat from last week.\n\nFormat: 200 words or fewer. Write in first person as Diego.`,'normal',0,null,600);
}
async function runYuki(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const pipelineData = await fetchLegalFinanceData();
  const agentKnowledge = await getAgentKnowledge();
  return await runAgentToCSQ('yuki','Yuki Tanaka','Legal & Finance','weekly_financial_report','financial_report',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Yuki Tanaka, Financial Reporting Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\n\nREAL PIPELINE DATA (use only these numbers):\n${pipelineData}\n\nHARD RULES — read before writing a single word:\n1. Every number you write must come directly from the data above. If it is not in the data, do not write it.\n2. No revenue projections, no estimated earnings, no conversion math. Real reported figures only.\n3. If total revenue collected = $0.00 and diagnostics sold = 0, open with: \"Zero revenue to report this week. No financial figures to present.\" Then name the single financial tracking item to set up before the first sale lands.\n4. If there IS real revenue, report it exactly — by client name, amount paid, and stage.\n5. Writing any number not in the data above is a fabrication. DeAnna checks your output against the raw table.\n\nFormat: 150 words or fewer. Write in first person as Yuki.`,'normal',0,null,600);
}
async function runMarcus(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const pipelineData = await fetchLegalFinanceData();
  const agentKnowledge = await getAgentKnowledge();
  return await runAgentToCSQ('marcus','Marcus Chen','Legal & Finance','weekly_tax_strategy_briefing','tax_strategy',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Marcus Chen, Tax Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nEntity: LLC (DBA Dimensional Solns, LLC) — Texas. DISCLAIMER: All guidance is strategic tax counsel for planning purposes only. Final decisions require a licensed CPA or tax attorney.\n\nREAL PIPELINE DATA (use only these numbers):\n${pipelineData}\n\nHARD RULES:\n1. Calibrate every recommendation to the actual revenue stage shown in the data. Do not advise on quarterly estimated tax payments if total revenue = $0.\n2. If total revenue collected = $0.00 and diagnostics sold = 0, open with: \"No revenue collected yet. Tax planning is in setup stage.\" Then give one specific structural action to complete before the first dollar arrives.\n3. If there IS real revenue, report it by client and advise on tax obligations tied to those exact amounts.\n4. Do not repeat the same S-Corp election or home office advice every week unless something in the data has changed that makes it newly relevant.\n5. One time-sensitive flag only if something is genuinely urgent based on real data or the calendar.\n\nFormat: 150 words or fewer. Write in first person as Marcus.`,'normal',0,null,600,'claude-sonnet-4-6');
}

// P5
async function runKhalid(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const previousFlags = await getCrossRead(['khalid'], 1);
  const prevSection = previousFlags ? `WHAT YOU FLAGGED YESTERDAY (do not repeat any of these):\n${previousFlags}` : 'No previous flags on record.';
  const agentKnowledge = await getAgentKnowledge();
  return await runAgentToCSQ('khalid','Khalid Hassan','AI Governance','daily_disclaimer_review','disclaimer_review',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Khalid Hassan, Disclaimer Writer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\n\n${prevSection}\n\nHARD RULE: If you are about to raise something already listed above, skip it entirely. Only surface what is genuinely new or has materially changed since yesterday.\n\n**AI-Generated Content Disclaimer** — Short and full form. Only if a NEW gap identified.\n**Course Disclaimer** — For From Confusion to Confident with AI™. Only if NEW gap.\n**Consulting Disclaimer** — For Strategic Diagnostic™ and Executive Diagnostic™. Only if NEW gap.\n**Today's Action** — One NEW highest-risk disclaimer gap. If nothing new: \"No new disclaimer gaps today.\"\n\nFormat: 200 words or fewer. Write in first person as Khalid Hassan.`,'normal',0,null,1500);
}
async function runSofia(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const previousFlags = await getCrossRead(['sofia'], 1);
  const prevSection = previousFlags ? `WHAT YOU FLAGGED YESTERDAY (do not repeat any of these):\n${previousFlags}` : 'No previous flags on record.';
  const agentKnowledge = await getAgentKnowledge();
  return await runAgentToCSQ('sofia','Sofia Petrov','AI Governance','daily_privacy_compliance','privacy_policy',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Sofia Petrov, Privacy Policy Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\n\n${prevSection}\n\nHARD RULE: If you are about to raise something already listed above, skip it entirely. Only surface what is genuinely new or has materially changed since yesterday.\n\n**Data Collection Status** — One NEW gap in what is collected via assessment.druaiconsulting.com.\n**GDPR/CCPA Readiness** — One NEW compliance gap and actionable step. If none new, say so.\n**Privacy Policy Review** — One NEW update needed. If none new, say so.\n**Today's Priority** — Single most important NEW privacy action. If nothing new: \"No new privacy gaps today.\"\n\nFormat: 200 words or fewer. Write in first person as Sofia Petrov.`,'normal',0,null,1500);
}
async function runJames(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const previousFlags = await getCrossRead(['james'], 1);
  const prevSection = previousFlags ? `WHAT YOU FLAGGED YESTERDAY (do not repeat any of these):\n${previousFlags}` : 'No previous flags on record.';
  const agentKnowledge = await getAgentKnowledge();
  return await runAgentToCSQ('james','James Osei','AI Governance','daily_contract_readiness','contract_review',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are James Osei, Contract Writer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\n\n${prevSection}\n\nHARD RULE: If you are about to raise something already listed above, skip it entirely. Only surface what is genuinely new or has materially changed since yesterday.\n\n**Engagement Agreement Status** — Any NEW contract gap for: Strategic Diagnostic™ ($3,497), Executive Diagnostic™ ($4,997), 90-Day AI Transformation Journey™ ($20K+), From Confusion to Confident with AI™ Course.\n**Today's Contract Action** — One specific NEW gap to close. If nothing new: \"No new contract gaps today.\"\n\nFormat: 200 words or fewer. Write in first person as James Osei.`,'normal',0,null,1500);
}
async function runMeiLin(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const agentKnowledge = await getAgentKnowledge();
  const agentCorrections = await getAgentCorrections('Mei Lin');
  const prompt = `${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}${agentCorrections}\n\nYou are Mei Lin, Brand Protection Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\n\nUse web search to do the following:\n**Infringement Scan** — Search for any entity using DRU CLEAR, DRU AI Consulting, 5C Cultural DNA, 5D Leadership, or DRU AI Leadership Ecosystem online. Report any unauthorized use found. If none, say so.\n**Competitive Intelligence** — Search for competitors in AI leadership consulting or AI transformation consulting. One specific threat or positioning opportunity based on what you actually find.\n**Brand Presence Check** — One brand consistency recommendation across druaiconsulting.com, assessment.druaiconsulting.com, app.druaiconsulting.com, and LinkedIn.\n**Today's Brand Action** — Single most important brand protection move based on what you found today.\n\nOnly report what search returns. Do not invent threats or invent competitor names.\n\nFormat: 250 words or fewer. Write in first person as Mei Lin.`;
  try {
    const output = await callAnthropicWithWebSearch(prompt, 1500, 3);
    return await writeToCSQ({agent_id:'meilin',agent_name:'Mei Lin',division:'AI Governance',task:'daily_brand_protection',category:'brand_monitoring',raw_output:output,priority:'normal',status:'pending',retry_count:0});
  } catch(err) { console.error('[meilin] Error:', err); return null; }
}
async function runRafael(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const agentKnowledge = await getAgentKnowledge();
  const agentCorrections = await getAgentCorrections('Rafael Torres');
  const prompt = `${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}${agentCorrections}\n\nYou are Rafael Torres, AI Intelligence Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\n\nUse web search to find real AI news published today or this week. Search for the latest updates from OpenAI, Anthropic (Claude), and Google Gemini.\n\n**AI Landscape Update** — Top 2 real developments found today. For each: what it is, why it matters for DeAnna's clients and positioning, one action it suggests.\n**Competitive Intelligence** — One real move by competitors in AI consulting or leadership development found in your search.\n**Today's Learning Priority** — Single most strategically significant insight for DeAnna based on what you actually found.\n\nOnly report what search returns. If nothing new found, say so. Do not invent developments.\n\nFormat: 300 words or fewer. Write in first person as Rafael.`;
  try {
    const output = await callAnthropicWithWebSearch(prompt, 1500, 3);
    return await writeToCSQ({agent_id:'rafael',agent_name:'Rafael Torres',division:'AI Governance',task:'daily_ai_intelligence',category:'ai_intelligence',raw_output:output,priority:'normal',status:'pending',retry_count:0});
  } catch(err) { console.error('[rafael] Error:', err); return null; }
}

// Pulls real system health data from Supabase for Fatima.
// Queries CSQ for needs_correction and rejected items in last 24 hours
// so Fatima reports actual agent issues, not invented operational status.
async function fetchSystemHealthData(): Promise<string> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return 'System health data unavailable.';
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [correctionRes, rejectedRes, pendingRes] = await Promise.all([
      fetch(`${url}/rest/v1/chief_of_staff_queue?status=eq.needs_correction&created_at=gte.${since}&select=agent_name,division,correction_notes,isabella_flags&order=created_at.desc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
      fetch(`${url}/rest/v1/chief_of_staff_queue?status=eq.rejected&created_at=gte.${since}&select=agent_name,division,correction_notes&order=created_at.desc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
      fetch(`${url}/rest/v1/chief_of_staff_queue?status=eq.pending&created_at=gte.${since}&select=agent_name,division&order=created_at.desc&limit=5`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
    ]);
    const [corrections, rejected, pending]: [any[], any[], any[]] = await Promise.all([correctionRes.json(), rejectedRes.json(), pendingRes.json()]);
    const correctionList = Array.isArray(corrections) && corrections.length > 0
      ? corrections.map((c: any) => `  - ${c.agent_name} (${c.division}): ${(c.correction_notes || c.isabella_flags || 'flagged').slice(0, 120)}`).join('\n')
      : '  (none)';
    const rejectedList = Array.isArray(rejected) && rejected.length > 0
      ? rejected.map((r: any) => `  - ${r.agent_name} (${r.division}): ${(r.correction_notes || 'rejected').slice(0, 120)}`).join('\n')
      : '  (none)';
    const lines = [
      'REAL SYSTEM HEALTH DATA (last 24 hours) ' + '—' + ' use only these, never invent agent issues:',
      `Agents needing correction: ${Array.isArray(corrections) ? corrections.length : 0}`,
      `Correction details:\n${correctionList}`,
      `Agents rejected: ${Array.isArray(rejected) ? rejected.length : 0}`,
      `Rejection details:\n${rejectedList}`,
      `Agents still pending (stuck): ${Array.isArray(pending) ? pending.length : 0}`,
    ];
    return lines.join('\n');
  } catch {
    return 'System health data unavailable.';
  }
}

// P6
async function runNaomi(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const pipelineData = await fetchLegalFinanceData();
  const agentKnowledge = await getAgentKnowledge();
  return await runAgentToCSQ('naomi','Naomi Williams','HR','daily_recruiting_status','recruiting',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Naomi Williams, Recruiting Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\n\nREAL PIPELINE DATA (use only this — do not invent candidates, interviews, or offers):\n${pipelineData}\n\nHARD RULES:\n1. There are no real candidates in the system until GHL or Supabase shows them. Do not invent phone screens, offers, or pipeline stages.\n2. If clients in journey = 0 and diagnostics sold = 0, open with: \"No clients yet, no active candidates. Recruiting is in preparation mode.\" Then give ONE structural action to take today to prepare for hiring (write a JD, define a role scorecard, set up a GHL recruiting pipeline stage).\n3. If clients ARE in the pipeline, hiring urgency is real — name the client volume and which role becomes critical first.\n4. Do not repeat the same role priority list every day. If the priority list has not changed, acknowledge that and focus only on today's one action.\n\nFormat: 200 words or fewer. Write in first person as Naomi.`,'normal',0,null,1500);
}
async function runAiden(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const previousRecs = await getCrossRead(['aiden'], 1);
  const prevSection = previousRecs ? `WHAT YOU RECOMMENDED YESTERDAY (do not repeat):\n${previousRecs}` : 'No previous recommendations on record.';
  const agentKnowledge = await getAgentKnowledge();
  return await runAgentToCSQ('aiden','Aiden Park','HR','daily_onboarding_readiness','onboarding',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Aiden Park, Internal Onboarding Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nCLIENT ONBOARDING FLOW: DRU CLEAR™ Assessment — GHL automation — welcome sequence — diagnostic scheduling.\n\n${prevSection}\n\nHARD RULE: If you are about to recommend something already in the list above, skip it. Only surface what is genuinely new.\n\n**Client First 24 Hours** — One NEW experience upgrade not recommended yesterday.\n**Internal Team Onboarding** — One NEW onboarding document or process item to create.\n**Today's Priority** — Single most impactful NEW onboarding action. If nothing new: \"No new onboarding recommendations today.\"\n\nDo not describe fictional client scenarios. If no real clients exist yet, focus on infrastructure preparation only.\n\nFormat: 200 words or fewer. Write in first person as Aiden.`,'normal',0,null,1500);
}
async function runFatima(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const healthData = await fetchSystemHealthData();
  const agentKnowledge = await getAgentKnowledge();
  return await runAgentToCSQ('fatima','Fatima Al-Rashid','HR','daily_internal_helpdesk','helpdesk',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Fatima Al-Rashid, Internal Helpdesk and Operations Coordinator for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\n\nREAL SYSTEM HEALTH DATA (use only this — do not invent agent issues, error rates, or operational status):\n${healthData}\n\nHARD RULES:\n1. Your ecosystem health report must be based entirely on the data above. Do not invent issues, percentages, or agent-specific problems.\n2. If agents needing correction = 0 and agents rejected = 0, open with: \"All agents cleared in the last 24 hours. No corrections or rejections on record.\"\n3. If there ARE real issues, name the agent, the division, and what the correction note says. One action to resolve each.\n4. Do not assert vendor status (Vercel, Supabase, GHL, etc.) unless you have real data showing an issue. If no vendor data available, skip that section.\n5. One genuine workflow optimization to reduce DeAnna's manual review time — based on what the health data actually shows.\n\nFormat: 200 words or fewer. Write in first person as Fatima.`,'normal',0,null,1500);
}

// P7
// Pulls real client delivery data for all Client Delivery agents.
async function fetchClientDeliveryData(): Promise<string> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return 'Client delivery data unavailable.';
  try {
    // Real clients live in profiles.pathway_stage now (Aug 23, 2026 fix) -- the automated,
    // GHL-driven system that matches the actual DRU AI Transformation Pathway(TM) IP, not
    // the old client_journey_stages manual table, which had no confirmed source and no
    // identity spine. 'Discover' (free assessment only) is excluded -- these are paying
    // clients only, matching what "clients in journey" has always meant to the agents below.
    const [clientRes, postsRes, lbRes, streakRes, enrollRes, progressRes] = await Promise.all([
      fetch(`${url}/rest/v1/profiles?pathway_stage=in.(Diagnose,Design,Deploy,Dominate)&select=first_name,last_name,email,ghl_contact_id,pathway_stage,amount_paid,updated_at&order=updated_at.desc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
      fetch(`${url}/rest/v1/community_posts?select=id,created_at,profile_id&order=created_at.desc&limit=10`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
      fetch(`${url}/rest/v1/community_leaderboard?select=user_id,total_points,rank&order=rank.asc&limit=5`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
      fetch(`${url}/rest/v1/user_streaks?select=user_id,current_streak,longest_streak`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
      fetch(`${url}/rest/v1/course_enrollments?select=id,created_at&order=created_at.desc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
      fetch(`${url}/rest/v1/course_progress?select=id,lesson_id,completed_at`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
    ]);
    const [clients, posts, lb, streaks, enrollments, progress]: [any[],any[],any[],any[],any[],any[]] = await Promise.all([clientRes.json(),postsRes.json(),lbRes.json(),streakRes.json(),enrollRes.json(),progressRes.json()]);

    // Join each client back to their pre-payment history via ghl_contact_id -- the shared
    // identity spine. Gives Keisha and the rest of Client Delivery real context (where they
    // came from, how they scored, whether Aaliyah reached them) instead of a blank slate.
    let historyByContactId: Record<string, { source_campaign?: string; outreach_count: number }> = {};
    const contactIds = (Array.isArray(clients) ? clients : []).map((c:any) => c.ghl_contact_id).filter(Boolean);
    if (contactIds.length > 0) {
      const [scoringRes, outreachRes] = await Promise.all([
        fetch(`${url}/rest/v1/lead_scoring_events?ghl_contact_id=in.(${contactIds.join(',')})&select=ghl_contact_id,source_campaign&order=created_at.desc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
        fetch(`${url}/rest/v1/outreach_log?ghl_contact_id=in.(${contactIds.join(',')})&select=ghl_contact_id`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
      ]);
      const scoringRows = scoringRes.ok ? await scoringRes.json() : [];
      const outreachRows = outreachRes.ok ? await outreachRes.json() : [];
      for (const row of (Array.isArray(scoringRows) ? scoringRows : [])) {
        if (row.ghl_contact_id && !historyByContactId[row.ghl_contact_id]) {
          historyByContactId[row.ghl_contact_id] = { source_campaign: row.source_campaign, outreach_count: 0 };
        }
      }
      for (const row of (Array.isArray(outreachRows) ? outreachRows : [])) {
        if (row.ghl_contact_id) {
          if (!historyByContactId[row.ghl_contact_id]) historyByContactId[row.ghl_contact_id] = { outreach_count: 0 };
          historyByContactId[row.ghl_contact_id].outreach_count++;
        }
      }
    }
    const clientList = Array.isArray(clients) && clients.length > 0
      ? clients.map((c:any) => {
          const name = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.email;
          const h = c.ghl_contact_id ? historyByContactId[c.ghl_contact_id] : undefined;
          const historyNote = h ? ` | came from: ${h.source_campaign ?? 'unknown'} | outreach sent: ${h.outreach_count}` : ' | no prior outreach history';
          return `  - ${name} | ${c.pathway_stage} | $${c.amount_paid ?? 0}${historyNote}`;
        }).join('\n')
      : '  (none)';
    const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString();
    const recentPosts = Array.isArray(posts) ? posts.filter((p:any) => p.created_at >= sevenDaysAgo).length : 0;
    const lines = [
      'REAL CLIENT DELIVERY DATA — use only these numbers, never invent client counts, completion rates, or community metrics:',
      `Clients in journey: ${Array.isArray(clients) ? clients.length : 0}`,
      `Client list:\n${clientList}`,
      `Community posts (all time): ${Array.isArray(posts) ? posts.length : 0} | Last 7 days: ${recentPosts}`,
      `Leaderboard entries: ${Array.isArray(lb) ? lb.length : 0}`,
      `Active streaks: ${Array.isArray(streaks) ? streaks.length : 0}`,
      `Course enrollments: ${Array.isArray(enrollments) ? enrollments.length : 0}`,
      `Course lessons completed: ${Array.isArray(progress) ? progress.length : 0}`,
    ];
    return lines.join('\n');
  } catch { return 'Client delivery data unavailable.'; }
}

async function runKeisha(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const deliveryData = await fetchClientDeliveryData();
  const prev = await getCrossRead(['keisha'], 1);
  const prevSection = prev ? `WHAT YOU RECOMMENDED YESTERDAY (do not repeat):\n${prev}` : 'No previous output on record.';
  const agentKnowledge = await getAgentKnowledge();
  return await runAgentToCSQ('keisha','Keisha Thompson','Client Delivery','daily_client_onboarding','client_onboarding',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Keisha Thompson, Client Onboarding Coach for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nCLIENT ONBOARDING FLOW: DRU CLEAR™ Assessment — GHL automation — welcome sequence — diagnostic scheduling.\n\nREAL DATA:\n${deliveryData}\n\n${prevSection}\n\nHARD RULES:\n1. If clients in journey = 0, open with: \"No clients in pipeline yet.\" Then give ONE new onboarding infrastructure item not covered yesterday.\n2. If clients exist, name each one, their stage, and the specific onboarding action their stage requires.\n3. Do not repeat the same friction point or protocol every day. Check previous output above first.\n4. Do not invent client scenarios, drop-off rates, or conversion windows.\n\nFormat: 200 words or fewer. Write in first person as Keisha.`,'normal',0,null,1500);
}
async function runMarco(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const deliveryData = await fetchClientDeliveryData();
  const prev = await getCrossRead(['marco'], 1);
  const prevSection = prev ? `WHAT YOU RECOMMENDED YESTERDAY (do not repeat):\n${prev}` : 'No previous output on record.';
  const agentKnowledge = await getAgentKnowledge();
  return await runAgentToCSQ('marco','Marco Silva','Client Delivery','daily_community_management','community_management',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Marco Silva, Community Manager for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nPLATFORM: app.druaiconsulting.com — Community Connection (Navigator $47/mo and Accelerator $147/mo).\n\nREAL DATA:\n${deliveryData}\n\n${prevSection}\n\nHARD RULES:\n1. Base all community observations on the real data above. Do not invent engagement rates, member counts, or activity levels.\n2. If community posts > 0, reference what the actual post volume tells you about engagement stage.\n3. If leaderboard entries > 0, the community has active members — acknowledge that and tailor your prompt accordingly.\n4. Do not repeat the same engagement prompt or retention action as yesterday. Check previous output above first.\n5. One community engagement prompt and one retention action — both must be NEW.\n\nFormat: 200 words or fewer. Write in first person as Marco.`,'normal',0,null,1500);
}
async function runLeila(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const deliveryData = await fetchClientDeliveryData();
  const prev = await getCrossRead(['leila'], 1);
  const prevSection = prev ? `WHAT YOU RECOMMENDED YESTERDAY (do not repeat):\n${prev}` : 'No previous output on record.';
  const agentKnowledge = await getAgentKnowledge();
  return await runAgentToCSQ('leila','Leila Nasser','Client Delivery','daily_feedback_coaching','feedback_coaching',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Leila Nasser, Feedback Coach for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\n\nREAL DATA:\n${deliveryData}\n\n${prevSection}\n\nHARD RULES:\n1. If clients in journey = 0 and course lessons completed = 0, there is no real feedback to report. Open with: \"No client feedback to report yet.\" Then give ONE new feedback infrastructure item not covered yesterday.\n2. If clients or course progress exist, build your feedback recommendations around those specific touchpoints.\n3. Do not invent NPS scores, testimonial quotes, or satisfaction metrics.\n4. Do not repeat the same feedback template or system recommendation as yesterday.\n\nFormat: 200 words or fewer. Write in first person as Leila.`,'normal',0,null,1500);
}
async function runJordan(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const dayOfWeek=new Date().toLocaleDateString('en-US',{weekday:'long',timeZone:'America/Chicago'});
  const deliveryData = await fetchClientDeliveryData();
  const focusType=dayOfWeek==='Monday'?'weekly_creative_brief':dayOfWeek==='Friday'?'weekly_creative_recap':'daily_creative_direction';
  const focusInstructions:Record<string,string>={
    weekly_creative_brief:`Set creative direction for Simone (course), Theo (presentations), and Amelia (video) this week. One unifying theme, one visual direction (Navy #0A2342 / Gold #D4AF37 / Magenta #C2185B), one production priority per team member. Base priorities on what is actually needed given the real delivery data above — do not assign work that presupposes clients or course completions that don't exist yet.`,
    daily_creative_direction:`One creative asset priority for today. Specify which team member and the exact deliverable. One brand consistency note. Do not describe any asset as complete, deployed, or live unless the delivery data above confirms it exists.`,
    weekly_creative_recap:`Review this week's creative direction. Note what was assigned. Do not describe any deliverable as completed or live unless confirmed in the delivery data above. One quality recommendation for next week.`
  };
  const agentKnowledge = await getAgentKnowledge();
  return await runAgentToCSQ('jordan','Jordan Hayes','Client Delivery','daily_creative_direction','creative_direction',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Jordan Hayes, Creative Director for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}. You coordinate: Simone Laurent (Course Architect), Theo Nguyen (Presentation Designer), Amelia Santos (Training Video Producer).\nBrand: Navy #0A2342, Gold #D4AF37, Magenta #C2185B. Fonts: Playfair Display (headlines), Inter (body).\n\nREAL DELIVERY DATA:\n${deliveryData}\n\nHARD RULE: Do not describe any asset, module, or video as complete, deployed, or live unless the data above confirms it. Course enrollments and lessons completed are the truth — report them as-is.\n\nFOCUS: ${focusType}\n${focusInstructions[focusType]}`,'normal',0,null,1500,'claude-sonnet-4-6');
}
async function runSimone(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const dayOfWeek=new Date().toLocaleDateString('en-US',{weekday:'long',timeZone:'America/Chicago'});
  const deliveryData = await fetchClientDeliveryData();
  const moduleMap:Record<string,string>={Monday:'Module 1: AI Readiness (DRU CLEAR™ Foundation)',Tuesday:'Module 2: AI Strategy (DRU AI Transformation Pathway™ — Discover & Diagnose)',Wednesday:'Module 3: AI Design & Deploy (DRU AI Transformation Pathway™ — Design & Deploy)',Thursday:'Module 4: AI Leadership (5D Leadership™ + 5C Cultural DNA™)',Friday:'Module 5: AI Mastery (DRU AI Leadership Ecosystem™.)'};
  const todayModule=moduleMap[dayOfWeek]??'Module 1: AI Readiness (DRU CLEAR™ Foundation)';
  const agentKnowledge = await getAgentKnowledge();
  return await runAgentToCSQ('simone','Simone Laurent','Client Delivery','daily_course_architecture','course_architecture',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Simone Laurent, Course Architect for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nCOURSE: From Confusion to Confident with AI™. Tiers: Self-Paced $1,497, Live Cohort $7,997, Cohort Mastermind $12,997.\n\nREAL DELIVERY DATA:\n${deliveryData}\n\nHARD RULES:\n1. Do not invent completion rates, cohort data, learner feedback, or engagement metrics. The real numbers are above — use only those.\n2. If course lessons completed = 0, the course has not been completed by any student yet. Do not reference student outcomes.\n3. Course enrollments shows how many students exist. Calibrate your architecture decisions to that reality.\n4. You are building architecture — that is real, valuable work even before students arrive. But describe it as design in progress, not as complete or validated.\n\nTODAY'S MODULE FOCUS: ${todayModule}\n**Module Architecture** — 3 learning objectives, 3-5 key concepts, one framework application exercise, one executive reflection prompt.\n**Assessment Design** — One knowledge check and one real-world application activity.\n**Today's Priority** — Single most important architecture decision or asset to produce today.\n\nFormat: 250 words or fewer. Write in first person as Simone.`,'normal',0,null,1500,'claude-sonnet-4-6');
}
async function runTheo(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const dayOfWeek=new Date().toLocaleDateString('en-US',{weekday:'long',timeZone:'America/Chicago'});
  const deliveryData = await fetchClientDeliveryData();
  const assetType=dayOfWeek==='Monday'?'diagnostic_readout_template':dayOfWeek==='Wednesday'?'course_module_slides':dayOfWeek==='Friday'?'framework_visualization':'daily_presentation_asset';
  const assetInstructions:Record<string,string>={
    diagnostic_readout_template:`Slide structure for delivering Strategic Diagnostic™ or Executive Diagnostic™ results. Slides: executive summary, findings by pillar, DRU AI Transformation Pathway™ stage placement, recommendations, next steps.`,
    course_module_slides:`Slide structure for one course module (5-8 slides). Title, learning objectives, 3 content slides with visual direction, one activity slide, summary/CTA.`,
    framework_visualization:`One-page visual representation of a DRU proprietary framework. Layout concept, key elements, color application (Navy/Gold/Magenta), typography guidance.`,
    daily_presentation_asset:`One slide concept for the highest-priority presentation need today. Specify type, layout, content, visual direction.`
  };
  const agentKnowledge = await getAgentKnowledge();
  return await runAgentToCSQ('theo','Theo Nguyen','Client Delivery','daily_presentation_design','presentation_design',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Theo Nguyen, Presentation Designer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nBrand: Navy #0A2342, Gold #D4AF37, Magenta #C2185B. Fonts: Playfair Display (headlines), Inter (body).\n\nREAL DELIVERY DATA:\n${deliveryData}\n\nHARD RULE: You are producing design specs and briefs — that is real work. But do not describe any asset as deployed, client-facing, or in active use unless the delivery data above confirms clients exist who would use it. Design in progress is honest. Fake deployment status is not.\n\nASSET TYPE: ${assetType}\n${assetInstructions[assetType]}\n**Today's Production Priority** — Single most important asset to advance today.\n\nFormat: 250 words or fewer. Write in first person as Theo.`,'normal',0,null,1500);
}
async function runAmelia(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const dayOfWeek=new Date().toLocaleDateString('en-US',{weekday:'long',timeZone:'America/Chicago'});
  const deliveryData = await fetchClientDeliveryData();
  const videoType=dayOfWeek==='Monday'?'intro_video_script':dayOfWeek==='Wednesday'?'course_module_video':dayOfWeek==='Friday'?'testimonial_video_framework':'social_video_brief';
  const videoInstructions:Record<string,string>={
    intro_video_script:`60-90 second script for DeAnna's course introduction. Opening hook, who this is for, what they'll achieve using the DRU AI Transformation Pathway™, one credential reference, CTA to assessment.druaiconsulting.com.`,
    course_module_video:`Production brief for one module video in From Confusion to Confident with AI™. Learning objective, talking points (3-5 bullets), on-screen graphics, estimated runtime (8-12 min).`,
    testimonial_video_framework:`Question sequence for client testimonial videos (5-7 questions). Structure: before state — discovery of DRU CLEAR™ — transformation — measurable outcome — recommendation. Note: no real testimonials exist yet — this is the framework for when they do.`,
    social_video_brief:`30-60 second video concept for LinkedIn or Instagram Reels. First 3-second hook, core message tied to one DRU framework, visual direction, CTA to assessment.druaiconsulting.com.`
  };
  const agentKnowledge = await getAgentKnowledge();
  return await runAgentToCSQ('amelia','Amelia Santos','Client Delivery','daily_video_production','video_production',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Amelia Santos, Training Video Producer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\n\nREAL DELIVERY DATA:\n${deliveryData}\n\nHARD RULES:\n1. Do not invent view counts, engagement rates, or video performance metrics. No real video data exists yet — say so if relevant.\n2. If clients in journey = 0, testimonial frameworks are prep work only — label them as such, not as active production.\n3. You are producing creative briefs and scripts — that is real, valuable work. Just be honest about what stage the business is at.\n\nVIDEO TYPE: ${videoType}\n${videoInstructions[videoType]}\n**Production Checklist** — Three technical requirements for today's video type.\n**Today's Priority** — Single most important video asset to advance today.\n\nFormat: 250 words or fewer. Write in first person as Amelia.`,'normal',0,null,1500,'claude-sonnet-4-6');
}

// P8
// Pulls real support ticket data from Supabase for Isaiah and Priscilla.
// Both agents report actual ticket volume and open issues — never invented metrics.
async function fetchSupportData(): Promise<string> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return 'Support data unavailable.';
  try {
    const [allRes, openRes, recentRes] = await Promise.all([
      fetch(`${url}/rest/v1/support_requests?select=id,category,status,member_tier,created_at`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
      fetch(`${url}/rest/v1/support_requests?status=eq.open&select=id,category,member_name,member_tier,question,created_at&order=created_at.desc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
      fetch(`${url}/rest/v1/support_requests?select=id,category,status,member_name,member_tier,question,created_at&order=created_at.desc&limit=5`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
    ]);
    const [all, open, recent]: [any[], any[], any[]] = await Promise.all([allRes.json(), openRes.json(), recentRes.json()]);
    const openList = Array.isArray(open) && open.length > 0
      ? open.map((t: any) => `  - [${t.member_tier ?? 'unknown tier'}] ${t.member_name ?? 'Unknown'}: ${(t.question || '').slice(0, 100)} (category: ${t.category ?? 'general'})`).join('\n')
      : '  (none)';
    const recentList = Array.isArray(recent) && recent.length > 0
      ? recent.map((t: any) => `  - ${t.status?.toUpperCase()} | ${t.category ?? 'general'} | ${t.member_tier ?? 'unknown tier'} | ${t.created_at?.slice(0,10)}`).join('\n')
      : '  (none)';
    const lines = [
      'REAL SUPPORT DATA — use only these numbers, never invent ticket counts, metrics, or response rates:',
      `Total support requests (all time): ${Array.isArray(all) ? all.length : 0}`,
      `Open tickets: ${Array.isArray(open) ? open.length : 0}`,
      `Open ticket details:\n${openList}`,
      `5 most recent tickets:\n${recentList}`,
    ];
    return lines.join('\n');
  } catch {
    return 'Support data unavailable.';
  }
}

async function runIsaiah(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const supportData = await fetchSupportData();
  const previousWork = await getCrossRead(['isaiah'], 1);
  const prevSection = previousWork ? `WHAT YOU COVERED YESTERDAY (do not repeat):\n${previousWork}` : 'No previous output on record.';
  const agentKnowledge = await getAgentKnowledge();
  return await runAgentToCSQ('isaiah','Isaiah Carter','Customer Support','daily_issue_resolution','issue_resolution',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Isaiah Carter, Issue Resolution Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\n\nREAL SUPPORT DATA (use only this — do not invent tickets, issues, or resolution counts):\n${supportData}\n\n${prevSection}\n\nHARD RULES:\n1. Base every statement on the real support data above. Do not invent ticket categories, volumes, or resolution flows that don't correspond to actual open tickets.\n2. If open tickets = 0 and total requests = 0, open with: \"No support tickets on record. Queue is clear.\" Then give ONE new infrastructure prep item not covered yesterday.\n3. If there ARE open tickets, address each one by name, category, and member tier. State the resolution action.\n4. Do not rewrite the same four resolution flows every day. If the protocols haven't changed and there are no real tickets, say so.\n5. Only surface genuinely new infrastructure improvements — check the previous output above before writing.\n\nFormat: 200 words or fewer. Write in first person as Isaiah.`,'normal',0,null,1500);
}
async function runPriscilla(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const supportData = await fetchSupportData();
  const previousWork = await getCrossRead(['priscilla'], 1);
  const prevSection = previousWork ? `WHAT YOU COVERED YESTERDAY (do not repeat):\n${previousWork}` : 'No previous output on record.';
  const agentKnowledge = await getAgentKnowledge();
  return await runAgentToCSQ('priscilla','Priscilla Okonkwo','Customer Support','daily_multichannel_comms','multichannel_comms',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Priscilla Okonkwo, Multi-Channel Communication Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nCHANNELS: Email (druaiconsulting@gmail.com), SMS (GHL A2P 10DLC), Portal notifications (app.druaiconsulting.com), LinkedIn DM.\n\nREAL SUPPORT DATA (use only this — do not invent response rates, open rates, or communication metrics):\n${supportData}\n\n${prevSection}\n\nHARD RULES:\n1. Do not invent channel metrics. If no real data exists for a channel, do not report a percentage or rate for it.\n2. If total support requests = 0, open with: \"No client communications on record yet.\" Then give ONE new comms infrastructure item not covered yesterday.\n3. If there ARE tickets, use their category and tier to inform which channel needs attention and what template would help.\n4. Do not rewrite the same channel health table or template set every day. Check the previous output above — only surface what is genuinely new.\n\nFormat: 200 words or fewer. Write in first person as Priscilla.`,'normal',0,null,1500);
}

async function runAaliyahCCOutreach(signalType: string, contactEmail: string, contactFirstName: string, contactPhone: string): Promise<void> {
  const webhookUrl = AALIYAH_CC_ROUTING[signalType];
  if (!webhookUrl) { console.warn(`[aaliyah_cc] Unknown signal type: ${signalType}`); return; }
  try {
    await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: contactEmail, first_name: contactFirstName, phone: contactPhone, signal_type: signalType, source: 'cc_upsell_signal' }) });
    console.log(`[aaliyah_cc] Fired ${signalType} outreach for ${contactEmail}`);
  } catch (error) { console.error(`[aaliyah_cc] Webhook failed for ${signalType}:`, error); }
}
export default async function handler(req:any,res:any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, x-cron-secret');
  if (req.method==='OPTIONS'){res.status(200).end();return;}
  if (req.method==='GET'&&req.query?.trigger_type){req.body={trigger_type:req.query.trigger_type,source:'vercel_cron'};}
  else if (req.method!=='POST'){res.status(405).json({error:'Method not allowed'});return;}
  const incomingSecret=req.headers['x-cron-secret'];
  if (incomingSecret!==undefined&&incomingSecret!==process.env.CRON_SECRET){res.status(401).json({error:'Unauthorized'});return;}
  const payload:TriggerPayload=req.body;
  if (!payload?.trigger_type){res.status(400).json({error:'trigger_type is required'});return;}
  const route=AGENT_ROUTES[payload.trigger_type];
  if (!route){res.status(400).json({error:`Unknown trigger_type: ${payload.trigger_type}`});return;}
  const sourceLabel=payload.source??'webhook';
  const triggeredAt=new Date().toISOString();
  console.log(`[ghl-agent-trigger] ${route.agent_name} | ${route.division} | ${sourceLabel}`);

  if (route.pipeline==='p1_omar'){const omar=await runOmar();const ryan=await runRyan(omar);res.status(202).json({success:true,agent:route.agent_name,leads_scanned:omar.total_leads_scanned,crm_updates:ryan.crm_updates});}
  else if (route.pipeline==='p1_omar_realtime'){const result=await runOmarRealtime(payload);res.status(202).json({success:result.success,agent:route.agent_name,contact_id:result.contact_id,skipped_reason:result.skipped_reason});}
  else if (route.pipeline==='p1_serena'){const agentKnowledge=await getAgentKnowledge();const id=await runAgentToCSQ('serena','Serena Jackson','Revenue, Growth & Sales','morning_coaching_briefing','coaching',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Serena Jackson, Business Coach for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.\nGenerate DeAnna's morning business coaching briefing. Today: ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'})}. Include: strategic focus, coaching insight, mindset anchor, one actionable growth move.`,'normal',0,null,1500,'claude-sonnet-4-6');res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p1_mateo'){const agentKnowledge=await getAgentKnowledge();const id=await runAgentToCSQ('mateo','Mateo Gonzalez','Revenue, Growth & Sales','sales_pipeline_review','sales_support',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Mateo Gonzalez, Sales Support Agent for DRU AI Consulting.\nOFFERS: DRU CLEAR™ AI Readiness Assessment (free) | Strategic Diagnostic™ ($3,497) | Executive Diagnostic™ ($4,997) | From Confusion to Confident with AI™ Course ($1,497-$12,997).\nInclude: sales focus, pipeline health, follow-up actions, sales tip, objection handling. All leads to assessment.druaiconsulting.com first.`,'normal',0,null,3000);res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p1_aaliyah'){
    // PARKED Aug 23, 2026 -- Aaliyah's outreach-email job was found fully redundant with
    // DeAnna's own GHL "DRU CLEAR™ Nurture Sequence" workflow (Tier Email -> 2nd Nudge ->
    // 3rd Email, real click/UTM tracking, working purchase-suppression gate already built
    // by DeAnna). Short-circuits here deliberately -- no Supabase reads, no Claude call, no
    // draft written -- so nothing fires even if this cron gets reactivated. She is not
    // deleted; a new job (comment/pain-point-hook scraping) is planned for a future session.
    // See /areas/rgs-lead-gen-buildout.md for full context before reactivating anything here.
    res.status(202).json({success:true,agent:route.agent_name,status:'parked',note:'Aaliyah\'s outreach job is parked -- redundant with the GHL nurture sequence. No action taken.'});}
  else if (route.pipeline==='p1_jaylen'){const result=await runJaylen();res.status(202).json({success:true,agent:route.agent_name,...result});}
  else if (route.pipeline==='p1_chloe'){const agentKnowledge=await getAgentKnowledge();const id=await runAgentToCSQ('chloe','Chloe Dubois','Revenue, Growth & Sales','daily_copy_asset','copywriting',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Chloe Dubois, Copy Writer for DRU AI Consulting. Generate one copy asset today. Rotate: ad copy, landing page headline+subhead+hero, CTA button variations (5 options), or testimonial prompt template. Brand: "Leadership Clarity · AI Mastery · Measurable Results." CTA destination: assessment.druaiconsulting.com. Every word earns its place.`);res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p1_zara'){
    const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
    const weekNum=Math.floor((Date.now()-new Date('2026-07-07').getTime())/(7*24*60*60*1000));
    const frameworks=['DRU CLEAR™','5C Cultural DNA™','5D Leadership™','AI Sales Mastery™'];
    const framework=frameworks[weekNum%4];
    const positioning=await fetchBrandCopy('positioning');
    const agentKnowledge=await getAgentKnowledge();
    const id=await runAgentToCSQ('zara','Zara Ahmed','Client Delivery','acc_weekly_pdf_content','acc_weekly_pdf',
    `${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Zara Ahmed, Content Architect for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.

You are writing this week's Accelerator Circle (ACC) member PDF, in the Workbook format. These are Accelerator-tier members ($147/mo) — serious, high-level leaders in active ${positioning} transformation. Write UP to them. They expect depth, directness, and real frameworks applied to real challenges — strategic substance, not motivational scaffolding. No fluff. No surface content. Every sentence earns its place.

SPECIFIC-INSIGHT BAR: if a paragraph you write could describe any company's generic AI rollout, it is too generic — rewrite it until it could only apply inside ${framework}'s own logic and dimensions.

THIS WEEK'S FRAMEWORK FOCUS: ${framework}

CONTENT FORMAT — Workbook structure, repeat this full block once per lesson/dimension you cover this week (2-3 lessons):

LESSON [N] — a short headline naming the dimension or lesson (this becomes the page title)

INSIGHT — the core teaching. Deep, specific, rooted entirely inside ${framework}. This is where the strategic depth lives.

WHAT IT LOOKS LIKE IN PRACTICE — a concrete second-person or specific-scene story (a named moment, a Thursday meeting, a real interaction) showing the Insight in action. Specific and human, never abstract.

BE PROACTIVE — one concrete, forward-moving practice or habit tied directly to the Insight above; specific enough to act on this week, written in the same elevated, affirmative voice.

THIS WEEK'S ACTION — exactly 3 concrete micro-steps a member can do this week, each one a single doable action, not a project.

REFLECTION — one powerful question that makes them pause and answer for themselves.

Lead with what is possible throughout — write every statement as active, affirmative, forward-moving language, the kind that names what's true and what to do next rather than what to fear or avoid. Vocabulary register is elevated and deliberate ("achieved significant advancement," "meticulously prepared") while staying warm, not stiff. Vary sentence rhythm — semicolons for flow, short punchy statements for emphasis. Write every word as DeAnna herself would — this must sound like DeAnna authored it, not a content writer approximating her.

CLOSING — always four parts, in this order:

1. A quote — pull the most honest, direct line from the piece itself. The one that lands hardest. Set it apart, no quotation marks needed.

2. This Week, Pick One — a short paragraph telling them they do not need to act on everything. Just the one that resonated most. Do the action step. Then bring the reflection answer into the Circle.

3. A bulleted recap — one line per lesson, each restating that lesson's Reflection question, labeled by lesson number.

4. Want to continue on your DRU AI Transformation Pathway™ journey with a custom-made, just-for-you roadmap? Click here frameworks.druaiconsulting.com

Write the complete article. This is the full PDF content — not a summary or outline.`,
    'normal',0,null,2500,'claude-sonnet-4-6');
    res.status(202).json({success:true,agent:route.agent_name,csq_id:id});
  }
  else if (route.pipeline==='p1_elena'){const agentKnowledge=await getAgentKnowledge();const id=await runAgentToCSQ('elena','Elena Vasquez','Revenue, Growth & Sales','product_knowledge_update','product_knowledge',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Elena Vasquez, Product Knowledge Agent for DRU AI Consulting. Generate weekly product knowledge update. Include: 5 executive FAQs, offer comparison guide (all starting with assessment.druaiconsulting.com), objection + response per offer, one positioning insight.`);res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p1_kwame'){const agentKnowledge=await getAgentKnowledge();const id=await runAgentToCSQ('kwame','Kwame Asante','Revenue, Growth & Sales','proposal_template_update','proposals',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Kwame Asante, Proposal Writer for DRU AI Consulting. Generate weekly proposal update. Include: executive summary template for Executive Diagnostic ($4,997) in McKinsey-style, proposal outline for C-suite client, value proposition (3 versions: short/medium/long), one proposal best practice. Brand: DeAnna R. Upshaw — 25+ years IT, 10+ years leadership development, AI Authority. Use only the figures given here — never invent a statistic, percentage, dollar range, or timeframe that wasn't provided.`);res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p1_adaeze_scout'){const result=await runAdaezeScout();res.status(202).json({success:true,agent:route.agent_name,opportunities_found:result.count,csq_id:result.csqId});}
  else if (route.pipeline==='p1_kwame_grants'){
    const opportunityName = typeof payload.opportunity_name === 'string' ? payload.opportunity_name : '';
    if (!opportunityName.trim()){res.status(400).json({error:'opportunity_name is required -- DeAnna must specify which opportunity to draft, Kwame does not select one'});return;}
    const result=await runKwameGrantWriter(opportunityName);
    if (result.csqId) {
      const spendCheck = await checkAndReserveOnDemandSpend();
      if (spendCheck.ok) {
        const locked = await acquireOnDemandLock('Kwame Asante (grant draft)');
        if (locked) {
          const cronSecret = process.env.CRON_SECRET ?? '';
          const csqIdToProcess = result.csqId;
          waitUntil(
            fetch('https://app.druaiconsulting.com/api/process-on-demand', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-cron-secret': cronSecret },
              body: JSON.stringify({ csq_id: csqIdToProcess }),
            }).then((r) => { console.log(`[kwame-grants] on-demand chain response: ${r.status}`); })
              .catch((err) => { console.error('[kwame-grants] Failed to fire on-demand chain:', err); releaseOnDemandLock(); })
          );
          console.log(`[kwame-grants] On-demand chain fired for CSQ: ${result.csqId}`);
        } else {
          console.log('[kwame-grants] On-demand lock busy -- draft will be picked up by the daily cron instead.');
        }
      } else {
        console.log(`[kwame-grants] Daily spend cap reached ($${spendCheck.totalSpent}/$${spendCheck.cap}) -- draft will be picked up by the daily cron instead.`);
      }
    }
    if (result.count > 0) {
      res.status(202).json({success:true,agent:route.agent_name,drafted:result.count,csq_id:result.csqId});
    } else {
      res.status(500).json({success:false,agent:route.agent_name,error:'Kwame could not produce a usable draft -- check server logs for the specific failure, or Chloe hard-rejected it after 3 review passes (check the addressable block on your dashboard).'});
    }
  }
  else if (route.pipeline==='p1_aaliyah_scout'){const result=await runAaliyahProspectScout();res.status(202).json({success:true,agent:route.agent_name,opportunities_found:result.count,csq_id:result.csqId});}
  else if (route.pipeline==='p2_camila'){const id=await runCamila();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p2_darius'){const id=await runDarius();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p2_ravi'){const id=await runRavi();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p2_yara'){
    const urlY=process.env.VITE_SUPABASE_URL; const keyY=process.env.SUPABASE_SERVICE_ROLE_KEY; let topPost='';
    if (urlY&&keyY){const mondayY=new Date();mondayY.setDate(mondayY.getDate()-mondayY.getDay()+1);const weekOfY=mondayY.toISOString().split('T')[0];const r=await fetch(`${urlY}/rest/v1/content_queue?week_of=eq.${weekOfY}&status=neq.queued&order=day_number.asc&limit=1`,{headers:{apikey:keyY,Authorization:`Bearer ${keyY}`}});if (r.ok){const q=await r.json();if (q.length>0) topPost=`${q[0].hook}\n\n${q[0].content}\n\n${q[0].hashtags}`;}}
    const agentKnowledge=await getAgentKnowledge();
    const yaraPrompt=`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Yara Mansour, Bilingual Content Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.\n${topPost?`Adapt this week's content into a full bilingual multi-platform campaign.\n\nSOURCE CONTENT:\n${topPost}`:'Write original AI leadership content for a bilingual multi-platform campaign targeting English-speaking and LATAM executives.'}\n\nRespond ONLY with a valid JSON object — no preamble, no markdown fences:\n{\n  "linkedin_content": "English LinkedIn post — 200-300 words, strong hook, professional tone, one DRU framework reference (™), CTA: assessment.druaiconsulting.com, max 3 hashtags",\n  "facebook_content": "English Facebook post — 150-200 words, warm conversational tone, same core message, CTA: assessment.druaiconsulting.com",\n  "instagram_caption": "English Instagram caption — 80-120 words, punchy opening, visual energy, CTA: assessment.druaiconsulting.com, 5-7 hashtags",\n  "spanish_content": "Spanish LinkedIn post — natural executive-level LATAM Spanish, culturally adapted (not literal), same length as linkedin_content, CTA: assessment.druaiconsulting.com, translated hashtags"\n}`;
    const id=await runAgentToCSQ('yara','Yara Mansour','Content & Brand','spanish_localization','localization',yaraPrompt);
    res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p2_ingrid'){
    const urlI=process.env.VITE_SUPABASE_URL; const keyI=process.env.SUPABASE_SERVICE_ROLE_KEY; let weekContent='';
    if (urlI&&keyI){const mondayI=new Date();mondayI.setDate(mondayI.getDate()-mondayI.getDay()+1);const weekOfI=mondayI.toISOString().split('T')[0];const r=await fetch(`${urlI}/rest/v1/content_queue?week_of=eq.${weekOfI}&order=day_number.asc`,{headers:{apikey:keyI,Authorization:`Bearer ${keyI}`}});if (r.ok){const posts=await r.json();weekContent=posts.map((p:any)=>`Day ${p.day_number} (${p.framework_covered}): ${p.hook}`).join('\n');}}
    const agentKnowledge=await getAgentKnowledge();
    const id=await runAgentToCSQ('ingrid','Ingrid Larsen','Content & Brand','weekly_press_release','press_release',`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${VOICE_DNA}\n\nYou are Ingrid Larsen, Press Release Writer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority, CEO/Founder. This week's content: ${weekContent||'AI leadership, DRU frameworks, executive AI adoption'}. Write AP-style press release. Include: FOR IMMEDIATE RELEASE / Headline / Subheadline / Lead paragraph / Body (2-3 paragraphs with DeAnna quotes) / Boilerplate mentioning assessment.druaiconsulting.com / Contact: druaiconsulting@gmail.com`);
    res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p3_nia'){const id=await runNia();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p3_luca'){const id=await runLuca();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p3_hyunji'){const id=await runHyunJi();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p3_andre'){const id=await runAndre();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p4_amara'){const id=await runAmara();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p4_diego'){const id=await runDiego();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p4_yuki'){const id=await runYuki();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p4_marcus'){const id=await runMarcus();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p5_khalid'){const id=await runKhalid();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p5_sofia'){const id=await runSofia();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p5_james'){const id=await runJames();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p5_meilin'){const id=await runMeiLin();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p5_rafael'){const id=await runRafael();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p6_naomi'){const id=await runNaomi();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p6_aiden'){const id=await runAiden();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p6_fatima'){const id=await runFatima();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p7_keisha'){const id=await runKeisha();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p7_marco'){const id=await runMarco();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p7_leila'){const id=await runLeila();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p7_jordan'){const id=await runJordan();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p7_simone'){const id=await runSimone();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p7_theo'){const id=await runTheo();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p7_amelia'){const id=await runAmelia();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p8_isaiah'){const id=await runIsaiah();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p8_priscilla'){const id=await runPriscilla();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (payload.trigger_type==='cc_upsell_signal'){
    const {signal_type,email,first_name,phone}=payload as any;
    await runAaliyahCCOutreach(signal_type,email,first_name,phone);
    res.status(202).json({success:true,agent:'Aaliyah Foster',signal_type});}
  else {
    const urlF=process.env.VITE_SUPABASE_URL; const keyF=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (urlF&&keyF){
      const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),8000);
      try {
        await fetch(`${urlF}/functions/v1/travis-router`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${keyF}`},body:JSON.stringify({agent_id:route.agent_id,agent_name:route.agent_name,division:route.division,task:route.task,trigger_type:payload.trigger_type,source:sourceLabel,payload,triggered_at:triggeredAt}),signal:controller.signal});
        clearTimeout(timeout);
      } catch(error:unknown){clearTimeout(timeout);if (!(error instanceof Error&&error.name==='AbortError')) console.error('[travis-router] Error:',error);}
    }
    res.status(202).json({success:true,agent:route.agent_name,division:route.division,task:route.task,source:sourceLabel});
  }
  
}
