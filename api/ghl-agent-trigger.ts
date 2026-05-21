// DRU AI Leadership Ecosystem™ — api/ghl-agent-trigger.ts
// 54 agents · 9 divisions · Community Connection (P9) added
// Isabella: Sonnet calls parallel + DB writes parallel
// P4 Legal & Finance: weekly Tuesday | P5 AI Governance: daily | P6 HR: daily
// P7 Client Delivery: daily | P8 Customer Support: daily | P9 Community Connection: daily

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION_ID = 'gl07I4JnbkGgW8zJprSz';
export const config = { maxDuration: 60 };
const GENIUS_MODE = `You operate in Genius Mode — think and respond at the level of a top 0.1% expert in your field. Apply deep logic, strategic frameworks, creative synthesis, and second-order thinking to every output. Never produce generic or surface-level work. Every sentence must earn its place.`;

interface AgentRoute { agent_id: string; agent_name: string; division: string; task: string; pipeline?: string; }
interface TriggerPayload { trigger_type: string; source?: string; [key: string]: unknown; }
interface ScoredLead { contact_id: string; name: string; email: string; phone: string; source: string; score: number; intent_level: 'high' | 'medium' | 'low'; recommended_action: string; notes: string; }
interface OmarResult { success: boolean; total_leads_scanned: number; scored_leads: ScoredLead[]; high_intent_leads: ScoredLead[]; run_date: string; error?: string; }
interface CSQItem { id: string; agent_id: string; agent_name: string; division: string; task: string; category: string; raw_output: string; priority: string; retry_count?: number; correction_notes?: string; parent_csq_id?: string; raymond_notes?: string; raymond_action?: string; raymond_priority?: string; travis_notes?: string; priya_notes?: string; governance_notes?: string; legal_notes?: string; isabella_flags?: string; compliance_score?: number; }

const AGENT_ROUTES: Record<string, AgentRoute> = {
  cron_isabella_review:           { agent_id: 'isabella',      agent_name: 'Isabella Moreno',  division: 'AI Governance',        task: 'trademark_compliance_review',   pipeline: 'cmd_isabella' },
  cron_governance_legal_review:   { agent_id: 'governance',    agent_name: 'Governance Panel', division: 'AI Governance',        task: 'governance_panel_review',       pipeline: 'cmd_governance' },
  cron_command_layer:             { agent_id: 'command_layer', agent_name: 'Command Layer',    division: 'Command',              task: 'executive_review',              pipeline: 'cmd_command_layer' },
  cron_twin_synthesis:            { agent_id: 'twin',          agent_name: "DeAnna's AI Twin", division: 'Command',              task: 'daily_synthesis_briefing',      pipeline: 'cmd_twin' },
  cron_omar_lead_score:           { agent_id: 'omar',     agent_name: 'Omar Patel',        division: 'Revenue & Growth', task: 'scan_score_route_leads',        pipeline: 'p1_omar' },
  cron_ryan_crm_update:           { agent_id: 'ryan',     agent_name: 'Ryan Nakamura',     division: 'Revenue & Growth', task: 'overnight_crm_sync',            pipeline: 'p1_ryan' },
  cron_serena_coaching:           { agent_id: 'serena',   agent_name: 'Serena Jackson',    division: 'Revenue & Growth', task: 'morning_coaching_briefing',     pipeline: 'p1_serena' },
  cron_mateo_sales_support:       { agent_id: 'mateo',    agent_name: 'Mateo Gonzalez',    division: 'Revenue & Growth', task: 'sales_pipeline_review',         pipeline: 'p1_mateo' },
  cron_aaliyah_outreach:          { agent_id: 'aaliyah',  agent_name: 'Aaliyah Foster',    division: 'Revenue & Growth', task: 'personalized_outreach_messages',pipeline: 'p1_aaliyah' },
  cron_jaylen_email:              { agent_id: 'jaylen',   agent_name: 'Jaylen Brooks',     division: 'Revenue & Growth', task: 'email_campaign_content',        pipeline: 'p1_jaylen' },
  cron_chloe_copy:                { agent_id: 'chloe',    agent_name: 'Chloe Dubois',      division: 'Revenue & Growth', task: 'daily_copy_asset',              pipeline: 'p1_chloe' },
  cron_zara_product:              { agent_id: 'zara',     agent_name: 'Zara Ahmed',        division: 'Revenue & Growth', task: 'product_launch_readiness',      pipeline: 'p1_zara' },
  cron_elena_knowledge:           { agent_id: 'elena',    agent_name: 'Elena Vasquez',     division: 'Revenue & Growth', task: 'product_knowledge_update',      pipeline: 'p1_elena' },
  cron_kwame_proposal:            { agent_id: 'kwame',    agent_name: 'Kwame Asante',      division: 'Revenue & Growth', task: 'proposal_template_update',      pipeline: 'p1_kwame' },
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
  cron_keisha_onboarding_daily:   { agent_id: 'keisha',    agent_name: 'Keisha Thompson',   division: 'Client Delivery',  task: 'daily_client_onboarding',       pipeline: 'p7_keisha' },
  cron_marco_community_daily:     { agent_id: 'marco',     agent_name: 'Marco Silva',       division: 'Client Delivery',  task: 'daily_community_management',    pipeline: 'p7_marco' },
  cron_leila_feedback_daily:      { agent_id: 'leila',     agent_name: 'Leila Nasser',      division: 'Client Delivery',  task: 'daily_feedback_coaching',       pipeline: 'p7_leila' },
  cron_jordan_creative_daily:     { agent_id: 'jordan',    agent_name: 'Jordan Hayes',      division: 'Client Delivery',  task: 'daily_creative_direction',      pipeline: 'p7_jordan' },
  cron_simone_course_daily:       { agent_id: 'simone',    agent_name: 'Simone Laurent',    division: 'Client Delivery',  task: 'daily_course_architecture',     pipeline: 'p7_simone' },
  cron_theo_presentation_daily:   { agent_id: 'theo',      agent_name: 'Theo Nguyen',       division: 'Client Delivery',  task: 'daily_presentation_design',     pipeline: 'p7_theo' },
  cron_amelia_video_daily:        { agent_id: 'amelia',    agent_name: 'Amelia Santos',     division: 'Client Delivery',  task: 'daily_video_production',        pipeline: 'p7_amelia' },
  cron_isaiah_support_daily:      { agent_id: 'isaiah',    agent_name: 'Isaiah Carter',     division: 'Customer Support', task: 'daily_issue_resolution',        pipeline: 'p8_isaiah' },
  cron_priscilla_comms_daily:     { agent_id: 'priscilla', agent_name: 'Priscilla Okonkwo', division: 'Customer Support', task: 'daily_multichannel_comms',       pipeline: 'p8_priscilla' },
  // P9 — Community Connection
  cron_dominique_daily_insight:   { agent_id: 'dominique',   agent_name: 'Dominique Carter', division: 'Community Connection', task: 'daily_leadership_insight',    pipeline: 'p9_dominique' },
  cron_elijah_framework_lesson:   { agent_id: 'elijah',      agent_name: 'Elijah Brooks',    division: 'Community Connection', task: 'framework_micro_lesson',      pipeline: 'p9_elijah' },
  cron_solange_action_challenge:  { agent_id: 'solange',     agent_name: 'Solange Dupont',   division: 'Community Connection', task: 'daily_action_challenge',      pipeline: 'p9_solange' },
  cron_isaiah_webb_framework:     { agent_id: 'isaiah_webb', agent_name: 'Isaiah Webb',      division: 'Community Connection', task: 'weekly_framework_training',   pipeline: 'p9_isaiah_webb' },
  cron_nadia_strategic_edge:      { agent_id: 'nadia',       agent_name: 'Nadia Osei',       division: 'Community Connection', task: 'strategic_edge_insight',      pipeline: 'p9_nadia' },
  cron_victor_engagement:         { agent_id: 'victor',      agent_name: 'Victor Reyes',     division: 'Community Connection', task: 'community_engagement_post',   pipeline: 'p9_victor' },
  cron_sasha_sales_insight:       { agent_id: 'sasha',       agent_name: 'Sasha Kim',        division: 'Community Connection', task: 'ai_sales_mastery_insight',    pipeline: 'p9_sasha' },
  cron_tariq_pdf_brief:           { agent_id: 'tariq',       agent_name: 'Tariq Oladele',    division: 'Community Connection', task: 'weekly_pdf_briefing',         pipeline: 'p9_tariq' },
  cron_zoe_community_lead:        { agent_id: 'zoe',         agent_name: 'Zoe Beaumont',     division: 'Community Connection', task: 'daily_community_facilitation',pipeline: 'p9_zoe' },
  cron_micah_member_experience:   { agent_id: 'micah',       agent_name: 'Micah Santos',     division: 'Community Connection', task: 'daily_member_experience',     pipeline: 'p9_micah' },
  // Event-based routes
  lead_created:         { agent_id: 'omar',    agent_name: 'Omar Patel',     division: 'Revenue & Growth', task: 'score_new_lead' },
  contact_updated:      { agent_id: 'ryan',    agent_name: 'Ryan Nakamura',  division: 'Revenue & Growth', task: 'process_contact_update' },
  assessment_completed: { agent_id: 'omar',    agent_name: 'Omar Patel',     division: 'Revenue & Growth', task: 'route_assessment_lead' },
  support_ticket:       { agent_id: 'isaiah',  agent_name: 'Isaiah Carter',  division: 'Customer Support', task: 'handle_support_request' },
  cc_upsell_signal:     { agent_id: 'aaliyah', agent_name: 'Aaliyah Foster', division: 'Revenue & Growth', task: 'cc_upsell_outreach' },
};

// Aaliyah CC Routing Map — signal type to GHL outreach webhook
const AALIYAH_CC_ROUTING: Record<string, string> = {
  navigator_upgrade:   'https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/u4dd3zsaVRZUW73wMc5t',
  accelerator_upgrade: 'https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/AlZQHDN7D7PIvApW0qDF',
  diagnostic_interest: 'https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/ec61ce1a-faf0-481f-9404-d6269fbda861',
  course_interest:     'https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/EDVsKWuDioWGDHaI1K7S',
};

const INTERNAL_CATEGORIES = ['coaching','sales_support','lead_intelligence','proposals','product_knowledge','product_launch','digital_marketing','analytics_report','seo_sem','legal_briefing','expense_report','financial_report','tax_strategy','disclaimer_review','privacy_policy','contract_review','brand_monitoring','ai_intelligence','recruiting','onboarding','helpdesk','client_onboarding','community_management','feedback_coaching','creative_direction','course_architecture','presentation_design','video_production','issue_resolution','multichannel_comms'];
const CLIENT_FACING_CATEGORIES = ['linkedin_post','instagram_post','facebook_post','twitter_post','tiktok_post','youtube_post','social_post','email_marketing','outreach','copywriting','press_release','localization','design_brief','content_creation','community_insight','community_lesson','community_challenge','community_edge','community_training','community_pdf','community_engagement'];
const SOCIAL_DIVISIONS = ['Content & Brand','Marketing'];

function getDivisionCategory(division: string): string {
  const map: Record<string,string> = {
    'Revenue & Growth':'revenue_growth','Content & Brand':'content_brand','Marketing':'marketing',
    'Legal & Finance':'legal_finance','AI Governance':'ai_governance','HR':'hr',
    'Client Delivery':'client_delivery','Customer Support':'customer_support',
    'Community Connection':'community_connection',
  };
  return map[division] ?? 'division_briefing';
}

function getPlatformLabel(category: string): string {
  const map: Record<string,string> = {linkedin_post:'LinkedIn',instagram_post:'Instagram',facebook_post:'Facebook',twitter_post:'X',tiktok_post:'TikTok',youtube_post:'YouTube',social_post:'Social',content_creation:'Content',press_release:'Press',design_brief:'Design',localization:'Localization',copywriting:'Copy',email_marketing:'Email',outreach:'Outreach'};
  return map[category] ?? 'Social';
}

