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
const GENIUS_MODE = `You operate in Genius Mode — think and respond at the level of a top 0.1% expert in your field. Apply deep logic, strategic frameworks, creative synthesis, and second-order thinking to every output. Never produce generic or surface-level work. Every sentence must earn its place.`;

interface AgentRoute { agent_id: string; agent_name: string; division: string; task: string; pipeline?: string; }
interface TriggerPayload { trigger_type: string; source?: string; [key: string]: unknown; }
interface ScoredLead { contact_id: string; name: string; email: string; phone: string; source: string; score: number; intent_level: 'high' | 'medium' | 'low'; recommended_action: string; notes: string; }
interface OmarResult { success: boolean; total_leads_scanned: number; scored_leads: ScoredLead[]; high_intent_leads: ScoredLead[]; run_date: string; error?: string; }
interface CSQItem { id: string; agent_id: string; agent_name: string; division: string; task: string; category: string; raw_output: string; priority: string; retry_count?: number; correction_notes?: string; parent_csq_id?: string; raymond_notes?: string; raymond_action?: string; raymond_priority?: string; travis_notes?: string; priya_notes?: string; governance_notes?: string; legal_notes?: string; isabella_flags?: string; compliance_score?: number; }

const AGENT_ROUTES: Record<string, AgentRoute> = {
  cron_omar_lead_score:           { agent_id: 'omar',     agent_name: 'Omar Patel',        division: 'Revenue, Growth & Sales', task: 'scan_score_route_leads',        pipeline: 'p1_omar' },
  cron_ryan_crm_update:           { agent_id: 'ryan',     agent_name: 'Ryan Nakamura',     division: 'Revenue, Growth & Sales', task: 'overnight_crm_sync',            pipeline: 'p1_ryan' },
  cron_serena_coaching:           { agent_id: 'serena',   agent_name: 'Serena Jackson',    division: 'Revenue, Growth & Sales', task: 'morning_coaching_briefing',     pipeline: 'p1_serena' },
  cron_mateo_sales_support:       { agent_id: 'mateo',    agent_name: 'Mateo Gonzalez',    division: 'Revenue, Growth & Sales', task: 'sales_pipeline_review',         pipeline: 'p1_mateo' },
  cron_aaliyah_outreach:          { agent_id: 'aaliyah',  agent_name: 'Aaliyah Foster',    division: 'Revenue, Growth & Sales', task: 'personalized_outreach_messages',pipeline: 'p1_aaliyah' },
  cron_jaylen_email:              { agent_id: 'jaylen',   agent_name: 'Jaylen Brooks',     division: 'Revenue, Growth & Sales', task: 'email_campaign_content',        pipeline: 'p1_jaylen' },
  cron_chloe_copy:                { agent_id: 'chloe',    agent_name: 'Chloe Dubois',      division: 'Revenue, Growth & Sales', task: 'daily_copy_asset',              pipeline: 'p1_chloe' },
  cron_zara_product:              { agent_id: 'zara',     agent_name: 'Zara Ahmed',        division: 'Client Delivery', task: 'acc_weekly_pdf_content',        pipeline: 'p1_zara' },
  cron_elena_knowledge:           { agent_id: 'elena',    agent_name: 'Elena Vasquez',     division: 'Revenue, Growth & Sales', task: 'product_knowledge_update',      pipeline: 'p1_elena' },
  cron_kwame_proposal:            { agent_id: 'kwame',    agent_name: 'Kwame Asante',      division: 'Revenue, Growth & Sales', task: 'proposal_template_update',      pipeline: 'p1_kwame' },
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
  assessment_completed: { agent_id: 'omar',    agent_name: 'Omar Patel',     division: 'Revenue, Growth & Sales', task: 'route_assessment_lead' },
  support_ticket:       { agent_id: 'isaiah',  agent_name: 'Isaiah Carter',  division: 'Customer Support', task: 'handle_support_request' },
  cc_upsell_signal:     { agent_id: 'aaliyah', agent_name: 'Aaliyah Foster', division: 'Revenue, Growth & Sales', task: 'cc_upsell_outreach' },
};

const AALIYAH_CC_ROUTING: Record<string, string> = {
  navigator_upgrade:   'https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/u4dd3zsaVRZUW73wMc5t',
  accelerator_upgrade: 'https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/AlZQHDN7D7PIvApW0qDF',
  diagnostic_interest: 'https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/ec61ce1a-faf0-481f-9404-d6269fbda861',
  course_interest:     'https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/EDVsKWuDioWGDHaI1K7S',
};

const FALLBACK_TM_MARKS = ['DRU CLEAR™','DRU AI Leadership Ecosystem™','DRU AI Transformation Pathway™','5C Cultural DNA™','5D Leadership™','AI Sales Mastery™','From Confusion to Confident with AI™'];
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
- COMMUNICATION: Foundation. How leaders and teams share vision and create clarity around AI.
- CONNECTION: Relational layer. Trust and meaningful relationships that enable collaboration.
- COLLABORATION: Action layer. Breaking silos so AI initiatives flow through the whole organization.
- COACHING: Development layer. Building confidence and competency from the inside out.
- CULTURE TRANSFORMATION: Outcome. From resistance and fear to ownership and strategic adoption.

### 5D Leadership™ — Leadership | $6,500 | 3 sessions x 90 min
An AI-infused methodology where personal mastery and strategic impact develop together.
- I. SELF: Personal mastery. How a leader thinks, decides, and shows up.
- II. PEOPLE: Relational intelligence. Connects with and develops the individuals around them.
- III. TEAM: Collective effectiveness. Builds cohesion, trust, and high performance.
- IV. ORGANIZATION: Systemic strength. Aligns culture, strategy, and operations.
- V. VISIONARY: Strategic impact. Sees beyond today, positions organization to lead.

### AI Sales Mastery™ — Sales | $6,000 | 3 sessions x 90 min
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

## CLIENT JOURNEY & FUNNEL — KNOW THIS COLD

### ENTRY POINT (one and only one)
Every lead, every referral, every conversation ends at: assessment.druaiconsulting.com
This is the DRU CLEAR™ AI Readiness Assessment. It is FREE. It takes 3 minutes.
Never send anyone to a payment page, a calendar, or a course before they complete the assessment.

### THE ASSESSMENT — HOW IT WORKS
15 questions across 5 pillars (3 questions per pillar). Likert scale 1–5:
1 = Strongly Disagree | 2 = Disagree | 3 = Neutral | 4 = Agree | 5 = Strongly Agree
Each pillar scores out of 15. Total raw score out of 75, scaled to /100.

PILLAR 1 — CLARITY (C): AI Vision & Strategic Direction
  Q1: Clear AI vision connected to overall business strategy
  Q2: Leaders and teams understand why pursuing AI and what success looks like
  Q3: Identified specific strategic priorities where AI will have greatest impact

PILLAR 2 — LEADERSHIP (L): Executive AI Fluency & Sponsorship
  Q4: Leaders can articulate how AI connects to business strategy
  Q5: Designated executive sponsor accountable for AI transformation
  Q6: Leadership actively participates in AI learning and decision-making

PILLAR 3 — EXECUTION (E): Operational AI Implementation Capacity
  Q7: Identified specific processes where AI can deliver measurable impact
  Q8: Teams have the skills, tools, and resources to implement AI today
  Q9: Completed at least one AI pilot or proof of concept in the past 12 months

PILLAR 4 — ALIGNMENT (A): Cross-Functional Strategic Coherence
  Q10: AI initiatives aligned with overall business goals and strategic plan
  Q11: Clear and consistent communication between departments about AI priorities
  Q12: AI efforts coordinated across teams rather than operating in silos

PILLAR 5 — RESULTS (R): Measurement, Tracking & ROI
  Q13: Defined KPIs to measure success of AI initiatives
  Q14: Can demonstrate measurable ROI from at least one AI initiative
  Q15: System in place to regularly track and report AI progress to leadership

### SCORE TIERS — WHAT THEY MEAN
EMERGING  (0–40/100):  Early stage. AI efforts are scattered, no structured approach.
                        They score higher than 25% of organizations assessed.
                        Priority: build the foundation before anything else.
DEVELOPING (41–60/100): Conversation started, but critical gaps in Clarity and Alignment
                        slow momentum. They score higher than 52%.
                        Priority: close gaps before competitors do.
ADVANCING  (61–80/100): Making meaningful progress. One or two pillars underperforming.
                        They score higher than 74%.
                        Priority: identify exactly what's holding them back and fix it.
LEADING    (81–100/100): Ahead of most organizations. Scores higher than 93%.
                        Priority: sustainability, scale, competitive dominance.

### GAP IDENTIFICATION
Any pillar scoring below 12/15 is a gap. The top 2 lowest pillars are the client's priority gaps.
Gap messages agents must know:
- CLARITY gap: no clear AI vision or strategic direction — AI efforts become scattered
- LEADERSHIP gap: leadership not AI-fluent or actively sponsoring — AI fails without executive champions
- EXECUTION gap: teams lack skills, tools, processes to implement AI — strategy without execution is theory
- ALIGNMENT gap: departments not unified around AI strategy — silos kill momentum
- RESULTS gap: not tracking or demonstrating AI ROI — what isn't measured can't be scaled

### POST-ASSESSMENT FUNNEL (steps in order)
STEP 1 — Assessment completed → lead lands on Results screen
  - Sees their score /100, tier label, pillar breakdown, top 2 gaps, strongest pillar
  - Receives GHL automation: tagged with tier (EMERGING/DEVELOPING/ADVANCING/LEADING)
  - Supabase account auto-created at free tier

