// api/cmd-isabella.ts
// Isabella Moreno — Director of Compliance
// Runs every 30 minutes 8am-4pm UTC via dru-isabella-review-rolling
// Picks up pending items (48hr window, max 25 per run), Sonnet only
// FIX: extractJSON replaces greedy regex that was causing SyntaxError on complex content

import type { VercelRequest, VercelResponse } from "@vercel/node";
export const config = { maxDuration: 300 };

const GENIUS_MODE = `You operate in Genius Mode — think and respond at the level of a top 0.1% expert in your field. Apply deep logic, strategic frameworks, creative synthesis, and second-order thinking to every output. Never produce generic or surface-level work. Every sentence must earn its place.`;

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
`;

interface CSQItem {
  id: string; agent_id: string; agent_name: string; division: string;
  task: string; category: string; raw_output: string; priority: string;
  retry_count?: number; correction_notes?: string; parent_csq_id?: string;
  isabella_flags?: string;
}

// ── extractJSON: depth-tracking JSON extractor (fixes greedy regex SyntaxError) ──
function extractJSON(text: string): string {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in response');
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error('Unterminated JSON object in response');
}

// Sonnet — Isabella only
async function callTwin(prompt: string, maxTokens = 2000): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Twin error ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

// Haiku — correction agent
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

async function getCSQItems(status: string, limit?: number, afterDate?: string): Promise<CSQItem[]> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  let query = `${url}/rest/v1/chief_of_staff_queue?status=eq.${status}&order=created_at.asc`;
  if (afterDate) query += `&created_at=gte.${afterDate}`;
  if (limit) query += `&limit=${limit}`;
  const res = await fetch(query, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
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

async function getAgentKnowledge(): Promise<string> {
  let tmMarks: string[] = [];
  try {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const res = await fetch(`${url}/rest/v1/brand_marks?active=eq.true&order=created_at.asc`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (res.ok) { const data = await res.json(); tmMarks = (data as { mark: string }[]).map(m => m.mark).filter(Boolean); }
    }
  } catch (err) { console.error('[agentKnowledge] fetch error:', err); }
  if (tmMarks.length === 0) tmMarks = FALLBACK_TM_MARKS;
  const tmList = tmMarks.map(m => `  - ${m}`).join('\n');
  return `=== DRU AI CONSULTING — AGENT KNOWLEDGE BASE ===

PROTECTED IP MARKS — TM REQUIRED ON EVERY USE, NO EXCEPTIONS:
${tmList}

RULES: Every mark above MUST include TM every time. NO other terms carry TM.
Do NOT add TM to anything not on this list. 'DRU AI Consulting' = business name, NO TM.
REQUIRED CTA: assessment.druaiconsulting.com (ONLY entry point into the ecosystem)
${FRAMEWORK_KNOWLEDGE}
=== END AGENT KNOWLEDGE BASE ===`.trim();
}

async function runCorrectionAgent(item: CSQItem, correctionNotes: string, newRetryCount: number): Promise<void> {
  try {
    const agentKnowledge = await getAgentKnowledge();
    const output = await callAnthropic(
      `${GENIUS_MODE}\n\n${agentKnowledge}\n\nYou are ${item.agent_name}, working for DRU AI Consulting. Your previous submission for task "${item.task}" was returned with corrections:\nCORRECTION NOTES: ${correctionNotes}\nYOUR PREVIOUS OUTPUT: ${item.raw_output}\nProduce a corrected version. All protected marks require TM — full list is in the knowledge base above.\nOutput ONLY the corrected content. No compliance notes or metadata.`,
      1500
    );
    await writeToCSQ({
      agent_id: item.agent_id, agent_name: item.agent_name, division: item.division,
      task: item.task, category: item.category, raw_output: output, priority: item.priority,
      status: 'pending', retry_count: newRetryCount, parent_csq_id: item.id,
      correction_notes: correctionNotes,
    });
    console.log(`[isabella] Correction triggered for ${item.agent_name} (attempt ${newRetryCount})`);
  } catch (error) { console.error(`[isabella] Correction failed for ${item.agent_name}:`, error); }
}

async function processIsabellaItem(item: CSQItem): Promise<'cleared' | 'sent_back' | 'rejected' | 'error'> {
  try {
    const raw = await callTwin(
      `${GENIUS_MODE}

You are Isabella Moreno, Director of Compliance for DRU AI Consulting.

RESPONSIBILITIES:
1. Every DRU proprietary framework name must include ™
2. Content stays within Classes 35, 41, 42
3. Flag content outside these classes