function getDivisionPrompt(division: string, today: string, content: string): string {
  const instructions: Record<string,string> = {
    'Revenue & Growth': `Synthesize the Revenue & Growth division's work for today. Cover: lead intelligence (Omar/Ryan), sales support (Mateo), coaching insight (Serena), outreach created (Aaliyah), email campaign (Jaylen), copy asset (Chloe), launch readiness (Zara), product knowledge (Elena), proposal work (Kwame). 250-350 words. First person. Flag any high-intent leads or urgent pipeline actions.`,
    'Content & Brand': `Synthesize the Content & Brand division's work. Cover: content queue strategy (Camila), design brief (Ravi), press release activity (Ingrid), localization work (Yara). Note: Darius King's post is in the Social Media card. 200-300 words. First person.`,
    'Marketing': `Synthesize the Marketing division's strategic work. Cover: digital campaign status (Luca), analytics and funnel insights (Hyun-Ji), SEO/SEM priorities (Andre). Note: Nia's published content is in the Social Media card. 200-300 words. First person.`,
    'Legal & Finance': `Synthesize the Legal & Finance division's weekly work. Cover: legal briefing highlights (Amara), expense health (Diego), financial projections (Yuki), business financial planning intelligence (Marcus). 200-300 words. First person. Flag anything requiring DeAnna's signature or financial decision.`,
    'AI Governance': `Synthesize the AI Governance division's daily work. Cover: disclaimer status (Khalid), privacy compliance (Sofia), contract readiness (James), brand protection (Mei Lin), AI landscape intelligence (Rafael). 200-300 words. First person. Flag any compliance risks or urgent governance actions.`,
    'HR': `Synthesize the HR division's daily work. Cover: recruiting pipeline (Naomi), onboarding readiness (Aiden), internal operations health (Fatima). 150-250 words. First person. Flag any staffing decisions or internal issues needing DeAnna's attention.`,
    'Client Delivery': `Synthesize the Client Delivery division's work. Cover: client onboarding (Keisha), community engagement (Marco), feedback insights (Leila), creative production — Jordan orchestrating Simone/Theo/Amelia. 200-300 words. First person.`,
    'Customer Support': `Synthesize the Customer Support division's work. Cover: support ticket status (Isaiah), multi-channel communication health (Priscilla). 150-250 words. First person. Flag any unresolved escalations.`,
    'Community Connection': `Synthesize the Community Connection division's work. Cover: CLEAR Vision insights posted (Dominique/Elijah using DRU CLEAR™), 5D Elevation content (Solange/Isaiah Webb using 5D Leadership™), Culture DNA posts (Nadia/Victor using 5C Cultural DNA™), Revenue Intelligence (Sasha/Tariq using AI Sales Mastery™), CC Leadership facilitation and upsell signals (Zoe Beaumont/Micah Santos). Highlight community posts created today, any upsell opportunities identified, and member engagement momentum. 200-300 words. First person. Flag any upsell signals that should be routed to Aaliyah for outreach.`,
  };
  const instruction = instructions[division] ?? `Synthesize this division's work. 200-300 words. First person.`;
  return `You are DeAnna R. Upshaw's AI Twin synthesizing the ${division} division's work. Today: ${today}.
BRAND: "AI Mastery. Leadership Clarity. Measurable Results."
FRAMEWORKS (always ™): DRU CLEAR™ | DRU AI Leadership Ecosystem™ | DRU AI Transformation Pathway™ | 5C Cultural DNA™ | 5D Leadership™ | AI Sales Mastery™ | From Confusion to Confident with AI™
${division.toUpperCase()} DIVISION OUTPUTS:
${content}
${instruction}
Write as DeAnna speaking to herself. Start with ## ${division}.`;
}

async function callAnthropic(prompt: string, maxTokens = 2000): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:maxTokens,messages:[{role:'user',content:prompt}]})});
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = await res.json(); return data.content?.[0]?.text ?? '';
}

async function callTwin(prompt: string, maxTokens = 2000): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:maxTokens,messages:[{role:'user',content:prompt}]})});
  if (!res.ok) throw new Error(`Twin error ${res.status}`);
  const data = await res.json(); return data.content?.[0]?.text ?? '';
}

async function writeToCSQ(record: Record<string,unknown>): Promise<string|null> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key) return null;
  const res = await fetch(`${url}/rest/v1/chief_of_staff_queue`,{method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`,Prefer:'return=representation'},body:JSON.stringify(record)});
  if (!res.ok){console.error(`[csq] Write failed: ${await res.text()}`);return null;}
  const data = await res.json(); return data?.[0]?.id ?? null;
}

async function writeApproval(record: Record<string,unknown>): Promise<string|null> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key) return null;
  const res = await fetch(`${url}/rest/v1/approvals`,{method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`,Prefer:'return=representation'},body:JSON.stringify(record)});
  if (!res.ok){console.error(`[approvals] Write failed: ${await res.text()}`);return null;}
  const data = await res.json(); return data?.[0]?.id ?? null;
}

async function writeToCommunityPosts(record: Record<string,unknown>): Promise<string|null> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key) return null;
  const res = await fetch(`${url}/rest/v1/community_posts`,{method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`,Prefer:'return=representation'},body:JSON.stringify(record)});
  if (!res.ok){console.error(`[community_posts] Write failed: ${await res.text()}`);return null;}
  const data = await res.json(); return data?.[0]?.id ?? null;
}

async function fetchBrandMarks(): Promise<string> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key) return '';
  const res = await fetch(`${url}/rest/v1/brand_marks?active=eq.true&order=created_at.asc`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  if (!res.ok) return '';
  const data = await res.json(); return (data as {mark:string}[]).map(m=>m.mark).join(' | ');
}

async function getCSQItems(status: string): Promise<CSQItem[]> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key) return [];
  const res = await fetch(`${url}/rest/v1/chief_of_staff_queue?status=eq.${status}&order=created_at.asc`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
  if (!res.ok) return []; return await res.json();
}

async function updateCSQ(id: string, updates: Record<string,unknown>): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key) return;
  await fetch(`${url}/rest/v1/chief_of_staff_queue?id=eq.${id}`,{method:'PATCH',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`},body:JSON.stringify(updates)});
}

async function runAgentToCSQ(agentId:string,agentName:string,division:string,task:string,category:string,prompt:string,priority='normal',retryCount=0,parentCsqId:string|null=null,maxTokens=1500): Promise<string|null> {
  try {
    const output = await callAnthropic(`${GENIUS_MODE}\n\n${prompt}`,maxTokens);
    return await writeToCSQ({agent_id:agentId,agent_name:agentName,division,task,category,raw_output:output,priority,status:'pending',retry_count:retryCount,...(parentCsqId?{parent_csq_id:parentCsqId}:{})});
  } catch(error){console.error(`[${agentId}] Error:`,error);return null;}
}

async function runCCAgent(agentId:string,agentName:string,task:string,postType:string,tierRequired:string,category:string,prompt:string): Promise<{csq_id:string|null;post_id:string|null}> {
  try {
    const raw = await callAnthropic(`${GENIUS_MODE}\n\n${prompt}\n\nReturn ONLY valid JSON with no preamble or markdown: {"title":"...","content":"..."}`,1500);
    let title = ''; let content = '';
    try {
      const parsed = JSON.parse(raw.replace(/```json|```/g,'').trim());
      title = parsed.title || agentName;
      content = parsed.content || raw;
    } catch {
      const dateStr = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'America/Chicago'});
      title = `${agentName} — ${dateStr}`;
      content = raw;
    }
    const csq_id = await writeToCSQ({agent_id:agentId,agent_name:agentName,division:'Community Connection',task,category,raw_output:`${title}\n\n${content}`,priority:'normal',status:'pending',retry_count:0});
    const post_id = await writeToCommunityPosts({title,content,post_type:postType,tier_required:tierRequired,agent_id:agentId,agent_name:agentName,published_at:new Date().toISOString(),is_active:false});
    console.log(`[${agentId}] CC post created: ${post_id??'failed'} | CSQ: ${csq_id??'failed'}`);
    return {csq_id,post_id};
  } catch(error){console.error(`[${agentId}] CC agent error:`,error);return {csq_id:null,post_id:null};}
}

async function runCorrectionAgent(item:CSQItem,correctionNotes:string,newRetryCount:number): Promise<void> {
  try {
    const output = await callAnthropic(`${GENIUS_MODE}
You are ${item.agent_name}, working for DRU AI Consulting. Your previous submission for task "${item.task}" was returned with corrections:
CORRECTION NOTES: ${correctionNotes}
YOUR PREVIOUS OUTPUT: ${item.raw_output}
Produce a corrected version. COMPLIANCE: All DRU framework names MUST include ™: DRU CLEAR™, DRU AI Leadership Ecosystem™, DRU AI Transformation Pathway™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™, From Confusion to Confident with AI™. Stay within Classes 35, 41, 42.
Output ONLY the corrected content. No compliance notes or metadata.`,1500);
    await writeToCSQ({agent_id:item.agent_id,agent_name:item.agent_name,division:item.division,task:item.task,category:item.category,raw_output:output,priority:item.priority,status:'pending',retry_count:newRetryCount,parent_csq_id:item.id,correction_notes:correctionNotes});
    console.log(`[isabella] Correction triggered for ${item.agent_name} (attempt ${newRetryCount})`);
  } catch(error){console.error(`[isabella] Correction failed for ${item.agent_name}:`,error);}
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
    const text = await callAnthropic(`${GENIUS_MODE}\n\nYou are Omar Patel, Lead Scoring Agent for DRU AI Consulting. Score each lead 1-10. High-intent recommended_action must direct to assessment.druaiconsulting.com.\nReturn ONLY JSON array: [{"contact_id":"...","name":"...","email":"...","phone":"...","source":"...","score":8,"intent_level":"high","recommended_action":"Invite to DRU CLEAR\u2122 AI Readiness Assessment \u2014 assessment.druaiconsulting.com","notes":"..."}]\nLeads: ${JSON.stringify(leadSummary)}`,2000);
    const scored:ScoredLead[] = JSON.parse(text.replace(/```json|```/g,'').trim());
    return {success:true,total_leads_scanned:rawLeads.length,scored_leads:scored,high_intent_leads:scored.filter(l=>l.intent_level==='high'),run_date:new Date().toISOString()};
  } catch(error){return {success:false,total_leads_scanned:0,scored_leads:[],high_intent_leads:[],run_date:new Date().toISOString(),error:String(error)};}
}

async function runRyan(omarResult:OmarResult): Promise<{csq_id:string|null;crm_updates:number}> {
  const ghlApiKey = process.env.GHL_API_KEY;
  if (!ghlApiKey) return {csq_id:null,crm_updates:0};
  if (omarResult.total_leads_scanned===0){
    const csq_id = await writeToCSQ({agent_id:'ryan',agent_name:'Ryan Nakamura',division:'Revenue & Growth',task:'overnight_crm_sync',category:'lead_intelligence',raw_output:'**Daily Lead Intelligence \u2014 No New Leads**\n\nOmar scanned GHL and found no new contacts in the last 24 hours. No CRM updates required.',priority:'normal',status:'pending',retry_count:0});
    return {csq_id,crm_updates:0};
  }
  let crmUpdates=0;
  for (const lead of omarResult.scored_leads){if (lead.contact_id){await fetch(`${GHL_API_BASE}/contacts/${lead.contact_id}`,{method:'PUT',headers:{Authorization:`Bearer ${ghlApiKey}`,Version:'2021-07-28','Content-Type':'application/json'},body:JSON.stringify({tags:[`ai-scored`,`intent-${lead.intent_level}`,`score-${lead.score}`]})});crmUpdates++;}}
  const highIntentSummary = omarResult.high_intent_leads.map(l=>`* ${l.name} (Score: ${l.score}/10) \u2014 ${l.recommended_action}`).join('\n');
  const briefing = await callAnthropic(`${GENIUS_MODE}\n\nYou are Ryan Nakamura, CRM Management Agent for DRU AI Consulting. Write a precise lead intelligence briefing.\nDATA: Total:${omarResult.total_leads_scanned} | High-intent:${omarResult.high_intent_leads.length} | Medium:${omarResult.scored_leads.filter(l=>l.intent_level==='medium').length} | Low:${omarResult.scored_leads.filter(l=>l.intent_level==='low').length}\nHIGH-INTENT: ${highIntentSummary||'None today'}\nInclude: executive summary, high-intent leads with actions (all directed to assessment.druaiconsulting.com), CRM updates completed, strategic next steps.`);
  const csq_id = await writeToCSQ({agent_id:'ryan',agent_name:'Ryan Nakamura',division:'Revenue & Growth',task:'overnight_crm_sync',category:'lead_intelligence',raw_output:briefing,priority:omarResult.high_intent_leads.length>0?'high':'normal',status:'pending',retry_count:0});
  return {csq_id,crm_updates:crmUpdates};
}