STEP 2 — Diagnose screen → client self-selects their diagnostic (no automatic routing)
  EXECUTIVE DIAGNOSTIC™ — $4,997 (labeled BEST VALUE)
    - 25–35 additional deeper questions
    - All 4 DRU frameworks reviewed
    - Executive AI Alignment Report (boardroom-ready)
    - Comprehensive gap analysis + risk assessment
    - 120-min Zoom executive briefing
    - Executive-level recommendations + sequencing
  STRATEGIC DIAGNOSTIC™ — $3,497
    - 20–25 additional deeper questions
    - 2 DRU frameworks reviewed
    - Strategic AI Insight Report
    - Top 5 gaps and priority ranking
    - 90-min Zoom strategy session
    - Priority findings and strategic direction

STEP 3 — Payment → Thank You → book the Zoom session via calendar link

STEP 4 — Post-diagnostic engagement (what comes after the session with DeAnna)
  Membership:
    Navigator  — $97/mo: community access, Daily Connections, framework content
    Accelerator — $197/mo: full access, deeper content, Accelerator Circle weekly PDF
  Course: From Confusion to Confident with AI™
    Self-Paced $1,497 | Live Cohort $7,997 | Cohort Mastermind $12,997
  Framework packages:
    DRU CLEAR + 1 framework: $13,500
    DRU CLEAR + 2 frameworks: $19,500
    Full Ecosystem (all 4): $26,000

### AGENT RULES FOR THE FUNNEL
1. NEVER reference a diagnostic, course, or membership before the client has taken the free assessment.
2. All outreach, content, emails, and CTAs route to assessment.druaiconsulting.com FIRST.
3. When referencing a lead's score tier, tailor the message: EMERGING needs foundation language,
   DEVELOPING needs urgency, ADVANCING needs gap-targeting, LEADING needs scale and dominance.
4. The free scorecard shows WHAT. The diagnostic shows WHY and HOW. Never conflate the two.
5. Post-diagnostic recommendations depend on client needs — do not assume membership or course
   without context. Executive-level clients typically move toward framework packages, not just memberships.
