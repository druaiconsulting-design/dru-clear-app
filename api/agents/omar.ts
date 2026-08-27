// ================================================================
// DRU AI Leadership Ecosystem™ — Omar Patel, Lead Scoring Agent
// File: api/agents/omar.ts
// Division: Revenue & Growth
// Role: Lead Scoring
//
// Task: Scan GHL for new contacts created in last 24 hours,
// score each lead 1–10 using AI, flag high-intent leads (7+),
// return scored data for Ryan to process.
//
// NOTE: This is a pure module — imported by ghl-agent-trigger.ts
// No default export handler — not a standalone Vercel function
// ================================================================

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION_ID = 'gl07I4JnbkGgW8zJprSz';

// Logs every real API call's actual token usage and cost to Supabase so spend
// is visible in the Intelligence Hub instead of estimated by hand.
async function logModelUsage(model: string, inputTokens: number, outputTokens: number): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const rate = model.startsWith('claude-sonnet') ? { in: 3, out: 15 } : { in: 1, out: 5 };
  const cost_usd = (inputTokens / 1_000_000) * rate.in + (outputTokens / 1_000_000) * rate.out;
  await fetch(`${url}/rest/v1/model_usage_log`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ source_file: 'omar', model, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd }) });
}

export interface ScoredLead {
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

export interface OmarResult {
  success: boolean;
  total_leads_scanned: number;
  scored_leads: ScoredLead[];
  high_intent_leads: ScoredLead[];
  run_date: string;
  error?: string;
}

async function fetchNewLeads(ghlApiKey: string): Promise<any[]> {
  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 24);
  const startAfterDate = yesterday.toISOString();

  const url = `${GHL_API_BASE}/contacts/?locationId=${GHL_LOCATION_ID}&startAfterDate=${encodeURIComponent(startAfterDate)}&limit=100`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${ghlApiKey}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`GHL contacts API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.contacts ?? [];
}

async function scoreLeads(leads: any[], anthropicApiKey: string): Promise<ScoredLead[]> {
  if (leads.length === 0) return [];

  const leadSummary = leads.map(l => ({
    id: l.id,
    name: `${l.firstName ?? ''} ${l.lastName ?? ''}`.trim(),
    email: l.email ?? '',
    phone: l.phone ?? '',
    source: l.source ?? 'unknown',
    tags: l.tags ?? [],
    customFields: l.customFields ?? [],
  }));

  const prompt = `You are Omar Patel, Lead Scoring Agent for DRU AI Consulting.

DRU AI Consulting serves executives, leaders, and business owners who need AI strategy, leadership development, and implementation support. Services range from $497 courses to $4,997 Executive Diagnostics.

Analyze these new leads and score each one 1–10 based on:
- Role/title seniority (executives, directors, founders = higher)
- Business context (B2B, professional services = higher)
- Source quality (referral, organic = higher than cold)
- Engagement signals from tags or custom fields

For each lead return:
- score (1–10)
- intent_level: "high" (7–10), "medium" (4–6), "low" (1–3)
- recommended_action: specific next step for this lead
- notes: brief rationale for the score

Leads to score:
${JSON.stringify(leadSummary, null, 2)}

Respond ONLY with a valid JSON array. No preamble, no markdown, no explanation. Format:
[{"contact_id":"...","name":"...","email":"...","phone":"...","source":"...","score":8,"intent_level":"high","recommended_action":"...","notes":"..."}]`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`Anthropic API error ${response.status}`);

  const data = await response.json();
  await logModelUsage('claude-haiku-4-5-20251001', data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0).catch(() => {});
  const text = data.content?.[0]?.text ?? '[]';

  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    console.error('[omar] Failed to parse scored leads:', text);
    return [];
  }
}

export async function runOmar(): Promise<OmarResult> {
  const ghlApiKey = process.env.GHL_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!ghlApiKey || !anthropicApiKey) {
    return {
      success: false,
      total_leads_scanned: 0,
      scored_leads: [],
      high_intent_leads: [],
      run_date: new Date().toISOString(),
      error: 'Missing GHL_API_KEY or ANTHROPIC_API_KEY',
    };
  }

  try {
    console.log('[omar] Fetching new GHL leads...');
    const rawLeads = await fetchNewLeads(ghlApiKey);
    console.log(`[omar] Found ${rawLeads.length} new leads`);

    if (rawLeads.length === 0) {
      return {
        success: true,
        total_leads_scanned: 0,
        scored_leads: [],
        high_intent_leads: [],
        run_date: new Date().toISOString(),
      };
    }

    console.log('[omar] Scoring leads with AI...');
    const scoredLeads = await scoreLeads(rawLeads, anthropicApiKey);
    const highIntentLeads = scoredLeads.filter(l => l.intent_level === 'high');

    console.log(`[omar] Scored ${scoredLeads.length} leads | High intent: ${highIntentLeads.length}`);

    return {
      success: true,
      total_leads_scanned: rawLeads.length,
      scored_leads: scoredLeads,
      high_intent_leads: highIntentLeads,
      run_date: new Date().toISOString(),
    };

  } catch (error) {
    console.error('[omar] Error:', error);
    return {
      success: false,
      total_leads_scanned: 0,
      scored_leads: [],
      high_intent_leads: [],
      run_date: new Date().toISOString(),
      error: String(error),
    };
  }
}