// P2
async function runCamila(): Promise<number> {
  const url=process.env.VITE_SUPABASE_URL; const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key) return 0;
  const now=new Date(); const monday=new Date(now); monday.setDate(now.getDate()-now.getDay()+1); monday.setHours(0,0,0,0);
  const weekOf=monday.toISOString().split('T')[0];
  const days=[1,2,3,4,5].map(d=>{const date=new Date(monday);date.setDate(monday.getDate()+d-1);return{day_number:d,scheduled_for:date.toISOString().split('T')[0]};});
  const text = await callAnthropic(`${GENIUS_MODE}\n\nYou are Camila Flores, Social Media Strategist for DRU AI Consulting. Frameworks (always \u2122): DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\nGenerate 5 LinkedIn posts (Mon-Fri). Day 1:thought_leadership|Day 2:educational|Day 3:engagement|Day 4:story_insight|Day 5:soft_promotional. Each: compelling hook, 150-250 words, one framework, CTA to assessment.druaiconsulting.com, 3-5 hashtags.\nReturn ONLY valid JSON: [{"day_number":1,"framework_covered":"DRU CLEAR\u2122","post_type":"thought_leadership","hook":"...","content":"...","hashtags":"#AILeadership"}]`,3000);
  const posts=JSON.parse(text.replace(/```json|```/g,'').trim());
  for (const post of posts){const day=days.find(d=>d.day_number===post.day_number)??days[0];await fetch(`${url}/rest/v1/content_queue`,{method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`},body:JSON.stringify({week_of:weekOf,day_number:post.day_number,scheduled_for:day.scheduled_for,platform:'linkedin',framework_covered:post.framework_covered,post_type:post.post_type,hook:post.hook,content:post.content,hashtags:post.hashtags,status:'queued'})});}
  return posts.length;
}

async function runDarius(): Promise<string|null> {
  const url=process.env.VITE_SUPABASE_URL; const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const today=new Date().toISOString().split('T')[0];
  const now=new Date(); const monday=new Date(now); monday.setDate(now.getDate()-now.getDay()+1);
  const weekOf=monday.toISOString().split('T')[0];
  let postContent=''; let queueId:string|null=null;
  if (url&&key){const res=await fetch(`${url}/rest/v1/content_queue?week_of=eq.${weekOf}&status=eq.queued&scheduled_for=eq.${today}&limit=1`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});if (res.ok){const queue=await res.json();if(queue.length>0){queueId=queue[0].id;postContent=`${queue[0].hook}\n\n${queue[0].content}\n\n${queue[0].hashtags}`;}}}
  if (!postContent){const brandMarks=await fetchBrandMarks();postContent=await callAnthropic(`${GENIUS_MODE}\n\nYou are Darius King, Viral Scripter for DRU AI Consulting. Write ONE LinkedIn post that stops executives mid-scroll.\nTRADEMARK RULES: Only use frameworks with \u2122. APPROVED: ${brandMarks}\nSERVICE CLASS RULES: Classes 35, 41, 42 only.\nFORMAT: 150-250 words. Strong hook. CTA pointing to assessment.druaiconsulting.com. 3-5 hashtags.`);}
  const csqId=await writeToCSQ({agent_id:'darius',agent_name:'Darius King',division:'Content & Brand',task:'generate_daily_linkedin_post',category:'linkedin_post',raw_output:postContent,priority:'normal',status:'pending',retry_count:0});
  if (queueId&&url&&key){await fetch(`${url}/rest/v1/content_queue?id=eq.${queueId}`,{method:'PATCH',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`},body:JSON.stringify({status:'submitted',submitted_at:new Date().toISOString()})});}
  return csqId;
}

// P3
async function runNia(): Promise<string|null> {
  const brandMarks=await fetchBrandMarks();
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const dayOfWeek=new Date().toLocaleDateString('en-US',{weekday:'long',timeZone:'America/Chicago'});
  const contentTypeMap:Record<string,string>={Monday:'thought_leadership_article',Tuesday:'framework_explainer',Wednesday:'executive_faq_guide',Thursday:'client_transformation_story',Friday:'trend_analysis_piece'};
  const contentType=contentTypeMap[dayOfWeek]??'thought_leadership_article';
  const contentInstructions:Record<string,string>={
    thought_leadership_article:`Write a 600-800 word thought leadership article positioning DeAnna R. Upshaw as the AI Authority. Compelling headline, 3-4 sections, one DRU framework reference, CTA to assessment.druaiconsulting.com.`,
    framework_explainer:`Write a 500-700 word framework explainer for one of DeAnna's proprietary frameworks. What it is, why it matters, core components, real-world application, CTA to assessment.druaiconsulting.com.`,
    executive_faq_guide:`Write a 600-800 word FAQ guide answering 5 pressing executive questions about AI adoption. One DRU framework per answer. CTA to assessment.druaiconsulting.com.`,
    client_transformation_story:`Write a 500-700 word composite client transformation story using the DRU AI Transformation Pathway\u2122. Before state, intervention, transformation, outcomes, CTA to assessment.druaiconsulting.com.`,
    trend_analysis_piece:`Write a 600-800 word trend analysis on a current AI leadership trend. Position DeAnna as the authority. CTA to assessment.druaiconsulting.com.`,
  };
  return await runAgentToCSQ('nia','Nia Robinson','Marketing','daily_content_creation','content_creation',`You are Nia Robinson, Content Creation Specialist for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK RULES: Only use frameworks with \u2122. APPROVED: ${brandMarks}\nSERVICE CLASS RULES: Classes 35, 41, 42 only.\nTODAY'S CONTENT TYPE: ${contentType}\n${contentInstructions[contentType]}\nEvery piece must include assessment.druaiconsulting.com as the primary CTA.`,'normal',0,null,2000);
}

async function runLuca(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  return await runAgentToCSQ('luca','Luca Romano','Marketing','digital_marketing_briefing','digital_marketing',`You are Luca Romano, Digital Marketing Specialist for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}. All objectives point to assessment.druaiconsulting.com.\n**Campaign Status** \u2014 LinkedIn Ads: campaign type, targeting, budget, one ad copy variation. Meta Ads: retargeting strategy. Google Ads: one keyword cluster.\n**Funnel Optimization** \u2014 One landing page improvement. One A/B test hypothesis.\n**This Week's Priority Action** \u2014 One highest-impact move with rationale.`,'normal',0,null,2000);
}

async function runHyunJi(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const dayOfWeek=new Date().toLocaleDateString('en-US',{weekday:'long',timeZone:'America/Chicago'});
  const reportType=dayOfWeek==='Monday'?'weekly_recap':'daily_operational';
  const reportInstructions=reportType==='weekly_recap'?`Weekly analytics recap AND week-ahead priorities. Assessment funnel benchmarks, LinkedIn engagement benchmarks, email open rate targets (34%). 3 KPIs with targets for the week.`:`Daily analytics briefing. Funnel health at assessment.druaiconsulting.com. One metric that if moved 10% would most impact revenue. One assessment-to-diagnostic conversion insight.`;
  return await runAgentToCSQ('hyunji','Hyun-Ji Kim','Marketing','analytics_roi_briefing','analytics_report',`You are Hyun-Ji Kim, Analytics & ROI Specialist for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}.\nREPORT TYPE: ${reportType}\n${reportInstructions}`,'normal',0,null,2000);
}

async function runAndre(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const dayOfWeek=new Date().toLocaleDateString('en-US',{weekday:'long',timeZone:'America/Chicago'});
  const focusType=dayOfWeek==='Tuesday'?'technical_seo':dayOfWeek==='Friday'?'weekly_search_recap':'daily_operational';
  const focusInstructions:Record<string,string>={
    daily_operational:`**Brand Keyword Protection** \u2014 Protect: "DRU AI Consulting", "DeAnna Upshaw", "DRU CLEAR". One competitor threat. **Organic Search** \u2014 Top 3 keyword clusters. One content gap for Nia. **Today's SEO Action** \u2014 One immediately actionable move.`,
    technical_seo:`**Site Health** \u2014 Core Web Vitals targets for assessment + app subdomains. One crawlability recommendation. **Schema** \u2014 Recommended schema for services and courses. **This Week's Technical Priority** \u2014 Single highest-impact fix.`,
    weekly_search_recap:`**Organic Search Performance** \u2014 Benchmark targets. One keyword to monitor. **Paid Search** \u2014 Brand campaign health. **Next Week's Priorities** \u2014 3 actions ranked by impact.`,
  };
  return await runAgentToCSQ('andre','Andre Mitchell','Marketing','seo_sem_brand_briefing','seo_sem',`You are Andre Mitchell, SEO/SEM Brand Manager for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}. Primary conversion destination: assessment.druaiconsulting.com.\nFOCUS TYPE: ${focusType}\n${focusInstructions[focusType]}`,'normal',0,null,2000);
}

// P4
async function runAmara(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  return await runAgentToCSQ('amara','Amara Okafor','Legal & Finance','weekly_legal_briefing','legal_briefing',`You are Amara Okafor, Legal Advisor for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\nSERVICE CLASSES: All content within Classes 35, 41, 42 only.\nRespond in 200 words or fewer: (1) Top contract readiness item before first client. (2) One IP protection action this week. (3) One AI consulting liability risk and protection. (4) One pre-launch legal checklist item. Flag anything requiring immediate action.`,'normal',0,null,600);
}

async function runDiego(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  return await runAgentToCSQ('diego','Diego Reyes','Legal & Finance','weekly_expense_report','expense_report',`You are Diego Reyes, Expense Manager for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\nKNOWN EXPENSES: Vercel ~$20/mo | Anthropic API usage-based | GHL monthly | Make.com Pro $16/mo.\nRespond in 200 words or fewer: (1) Estimated monthly operating cost. (2) One cost optimization opportunity. (3) Break-even at Strategic Diagnostic\u2122 $3,497 and Executive Diagnostic\u2122 $4,997. (4) One financial action for this week.`,'normal',0,null,600);
}

async function runYuki(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  return await runAgentToCSQ('yuki','Yuki Tanaka','Legal & Finance','weekly_financial_report','financial_report',`You are Yuki Tanaka, Financial Reporting Specialist for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\nEXACT PRICING: Strategic Diagnostic\u2122 $3,497 | Executive Diagnostic\u2122 $4,997 | From Confusion to Confident with AI\u2122 Course $497-$1,497 | Daily Connections Navigator $47/mo | Accelerator $147/mo.\nRespond in 150 words or fewer: (1) Month 1 revenue projection conservative. (2) MRR target at 10 Daily Connections subscribers. (3) Highest revenue-per-hour offer. (4) One financial risk in first 90 days. Label all figures as projections.`,'normal',0,null,600);
}

async function runMarcus(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  return await runAgentToCSQ('marcus','Marcus Chen','Legal & Finance','weekly_tax_strategy_briefing','tax_strategy',`You are Marcus Chen, Tax Strategist for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\nEntity: LLC (DBA Dimensional Solns, LLC) \u2014 Texas. DISCLAIMER: All guidance is strategic tax counsel for planning purposes only. Final decisions require a licensed CPA or tax attorney.\nRespond in 150 words or fewer: (1) Top tax deduction to prioritize NOW. (2) Recommended quarterly estimated tax set-aside percentage. (3) One S-Corp election consideration. (4) One record-keeping action to start immediately. Flag any time-sensitive tax action.`,'normal',0,null,600);
}