`;

async function callAnthropic(prompt: string, maxTokens = 2000): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:maxTokens,messages:[{role:'user',content:prompt}]})});
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = await res.json(); return data.content?.[0]?.text ?? '';
}
// Web-search-enabled Anthropic call — used only by Adaeze's weekly grant scout.
// max_uses hard-caps search calls per run (cost control after the July on-demand
// cascade incident); Anthropic bills web search at $10/1,000 searches, so a cap
// of 6 keeps a weekly run to a few cents regardless of what Claude tries to do.
async function callAnthropicWithWebSearch(prompt: string, maxTokens = 3000, maxSearches = 6): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:maxTokens,messages:[{role:'user',content:prompt}],tools:[{type:'web_search_20250305',name:'web_search',max_uses:maxSearches}]})});
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = await res.json();
  const blocks = (data.content ?? []) as Array<{type:string;text?:string}>;
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

async function getKnownGrantKeys(): Promise<Set<string>> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key) return new Set();
  const res = await fetch(`${url}/rest/v1/grant_opportunities?select=opportunity_name,funder`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  if (!res.ok) return new Set();
  const rows = await res.json() as {opportunity_name:string;funder:string}[];
  return new Set(rows.map(r => `${(r.opportunity_name||'').trim().toLowerCase()}|${(r.funder||'').trim().toLowerCase()}`));
}

async function runAdaezeScout(): Promise<{count:number;csqId:string|null}> {
  try {
    const prompt = `${GENIUS_MODE}\n\nYou are Adaeze Nwosu, Grant Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority, Founder/CEO of Dimensional Solns, LLC (a FOR-PROFIT AI leadership & culture consulting business, not a nonprofit). Brand fit: AI adoption/leadership training, women-owned business, 5C Cultural DNA™, 5D Leadership™, DRU CLEAR™ AI Readiness frameworks.\n\nSearch the web broadly (no certification status assumed — search as if broadly eligible) for CURRENTLY OPEN small-business grants, grant contests, or funding programs a for-profit consulting/leadership-training business could realistically apply to. Do NOT include federal grants.gov-style research/nonprofit grants — those don't fit a for-profit LLC. Focus on: corporate small-business grant programs, women-owned/minority-owned business grant contests, and small-business funding competitions with open or upcoming application windows.\n\nRespond with ONLY a single JSON object, no preamble, no markdown fences:\n{\n  \"opportunities\": [\n    {\n      \"opportunity_name\": string,\n      \"funder\": string,\n      \"amount_range\": string,\n      \"eligibility\": string,\n      \"deadline\": string (YYYY-MM-DD if known, else best available description),\n      \"source_url\": string,\n      \"fit_score\": number (1-10, how well this fits DeAnna's brand/business),\n      \"fit_reasoning\": string (1-2 sentences)\n    }\n  ]\n}\nOnly include opportunities you found real, current information on. If you find none, return {\"opportunities\": []}.`;
    const [raw, knownKeys] = await Promise.all([callAnthropicWithWebSearch(prompt), getKnownGrantKeys()]);
    const parsed = extractJSONObject(raw);
    const allFound = Array.isArray(parsed?.opportunities) ? parsed!.opportunities as Record<string,unknown>[] : [];
    // Dedup — only keep opportunities not already logged (case-insensitive name+funder match)
    const newOnes = allFound.filter(o => {
      const nameKey = `${String(o.opportunity_name||'').trim().toLowerCase()}|${String(o.funder||'').trim().toLowerCase()}`;
      return !knownKeys.has(nameKey);
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
    // Surface the top 5 with everything needed to actually apply — not just a list.
    // DeAnna needs: where to apply, what it pays, why it fits, and the deadline.
    const top = activeOnes.slice(0,5).map((o:any) => {
      // Clean up opportunity_name if it already embeds the funder name in parens — prevents double display
      const cleanName = String(o.opportunity_name ?? '').replace(
        new RegExp(`\\s*\\(${String(o.funder ?? '').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\)`, 'gi'), ''
      ).trim();
      const lines = [
        `**${cleanName}** — ${o.funder}`,
        `Fit: ${o.fit_score}/10 | Amount: ${o.amount_range ?? 'See link'} | Deadline: ${o.deadline}`,
        `Why it fits: ${o.fit_reasoning ?? 'Strong brand alignment'}`,
        `Apply here: ${o.source_url ?? 'URL not found — search funder name'}`,
      ];
      return lines.join('\n');
    }).join('\n\n---\n\n');
    // Write directly to approvals — bypasses CSQ → command layer → Raymond chain
    // which was adding a full day of delay for no benefit (Raymond passes grants through untouched).
    const approvalId = await writeApprovalDirect({
      source: 'adaeze_grants',
      trigger_type: 'grants',
      agent_name: 'Adaeze Nwosu',
      agent_role: 'Revenue, Growth & Sales',
      division: 'Revenue, Growth & Sales',
      task_brief: `Daily Grant Scout — Adaeze Nwosu | ${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}`,
      output: `Found ${written} new grant opportunity/opportunities today. Top picks ready to apply:\n\n${top}\n\nFull list with all details stored in the grant_opportunities table.`,
      status: 'pending',
      notify_deanna: false,
      priority: 'normal',
      category: 'grants',
      platform: null,
    });
    return { count: written, csqId: approvalId };
  } catch(error){ console.error('[adaeze] Scout error:',error); return { count:0, csqId:null }; }
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
async function getAgentKnowledge(): Promise<string> {
  let tmMarks: string[] = [];
  try {
    const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url&&key){
      const res = await fetch(`${url}/rest/v1/brand_marks?active=eq.true&order=created_at.asc`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
      if (res.ok){const data=await res.json();tmMarks=(data as {mark:string}[]).map(m=>m.mark).filter(Boolean);}
    }
  } catch(err){console.error('[agentKnowledge] fetch error:',err);}
  if (tmMarks.length===0) tmMarks=FALLBACK_TM_MARKS;
  const tmList=tmMarks.map(m=>`  - ${m}`).join('\n');
  return `=== DRU AI CONSULTING — AGENT KNOWLEDGE BASE ===

PROTECTED IP MARKS — TM REQUIRED ON EVERY USE, NO EXCEPTIONS:
${tmList}

RULES: Every mark above MUST include TM every time. NO other terms carry TM.
Do NOT add TM to anything not on this list. 'DRU AI Consulting' = business name, NO TM.
REQUIRED CTA: assessment.druaiconsulting.com (ONLY entry point into the ecosystem)
${FRAMEWORK_KNOWLEDGE}
=== END AGENT KNOWLEDGE BASE ===`.trim();
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

async function runAgentToCSQ(agentId:string,agentName:string,division:string,task:string,category:string,prompt:string,priority='normal',retryCount=0,parentCsqId:string|null=null,maxTokens=1500): Promise<string|null> {
  try {
    const agentKnowledge = await getAgentKnowledge();
    const output = await callAnthropic(`${GENIUS_MODE}\n\n${agentKnowledge}\n\n${prompt}`,maxTokens);
    return await writeToCSQ({agent_id:agentId,agent_name:agentName,division,task,category,raw_output:output,priority,status:'pending',retry_count:retryCount,...(parentCsqId?{parent_csq_id:parentCsqId}:{})});
  } catch(error){console.error(`[${agentId}] Error:`,error);return null;}
}

// P1
async function runOmar(): Promise<OmarResult> {
  const ghlApiKey = process.env.GHL_API_KEY;
  if (!ghlApiKey) return {success:false,total_leads_scanned:0,scored_leads:[],high_intent_leads:[],run_date:new Date().toISOString(),error:'Missing GHL_API_KEY'};
  try {
    const yesterday = new Date(); yesterday.setHours(yesterday.getHours()-24);
    const res = await fetch(`${GHL_API_BASE}/contacts/?locationId=${GHL_LOCATION_ID}&startAfterDate=${encodeURIComponent(yesterday.toISOString())}&limit=100`,{headers:{Authorization:`Bearer ${ghlApiKey}`,Version:'2021-07-28'}});
    if (!res.ok) throw new Error(`GHL error ${res.status}`);
    const rawLeads = (await res.json()).contacts??[];
    if (rawLeads.length===0) return {success:true,total_leads_scanned:0,scored_leads:[],high_intent_leads:[],run_date:new Date().toISOString()};
    const leadSummary = rawLeads.map((l:any)=>({id:l.id,name:`${l.firstName??''} ${l.lastName??''}`.trim(),email:l.email??'',phone:l.phone??'',source:l.source??'unknown',tags:l.tags??[]}));
    const text = await callAnthropic(`${GENIUS_MODE}\n\nYou are Omar Patel, Lead Scoring Agent for DRU AI Consulting. Score each lead 1-10. High-intent recommended_action must direct to assessment.druaiconsulting.com.\nReturn ONLY JSON array: [{"contact_id":"...","name":"...","email":"...","phone":"...","source":"...","score":8,"intent_level":"high","recommended_action":"Invite to DRU CLEAR™ AI Readiness Assessment — assessment.druaiconsulting.com","notes":"..."}]\nLeads: ${JSON.stringify(leadSummary)}`,2000);
    const scored:ScoredLead[] = JSON.parse(text.replace(/\`\`\`json|\`\`\`/g,'').trim());
    return {success:true,total_leads_scanned:rawLeads.length,scored_leads:scored,high_intent_leads:scored.filter(l=>l.intent_level==='high'),run_date:new Date().toISOString()};
  } catch(error){return {success:false,total_leads_scanned:0,scored_leads:[],high_intent_leads:[],run_date:new Date().toISOString(),error:String(error)};}
}
async function runRyan(omarResult:OmarResult): Promise<{csq_id:string|null;crm_updates:number}> {
  const ghlApiKey = process.env.GHL_API_KEY;
  if (!ghlApiKey) return {csq_id:null,crm_updates:0};
  if (omarResult.total_leads_scanned===0){
    const csq_id = await writeToCSQ({agent_id:'ryan',agent_name:'Ryan Nakamura',division:'Revenue, Growth & Sales',task:'overnight_crm_sync',category:'lead_intelligence',raw_output:'**Daily Lead Intelligence — No New Leads**\n\nOmar scanned GHL and found no new contacts in the last 24 hours. No CRM updates required.',priority:'normal',status:'pending',retry_count:0});
    return {csq_id,crm_updates:0};
  }
  let crmUpdates=0;
  for (const lead of omarResult.scored_leads){if (lead.contact_id){await fetch(`${GHL_API_BASE}/contacts/${lead.contact_id}`,{method:'PUT',headers:{Authorization:`Bearer ${ghlApiKey}`,Version:'2021-07-28','Content-Type':'application/json'},body:JSON.stringify({tags:[`ai-scored`,`intent-${lead.intent_level}`,`score-${lead.score}`]})});crmUpdates++;}}
  const highIntentSummary = omarResult.high_intent_leads.map(l=>`* ${l.name} (Score: ${l.score}/10) — ${l.recommended_action}`).join('\n');
  const briefing = await callAnthropic(`${GENIUS_MODE}\n\nYou are Ryan Nakamura, CRM Management Agent for DRU AI Consulting. Write a precise lead intelligence briefing.\nDATA: Total:${omarResult.total_leads_scanned} | High-intent:${omarResult.high_intent_leads.length} | Medium:${omarResult.scored_leads.filter(l=>l.intent_level==='medium').length} | Low:${omarResult.scored_leads.filter(l=>l.intent_level==='low').length}\nHIGH-INTENT: ${highIntentSummary||'None today'}\nInclude: executive summary, high-intent leads with actions (all directed to assessment.druaiconsulting.com), CRM updates completed, strategic next steps.`);
  const csq_id = await writeToCSQ({agent_id:'ryan',agent_name:'Ryan Nakamura',division:'Revenue, Growth & Sales',task:'overnight_crm_sync',category:'lead_intelligence',raw_output:briefing,priority:omarResult.high_intent_leads.length>0?'high':'normal',status:'pending',retry_count:0});
  const sbUrl=process.env.VITE_SUPABASE_URL; const sbKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (sbUrl&&sbKey){
    await Promise.all([
      fetch(`${sbUrl}/rest/v1/stats?id=eq.leads_scored_today`,{method:'PATCH',headers:{'Content-Type':'application/json',apikey:sbKey,Authorization:`Bearer ${sbKey}`,Prefer:'return=minimal'},body:JSON.stringify({value:omarResult.total_leads_scanned})}),
      fetch(`${sbUrl}/rest/v1/stats?id=eq.high_intent_today`,{method:'PATCH',headers:{'Content-Type':'application/json',apikey:sbKey,Authorization:`Bearer ${sbKey}`,Prefer:'return=minimal'},body:JSON.stringify({value:omarResult.high_intent_leads.length})}),
    ]);
  }
  return {csq_id,crm_updates:crmUpdates};
}

// P2
// FIXED: Camila now writes to CSQ like all other agents — full chain (Isabella → Governance → Command Layer → Twin)
// PHASE 3: Reads ecosystem intelligence from Revenue, Client Delivery, and Analytics before generating
// content_queue write removed — everything flows through CSQ
async function runCamila(): Promise<string|null> {
  const ecosystemIntel = await getCrossRead(['ryan','serena','keisha','leila','hyunji']);
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const brandMarks=await fetchBrandMarks();
  return await runAgentToCSQ(
    'camila','Camila Flores','Content & Brand','generate_weekly_linkedin_queue','content_strategy',
    `You are Camila Flores, Social Media Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Her positioning is "Leadership with AI." Today: ${today}.
TRADEMARK RULES: Only use frameworks with ™. APPROVED: ${brandMarks}
SERVICE CLASS RULES: Classes 35, 41, 42 only.

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
  const url=process.env.VITE_SUPABASE_URL; const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const today=new Date().toISOString().split('T')[0];
  const now=new Date(); const monday=new Date(now); monday.setDate(now.getDate()-now.getDay()+1);
  const weekOf=monday.toISOString().split('T')[0];
  let topicBrief=''; let queueId:string|null=null;
  if (url&&key){
    const res=await fetch(`${url}/rest/v1/content_queue?week_of=eq.${weekOf}&status=eq.queued&scheduled_for=eq.${today}&limit=1`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
    if (res.ok){const queue=await res.json();if(queue.length>0){queueId=queue[0].id;topicBrief=`Framework: ${queue[0].framework_covered} | Type: ${queue[0].post_type} | Hook direction: ${queue[0].hook} | Content direction: ${queue[0].content}`;}}
  }
  const brandMarks=await fetchBrandMarks();
  const topicContext=topicBrief||`Generate a thought leadership topic on Leadership with AI using one of these frameworks: ${brandMarks}`;
  const structuredOutput=await callAnthropic(
    `${GENIUS_MODE}\n\nYou are Darius King, Viral Scripter for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Her positioning is "Leadership with AI."\nTRADEMARK RULES: Only use frameworks with ™. APPROVED: ${brandMarks}\nSERVICE CLASS RULES: Classes 35, 41, 42 only.\n\nFRAMEWORK REFERENCE — memorize these exact definitions before writing. Never paraphrase or invent framework content:\n${FRAMEWORK_KNOWLEDGE}\n\nTODAY'S TOPIC BRIEF: ${topicContext}\n\nWrite 3 platform-native versions of this topic. Same core message, 3 different audience voices:\n\nLINKEDIN (VP+ executives, authority, framework-forward): 150-300 words, strong hook, one framework reference, CTA to assessment.druaiconsulting.com, 3-5 hashtags.\nFACEBOOK (warm community tone, outcome-focused, relatable): 100-200 words, CTA to assessment.druaiconsulting.com.\nINSTAGRAM (visual-first, punchy, short): 50-80 words, 5-8 hashtags, ends with assessment.druaiconsulting.com.\n\nReturn ONLY valid JSON — no markdown fences, no preamble, no explanation:\n{"linkedin_content":"...","facebook_content":"...","instagram_caption":"...","hook":"single strongest opening line","content_type":"thought_leadership"}`,
    2500
  );
  const csqId=await writeToCSQ({agent_id:'darius',agent_name:'Darius King',division:'Content & Brand',task:'generate_daily_linkedin_post',category:'linkedin_post',raw_output:structuredOutput,priority:'normal',status:'pending',retry_count:0});
  if (queueId&&url&&key){await fetch(`${url}/rest/v1/content_queue?id=eq.${queueId}`,{method:'PATCH',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`},body:JSON.stringify({status:'submitted',submitted_at:new Date().toISOString()})});}
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

  return await runAgentToCSQ(
    'ravi','Ravi Gupta','Content & Brand','generate_design_brief','design_brief',
    `You are Ravi Gupta, Graphic Designer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Brand: Navy #0A2342, Gold #D4AF37, Magenta #C2185B. Fonts: Playfair Display (headlines), Inter (body). Today: ${today}. CTA destination: assessment.druaiconsulting.com.\n\n${postContext}\n\nGenerate a complete LinkedIn visual design brief (1200×627px) where the visual DIRECTLY SUPPORTS and VISUALLY REINFORCES today\'s post. The image and copy must tell the same story — not separate concepts.\n\nInclude:\n- STRATEGIC INTENT (aligned to today\'s post theme and audience)\n- VISUAL CONCEPT (concept name + metaphor that matches the post message)\n- LAYOUT ARCHITECTURE (canvas 1200×627px, bifurcated left/right, bottom CTA strip)\n- COLOR PALETTE with application logic (Navy #0A2342, Gold #D4AF37, Magenta #C2185B)\n- IMAGE DIRECTION (left hemisphere: problem/chaos state matching post theme; right hemisphere: clarity/solution state)\n- TYPOGRAPHY HIERARCHY (headline pulled from or inspired by today\'s hook; subheadline; body copy; CTA button)\n- AI IMAGE GENERATION PROMPTS (left hemisphere, right hemisphere, combined scene — ready to paste into Creator Studio)\n- DESIGN SPECIFICATIONS (PNG 1200×627px @ 300DPI, RGB, optimized <500KB)`,
    'normal',0,null,2500
  );
}

// P3
// NIA ROBINSON — Content Strategist
// Schedule: Wed/Sat/Sun = LinkedIn posts | Thu = LEAD, CLARITY, WIN! Newsletter x3 | Fri = LinkedIn native article
// Mon/Tue = Darius days, Nia returns null
// Reads Camila's weekly brief for strategic alignment before writing anything
async function runNia(): Promise<string|null> {
  const brandMarks   = await fetchBrandMarks();
  const clientIntel  = await getCrossRead(['keisha','leila','ryan']);
  const camilaBrief  = await getCrossRead(['camila']);
  const today        = new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const dayOfWeek    = new Date().toLocaleDateString('en-US',{weekday:'long',timeZone:'America/Chicago'});
  const trademarks   = `TRADEMARK RULES: Always ™ on every mention. APPROVED: ${brandMarks}\nSERVICE CLASS RULES: Classes 35, 41, 42 only.`;
  const strategyContext = camilaBrief
    ? `\nWEEKLY CONTENT STRATEGY (from Camila Flores, Social Media Strategist) — align your content with this week's direction:\n${camilaBrief}`
    : '\nNo weekly strategy brief available — draw from framework rotation and ecosystem signals.';
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
    return await runAgentToCSQ('nia','Nia Robinson','Marketing','linkedin_post','linkedin_post',
      `You are Nia Robinson, Content Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\n${trademarks}\n${strategyContext}\n${postInstructions[postTypeMap[dayOfWeek]]}\n${intelContext}`,
      'normal',0,null,800);
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
    return await runAgentToCSQ('nia','Nia Robinson','Marketing','linkedin_article','linkedin_article',
      `## ARTICLE FORMAT — LinkedIn Native Article\nYou are Nia Robinson, Content Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\n${trademarks}\n${strategyContext}\n${articleInstructions[topic]}\n${intelContext}`,
      'normal',0,null,1500);
  }

  // ── THURSDAY — LEAD, CLARITY, WIN! Newsletter × 3 tiers ─────────────────────
  if (dayOfWeek === 'Thursday') {
    const topic = camilaBrief
      ? `This week's theme from your content strategy brief — align the Newsletter to the week's direction`
      : `AI leadership insight grounded in one DRU framework (™) — ${today}`;

    // Non-member edition
    await runAgentToCSQ('nia','Nia Robinson','Marketing','newsletter_nonmember','newsletter_nonmember',
      `## LEAD, CLARITY, WIN! Newsletter — Non-Member Edition\nYou are Nia Robinson, Content Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nAUDIENCE: Executives who have NOT yet joined DRU AI Consulting.\n${trademarks}\n${strategyContext}\nDEPTH: Surface — reveal the problem clearly, hint at the solution, stop before delivering it. Hook them on the promise.\nFORMAT: Subject line | Opening hook (2-3 sentences that stop them) | The problem (1 paragraph — they should feel seen) | A glimpse of what's possible (1 paragraph — tease, do NOT teach) | CTA\nCTA: "Your AI transformation starts with one assessment. → assessment.druaiconsulting.com"\nTOPIC: ${topic}\nDo NOT give away framework IP. No framework detail — name only.`,
      'normal',0,null,1000);

    // Navigator edition
    await runAgentToCSQ('nia','Nia Robinson','Marketing','newsletter_navigator','newsletter_navigator',
      `## LEAD, CLARITY, WIN! Newsletter — Navigator Edition\nYou are Nia Robinson, Content Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nAUDIENCE: Navigator members ($97/mo) — executives who completed the assessment and joined.\n${trademarks}\n${strategyContext}\nDEPTH: Medium — apply one framework concept to a real leadership challenge. Give real value but leave the full system for the 90-Day Journey.\nFORMAT: Subject line | Opening (acknowledge where they are as executives) | One framework concept + one action step they can take this week | What becomes possible when they go deeper | CTA\nCTA: "Ready to go all in? Start your 90-Day Transformation Pathway. → frameworks.druaiconsulting.com"\nTOPIC: ${topic}`,
      'normal',0,null,1000);

    // Accelerator edition
    return await runAgentToCSQ('nia','Nia Robinson','Marketing','newsletter_accelerator','newsletter_accelerator',
      `## LEAD, CLARITY, WIN! Newsletter — Accelerator Edition\nYou are Nia Robinson, Content Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nAUDIENCE: Accelerator members ($197/mo) — executive leaders in active transformation.\n${trademarks}\n${strategyContext}\nDEPTH: Deeper — one framework at strategic implementation level. Executive stakes, real complexity.\nFORMAT: Subject line | Opening (meet them at their executive level) | Strategic insight — one framework, implementation angle, the hard question they're avoiding | The gap they're likely sitting in right now | CTA\nCTA: "Activate your 90-Day Pathway. The full transformation is waiting. → frameworks.druaiconsulting.com"\nTOPIC: ${topic}`,
      'normal',0,null,1000);
  }

  return null; // Monday, Tuesday — Darius days
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
  return await runAgentToCSQ('luca','Luca Romano','Marketing','digital_marketing_briefing','digital_marketing',`You are Luca Romano, Digital Marketing Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}. All objectives point to assessment.druaiconsulting.com.\n\nREAL PLATFORM DATA (use only these numbers):\n${marketingData}\n\nHARD RULES — read before writing a single word:\n1. Every number you write must appear verbatim in the data above. If it is not in the data, do not write it.\n2. Do not estimate, project, extrapolate, or use phrases like \"approximately,\" \"roughly,\" or \"based on typical benchmarks.\" Real numbers only.\n3. If assessments completed = 0 and all stats = 0, open with: \"Platform is pre-traffic. No funnel data to report yet.\" Then give one setup action we can take TODAY to start capturing real data.\n4. If there IS real data, open with a DATA SNAPSHOT block that quotes the exact numbers from above — no rounding, no reframing.\n5. Writing any number not found in the data above is a fabrication. DeAnna will compare your output to the raw data table.\n\nAfter your opening (data snapshot or pre-traffic statement), write:\n**Campaign Priority** — One platform to activate or optimize this week, grounded only in what the data shows about traffic source or funnel stage. If no data, recommend the single first campaign to run and why.\n**This Week\'s Action** — One specific move with clear rationale tied only to real numbers or acknowledged gaps.\n\nDo not use \"Briefing\" or \"Brief\" as a heading. Write in first person as Luca.`,'normal',0,null,2000);
}
async function runHyunJi(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const dayOfWeek=new Date().toLocaleDateString('en-US',{weekday:'long',timeZone:'America/Chicago'});
  const reportType=dayOfWeek==='Monday'?'weekly_recap':'daily_operational';
  const marketingData = await fetchMarketingData();
  const reportInstructions=reportType==='weekly_recap'
    ?`Weekly analytics recap using ONLY the real data provided above. What does the data actually show? What is the week-ahead priority based on real numbers? Set 3 KPI targets that make sense for this launch stage.`
    :`Daily analytics update using ONLY the real data provided above. What does the funnel actually show right now? Which single metric, if moved, would have the most impact on revenue? One insight about the assessment-to-diagnostic path grounded in real numbers.`;
  return await runAgentToCSQ('hyunji','Hyun-Ji Kim','Marketing','analytics_roi_briefing','analytics_report',`You are Hyun-Ji Kim, Analytics & ROI Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\n\nREAL PLATFORM DATA (use only these numbers):\n${marketingData}\n\nHARD RULES — read before writing a single word:\n1. Every number you write must come directly from the data above, quoted exactly. If it is not in the data, do not write it.\n2. No estimates, no projections, no revenue calculations, no conversion rate math. Real numbers only.\n3. If assessments completed = 0 and all stats = 0, open with: \"Zero activity to report. Platform is pre-traffic.\" Then name the single metric we should focus on activating first and why.\n4. If there IS real data, your first section must be a DATA SNAPSHOT that mirrors the exact figures above before any analysis.\n5. Writing any number not found in the data above is a fabrication and a trust violation. DeAnna checks your output against the raw table.\n\nREPORT TYPE: ${reportType}\n${reportInstructions}\n\nDo not use \"Briefing\" or \"Brief\" as a heading. Write in first person as Hyun-Ji.`,'normal',0,null,2000);
}
async function runAndre(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const dayOfWeek=new Date().toLocaleDateString('en-US',{weekday:'long',timeZone:'America/Chicago'});
  const focusType=dayOfWeek==='Tuesday'?'technical_seo':dayOfWeek==='Friday'?'weekly_search_recap':'daily_operational';
  const marketingData = await fetchMarketingData();
  const focusInstructions:Record<string,string>={
    daily_operational:`**Brand Keyword Protection** — Protect: "DRU AI Consulting", "DeAnna Upshaw", "DRU CLEAR™". Recommend organic defense strategy grounded in platform launch stage. Do not fabricate competitor threats — note if none are confirmed. **Organic Search** — Top 3 keyword clusters to target given the real UTM data above. One content gap for Nia grounded in actual traffic sources or assessment top gaps. **Today's SEO Action** — One immediately actionable move tied to real data.`,
    technical_seo:`**Site Health** — Core Web Vitals targets for assessment.druaiconsulting.com and app.druaiconsulting.com. One crawlability recommendation. **Schema** — Recommended schema markup for services and courses. **This Week's Technical Priority** — Single highest-impact fix.`,
    weekly_search_recap:`**Organic Search** — Benchmark targets appropriate for this launch stage. One keyword to prioritize based on real UTM sources above. **Paid Search** — Brand campaign recommendations. **Next Week's Priorities** — 3 actions ranked by impact for an early-stage platform.`
  };
  return await runAgentToCSQ('andre','Andre Mitchell','Marketing','seo_sem_brand_briefing','seo_sem',`You are Andre Mitchell, SEO/SEM Brand Manager for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}. Primary conversion destination: assessment.druaiconsulting.com.\n\nIMPORTANT: The platform launched July 7, 2026. You have access to REAL platform data below. Use UTM sources and assessment data to inform your recommendations — do not invent competitor activity, traffic volumes, or search rankings.\n\n${marketingData}\n\nFOCUS TYPE: ${focusType}\n${focusInstructions[focusType]}\n\nDo not use "Briefing" or "Brief" as a heading. Write in first person as Andre.`,'normal',0,null,2000);
}

// Pulls real pipeline and revenue data from Supabase for Amara, Yuki, and Marcus.
// All three agents receive this snapshot so they report actual business state,
// never invented revenue figures, fabricated client counts, or assumed contract needs.
async function fetchLegalFinanceData(): Promise<string> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return 'Pipeline data unavailable.';
  try {
    const [clientRes, statsRes, subRes] = await Promise.all([
      fetch(`${url}/rest/v1/client_journey_stages?select=client_name,stage,amount_paid,stage_updated_at,notes&order=stage_updated_at.desc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
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
      ? clients.map((c: any) => `  - ${c.client_name} | Stage: ${c.stage} | Paid: $${c.amount_paid ?? 0} | Updated: ${c.stage_updated_at?.slice(0,10) ?? 'unknown'}${c.notes ? ` | Note: ${c.notes}` : ''}`).join('\n')
      : '  (none)';
    const lines = [
      'REAL PIPELINE DATA ' + em + ' use only these numbers, never invent or estimate:',
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
  return await runAgentToCSQ('amara','Amara Okafor','Legal & Finance','weekly_legal_briefing','legal_briefing',`You are Amara Okafor, Legal Advisor for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nSERVICE CLASSES: All content within Classes 35, 41, 42 only.\n\nREAL PIPELINE DATA (use only this — do not invent client counts, contract needs, or revenue figures):\n${pipelineData}\n\nHARD RULES:\n1. Every client-facing statement must be grounded in the pipeline data above. If clients in journey = 0 and diagnostics sold = 0, open with: \"No clients in pipeline. No contract actions required this week.\"\n2. Do not repeat the same MSA/trademark checklist if nothing in the pipeline has changed. Acknowledge what stage we are at based on real data.\n3. If there ARE clients in the pipeline, identify each one by name and stage, and state exactly what legal action their stage requires.\n4. One standing legal readiness item is acceptable — but only if it is stage-appropriate and not already covered last week.\n5. Flag anything genuinely time-sensitive. If nothing is time-sensitive, say so.\n\nFormat: 150 words or fewer. Write in first person as Amara.`,'normal',0,null,600);
}
}
async function runDiego(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const pipelineData = await fetchLegalFinanceData();
  return await runAgentToCSQ('diego','Diego Reyes','Legal & Finance','weekly_expense_report','expense_report',`You are Diego Reyes, Expense Manager for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\n\nKNOWN FIXED EXPENSES (these are real — report them as-is):\nVercel Pro: $20/mo | Anthropic API: usage-based (variable) | GHL: ~$40—$60/mo | HeyGen Creator: $31/mo | Bunny Stream: $1—$5/mo\n\nREAL PIPELINE DATA (use only these numbers for revenue-side reporting):\n${pipelineData}\n\nHARD RULES:\n1. Known fixed expenses above are real — report them accurately. Do not invent additional costs.\n2. For the revenue side, use ONLY the total revenue collected figure from the pipeline data above.\n3. If total revenue collected = $0.00, state that clearly: \"Revenue collected: $0. Operating at a loss of [known expenses] this month.\" Do not calculate break-even as if revenue exists.\n4. If revenue exists, show actual P&L: revenue collected minus known monthly expenses = net position. Name the clients and amounts.\n5. One cost optimization item is acceptable — but only if it is actionable this week, not a repeat from last week.\n\nFormat: 200 words or fewer. Write in first person as Diego.`,'normal',0,null,600);
}
}
async function runYuki(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const pipelineData = await fetchLegalFinanceData();
  return await runAgentToCSQ('yuki','Yuki Tanaka','Legal & Finance','weekly_financial_report','financial_report',`You are Yuki Tanaka, Financial Reporting Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\n\nREAL PIPELINE DATA (use only these numbers):\n${pipelineData}\n\nHARD RULES — read before writing a single word:\n1. Every number you write must come directly from the data above. If it is not in the data, do not write it.\n2. No revenue projections, no estimated earnings, no conversion math. Real reported figures only.\n3. If total revenue collected = $0.00 and diagnostics sold = 0, open with: \"Zero revenue to report this week. No financial figures to present.\" Then name the single financial tracking item to set up before the first sale lands.\n4. If there IS real revenue, report it exactly — by client name, amount paid, and stage.\n5. Writing any number not in the data above is a fabrication. DeAnna checks your output against the raw table.\n\nFormat: 150 words or fewer. Write in first person as Yuki.`,'normal',0,null,600);
}
}
async function runMarcus(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const pipelineData = await fetchLegalFinanceData();
  return await runAgentToCSQ('marcus','Marcus Chen','Legal & Finance','weekly_tax_strategy_briefing','tax_strategy',`You are Marcus Chen, Tax Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nEntity: LLC (DBA Dimensional Solns, LLC) — Texas. DISCLAIMER: All guidance is strategic tax counsel for planning purposes only. Final decisions require a licensed CPA or tax attorney.\n\nREAL PIPELINE DATA (use only these numbers):\n${pipelineData}\n\nHARD RULES:\n1. Calibrate every recommendation to the actual revenue stage shown in the data. Do not advise on quarterly estimated tax payments if total revenue = $0.\n2. If total revenue collected = $0.00 and diagnostics sold = 0, open with: \"No revenue collected yet. Tax planning is in setup stage.\" Then give one specific structural action to complete before the first dollar arrives.\n3. If there IS real revenue, report it by client and advise on tax obligations tied to those exact amounts.\n4. Do not repeat the same S-Corp election or home office advice every week unless something in the data has changed that makes it newly relevant.\n5. One time-sensitive flag only if something is genuinely urgent based on real data or the calendar.\n\nFormat: 150 words or fewer. Write in first person as Marcus.`,'normal',0,null,600);
}
}

// P5
async function runKhalid(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const previousFlags = await getCrossRead(['khalid'], 1);
  const prevSection = previousFlags ? `WHAT YOU FLAGGED YESTERDAY (do not repeat any of these):\n${previousFlags}` : 'No previous flags on record.';
  return await runAgentToCSQ('khalid','Khalid Hassan','AI Governance','daily_disclaimer_review','disclaimer_review',`You are Khalid Hassan, Disclaimer Writer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nSERVICE CLASSES: All content within Classes 35, 41, 42 only.\n\n${prevSection}\n\nHARD RULE: If you are about to raise something already listed above, skip it entirely. Only surface what is genuinely new or has materially changed since yesterday.\n\n**AI-Generated Content Disclaimer** — Short and full form. Only if a NEW gap identified.\n**Course Disclaimer** — For From Confusion to Confident with AI™. Only if NEW gap.\n**Consulting Disclaimer** — For Strategic Diagnostic™ and Executive Diagnostic™. Only if NEW gap.\n**Today's Action** — One NEW highest-risk disclaimer gap. If nothing new: \"No new disclaimer gaps today.\"\n\nFormat: 200 words or fewer. Write in first person as Khalid Hassan.`,'normal',0,null,1500);
}
}
async function runSofia(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const previousFlags = await getCrossRead(['sofia'], 1);
  const prevSection = previousFlags ? `WHAT YOU FLAGGED YESTERDAY (do not repeat any of these):\n${previousFlags}` : 'No previous flags on record.';
  return await runAgentToCSQ('sofia','Sofia Petrov','AI Governance','daily_privacy_compliance','privacy_policy',`You are Sofia Petrov, Privacy Policy Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nSERVICE CLASSES: All content within Classes 35, 41, 42 only.\n\n${prevSection}\n\nHARD RULE: If you are about to raise something already listed above, skip it entirely. Only surface what is genuinely new or has materially changed since yesterday.\n\n**Data Collection Status** — One NEW gap in what is collected via assessment.druaiconsulting.com.\n**GDPR/CCPA Readiness** — One NEW compliance gap and actionable step. If none new, say so.\n**Privacy Policy Review** — One NEW update needed. If none new, say so.\n**Today's Priority** — Single most important NEW privacy action. If nothing new: \"No new privacy gaps today.\"\n\nFormat: 200 words or fewer. Write in first person as Sofia Petrov.`,'normal',0,null,1500);
}
}
async function runJames(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const previousFlags = await getCrossRead(['james'], 1);
  const prevSection = previousFlags ? `WHAT YOU FLAGGED YESTERDAY (do not repeat any of these):\n${previousFlags}` : 'No previous flags on record.';
  return await runAgentToCSQ('james','James Osei','AI Governance','daily_contract_readiness','contract_review',`You are James Osei, Contract Writer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nSERVICE CLASSES: All content within Classes 35, 41, 42 only.\n\n${prevSection}\n\nHARD RULE: If you are about to raise something already listed above, skip it entirely. Only surface what is genuinely new or has materially changed since yesterday.\n\n**Engagement Agreement Status** — Any NEW contract gap for: Strategic Diagnostic™ ($3,497), Executive Diagnostic™ ($4,997), 90-Day AI Transformation Journey™ ($20K+), From Confusion to Confident with AI™ Course.\n**Today's Contract Action** — One specific NEW gap to close. If nothing new: \"No new contract gaps today.\"\n\nFormat: 200 words or fewer. Write in first person as James Osei.`,'normal',0,null,1500);
}
}
async function runMeiLin(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const agentKnowledge = await getAgentKnowledge();
  const prompt = `${GENIUS_MODE}\n\n${agentKnowledge}\n\nYou are Mei Lin, Brand Protection Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\n\nUse web search to do the following:\n**Infringement Scan** — Search for any entity using DRU CLEAR, DRU AI Consulting, 5C Cultural DNA, 5D Leadership, or DRU AI Leadership Ecosystem online. Report any unauthorized use found. If none, say so.\n**Competitive Intelligence** — Search for competitors in AI leadership consulting or AI transformation consulting. One specific threat or positioning opportunity based on what you actually find.\n**Brand Presence Check** — One brand consistency recommendation across druaiconsulting.com, assessment.druaiconsulting.com, app.druaiconsulting.com, and LinkedIn.\n**Today's Brand Action** — Single most important brand protection move based on what you found today.\n\nOnly report what search returns. Do not invent threats or invent competitor names.\n\nFormat: 250 words or fewer. Write in first person as Mei Lin.`;
  try {
    const output = await callAnthropicWithWebSearch(prompt, 1500, 3);
    return await writeToCSQ({agent_id:'meilin',agent_name:'Mei Lin',division:'AI Governance',task:'daily_brand_protection',category:'brand_monitoring',raw_output:output,priority:'normal',status:'pending',retry_count:0});
  } catch(err) { console.error('[meilin] Error:', err); return null; }
}
}
async function runRafael(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const agentKnowledge = await getAgentKnowledge();
  const prompt = `${GENIUS_MODE}\n\n${agentKnowledge}\n\nYou are Rafael Torres, AI Intelligence Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\n\nUse web search to find real AI news published today or this week. Search for the latest updates from OpenAI, Anthropic (Claude), and Google Gemini.\n\n**AI Landscape Update** — Top 2 real developments found today. For each: what it is, why it matters for DeAnna's clients and positioning, one action it suggests.\n**Competitive Intelligence** — One real move by competitors in AI consulting or leadership development found in your search.\n**Today's Learning Priority** — Single most strategically significant insight for DeAnna based on what you actually found.\n\nOnly report what search returns. If nothing new found, say so. Do not invent developments.\n\nFormat: 300 words or fewer. Write in first person as Rafael.`;
  try {
    const output = await callAnthropicWithWebSearch(prompt, 1500, 3);
    return await writeToCSQ({agent_id:'rafael',agent_name:'Rafael Torres',division:'AI Governance',task:'daily_ai_intelligence',category:'ai_intelligence',raw_output:output,priority:'normal',status:'pending',retry_count:0});
  } catch(err) { console.error('[rafael] Error:', err); return null; }
}
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
  return await runAgentToCSQ('naomi','Naomi Williams','HR','daily_recruiting_status','recruiting',`You are Naomi Williams, Recruiting Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\n\nREAL PIPELINE DATA (use only this — do not invent candidates, interviews, or offers):\n${pipelineData}\n\nHARD RULES:\n1. There are no real candidates in the system until GHL or Supabase shows them. Do not invent phone screens, offers, or pipeline stages.\n2. If clients in journey = 0 and diagnostics sold = 0, open with: \"No clients yet, no active candidates. Recruiting is in preparation mode.\" Then give ONE structural action to take today to prepare for hiring (write a JD, define a role scorecard, set up a GHL recruiting pipeline stage).\n3. If clients ARE in the pipeline, hiring urgency is real — name the client volume and which role becomes critical first.\n4. Do not repeat the same role priority list every day. If the priority list has not changed, acknowledge that and focus only on today's one action.\n\nFormat: 200 words or fewer. Write in first person as Naomi.`,'normal',0,null,1500);
}
}
async function runAiden(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const previousRecs = await getCrossRead(['aiden'], 1);
  const prevSection = previousRecs ? `WHAT YOU RECOMMENDED YESTERDAY (do not repeat):\n${previousRecs}` : 'No previous recommendations on record.';
  return await runAgentToCSQ('aiden','Aiden Park','HR','daily_onboarding_readiness','onboarding',`You are Aiden Park, Internal Onboarding Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nCLIENT ONBOARDING FLOW: DRU CLEAR™ Assessment — GHL automation — welcome sequence — diagnostic scheduling.\n\n${prevSection}\n\nHARD RULE: If you are about to recommend something already in the list above, skip it. Only surface what is genuinely new.\n\n**Client First 24 Hours** — One NEW experience upgrade not recommended yesterday.\n**Internal Team Onboarding** — One NEW onboarding document or process item to create.\n**Today's Priority** — Single most impactful NEW onboarding action. If nothing new: \"No new onboarding recommendations today.\"\n\nDo not describe fictional client scenarios. If no real clients exist yet, focus on infrastructure preparation only.\n\nFormat: 200 words or fewer. Write in first person as Aiden.`,'normal',0,null,1500);
}
}
async function runFatima(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const healthData = await fetchSystemHealthData();
  return await runAgentToCSQ('fatima','Fatima Al-Rashid','HR','daily_internal_helpdesk','helpdesk',`You are Fatima Al-Rashid, Internal Helpdesk and Operations Coordinator for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\n\nREAL SYSTEM HEALTH DATA (use only this — do not invent agent issues, error rates, or operational status):\n${healthData}\n\nHARD RULES:\n1. Your ecosystem health report must be based entirely on the data above. Do not invent issues, percentages, or agent-specific problems.\n2. If agents needing correction = 0 and agents rejected = 0, open with: \"All agents cleared in the last 24 hours. No corrections or rejections on record.\"\n3. If there ARE real issues, name the agent, the division, and what the correction note says. One action to resolve each.\n4. Do not assert vendor status (Vercel, Supabase, GHL, etc.) unless you have real data showing an issue. If no vendor data available, skip that section.\n5. One genuine workflow optimization to reduce DeAnna's manual review time — based on what the health data actually shows.\n\nFormat: 200 words or fewer. Write in first person as Fatima.`,'normal',0,null,1500);
}
}