DRU PROPRIETARY MARKS (always ™): DRU CLEAR™ | DRU AI Leadership Ecosystem™ | DRU AI Transformation Pathway™ | 5C Cultural DNA™ | 5D Leadership™ | AI Sales Mastery™ | From Confusion to Confident with AI™

BUSINESS NAME — NOT A TRADEMARK: 'DRU AI Consulting' is the registered business name. It does NOT require ™. Do NOT flag it.

CLEARING STANDARD:
- All marks with ™ AND content within Classes 35/41/42 → cleared:true
- Missing ™ → cleared:false, state exactly which mark and where
- Outside classes → cleared:false, state exactly what

LEGAL & FINANCE EXCEPTION: Content from the Legal & Finance division is INTERNAL OPERATIONAL advisory for DeAnna only. Check ™ marks and service class usage as normal. Do NOT flag the surrounding operational subject matter as a class violation. If ™ marks are correct, return cleared:true.

COMMUNITY CONNECTION EXCEPTION: Content from the Community Connection division is educational community content for Navigator and Accelerator subscribers. Framework lessons, action challenges, daily insights, strategic edge posts are firmly within Class 41 (educational) and Class 35 (community facilitation). UPSELL SIGNAL notes in Zoe and Micah outputs are internal routing instructions — do NOT flag them as class violations. If ™ marks are correct, return cleared:true.

AGENT: ${item.agent_name} | TASK: ${item.task}
CONTENT: ${item.raw_output}

Output ONLY this JSON:
{"cleared":true,"flags":"none","correction_notes":"Content reviewed. All marks correct. Within Classes 35/41/42."}
OR: {"cleared":false,"flags":"specific issue","correction_notes":"Exact correction instruction"}`,
      600
    );

    const result = JSON.parse(extractJSON(raw));

    if (result.cleared) {
      await updateCSQ(item.id, {
        isabella_flags: result.flags ?? 'none',
        isabella_cleared_at: new Date().toISOString(),
        status: 'isabella_cleared',
      });
      return 'cleared';
    } else {
      const retryCount = item.retry_count ?? 0;
      if (retryCount >= 2) {
        await updateCSQ(item.id, {
          isabella_flags: result.flags,
          correction_notes: result.correction_notes,
          governance_cleared: false,
          status: 'rejected',
        });
        console.warn(`[isabella] HARD REJECT: ${item.agent_name} — ${result.flags}`);
        return 'rejected';
      } else {
        await updateCSQ(item.id, {
          isabella_flags: result.flags,
          correction_notes: result.correction_notes,
          status: 'needs_correction',
        });
        await runCorrectionAgent(item, result.correction_notes, retryCount + 1);
        console.log(`[isabella] Sent back to ${item.agent_name} (attempt ${retryCount + 1})`);
        return 'sent_back';
      }
    }
  } catch (error) {
    console.error(`[isabella] Sonnet call failed for ${item.agent_name}:`, error);
    return 'error';
  }
}

async function runIsabella(): Promise<{ reviewed: number; cleared: number; sent_back: number; rejected: number }> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const pending = await getCSQItems('pending', 25, cutoff);
  console.log(`[isabella] Reviewing ${pending.length} pending items (max 25, 48hr window, concurrent batches of 5)...`);
  if (pending.length === 0) return { reviewed: 0, cleared: 0, sent_back: 0, rejected: 0 };
  let cleared = 0; let sentBack = 0; let rejected = 0;
  const BATCH_SIZE = 5;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const outcomes = await Promise.all(batch.map(processIsabellaItem));
    for (const outcome of outcomes) {
      if (outcome === 'cleared') cleared++;
      else if (outcome === 'rejected') rejected++;
      else if (outcome === 'sent_back') sentBack++;
      // 'error' → no counter increment, item stays pending and will be retried next run
    }
  }

  console.log(`[isabella] ${pending.length} reviewed: ${cleared} cleared, ${sentBack} sent back, ${rejected} rejected`);
  return { reviewed: pending.length, cleared, sent_back: sentBack, rejected };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cron-secret');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const incomingSecret = req.headers['x-cron-secret'];
  if (incomingSecret !== undefined && incomingSecret !== process.env.CRON_SECRET) {
    res.status(401).json({ error: 'Unauthorized' }); return;
  }
  console.log('[cmd-isabella] Isabella review triggered');
  const result = await runIsabella();
  res.status(202).json({ success: true, ...result });
}