// P5
async function runKhalid(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  return await runAgentToCSQ('khalid','Khalid Hassan','AI Governance','daily_disclaimer_review','disclaimer_review',`You are Khalid Hassan, Disclaimer Writer for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\nSERVICE CLASSES: All content within Classes 35, 41, 42 only.\n**AI-Generated Content Disclaimer** \u2014 Short (1 sentence) and full (2-3 sentences).\n**Course Disclaimer** \u2014 For From Confusion to Confident with AI\u2122: results disclaimer, educational purpose only.\n**Consulting Disclaimer** \u2014 For Strategic Diagnostic\u2122 ($3,497) and Executive Diagnostic\u2122 ($4,997): scope of engagement disclaimer.\n**Today's Action** \u2014 One highest-risk missing disclaimer to address before launch.`,'normal',0,null,1500);
}

async function runSofia(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  return await runAgentToCSQ('sofia','Sofia Petrov','AI Governance','daily_privacy_compliance','privacy_policy',`You are Sofia Petrov, Privacy Policy Specialist for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\nSERVICE CLASSES: All content within Classes 35, 41, 42 only.\n**Data Collection Status** \u2014 What data is collected via assessment.druaiconsulting.com? One gap to fix.\n**GDPR/CCPA Readiness** \u2014 Biggest compliance gap. One actionable step.\n**Privacy Policy Review** \u2014 One update needed.\n**Today's Priority** \u2014 Single most important privacy action before first paying client.`,'normal',0,null,1500);
}

async function runJames(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  return await runAgentToCSQ('james','James Osei','AI Governance','daily_contract_readiness','contract_review',`You are James Osei, Contract Writer for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\nSERVICE CLASSES: All content within Classes 35, 41, 42 only.\n**Engagement Agreement Status** \u2014 Contract readiness (1-10) for: Strategic Diagnostic\u2122 ($3,497), Executive Diagnostic\u2122 ($4,997), 90-Day AI Transformation Journey\u2122 ($20K+), From Confusion to Confident with AI\u2122 Course.\n**Priority Contract** \u2014 Single highest-priority template and its 3 most critical clauses.\n**IP Protection** \u2014 One clause protecting DeAnna's proprietary frameworks.\n**Today's Contract Action** \u2014 One specific gap to close this week.`,'normal',0,null,1500);
}

async function runMeiLin(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  return await runAgentToCSQ('meilin','Mei Lin','AI Governance','daily_brand_protection','brand_monitoring',`You are Mei Lin, Brand Protection Specialist for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\nSERVICE CLASSES: All content within Classes 35, 41, 42 only.\n**Trademark Monitoring** \u2014 Status of DRU proprietary marks. One proactive trademark action for this week.\n**Digital Brand Presence** \u2014 One brand consistency recommendation across druaiconsulting.com, assessment, app, LinkedIn.\n**Competitive Intelligence** \u2014 One competitor threat. One positioning opportunity.\n**Today's Brand Protection Action** \u2014 Single most important brand protection move for the day.`,'normal',0,null,1500);
}

async function runRafael(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  return await runAgentToCSQ('rafael','Rafael Torres','AI Governance','daily_ai_intelligence','ai_intelligence',`You are Rafael Torres, AI Intelligence Specialist for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\nSERVICE CLASSES: All content within Classes 35, 41, 42 only.\n**AI Landscape Update** \u2014 Top 2 most relevant AI developments this week. For each: what it is, why it matters, what action it suggests.\n**Competitive Intelligence** \u2014 One notable move by competitors in AI consulting and leadership development.\n**AI Tool Update** \u2014 One new AI capability relevant to DeAnna's client work or the DRU AI Leadership Ecosystem\u2122.\n**Today's Learning Priority** \u2014 Single most strategically significant insight for DeAnna today.`,'normal',0,null,1500);
}

// P6
async function runNaomi(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  return await runAgentToCSQ('naomi','Naomi Williams','HR','daily_recruiting_status','recruiting',`You are Naomi Williams, Recruiting Specialist for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\n**Priority Roles Pipeline** \u2014 Top 3 human roles needed post-launch. For each: ideal candidate profile and when needed.\n**Talent Sourcing Strategy** \u2014 One specific LinkedIn search strategy or talent community to tap this week.\n**Pre-Launch HR Readiness** \u2014 One HR infrastructure item to complete before first client engagement.\n**Culture Brief** \u2014 One culture document based on DeAnna's 5C Cultural DNA\u2122.\n**Today's Recruiting Priority** \u2014 Single most important talent action for today.`,'normal',0,null,1500);
}

async function runAiden(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  return await runAgentToCSQ('aiden','Aiden Park','HR','daily_onboarding_readiness','onboarding',`You are Aiden Park, Internal Onboarding Specialist for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\n**Client Onboarding Status** \u2014 Current flow: DRU CLEAR\u2122 Assessment \u2192 GHL automation \u2192 welcome sequence \u2192 diagnostic scheduling. One specific improvement before first paying client.\n**Client First 24 Hours** \u2014 Ideal touchpoints for a new diagnostic client. One experience upgrade.\n**Internal Team Onboarding** \u2014 One onboarding document to create now.\n**Today's Onboarding Priority** \u2014 Single most impactful onboarding improvement for the day.`,'normal',0,null,1500);
}

async function runFatima(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  return await runAgentToCSQ('fatima','Fatima Al-Rashid','HR','daily_internal_helpdesk','helpdesk',`You are Fatima Al-Rashid, Internal Helpdesk and Operations Coordinator for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\n**Ecosystem Health Check** \u2014 DRU AI Leadership Ecosystem\u2122 operational status: 54 agents across 9 divisions including Community Connection. Any known issues? One operational improvement suggestion.\n**DeAnna's Workload Protection** \u2014 One workflow optimization that would reduce DeAnna's manual review time.\n**Vendor Status** \u2014 Quick status on: Vercel, Supabase, GHL, Make.com, Anthropic, Stripe. Any renewals or issues this week?\n**Today's Operations Priority** \u2014 Single most important internal operations action for the day.`,'normal',0,null,1500);
}

// P7
async function runKeisha(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  return await runAgentToCSQ('keisha','Keisha Thompson','Client Delivery','daily_client_onboarding','client_onboarding',`You are Keisha Thompson, Client Onboarding Coach for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\nCLIENT ONBOARDING FLOW: DRU CLEAR\u2122 Assessment \u2192 GHL automation \u2192 welcome sequence \u2192 diagnostic scheduling.\n**Onboarding Pipeline Status** \u2014 Current flow health assessment. One friction point to eliminate.\n**First 24 Hours Protocol** \u2014 Ideal client touchpoints post-purchase. One experience upgrade.\n**Welcome Sequence** \u2014 One specific improvement to the GHL automated welcome sequence.\n**Today's Onboarding Priority** \u2014 Single most impactful action to elevate client first impression today.`,'normal',0,null,1500);
}

async function runMarco(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  return await runAgentToCSQ('marco','Marco Silva','Client Delivery','daily_community_management','community_management',`You are Marco Silva, Community Manager for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\nPLATFORM: app.druaiconsulting.com \u2014 Daily Connections (Free: 1 card / Navigator $47/mo: 3 cards / Accelerator $147/mo: 4 cards).\n**Community Engagement** \u2014 One discussion prompt aligned with DRU AI Transformation Pathway\u2122.\n**Retention Strategy** \u2014 One specific action to increase Daily Connections subscriber retention and upgrade rate this week.\n**Community Health Indicators** \u2014 Key signals to monitor: active member engagement, card interaction rate, upgrade triggers.\n**Today's Community Priority** \u2014 Single highest-impact community action for today.`,'normal',0,null,1500);
}

async function runLeila(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  return await runAgentToCSQ('leila','Leila Nasser','Client Delivery','daily_feedback_coaching','feedback_coaching',`You are Leila Nasser, Feedback Coach for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\n**Feedback System Status** \u2014 Current feedback touchpoints across all offer tiers. One gap to close before first paying client.\n**Testimonial Pipeline** \u2014 One testimonial prompt template for post-diagnostic clients.\n**NPS Framework** \u2014 Recommended NPS survey timing for each offer tier. One question beyond standard NPS.\n**Today's Feedback Priority** \u2014 Single most important feedback infrastructure action before launch.`,'normal',0,null,1500);
}

async function runJordan(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const dayOfWeek=new Date().toLocaleDateString('en-US',{weekday:'long',timeZone:'America/Chicago'});
  const focusType=dayOfWeek==='Monday'?'weekly_creative_brief':dayOfWeek==='Friday'?'weekly_creative_recap':'daily_creative_direction';
  const focusInstructions:Record<string,string>={
    weekly_creative_brief:`**Weekly Creative Brief** \u2014 Set the creative direction for Simone (course architecture), Theo (presentations), and Amelia (video production) this week. One unifying theme, one visual direction tied to brand (Navy #0A2342 / Gold #D4AF37 / Magenta #C2185B), one production priority per team member.`,
    daily_creative_direction:`**Daily Creative Pulse** \u2014 One creative asset priority for today. Specify which team member (Simone/Theo/Amelia) should be producing and the exact deliverable. One brand consistency observation. One creative upgrade to the client experience that can be executed today.`,
    weekly_creative_recap:`**Weekly Creative Recap** \u2014 Review this week's creative output across course, presentations, and video. What was completed, in progress, and must carry forward. One quality elevation recommendation for next week.`,
  };
  return await runAgentToCSQ('jordan','Jordan Hayes','Client Delivery','daily_creative_direction','creative_direction',`You are Jordan Hayes, Creative Director for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}. You orchestrate: Simone Laurent (Course Architect), Theo Nguyen (Presentation Designer), Amelia Santos (Training Video Producer).\nTRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\nBrand: Navy #0A2342, Gold #D4AF37, Magenta #C2185B. Fonts: Playfair Display (headlines), Inter (body).\nFOCUS: ${focusType}\n${focusInstructions[focusType]}`,'normal',0,null,1500);
}

async function runSimone(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const dayOfWeek=new Date().toLocaleDateString('en-US',{weekday:'long',timeZone:'America/Chicago'});
  const moduleMap:Record<string,string>={Monday:'Module 1: AI Readiness \u2014 Understanding where you are (DRU CLEAR\u2122)',Tuesday:'Module 2: AI Strategy \u2014 Designing your transformation (DRU AI Transformation Pathway\u2122 \u2014 Discover\u2192Diagnose)',Wednesday:'Module 3: AI Design & Deploy \u2014 Building the operating model (DRU AI Transformation Pathway\u2122 \u2014 Design\u2192Deploy)',Thursday:'Module 4: AI Leadership \u2014 Leading teams through adoption (5D Leadership\u2122 + 5C Cultural DNA\u2122)',Friday:'Module 5: AI Mastery \u2014 Sustaining competitive advantage (DRU AI Leadership Ecosystem\u2122)'};
  const todayModule=moduleMap[dayOfWeek]??'Module 1: AI Readiness \u2014 Understanding where you are (DRU CLEAR\u2122)';
  return await runAgentToCSQ('simone','Simone Laurent','Client Delivery','daily_course_architecture','course_architecture',`You are Simone Laurent, Course Architect for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\nCOURSE: From Confusion to Confident with AI\u2122. Tiers: Self-Paced $1,497, Live Cohort $7,997, Cohort Mastermind $12,997.\nTODAY'S MODULE FOCUS: ${todayModule}\n**Module Architecture** \u2014 3 learning objectives, 3-5 key concepts, one framework application exercise, one executive reflection prompt.\n**Assessment Design** \u2014 One knowledge check question and one real-world application activity.\n**Today's Course Priority** \u2014 Single most important course architecture decision or content asset to produce today.`,'normal',0,null,1500);
}