// P7
// Pulls real client delivery data for all Client Delivery agents.
async function fetchClientDeliveryData(): Promise<string> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return 'Client delivery data unavailable.';
  try {
    const [clientRes, postsRes, lbRes, streakRes, enrollRes, progressRes] = await Promise.all([
      fetch(`${url}/rest/v1/client_journey_stages?select=client_name,stage,amount_paid,stage_updated_at&order=stage_updated_at.desc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
      fetch(`${url}/rest/v1/community_posts?select=id,created_at,profile_id&order=created_at.desc&limit=10`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
      fetch(`${url}/rest/v1/community_leaderboard?select=user_id,total_points,rank&order=rank.asc&limit=5`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
      fetch(`${url}/rest/v1/user_streaks?select=user_id,current_streak,longest_streak`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
      fetch(`${url}/rest/v1/course_enrollments?select=id,created_at&order=created_at.desc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
      fetch(`${url}/rest/v1/course_progress?select=id,lesson_id,completed_at`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }),
    ]);
    const [clients, posts, lb, streaks, enrollments, progress]: [any[],any[],any[],any[],any[],any[]] = await Promise.all([clientRes.json(),postsRes.json(),lbRes.json(),streakRes.json(),enrollRes.json(),progressRes.json()]);
    const clientList = Array.isArray(clients) && clients.length > 0
      ? clients.map((c:any) => `  - ${c.client_name} | ${c.stage} | $${c.amount_paid ?? 0}`).join('\n')
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
  return await runAgentToCSQ('keisha','Keisha Thompson','Client Delivery','daily_client_onboarding','client_onboarding',`You are Keisha Thompson, Client Onboarding Coach for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nCLIENT ONBOARDING FLOW: DRU CLEAR™ Assessment — GHL automation — welcome sequence — diagnostic scheduling.\n\nREAL DATA:\n${deliveryData}\n\n${prevSection}\n\nHARD RULES:\n1. If clients in journey = 0, open with: \"No clients in pipeline yet.\" Then give ONE new onboarding infrastructure item not covered yesterday.\n2. If clients exist, name each one, their stage, and the specific onboarding action their stage requires.\n3. Do not repeat the same friction point or protocol every day. Check previous output above first.\n4. Do not invent client scenarios, drop-off rates, or conversion windows.\n\nFormat: 200 words or fewer. Write in first person as Keisha.`,'normal',0,null,1500);
}
}
async function runMarco(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const deliveryData = await fetchClientDeliveryData();
  const prev = await getCrossRead(['marco'], 1);
  const prevSection = prev ? `WHAT YOU RECOMMENDED YESTERDAY (do not repeat):\n${prev}` : 'No previous output on record.';
  return await runAgentToCSQ('marco','Marco Silva','Client Delivery','daily_community_management','community_management',`You are Marco Silva, Community Manager for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nPLATFORM: app.druaiconsulting.com — Community Connection (Navigator $47/mo and Accelerator $147/mo).\n\nREAL DATA:\n${deliveryData}\n\n${prevSection}\n\nHARD RULES:\n1. Base all community observations on the real data above. Do not invent engagement rates, member counts, or activity levels.\n2. If community posts > 0, reference what the actual post volume tells you about engagement stage.\n3. If leaderboard entries > 0, the community has active members — acknowledge that and tailor your prompt accordingly.\n4. Do not repeat the same engagement prompt or retention action as yesterday. Check previous output above first.\n5. One community engagement prompt and one retention action — both must be NEW.\n\nFormat: 200 words or fewer. Write in first person as Marco.`,'normal',0,null,1500);
}
}
async function runLeila(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const deliveryData = await fetchClientDeliveryData();
  const prev = await getCrossRead(['leila'], 1);
  const prevSection = prev ? `WHAT YOU RECOMMENDED YESTERDAY (do not repeat):\n${prev}` : 'No previous output on record.';
  return await runAgentToCSQ('leila','Leila Nasser','Client Delivery','daily_feedback_coaching','feedback_coaching',`You are Leila Nasser, Feedback Coach for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\n\nREAL DATA:\n${deliveryData}\n\n${prevSection}\n\nHARD RULES:\n1. If clients in journey = 0 and course lessons completed = 0, there is no real feedback to report. Open with: \"No client feedback to report yet.\" Then give ONE new feedback infrastructure item not covered yesterday.\n2. If clients or course progress exist, build your feedback recommendations around those specific touchpoints.\n3. Do not invent NPS scores, testimonial quotes, or satisfaction metrics.\n4. Do not repeat the same feedback template or system recommendation as yesterday.\n\nFormat: 200 words or fewer. Write in first person as Leila.`,'normal',0,null,1500);
}
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
  return await runAgentToCSQ('jordan','Jordan Hayes','Client Delivery','daily_creative_direction','creative_direction',`You are Jordan Hayes, Creative Director for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}. You coordinate: Simone Laurent (Course Architect), Theo Nguyen (Presentation Designer), Amelia Santos (Training Video Producer).\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nBrand: Navy #0A2342, Gold #D4AF37, Magenta #C2185B. Fonts: Playfair Display (headlines), Inter (body).\n\nREAL DELIVERY DATA:\n${deliveryData}\n\nHARD RULE: Do not describe any asset, module, or video as complete, deployed, or live unless the data above confirms it. Course enrollments and lessons completed are the truth — report them as-is.\n\nFOCUS: ${focusType}\n${focusInstructions[focusType]}`,'normal',0,null,1500);
}
}
async function runSimone(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const dayOfWeek=new Date().toLocaleDateString('en-US',{weekday:'long',timeZone:'America/Chicago'});
  const deliveryData = await fetchClientDeliveryData();
  const moduleMap:Record<string,string>={Monday:'Module 1: AI Readiness (DRU CLEAR™ Foundation)',Tuesday:'Module 2: AI Strategy (DRU AI Transformation Pathway™ — Discover & Diagnose)',Wednesday:'Module 3: AI Design & Deploy (DRU AI Transformation Pathway™ — Design & Deploy)',Thursday:'Module 4: AI Leadership (5D Leadership™ + 5C Cultural DNA™)',Friday:'Module 5: AI Mastery (DRU AI Leadership Ecosystem™.)'};
  const todayModule=moduleMap[dayOfWeek]??'Module 1: AI Readiness (DRU CLEAR™ Foundation)';
  return await runAgentToCSQ('simone','Simone Laurent','Client Delivery','daily_course_architecture','course_architecture',`You are Simone Laurent, Course Architect for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nCOURSE: From Confusion to Confident with AI™. Tiers: Self-Paced $1,497, Live Cohort $7,997, Cohort Mastermind $12,997.\n\nREAL DELIVERY DATA:\n${deliveryData}\n\nHARD RULES:\n1. Do not invent completion rates, cohort data, learner feedback, or engagement metrics. The real numbers are above — use only those.\n2. If course lessons completed = 0, the course has not been completed by any student yet. Do not reference student outcomes.\n3. Course enrollments shows how many students exist. Calibrate your architecture decisions to that reality.\n4. You are building architecture — that is real, valuable work even before students arrive. But describe it as design in progress, not as complete or validated.\n\nTODAY'S MODULE FOCUS: ${todayModule}\n**Module Architecture** — 3 learning objectives, 3-5 key concepts, one framework application exercise, one executive reflection prompt.\n**Assessment Design** — One knowledge check and one real-world application activity.\n**Today's Priority** — Single most important architecture decision or asset to produce today.\n\nFormat: 250 words or fewer. Write in first person as Simone.`,'normal',0,null,1500);
}
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
  return await runAgentToCSQ('theo','Theo Nguyen','Client Delivery','daily_presentation_design','presentation_design',`You are Theo Nguyen, Presentation Designer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nBrand: Navy #0A2342, Gold #D4AF37, Magenta #C2185B. Fonts: Playfair Display (headlines), Inter (body).\n\nREAL DELIVERY DATA:\n${deliveryData}\n\nHARD RULE: You are producing design specs and briefs — that is real work. But do not describe any asset as deployed, client-facing, or in active use unless the delivery data above confirms clients exist who would use it. Design in progress is honest. Fake deployment status is not.\n\nASSET TYPE: ${assetType}\n${assetInstructions[assetType]}\n**Today's Production Priority** — Single most important asset to advance today.\n\nFormat: 250 words or fewer. Write in first person as Theo.`,'normal',0,null,1500);
}
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
  return await runAgentToCSQ('amelia','Amelia Santos','Client Delivery','daily_video_production','video_production',`You are Amelia Santos, Training Video Producer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\n\nREAL DELIVERY DATA:\n${deliveryData}\n\nHARD RULES:\n1. Do not invent view counts, engagement rates, or video performance metrics. No real video data exists yet — say so if relevant.\n2. If clients in journey = 0, testimonial frameworks are prep work only — label them as such, not as active production.\n3. You are producing creative briefs and scripts — that is real, valuable work. Just be honest about what stage the business is at.\n\nVIDEO TYPE: ${videoType}\n${videoInstructions[videoType]}\n**Production Checklist** — Three technical requirements for today's video type.\n**Today's Priority** — Single most important video asset to advance today.\n\nFormat: 250 words or fewer. Write in first person as Amelia.`,'normal',0,null,1500);
}
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
  return await runAgentToCSQ('isaiah','Isaiah Carter','Customer Support','daily_issue_resolution','issue_resolution',`You are Isaiah Carter, Issue Resolution Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\n\nREAL SUPPORT DATA (use only this — do not invent tickets, issues, or resolution counts):\n${supportData}\n\n${prevSection}\n\nHARD RULES:\n1. Base every statement on the real support data above. Do not invent ticket categories, volumes, or resolution flows that don't correspond to actual open tickets.\n2. If open tickets = 0 and total requests = 0, open with: \"No support tickets on record. Queue is clear.\" Then give ONE new infrastructure prep item not covered yesterday.\n3. If there ARE open tickets, address each one by name, category, and member tier. State the resolution action.\n4. Do not rewrite the same four resolution flows every day. If the protocols haven't changed and there are no real tickets, say so.\n5. Only surface genuinely new infrastructure improvements — check the previous output above before writing.\n\nFormat: 200 words or fewer. Write in first person as Isaiah.`,'normal',0,null,1500);
}
}
async function runPriscilla(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const supportData = await fetchSupportData();
  const previousWork = await getCrossRead(['priscilla'], 1);
  const prevSection = previousWork ? `WHAT YOU COVERED YESTERDAY (do not repeat):\n${previousWork}` : 'No previous output on record.';
  return await runAgentToCSQ('priscilla','Priscilla Okonkwo','Customer Support','daily_multichannel_comms','multichannel_comms',`You are Priscilla Okonkwo, Multi-Channel Communication Specialist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nCHANNELS: Email (druaiconsulting@gmail.com), SMS (GHL A2P 10DLC), Portal notifications (app.druaiconsulting.com), LinkedIn DM.\n\nREAL SUPPORT DATA (use only this — do not invent response rates, open rates, or communication metrics):\n${supportData}\n\n${prevSection}\n\nHARD RULES:\n1. Do not invent channel metrics. If no real data exists for a channel, do not report a percentage or rate for it.\n2. If total support requests = 0, open with: \"No client communications on record yet.\" Then give ONE new comms infrastructure item not covered yesterday.\n3. If there ARE tickets, use their category and tier to inform which channel needs attention and what template would help.\n4. Do not rewrite the same channel health table or template set every day. Check the previous output above — only surface what is genuinely new.\n\nFormat: 200 words or fewer. Write in first person as Priscilla.`,'normal',0,null,1500);
}
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

  if (route.pipeline==='p1_omar'){const omar=await runOmar();const ryan=await runRyan(omar);res.status(202).json({success:true,agent:route.agent_name,leads_scanned:omar.total_leads_scanned,high_intent:omar.high_intent_leads.length,crm_updates:ryan.crm_updates});}
  else if (route.pipeline==='p1_serena'){const id=await runAgentToCSQ('serena','Serena Jackson','Revenue, Growth & Sales','morning_coaching_briefing','coaching',`You are Serena Jackson, Business Coach for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™ (Discover Diagnose Design Deploy Dominate), 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nGenerate DeAnna's morning business coaching briefing. Today: ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'})}. Include: strategic focus, coaching insight, mindset anchor, one actionable growth move.`);res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p1_mateo'){const id=await runAgentToCSQ('mateo','Mateo Gonzalez','Revenue, Growth & Sales','sales_pipeline_review','sales_support',`You are Mateo Gonzalez, Sales Support Agent for DRU AI Consulting.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nOFFERS: DRU CLEAR™ AI Readiness Assessment (free) | Strategic Diagnostic™ ($3,497) | Executive Diagnostic™ ($4,997) | From Confusion to Confident with AI™ Course ($1,497-$12,997).\nInclude: sales focus, pipeline health, follow-up actions, sales tip, objection handling. All leads to assessment.druaiconsulting.com first.`,'normal',0,null,3000);res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p1_aaliyah'){
    const urlA=process.env.VITE_SUPABASE_URL; const keyA=process.env.SUPABASE_SERVICE_ROLE_KEY; let leadContext='No lead data available today.';
    if (urlA&&keyA){const todayA=new Date().toISOString().split('T')[0];const r=await fetch(`${urlA}/rest/v1/chief_of_staff_queue?run_date=eq.${todayA}&agent_id=eq.ryan&order=created_at.desc&limit=1`,{headers:{apikey:keyA,Authorization:`Bearer ${keyA}`}});if (r.ok){const d=await r.json();if (d?.[0]?.raw_output) leadContext=d[0].raw_output;}}
    const id=await runAgentToCSQ('aaliyah','Aaliyah Foster','Revenue, Growth & Sales','personalized_outreach_messages','outreach',`You are Aaliyah Foster, Personalized Outreach Agent for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.\nTRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.\nWrite personalized outreach for each high-intent lead — LinkedIn DM (150 words max) and email (subject + 200 word body). Mention DRU CLEAR™ AI Readiness Assessment and assessment.druaiconsulting.com. If no high-intent leads, write a warm outreach template.\nLead Intelligence:\n${leadContext}`,'high');
    res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p1_jaylen'){const id=await runAgentToCSQ('jaylen','Jaylen Brooks','Revenue, Growth & Sales','email_campaign_content','email_marketing',`You are Jaylen Brooks, Email Marketing Agent for DRU AI Consulting. Generate today's email marketing content. Audience: executives navigating AI. Offers: DRU CLEAR™ (free), Strategic Diagnostic™ ($3,497), Executive Diagnostic™ ($4,997), From Confusion to Confident with AI™ Course ($1,497-$12,997).\nRotate: nurture email, re-engagement, or promotional. Include: subject line + A/B variant, preview text, body (300 words max). CTA: assessment.druaiconsulting.com.`);res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p1_chloe'){const id=await runAgentToCSQ('chloe','Chloe Dubois','Revenue, Growth & Sales','daily_copy_asset','copywriting',`You are Chloe Dubois, Copy Writer for DRU AI Consulting. Generate one copy asset today. Rotate: ad copy, landing page headline+subhead+hero, CTA button variations (5 options), or testimonial prompt template. Brand: "AI Mastery. Leadership Clarity. Measurable Results." CTA destination: assessment.druaiconsulting.com. Every word earns its place.`);res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p1_zara'){
    const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
    const weekNum=Math.floor((Date.now()-new Date('2026-07-07').getTime())/(7*24*60*60*1000));
    const frameworks=['DRU CLEAR™','5C Cultural DNA™','5D Leadership™','AI Sales Mastery™'];
    const framework=frameworks[weekNum%4];
    const id=await runAgentToCSQ('zara','Zara Ahmed','Client Delivery','acc_weekly_pdf_content','acc_weekly_pdf',
    `You are Zara Ahmed, Content Architect for DRU AI Consulting — DeAnna R. Upshaw, AI Authority. Today: ${today}.
TRADEMARK REQUIREMENT: Always include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.

You are writing this week's Accelerator Circle (ACC) member PDF, in the Workbook format. These are Accelerator-tier members ($147/mo) — serious, high-level leaders in active Leadership with AI transformation. Write UP to them. They expect depth, directness, and real frameworks applied to real challenges — strategic substance, not motivational scaffolding. No fluff. No surface content. Every sentence earns its place.

SPECIFIC-INSIGHT BAR: if a paragraph you write could describe any company's generic AI rollout, it is too generic — rewrite it until it could only apply inside ${framework}'s own logic and dimensions.

THIS WEEK'S FRAMEWORK FOCUS: ${framework}

CONTENT FORMAT — Workbook structure, repeat this full block once per lesson/dimension you cover this week (2-3 lessons):

LESSON [N] — a short headline naming the dimension or lesson (this becomes the page title)

INSIGHT — the core teaching. Deep, specific, rooted entirely inside ${framework}. This is where the strategic depth lives.

WHAT IT LOOKS LIKE IN PRACTICE — a concrete second-person or specific-scene story (a named moment, a Thursday meeting, a real interaction) showing the Insight in action. Specific and human, never abstract.

BE PROACTIVE — one concrete, forward-moving practice or habit tied directly to the Insight above; specific enough to act on this week, written in the same elevated, affirmative voice.

THIS WEEK'S ACTION — exactly 3 concrete micro-steps a member can do this week, each one a single doable action, not a project.

REFLECTION — one powerful question that makes them pause and answer for themselves.

Do NOT include "The Real Cost," "The Pattern," or any fear/cost-contrast section — no fear language of any kind. Lead with what is possible throughout; avoid negative constructions ("don't," "didn't," "not," "instead of") — reframe every statement as active, affirmative, forward-moving language. Vocabulary register is elevated and deliberate ("achieved significant advancement," "meticulously prepared") while staying warm, not stiff. Vary sentence rhythm — semicolons for flow, short punchy statements for emphasis. Write every word as DeAnna herself would — this must sound like DeAnna authored it, not a content writer approximating her.

CLOSING — always four parts, in this order:

1. A quote — pull the most honest, direct line from the piece itself. The one that lands hardest. Set it apart, no quotation marks needed.

2. This Week, Pick One — a short paragraph telling them they do not need to act on everything. Just the one that resonated most. Do the action step. Then bring the reflection answer into the Circle.

3. A bulleted recap — one line per lesson, each restating that lesson's Reflection question, labeled by lesson number.

4. Want to continue on your DRU AI Transformation Pathway™ journey with a custom-made, just-for-you roadmap? Click here frameworks.druaiconsulting.com

Write the complete article. This is the full PDF content — not a summary or outline.`,
    'normal',0,null,2500);
    res.status(202).json({success:true,agent:route.agent_name,csq_id:id});
  }
  else if (route.pipeline==='p1_elena'){const id=await runAgentToCSQ('elena','Elena Vasquez','Revenue, Growth & Sales','product_knowledge_update','product_knowledge',`You are Elena Vasquez, Product Knowledge Agent for DRU AI Consulting. Generate weekly product knowledge update. Include: 5 executive FAQs, offer comparison guide (all starting with assessment.druaiconsulting.com), objection + response per offer, one positioning insight.`);res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p1_kwame'){const id=await runAgentToCSQ('kwame','Kwame Asante','Revenue, Growth & Sales','proposal_template_update','proposals',`You are Kwame Asante, Proposal Writer for DRU AI Consulting. Generate weekly proposal update. Include: executive summary template for Executive Diagnostic™ ($4,997) in McKinsey-style, proposal outline for C-suite client, value proposition (3 versions: short/medium/long), one proposal best practice. Brand: DeAnna R. Upshaw — 25+ years IT, 10+ years leadership development, AI Authority.`);res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p1_adaeze_scout'){const result=await runAdaezeScout();res.status(202).json({success:true,agent:route.agent_name,opportunities_found:result.count,csq_id:result.csqId});}
  else if (route.pipeline==='p2_camila'){const id=await runCamila();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p2_darius'){const id=await runDarius();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p2_ravi'){const id=await runRavi();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p2_yara'){
    const urlY=process.env.VITE_SUPABASE_URL; const keyY=process.env.SUPABASE_SERVICE_ROLE_KEY; let topPost='';
    if (urlY&&keyY){const mondayY=new Date();mondayY.setDate(mondayY.getDate()-mondayY.getDay()+1);const weekOfY=mondayY.toISOString().split('T')[0];const r=await fetch(`${urlY}/rest/v1/content_queue?week_of=eq.${weekOfY}&status=neq.queued&order=day_number.asc&limit=1`,{headers:{apikey:keyY,Authorization:`Bearer ${keyY}`}});if (r.ok){const q=await r.json();if (q.length>0) topPost=`${q[0].hook}\n\n${q[0].content}\n\n${q[0].hashtags}`;}}
    const yaraPrompt=`You are Yara Mansour, Bilingual Content Strategist for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.\n${topPost?`Adapt this week's content into a full bilingual multi-platform campaign.\n\nSOURCE CONTENT:\n${topPost}`:'Write original AI leadership content for a bilingual multi-platform campaign targeting English-speaking and LATAM executives.'}\n\nRespond ONLY with a valid JSON object — no preamble, no markdown fences:\n{\n  "linkedin_content": "English LinkedIn post — 200-300 words, strong hook, professional tone, one DRU framework reference (™), CTA: assessment.druaiconsulting.com, max 3 hashtags",\n  "facebook_content": "English Facebook post — 150-200 words, warm conversational tone, same core message, CTA: assessment.druaiconsulting.com",\n  "instagram_caption": "English Instagram caption — 80-120 words, punchy opening, visual energy, CTA: assessment.druaiconsulting.com, 5-7 hashtags",\n  "spanish_content": "Spanish LinkedIn post — natural executive-level LATAM Spanish, culturally adapted (not literal), same length as linkedin_content, CTA: assessment.druaiconsulting.com, translated hashtags"\n}\nTRADEMARK RULES: Always ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™.`;
    const id=await runAgentToCSQ('yara','Yara Mansour','Content & Brand','spanish_localization','localization',yaraPrompt);
    res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p2_ingrid'){
    const urlI=process.env.VITE_SUPABASE_URL; const keyI=process.env.SUPABASE_SERVICE_ROLE_KEY; let weekContent='';
    if (urlI&&keyI){const mondayI=new Date();mondayI.setDate(mondayI.getDate()-mondayI.getDay()+1);const weekOfI=mondayI.toISOString().split('T')[0];const r=await fetch(`${urlI}/rest/v1/content_queue?week_of=eq.${weekOfI}&order=day_number.asc`,{headers:{apikey:keyI,Authorization:`Bearer ${keyI}`}});if (r.ok){const posts=await r.json();weekContent=posts.map((p:any)=>`Day ${p.day_number} (${p.framework_covered}): ${p.hook}`).join('\n');}}
    const id=await runAgentToCSQ('ingrid','Ingrid Larsen','Content & Brand','weekly_press_release','press_release',`You are Ingrid Larsen, Press Release Writer for DRU AI Consulting — DeAnna R. Upshaw, AI Authority, CEO/Founder. This week's content: ${weekContent||'AI leadership, DRU frameworks, executive AI adoption'}. Write AP-style press release. Include: FOR IMMEDIATE RELEASE / Headline / Subheadline / Lead paragraph / Body (2-3 paragraphs with DeAnna quotes) / Boilerplate mentioning assessment.druaiconsulting.com / Contact: druaiconsulting@gmail.com`);
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