async function runTheo(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const dayOfWeek=new Date().toLocaleDateString('en-US',{weekday:'long',timeZone:'America/Chicago'});
  const assetType=dayOfWeek==='Monday'?'diagnostic_readout_template':dayOfWeek==='Wednesday'?'course_module_slides':dayOfWeek==='Friday'?'framework_visualization':'daily_presentation_asset';
  const assetInstructions:Record<string,string>={
    diagnostic_readout_template:`**Diagnostic Readout Template** \u2014 Slide structure for delivering Strategic Diagnostic\u2122 or Executive Diagnostic\u2122 results. Slides: executive summary, findings by pillar, DRU AI Transformation Pathway\u2122 stage placement, recommendations, next steps. Include design notes for each slide.`,
    course_module_slides:`**Course Module Slide Deck** \u2014 Slide structure for one course module (5-8 slides). Title slide, learning objectives, 3 content slides with visual direction, one activity slide, summary/CTA slide.`,
    framework_visualization:`**Framework Visualization** \u2014 One-page visual representation of a DRU proprietary framework. Layout concept, key elements, color application (Navy/Gold/Magenta), typography guidance.`,
    daily_presentation_asset:`**Daily Presentation Asset** \u2014 One slide concept for the highest-priority presentation need today. Specify type, layout, content, visual direction.`,
  };
  return await runAgentToCSQ('theo','Theo Nguyen','Client Delivery','daily_presentation_design','presentation_design',`You are Theo Nguyen, Presentation Designer for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\nBrand: Navy #0A2342, Gold #D4AF37, Magenta #C2185B. Fonts: Playfair Display (headlines), Inter (body).\nASSET TYPE: ${assetType}\n${assetInstructions[assetType]}\n**Today's Production Priority** \u2014 Single most impactful presentation asset to complete today.`,'normal',0,null,1500);
}

async function runAmelia(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const dayOfWeek=new Date().toLocaleDateString('en-US',{weekday:'long',timeZone:'America/Chicago'});
  const videoType=dayOfWeek==='Monday'?'intro_video_script':dayOfWeek==='Wednesday'?'course_module_video':dayOfWeek==='Friday'?'testimonial_video_framework':'social_video_brief';
  const videoInstructions:Record<string,string>={
    intro_video_script:`**DeAnna Intro Video Script** \u2014 60-90 second script for DeAnna's course introduction. Opening hook, who this is for, what they'll achieve using the DRU AI Transformation Pathway\u2122, one credential reference, CTA to assessment.druaiconsulting.com.`,
    course_module_video:`**Course Module Video Brief** \u2014 Production brief for one module video in From Confusion to Confident with AI\u2122. Learning objective, talking points (3-5 bullets), on-screen graphics needed, estimated runtime (8-12 min).`,
    testimonial_video_framework:`**Testimonial Video Framework** \u2014 Question sequence for client testimonial videos (5-7 questions). Structure: before state \u2192 discovery of DRU CLEAR\u2122 \u2192 transformation \u2192 measurable outcome \u2192 recommendation.`,
    social_video_brief:`**Social Video Brief** \u2014 30-60 second video concept for LinkedIn or Instagram Reels. First 3-second hook, core message tied to one DRU framework, visual direction, CTA to assessment.druaiconsulting.com.`,
  };
  return await runAgentToCSQ('amelia','Amelia Santos','Client Delivery','daily_video_production','video_production',`You are Amelia Santos, Training Video Producer for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\nVIDEO TYPE: ${videoType}\n${videoInstructions[videoType]}\n**Production Checklist** \u2014 Three technical requirements for today's video type.\n**Today's Video Priority** \u2014 Single most important video asset to advance today.`,'normal',0,null,1500);
}

// P8
async function runIsaiah(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  return await runAgentToCSQ('isaiah','Isaiah Carter','Customer Support','daily_issue_resolution','issue_resolution',`You are Isaiah Carter, Issue Resolution Specialist for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\n**Support Protocol** \u2014 Standard resolution flow for: (1) Assessment access issues at assessment.druaiconsulting.com, (2) Course access issues, (3) Diagnostic scheduling issues, (4) Billing/payment issues. One improvement per flow.\n**FAQ Development** \u2014 Top 3 anticipated support questions for launch week with complete answers.\n**Escalation Framework** \u2014 What Isaiah handles autonomously vs. what escalates to DeAnna.\n**Today's Support Priority** \u2014 Single most important support infrastructure item before first paying client.`,'normal',0,null,1500);
}

async function runPriscilla(): Promise<string|null> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  return await runAgentToCSQ('priscilla','Priscilla Okonkwo','Customer Support','daily_multichannel_comms','multichannel_comms',`You are Priscilla Okonkwo, Multi-Channel Communication Specialist for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. Today: ${today}.\nTRADEMARK REQUIREMENT: Always include \u2122 on EVERY mention: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122. CRITICAL: 'AI Sales Mastery' must ALWAYS be written as 'AI Sales Mastery\u2122' \u2014 every single instance.\nCHANNELS: Email (druaiconsulting@gmail.com), SMS (GHL A2P 10DLC registered), Portal notifications (app.druaiconsulting.com), LinkedIn DM.\n**Channel Health** \u2014 Status and one improvement action per channel.\n**Communication Templates** \u2014 One ready-to-use template (150 words or fewer) for each: (1) Missed appointment follow-up, (2) Post-assessment welcome, (3) Diagnostic reminder.\n**Response Time Standards** \u2014 Recommended SLA per channel for a solo-founder AI consulting business.\n**Today's Communications Priority** \u2014 Single most important communication system improvement for today.`,'normal',0,null,1500);
}

// P9 — Community Connection
async function runDominique(): Promise<{csq_id:string|null;post_id:string|null}> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  return await runCCAgent('dominique','Dominique Carter','daily_leadership_insight','daily_insight','navigator','community_insight',
    `You are Dominique Carter, CLEAR Vision Team Lead for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write a DAILY LEADERSHIP WITH AI INSIGHT applying the DRU CLEAR\u2122 framework to a real AI leadership challenge executives face today. Audience: C-suite and senior leaders navigating AI adoption. 150-200 words. Structure: one sharp opening insight, DRU CLEAR\u2122 framework application (2-3 sentences), one executive reflection question. Close with: assessment.druaiconsulting.com`);
}

async function runElijah(): Promise<{csq_id:string|null;post_id:string|null}> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const dayOfWeek=new Date().toLocaleDateString('en-US',{weekday:'long',timeZone:'America/Chicago'});
  const components:Record<string,string>={Monday:'Clarity \u2014 defining AI vision and success metrics',Tuesday:'Leadership \u2014 guiding teams through AI transformation',Wednesday:'Execution \u2014 deploying AI systematically and at scale',Thursday:'Acceleration \u2014 compounding AI gains over time',Friday:'Results \u2014 measuring and communicating AI ROI'};
  const component=components[dayOfWeek]??'Clarity \u2014 defining AI vision and success metrics';
  return await runCCAgent('elijah','Elijah Brooks','framework_micro_lesson','framework_lesson','navigator','community_lesson',
    `You are Elijah Brooks, Framework Educator for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write a FRAMEWORK MICRO-LESSON on today's DRU CLEAR\u2122 component: ${component}. 200-250 words. Cover: what this component means in practice, why executives consistently underinvest in it, one practical application exercise completable in under 10 minutes. End with "Today's Micro-Action:" (one sentence). CTA: assessment.druaiconsulting.com`);
}

async function runSolange(): Promise<{csq_id:string|null;post_id:string|null}> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  return await runCCAgent('solange','Solange Dupont','daily_action_challenge','action_challenge','navigator','community_challenge',
    `You are Solange Dupont, 5D Elevation Team Lead for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write TODAY'S ACTION CHALLENGE using the 5D Leadership\u2122 framework. 150-200 words. Structure: bold Challenge Statement (one sentence), context explaining why this matters for AI-era leaders (2-3 sentences), 3-step challenge instructions numbered (each doable in under 10 minutes), expected outcome, 24-hour commitment close. CTA: assessment.druaiconsulting.com`);
}

async function runIsaiahWebb(): Promise<{csq_id:string|null;post_id:string|null}> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const dayOfWeek=new Date().toLocaleDateString('en-US',{weekday:'long',timeZone:'America/Chicago'});
  const dimensions:Record<string,string>={Monday:'Direction \u2014 establishing clear AI vision and purpose',Tuesday:'Development \u2014 building AI capability and team fluency',Wednesday:'Discipline \u2014 creating AI governance and consistency',Thursday:'Distinction \u2014 differentiating through AI-powered leadership',Friday:'Dominance \u2014 achieving and sustaining AI competitive advantage'};
  const dimension=dimensions[dayOfWeek]??'Direction \u2014 establishing clear AI vision and purpose';
  return await runCCAgent('isaiah_webb','Isaiah Webb','weekly_framework_training','framework_training','navigator','community_training',
    `You are Isaiah Webb, 5D Elevation Trainer for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write FRAMEWORK TRAINING CONTENT on today's 5D Leadership\u2122 dimension: ${dimension}. 250-300 words. Include: concept deep-dive (what it really means for AI-era executives), one real-world scenario where this dimension is tested, one skill-building exercise, this week's leadership reflection journal prompt. Challenge the executive audience. CTA: assessment.druaiconsulting.com`);
}

async function runNadia(): Promise<{csq_id:string|null;post_id:string|null}> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  return await runCCAgent('nadia','Nadia Osei','strategic_edge_insight','strategic_edge','navigator','community_edge',
    `You are Nadia Osei, Culture DNA Strategist for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write DEANNA'S STRATEGIC EDGE \u2014 premium insider intelligence for Navigator subscribers. 200-250 words. This content must feel exclusive and worth the subscription. Reveal one strategic insight about AI leadership culture that gives executives a genuine competitive edge. Apply the 5C Cultural DNA\u2122 framework lens. End with one specific action that DeAnna's clients take that executives operating without this framework do not. CTA: assessment.druaiconsulting.com`);
}

async function runVictor(): Promise<{csq_id:string|null;post_id:string|null}> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  return await runCCAgent('victor','Victor Reyes','community_engagement_post','daily_insight','navigator','community_engagement',
    `You are Victor Reyes, Culture DNA Community Builder for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write a COMMUNITY ENGAGEMENT POST that sparks meaningful discussion among Navigator and Accelerator subscribers. 150-200 words. Include: one bold observation about AI leadership culture that most executives won't say out loud, a 5C Cultural DNA\u2122 framework lens applied to that observation, one community discussion question (formatted in bold). Make subscribers feel seen, challenged, and part of something significant. CTA: assessment.druaiconsulting.com`);
}

async function runSasha(): Promise<{csq_id:string|null;post_id:string|null}> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  return await runCCAgent('sasha','Sasha Kim','ai_sales_mastery_insight','framework_lesson','accelerator','community_lesson',
    `You are Sasha Kim, Revenue Intelligence Specialist for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write an EXCLUSIVE AI SALES MASTERY\u2122 INSIGHT for Accelerator subscribers only. 200-250 words. Premium revenue intelligence \u2014 tactical, specific, immediately applicable. Cover: one AI-powered revenue strategy executives can implement this week, one conversion insight specific to B2B consulting and leadership development sales, one revenue metric to track and benchmark. Frame through the AI Sales Mastery\u2122 framework. Make it worth the Accelerator investment. CTA: assessment.druaiconsulting.com`);
}

async function runTariq(): Promise<{csq_id:string|null;post_id:string|null}> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const dayOfWeek=new Date().toLocaleDateString('en-US',{weekday:'long',timeZone:'America/Chicago'});
  const pdfTopics:Record<string,string>={Monday:'The Executive AI Readiness Checklist \u2014 10 Non-Negotiables Before You Deploy AI',Tuesday:'The 5-Step AI Implementation Roadmap Using the DRU AI Transformation Pathway\u2122',Wednesday:'AI ROI Measurement Framework \u2014 What to Track and How to Report It',Thursday:'Executive AI Communication Templates \u2014 5 Messages Every Leader Needs Ready',Friday:'AI Leadership Culture Assessment \u2014 Using 5C Cultural DNA\u2122 to Diagnose Your Team'};
  const topic=pdfTopics[dayOfWeek]??'The Executive AI Readiness Checklist \u2014 10 Non-Negotiables Before You Deploy AI';
  return await runCCAgent('tariq','Tariq Oladele','weekly_pdf_briefing','pdf_downloadable','accelerator','community_pdf',
    `You are Tariq Oladele, Revenue Intelligence Analyst for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
Write the full content for this week's ACCELERATOR-EXCLUSIVE BRANDED FRAMEWORK PDF. Title: "${topic}". 300-400 words of structured, publication-ready content. Include: executive summary (2-3 sentences), numbered key points or steps (4-6 items each with brief explanation), framework connection (which DRU framework applies and how), one immediate action item, footer: "A resource from DeAnna R. Upshaw, AI Authority \u2014 assessment.druaiconsulting.com". Write the actual PDF content \u2014 no meta-commentary.`);
}

async function runZoe(): Promise<{csq_id:string|null;post_id:string|null}> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const url=process.env.VITE_SUPABASE_URL; const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  let recentPostsSummary='No recent community posts available.';
  if (url&&key){
    const since=new Date(); since.setHours(since.getHours()-48);
    const r=await fetch(`${url}/rest/v1/community_posts?published_at=gte.${since.toISOString()}&order=published_at.desc&limit=10`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
    if (r.ok){const posts=await r.json();if (posts.length>0) recentPostsSummary=posts.map((p:any)=>`${p.agent_name} (${p.post_type}, ${p.tier_required}): ${p.title}`).join('\n');}
  }
  return await runCCAgent('zoe','Zoe Beaumont','daily_community_facilitation','strategic_edge','navigator','community_edge',
    `You are Zoe Beaumont, Community Connection Leader for DRU AI Consulting. Today: ${today}.
TRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
RECENT COMMUNITY ACTIVITY (last 48 hours):
${recentPostsSummary}
Your role is COMMUNITY FACILITATOR LEADER. Write a daily community leadership post (200-250 words) that: (1) Acknowledges the community's engagement with recent content, (2) Sets the tone and intention for today with one leadership frame, (3) Creates genuine connection between members. Voice: warm authority. You are DeAnna's representative in the community.
After the post, on a new line write: "UPSELL SIGNAL: [one sentence identifying any pattern in today's community activity that suggests a Navigator subscriber is ready for Accelerator \u2014 route to Aaliyah Foster for outreach]"
CTA: assessment.druaiconsulting.com`);
}

async function runMicah(): Promise<{csq_id:string|null;post_id:string|null}> {
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const url=process.env.VITE_SUPABASE_URL; const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  let memberContext='No recent member data available.';
  if (url&&key){
    const r=await fetch(`${url}/rest/v1/profiles?tier=in.(navigator,accelerator)&order=updated_at.desc&limit=5`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});
    if (r.ok){const members=await r.json();if (members.length>0) memberContext=`Active members: ${members.length} navigator/accelerator subscribers. Recent activity logged.`;}
  }
  return await runCCAgent('micah','Micah Santos','daily_member_experience','daily_insight','navigator','community_engagement',
    `You are Micah Santos, Member Experience Manager for DRU AI Consulting's Community Connection division. Today: ${today}.
TRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.
SERVICE CLASSES: All content within Classes 35, 41, 42 only.
MEMBER CONTEXT: ${memberContext}
Write a DAILY MEMBER EXPERIENCE post (150-200 words) that makes every subscriber feel valued, seen, and motivated to engage. Rotate formats: (1) Warm welcome and community orientation for new members, (2) Member milestone acknowledgment and encouragement, (3) Community connection prompt that invites sharing, (4) Gratitude and momentum post celebrating community growth. Reference where subscribers likely are in the DRU AI Transformation Pathway\u2122. Voice: warm, encouraging, community-focused.
After the post, on a new line write: "UPSELL SIGNAL: [one sentence identifying any behavioral pattern suggesting a navigator subscriber may be ready for Accelerator \u2014 route to Aaliyah Foster for outreach]"
CTA: assessment.druaiconsulting.com`);
}

// Aaliyah CC Outreach \u2014 fires GHL webhook based on upsell signal type
async function runAaliyahCCOutreach(signalType: string, contactEmail: string, contactFirstName: string, contactPhone: string): Promise<void> {
  const webhookUrl = AALIYAH_CC_ROUTING[signalType];
  if (!webhookUrl) {
    console.warn(`[aaliyah_cc] Unknown signal type: ${signalType}`);
    return;
  }
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: contactEmail,
        first_name: contactFirstName,
        phone: contactPhone,
        signal_type: signalType,
        source: 'cc_upsell_signal',
      }),
    });
    console.log(`[aaliyah_cc] Fired ${signalType} outreach for ${contactEmail}`);
  } catch (error) {
    console.error(`[aaliyah_cc] Webhook failed for ${signalType}:`, error);
  }
}

// Command Chain \u2014 Isabella
async function runIsabella(): Promise<{reviewed:number;cleared:number;sent_back:number;rejected:number}> {
  const pending=await getCSQItems('pending');
  console.log(`[isabella] Reviewing ${pending.length} pending items fully parallel (Sonnet)...`);
  if (pending.length===0) return {reviewed:0,cleared:0,sent_back:0,rejected:0};
  let cleared=0; let sentBack=0; let rejected=0;

  const reviewResults=await Promise.all(pending.map(async(item)=>{
    try {
      const raw=await callTwin(`${GENIUS_MODE}

You are Isabella Moreno, Director of Compliance for DRU AI Consulting.

RESPONSIBILITIES:
1. Every DRU proprietary framework name must include \u2122
2. Content stays within Classes 35, 41, 42
3. Flag content outside these classes

DRU PROPRIETARY MARKS (always \u2122): DRU CLEAR\u2122 | DRU AI Leadership Ecosystem\u2122 | DRU AI Transformation Pathway\u2122 | 5C Cultural DNA\u2122 | 5D Leadership\u2122 | AI Sales Mastery\u2122 | From Confusion to Confident with AI\u2122

BUSINESS NAME \u2014 NOT A TRADEMARK: 'DRU AI Consulting' is the registered business name. It does NOT require \u2122. Do NOT flag it.

CLEARING STANDARD:
- All marks with \u2122 AND content within Classes 35/41/42 \u2192 cleared:true
- Missing \u2122 \u2192 cleared:false, state exactly which mark and where
- Outside classes \u2192 cleared:false, state exactly what

LEGAL & FINANCE EXCEPTION: Content from the Legal & Finance division (Marcus Chen, Amara Okafor, Diego Reyes, Yuki Tanaka) is INTERNAL OPERATIONAL advisory for DeAnna only. Check \u2122 marks and service class usage as normal. Do NOT flag the surrounding operational subject matter (tax advice, financial planning, legal counsel) as a class violation \u2014 this is internal business advisory. If \u2122 marks are correct, return cleared:true.

COMMUNITY CONNECTION EXCEPTION: Content from the Community Connection division (Dominique Carter, Elijah Brooks, Solange Dupont, Isaiah Webb, Nadia Osei, Victor Reyes, Sasha Kim, Tariq Oladele, Zoe Beaumont, Micah Santos) is educational community content for Navigator and Accelerator subscribers. Framework lessons, action challenges, daily insights, strategic edge posts, and PDF content are firmly within Class 41 (educational) and Class 35 (community facilitation/business development). UPSELL SIGNAL notes embedded in Zoe and Micah's outputs are internal routing instructions for the command chain \u2014 do NOT flag them as class violations. If \u2122 marks are correct and content is educational or community facilitation in nature, return cleared:true.

AGENT: ${item.agent_name} | TASK: ${item.task}
CONTENT: ${item.raw_output}

Output ONLY this JSON:
{"cleared":true,"flags":"none","correction_notes":"Content reviewed. All marks correct. Within Classes 35/41/42."}
OR: {"cleared":false,"flags":"specific issue","correction_notes":"Exact correction instruction"}`,600);
      const result=JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0]??'null');
      return {item,result,error:null};
    } catch(error){console.error(`[isabella] Sonnet call failed for ${item.agent_name}:`,error);return {item,result:null,error};}
  }));

  await Promise.all(reviewResults.map(async({item,result})=>{
    if (!result) return;
    if (result.cleared){
      cleared++;
      await updateCSQ(item.id,{isabella_flags:result.flags??'none',isabella_cleared_at:new Date().toISOString(),status:'isabella_cleared'});
    } else {
      const retryCount=item.retry_count??0;
      if (retryCount>=2){
        rejected++;
        await updateCSQ(item.id,{isabella_flags:result.flags,correction_notes:result.correction_notes,governance_cleared:false,status:'rejected'});
        console.warn(`[isabella] HARD REJECT: ${item.agent_name} \u2014 ${result.flags}`);
      } else {
        sentBack++;
        await Promise.all([
          updateCSQ(item.id,{isabella_flags:result.flags,correction_notes:result.correction_notes,status:'needs_correction'}),
          runCorrectionAgent(item,result.correction_notes,retryCount+1),
        ]);
        console.log(`[isabella] Sent back to ${item.agent_name} (attempt ${retryCount+1})`);
      }
    }
  }));

  console.log(`[isabella] ${pending.length} reviewed: ${cleared} cleared, ${sentBack} sent back, ${rejected} rejected`);
  return {reviewed:pending.length,cleared,sent_back:sentBack,rejected};
}

// Command Chain \u2014 Governance Panel
async function runGovernancePanel(): Promise<{reviewed:number;cleared:number;blocked:number}> {
  const items=await getCSQItems('isabella_cleared');
  console.log(`[governance] Reviewing ${items.length} Isabella-cleared items...`);
  if (items.length===0) return {reviewed:0,cleared:0,blocked:0};
  let cleared=0; let blocked=0;
  const updates:Promise<void>[]=[];
  for (const item of items){
    try {
      const isInternal=INTERNAL_CATEGORIES.includes(item.category);
      const isClientFacing=CLIENT_FACING_CATEGORIES.includes(item.category);
      let rulesBlock='';
      if (isInternal){rulesBlock=`INTERNAL OPERATIONAL CONTENT. Goes to AI Twin only. Never published.\nBLOCK ONLY IF: (1) specific factual error misleading DeAnna, (2) false credential claim about DeAnna, (3) named contractual obligation, (4) false financial figure vs known pricing: Strategic Diagnostic $3,497 | Executive Diagnostic $4,997 | Course $497-$1,497.\nIf NONE present, MUST return cleared:true.`;}
      else if (isClientFacing){rulesBlock=`CLIENT-FACING CONTENT. Will be published or sent to clients/community subscribers.\nBLOCK ONLY IF: (1) income guarantee without disclaimer, (2) false credential claim, (3) named privacy violation, (4) contractual guarantee creating legal liability, (5) false financial figure vs known pricing.\nIf NONE present, MUST return cleared:true.`;}
      else{rulesBlock=`Unclassified. Apply internal rules. BLOCK ONLY IF factual error, false credential, named contractual obligation, or false financial figure. If NONE, MUST return cleared:true.`;}
      const raw=await callAnthropic(`${GENIUS_MODE}\nYou are the AI Governance and Legal & Finance panel for DRU AI Consulting. Isabella has already cleared trademark and service class compliance \u2014 FINAL. Do NOT re-check.\n${rulesBlock}\nAGENT: ${item.agent_name} | DIVISION: ${item.division} | CATEGORY: ${item.category} | TASK: ${item.task}\nCONTENT: ${item.raw_output}\nOutput ONLY this JSON:\nIf cleared: {"cleared":true,"compliance_score":9,"governance_notes":"Panel reviewed. No blocking conditions present.","legal_notes":"No legal risk detected.","flags":"none"}\nIf blocked: {"cleared":false,"compliance_score":3,"governance_notes":"Condition violated: [exact text]","legal_notes":"[issue]","flags":"[exact phrase]"}`,800);
      const result=JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0]??'null');
      if (!result) throw new Error('Governance response unparseable');
      if (result.cleared){cleared++;updates.push(updateCSQ(item.id,{governance_cleared:true,compliance_score:result.compliance_score??8,governance_notes:result.governance_notes??'',legal_notes:result.legal_notes??'',governance_flags:result.flags??'none',governance_cleared_at:new Date().toISOString(),status:'governance_cleared'}));}
      else{blocked++;updates.push(updateCSQ(item.id,{governance_cleared:false,governance_notes:result.governance_notes??'Blocked',governance_flags:result.flags??'review_failed',governance_cleared_at:new Date().toISOString(),status:'rejected'}));}
    } catch(error){console.error(`[governance] Failed item ${item.id}:`,error);blocked++;updates.push(updateCSQ(item.id,{governance_cleared:false,governance_notes:'Governance review failed.',governance_cleared_at:new Date().toISOString(),status:'governance_error'}));}
  }
  await Promise.all(updates);
  console.log(`[governance] ${items.length} reviewed: ${cleared} cleared, ${blocked} blocked`);
  return {reviewed:items.length,cleared,blocked};
}

// Command Chain \u2014 Command Layer (Raymond + Travis + Priya)
async function runCommandLayer(): Promise<{reviewed:number}> {
  const items=await getCSQItems('governance_cleared');
  console.log(`[command_layer] Reviewing ${items.length} governance-cleared items...`);
  if (items.length===0) return {reviewed:0};
  const updates:Promise<void>[]=[];
  for (const item of items){
    try {
      const rawRaymond=await callAnthropic(`${GENIUS_MODE}\nYou are Raymond Holloway, Chief of Staff for DRU AI Consulting. Content cleared by Isabella and Governance. Assess strategic priority.\nAGENT: ${item.agent_name} (${item.division}) | TASK: ${item.task}\nCONTENT: ${item.raw_output}\nNOTE: If content contains "UPSELL SIGNAL:" \u2014 this is from Community Connection facilitators Zoe Beaumont or Micah Santos. Flag priority as 'high' and note in your action to route to Aaliyah Foster in Revenue & Growth for outreach nurture.\nOutput ONLY this JSON: {"priority":"normal","action":"route_to_twin","notes":"one strategic sentence for the Twin"}`,400);
      const raymond=JSON.parse(rawRaymond.match(/\{[\s\S]*\}/)?.[0]??'null');
      const rawTravis=await callAnthropic(`${GENIUS_MODE}\nYou are Travis Weston, Assistant Chief of Staff for DRU AI Consulting. Package this for the AI Twin.\nAGENT: ${item.agent_name} | RAYMOND'S NOTES: ${raymond?.notes??''}\nCONTENT: ${item.raw_output}\nOutput ONLY this JSON: {"organized":true,"package_notes":"one sentence on how this fits today's briefing"}`,400);
      const travis=JSON.parse(rawTravis.match(/\{[\s\S]*\}/)?.[0]??'null');
      const rawPriya=await callAnthropic(`${GENIUS_MODE}\nYou are Priya Sharma, Executive Assistant to DeAnna R. Upshaw. Flag anything time-sensitive or requiring DeAnna's personal action today.\nAGENT: ${item.agent_name} | TASK: ${item.task}\nCONTENT: ${item.raw_output}\nIn 1-2 sentences, add your executive perspective.`,200);
      updates.push(updateCSQ(item.id,{raymond_reviewed:true,raymond_notes:raymond?.notes??'',raymond_priority:raymond?.priority??'normal',raymond_action:raymond?.action??'route_to_twin',travis_notes:travis?.package_notes??'',priya_notes:rawPriya.trim(),command_approved_at:new Date().toISOString(),status:'command_approved',priority:raymond?.priority??'normal'}));
    } catch(error){console.error(`[command_layer] Failed item ${item.id}:`,error);}
  }
  await Promise.all(updates);
  console.log(`[command_layer] ${items.length} items command-approved`);
  return {reviewed:items.length};
}

// Command Chain \u2014 AI Twin Synthesis
async function sendDivisionNotification(division:string,approvalId:string,agentCount:number,triggeredAt:string): Promise<void> {
  const webhookUrl=process.env.GHL_NOTIFICATION_WEBHOOK_URL;
  if (!webhookUrl) return;
  const label=division==='Command'?'Daily Briefing':`${division} Briefing`;
  const subject=`DRU AI Consulting \u2014 ${label} Ready for Review`;
  const sms=`DRU AI Consulting | ${label} is ready. ${agentCount} agent${agentCount>1?'s':''} cleared through the full chain.\n\nReview: app.druaiconsulting.com/admin-approvals`;
  try {
    await fetch(webhookUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'druaiconsulting@gmail.com',phone:'+19796186671',first_name:'DeAnna',last_name:'Upshaw',agent_name:"DeAnna's AI Twin",division,task:label,approval_id:approvalId,summary:`${label} is ready for your review.`,triggered_at:triggeredAt,review_url:'https://app.druaiconsulting.com/admin-approvals',sms_body:sms,email_subject:subject,email_body:`${subject}\n\nReview and approve:\nhttps://app.druaiconsulting.com/admin-approvals\n\n\u2014 DRU AI Leadership Ecosystem\u2122`})});
  } catch(error){console.warn(`[twin] Notification failed for ${division} (non-fatal):`,error);}
}

async function runTwinSynthesis(): Promise<{cards_created:number;items_synthesized:number}> {
  const items=await getCSQItems('command_approved');
  console.log(`[twin] Synthesizing ${items.length} command-approved items...`);
  if (items.length===0){console.log('[twin] No items to synthesize today.');return {cards_created:0,items_synthesized:0};}
  const today=new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});
  const byDivision:Record<string,CSQItem[]>={};
  for (const item of items){if (!byDivision[item.division]) byDivision[item.division]=[];byDivision[item.division].push(item);}
  const triggeredAt=new Date().toISOString();
  const approvalMap:Record<string,string>={};
  const allSummary=items.map(i=>`${i.agent_name} (${i.division}): ${i.raw_output.slice(0,150)}... Raymond: ${i.raymond_notes??''} | Priya: ${i.priya_notes??''}`).join('\n');

  const dailySynthesisPromise=callTwin(`You are DeAnna R. Upshaw's AI Twin. Today: ${today}.\nWrite the Daily Briefing card with ONLY these three sections:\n\n## Daily Briefing \u2014 ${today}\n\n**Executive Summary**\n3-4 sentences ("My team has...") \u2014 what was accomplished today across all divisions.\n\n**Decisions Needed**\nBullet list of anything requiring DeAnna's personal action today. If none: "No decisions required today \u2014 team is executing."\n\n**Tomorrow's Priorities**\n3-5 specific bullets of what the team is positioned to execute tomorrow.\n\nTODAY'S TEAM WORK:\n${allSummary}`,1200)
    .then(async synthesis=>{
      const id=await writeApproval({source:'twin_synthesis',trigger_type:'cron_twin_synthesis',agent_name:"DeAnna's AI Twin",agent_role:'Master Orchestrator',division:'Command',task_brief:`Daily Briefing \u2014 ${today}`,output:synthesis,status:'pending',notify_deanna:true,priority:items.some(i=>i.priority==='high')?'high':'normal',category:'daily_briefing',platform:null});
      if (id){approvalMap['Command']=id;await sendDivisionNotification('Command',id,items.length,triggeredAt);}
      console.log(`[twin] Daily Briefing card written`);
    })
    .catch(err=>{console.error('[twin] Daily Briefing synthesis failed:',err);});

  const divisionSynthesisPromises=Object.entries(byDivision).map(async([division,divItems])=>{
    const content=divItems.map(i=>`**${i.agent_name}** (${i.task.replace(/_/g,' ')}):\n${i.raw_output}\nRaymond: ${i.raymond_notes??''} | Travis: ${i.travis_notes??''} | Priya: ${i.priya_notes??''}`).join('\n\n---\n\n');
    try {
      const synthesis=await callTwin(getDivisionPrompt(division,today,content),1500);
      const id=await writeApproval({source:'twin_synthesis',trigger_type:'cron_twin_synthesis',agent_name:"DeAnna's AI Twin",agent_role:'Master Orchestrator',division,task_brief:`${division} \u2014 ${divItems.length} agent${divItems.length>1?'s':''} | ${today}`,output:synthesis,status:'pending',notify_deanna:true,priority:divItems.some(i=>i.priority==='high')?'high':'normal',category:getDivisionCategory(division),platform:null});
      if (id){approvalMap[division]=id;
        if (divItems.some(i=>i.priority==='high')){
          await sendDivisionNotification(division,id,divItems.length,triggeredAt);
        }
        console.log(`[twin] ${division} card written`);}
    } catch(err){console.error(`[twin] ${division} synthesis failed:`,err);}
  });

  await Promise.all([dailySynthesisPromise,...divisionSynthesisPromises]);

  for (const item of items){
    if (SOCIAL_DIVISIONS.includes(item.division)&&CLIENT_FACING_CATEGORIES.includes(item.category)){
      try {
        let postContent=item.raw_output;
        const complianceCutoffs=['## COMPLIANCE AUDIT','COMPLIANCE AUDIT','## Isabella','CORRECTION REQUIRED','\n---\n'];
        for (const cutoff of complianceCutoffs){const idx=postContent.indexOf(cutoff);if (idx!==-1) postContent=postContent.slice(0,idx).trim();}
        postContent=postContent.replace(/\*\*(.*?)\*\*/g,'$1').replace(/\*(.*?)\*/g,'$1');
        postContent=postContent.split(/\n{2,}/).map((p:string)=>p.replace(/\n/g,' ').trim()).filter((p:string)=>p.length>0).join('\n\n');
        const platformLabel=getPlatformLabel(item.category);
        await writeApproval({source:`${item.agent_id}_social`,trigger_type:item.category,agent_name:item.agent_name,agent_role:item.division,division:item.division,task_brief:`${platformLabel} \u2014 ${item.agent_name} | ${today}`,output:postContent,status:'pending',notify_deanna:false,priority:'normal',category:'social',platform:platformLabel});
        console.log(`[twin] Social card: ${item.agent_name} \u2192 ${platformLabel}`);
      } catch(err){console.error(`[twin] Social card failed for ${item.agent_name}:`,err);}
    }
  }

  for (const item of items){
    const divisionApprovalId=approvalMap[item.division]??null;
    await updateCSQ(item.id,{twin_processed:true,twin_synthesis:`Division card: ${item.division}`,approval_id:divisionApprovalId,twin_processed_at:new Date().toISOString(),status:'twin_processed'});
  }

  const cardsCreated=Object.keys(approvalMap).length;
  console.log(`[twin] Synthesis complete \u2014 ${cardsCreated+1} division cards written`);
  return {cards_created:cardsCreated+1,items_synthesized:items.length};
}

// Main Handler
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req:any,res:any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, x-cron-secret');
  if (req.method==='OPTIONS'){res.status(200).end();return;}
  if (req.method==='GET'&&req.query?.trigger_type){
    req.body={trigger_type:req.query.trigger_type,source:'vercel_cron'};
  } else if (req.method!=='POST'){res.status(405).json({error:'Method not allowed'});return;}
  const incomingSecret=req.headers['x-cron-secret'];
  if (incomingSecret!==undefined&&incomingSecret!==process.env.CRON_SECRET){res.status(401).json({error:'Unauthorized'});return;}
  const payload:TriggerPayload=req.body;
  if (!payload?.trigger_type){res.status(400).json({error:'trigger_type is required'});return;}
  const route=AGENT_ROUTES[payload.trigger_type];
  if (!route){res.status(400).json({error:`Unknown trigger_type: ${payload.trigger_type}`});return;}
  const sourceLabel=payload.source??'webhook';
  const triggeredAt=new Date().toISOString();
  console.log(`[ghl-agent-trigger] ${route.agent_name} | ${route.division} | ${sourceLabel}`);

  // Command chain
  if (route.pipeline==='cmd_isabella'){const r=await runIsabella();res.status(202).json({success:true,agent:route.agent_name,...r});}
  else if (route.pipeline==='cmd_governance'){const r=await runGovernancePanel();res.status(202).json({success:true,agent:route.agent_name,...r});}
  else if (route.pipeline==='cmd_command_layer'){const r=await runCommandLayer();res.status(202).json({success:true,agent:route.agent_name,...r});}
  else if (route.pipeline==='cmd_twin'){const r=await runTwinSynthesis();res.status(202).json({success:true,agent:route.agent_name,...r});}
  // P1 Revenue & Growth
  else if (route.pipeline==='p1_omar'){const omar=await runOmar();const ryan=await runRyan(omar);res.status(202).json({success:true,agent:route.agent_name,leads_scanned:omar.total_leads_scanned,high_intent:omar.high_intent_leads.length,crm_updates:ryan.crm_updates});}
  else if (route.pipeline==='p1_serena'){const id=await runAgentToCSQ('serena','Serena Jackson','Revenue & Growth','morning_coaching_briefing','coaching',`You are Serena Jackson, Business Coach for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority.\nTRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122 (Discover Diagnose Design Deploy Dominate), 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\nGenerate DeAnna's morning business coaching briefing. Today: ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'})}. Include: strategic focus, coaching insight, mindset anchor, one actionable growth move.`);res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p1_mateo'){const id=await runAgentToCSQ('mateo','Mateo Gonzalez','Revenue & Growth','sales_pipeline_review','sales_support',`You are Mateo Gonzalez, Sales Support Agent for DRU AI Consulting.\nTRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\nOFFERS: DRU CLEAR\u2122 AI Readiness Assessment (free) | Strategic Diagnostic\u2122 ($3,497) | Executive Diagnostic\u2122 ($4,997) | From Confusion to Confident with AI\u2122 Course ($497-$1,497).\nInclude: sales focus, pipeline health, follow-up actions, sales tip, objection handling. All leads to assessment.druaiconsulting.com first.`,'normal',0,null,3000);res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p1_aaliyah'){
    const urlA=process.env.VITE_SUPABASE_URL; const keyA=process.env.SUPABASE_SERVICE_ROLE_KEY; let leadContext='No lead data available today.';
    if (urlA&&keyA){const todayA=new Date().toISOString().split('T')[0];const r=await fetch(`${urlA}/rest/v1/chief_of_staff_queue?run_date=eq.${todayA}&agent_id=eq.ryan&order=created_at.desc&limit=1`,{headers:{apikey:keyA,Authorization:`Bearer ${keyA}`}});if (r.ok){const d=await r.json();if (d?.[0]?.raw_output) leadContext=d[0].raw_output;}}
    const id=await runAgentToCSQ('aaliyah','Aaliyah Foster','Revenue & Growth','personalized_outreach_messages','outreach',`You are Aaliyah Foster, Personalized Outreach Agent for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority.\nTRADEMARK REQUIREMENT: Always include \u2122: DRU CLEAR\u2122, DRU AI Leadership Ecosystem\u2122, DRU AI Transformation Pathway\u2122, 5C Cultural DNA\u2122, 5D Leadership\u2122, AI Sales Mastery\u2122, From Confusion to Confident with AI\u2122.\nWrite personalized outreach for each high-intent lead \u2014 LinkedIn DM (150 words max) and email (subject + 200 word body). Mention DRU CLEAR\u2122 AI Readiness Assessment and assessment.druaiconsulting.com. If no high-intent leads, write a warm outreach template.\nLead Intelligence:\n${leadContext}`,'high');
    res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p1_jaylen'){const id=await runAgentToCSQ('jaylen','Jaylen Brooks','Revenue & Growth','email_campaign_content','email_marketing',`You are Jaylen Brooks, Email Marketing Agent for DRU AI Consulting. Generate today's email marketing content. Audience: executives navigating AI. Offers: DRU CLEAR\u2122 (free), Strategic Diagnostic\u2122 ($3,497), Executive Diagnostic\u2122 ($4,997), From Confusion to Confident with AI\u2122 Course ($497-$1,497).\nRotate: nurture email, re-engagement, or promotional. Include: subject line + A/B variant, preview text, body (300 words max). CTA: assessment.druaiconsulting.com.`);res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p1_chloe'){const id=await runAgentToCSQ('chloe','Chloe Dubois','Revenue & Growth','daily_copy_asset','copywriting',`You are Chloe Dubois, Copy Writer for DRU AI Consulting. Generate one copy asset today. Rotate: ad copy, landing page headline+subhead+hero, CTA button variations (5 options), or testimonial prompt template. Brand: "AI Mastery. Leadership Clarity. Measurable Results." CTA destination: assessment.druaiconsulting.com. Every word earns its place.`);res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p1_zara'){const id=await runAgentToCSQ('zara','Zara Ahmed','Revenue & Growth','product_launch_readiness','product_launch',`You are Zara Ahmed, Product Launch Agent for DRU AI Consulting. Generate weekly product launch readiness report. Offers: DRU CLEAR\u2122 (free), Strategic Diagnostic\u2122 ($3,497), Executive Diagnostic\u2122 ($4,997), From Confusion to Confident with AI\u2122 Course, Daily Connections tiers. Assess: launch readiness, marketing gaps, one improvement recommendation, pricing insight, next week priority.`);res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p1_elena'){const id=await runAgentToCSQ('elena','Elena Vasquez','Revenue & Growth','product_knowledge_update','product_knowledge',`You are Elena Vasquez, Product Knowledge Agent for DRU AI Consulting. Generate weekly product knowledge update. Include: 5 executive FAQs, offer comparison guide (all starting with assessment.druaiconsulting.com), objection + response per offer, one positioning insight.`);res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p1_kwame'){const id=await runAgentToCSQ('kwame','Kwame Asante','Revenue & Growth','proposal_template_update','proposals',`You are Kwame Asante, Proposal Writer for DRU AI Consulting. Generate weekly proposal update. Include: executive summary template for Executive Diagnostic\u2122 ($4,997) in McKinsey-style, proposal outline for C-suite client, value proposition (3 versions: short/medium/long), one proposal best practice. Brand: DeAnna R. Upshaw \u2014 25+ years IT, 10+ years leadership development, AI Authority.`);res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  // P2 Content & Brand
  else if (route.pipeline==='p2_camila'){const count=await runCamila();res.status(202).json({success:true,agent:route.agent_name,posts_generated:count});}
  else if (route.pipeline==='p2_darius'){const id=await runDarius();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p2_ravi'){const today4=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'America/Chicago'});const id=await runAgentToCSQ('ravi','Ravi Gupta','Content & Brand','generate_design_brief','design_brief',`You are Ravi Gupta, Graphic Designer for DRU AI Consulting. Brand: Navy #0A2342, Gold #D4AF37, Magenta #C2185B. Fonts: Playfair Display (headlines), Inter (body). Generate creative design brief for today's LinkedIn visual. Include: visual concept, layout, color palette, image direction, typography, AI image generation prompt. Today: ${today4}. CTA destination: assessment.druaiconsulting.com.`);res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p2_yara'){
    const urlY=process.env.VITE_SUPABASE_URL; const keyY=process.env.SUPABASE_SERVICE_ROLE_KEY; let topPost='';
    if (urlY&&keyY){const mondayY=new Date();mondayY.setDate(mondayY.getDate()-mondayY.getDay()+1);const weekOfY=mondayY.toISOString().split('T')[0];const r=await fetch(`${urlY}/rest/v1/content_queue?week_of=eq.${weekOfY}&status=neq.queued&order=day_number.asc&limit=1`,{headers:{apikey:keyY,Authorization:`Bearer ${keyY}`}});if (r.ok){const q=await r.json();if (q.length>0) topPost=`${q[0].hook}\n\n${q[0].content}\n\n${q[0].hashtags}`;}}
    const id=await runAgentToCSQ('yara','Yara Mansour','Content & Brand','spanish_localization','localization',`You are Yara Mansour, Translator for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority. ${topPost?`Translate and localize for LATAM executives:\n\n${topPost}\n\nFull Spanish translation, localization notes, translated hashtags. Keep assessment.druaiconsulting.com in CTA.`:'Write an original LinkedIn post in Spanish for LATAM executives. Include assessment.druaiconsulting.com as CTA.'}`);
    res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p2_ingrid'){
    const urlI=process.env.VITE_SUPABASE_URL; const keyI=process.env.SUPABASE_SERVICE_ROLE_KEY; let weekContent='';
    if (urlI&&keyI){const mondayI=new Date();mondayI.setDate(mondayI.getDate()-mondayI.getDay()+1);const weekOfI=mondayI.toISOString().split('T')[0];const r=await fetch(`${urlI}/rest/v1/content_queue?week_of=eq.${weekOfI}&order=day_number.asc`,{headers:{apikey:keyI,Authorization:`Bearer ${keyI}`}});if (r.ok){const posts=await r.json();weekContent=posts.map((p:any)=>`Day ${p.day_number} (${p.framework_covered}): ${p.hook}`).join('\n');}}
    const id=await runAgentToCSQ('ingrid','Ingrid Larsen','Content & Brand','weekly_press_release','press_release',`You are Ingrid Larsen, Press Release Writer for DRU AI Consulting \u2014 DeAnna R. Upshaw, AI Authority, CEO/Founder. This week's content: ${weekContent||'AI leadership, DRU frameworks, executive AI adoption'}. Write AP-style press release. Include: FOR IMMEDIATE RELEASE / Headline / Subheadline / Lead paragraph / Body (2-3 paragraphs with DeAnna quotes) / Boilerplate mentioning assessment.druaiconsulting.com / Contact: druaiconsulting@gmail.com`);
    res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  // P3 Marketing
  else if (route.pipeline==='p3_nia'){const id=await runNia();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p3_luca'){const id=await runLuca();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p3_hyunji'){const id=await runHyunJi();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p3_andre'){const id=await runAndre();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  // P4 Legal & Finance
  else if (route.pipeline==='p4_amara'){const id=await runAmara();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p4_diego'){const id=await runDiego();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p4_yuki'){const id=await runYuki();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p4_marcus'){const id=await runMarcus();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  // P5 AI Governance
  else if (route.pipeline==='p5_khalid'){const id=await runKhalid();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p5_sofia'){const id=await runSofia();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p5_james'){const id=await runJames();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p5_meilin'){const id=await runMeiLin();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p5_rafael'){const id=await runRafael();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  // P6 HR
  else if (route.pipeline==='p6_naomi'){const id=await runNaomi();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p6_aiden'){const id=await runAiden();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p6_fatima'){const id=await runFatima();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  // P7 Client Delivery
  else if (route.pipeline==='p7_keisha'){const id=await runKeisha();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p7_marco'){const id=await runMarco();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p7_leila'){const id=await runLeila();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p7_jordan'){const id=await runJordan();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p7_simone'){const id=await runSimone();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p7_theo'){const id=await runTheo();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p7_amelia'){const id=await runAmelia();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  // P8 Customer Support
  else if (route.pipeline==='p8_isaiah'){const id=await runIsaiah();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  else if (route.pipeline==='p8_priscilla'){const id=await runPriscilla();res.status(202).json({success:true,agent:route.agent_name,csq_id:id});}
  // P9 Community Connection
  else if (route.pipeline==='p9_dominique'){const r=await runDominique();res.status(202).json({success:true,agent:route.agent_name,csq_id:r.csq_id,post_id:r.post_id});}
  else if (route.pipeline==='p9_elijah'){const r=await runElijah();res.status(202).json({success:true,agent:route.agent_name,csq_id:r.csq_id,post_id:r.post_id});}
  else if (route.pipeline==='p9_solange'){const r=await runSolange();res.status(202).json({success:true,agent:route.agent_name,csq_id:r.csq_id,post_id:r.post_id});}
  else if (route.pipeline==='p9_isaiah_webb'){const r=await runIsaiahWebb();res.status(202).json({success:true,agent:route.agent_name,csq_id:r.csq_id,post_id:r.post_id});}
  else if (route.pipeline==='p9_nadia'){const r=await runNadia();res.status(202).json({success:true,agent:route.agent_name,csq_id:r.csq_id,post_id:r.post_id});}
  else if (route.pipeline==='p9_victor'){const r=await runVictor();res.status(202).json({success:true,agent:route.agent_name,csq_id:r.csq_id,post_id:r.post_id});}
  else if (route.pipeline==='p9_sasha'){const r=await runSasha();res.status(202).json({success:true,agent:route.agent_name,csq_id:r.csq_id,post_id:r.post_id});}
  else if (route.pipeline==='p9_tariq'){const r=await runTariq();res.status(202).json({success:true,agent:route.agent_name,csq_id:r.csq_id,post_id:r.post_id});}
  else if (route.pipeline==='p9_zoe'){const r=await runZoe();res.status(202).json({success:true,agent:route.agent_name,csq_id:r.csq_id,post_id:r.post_id});}
  else if (route.pipeline==='p9_micah'){const r=await runMicah();res.status(202).json({success:true,agent:route.agent_name,csq_id:r.csq_id,post_id:r.post_id});}
  // CC Upsell Signal \u2014 Aaliyah routing
  else if (payload.trigger_type==='cc_upsell_signal'){
    const {signal_type,email,first_name,phone}=payload as any;
    await runAaliyahCCOutreach(signal_type,email,first_name,phone);
    res.status(202).json({success:true,agent:'Aaliyah Foster',signal_type});}
  // Fallback \u2014 travis-router
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
