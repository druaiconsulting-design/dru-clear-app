// api/imani-report-writer.ts
// Imani Whitfield, SD/ED Report Writer (Client Delivery division, Sonnet 5.5).
// Writes the client-specific wording for the Strategic AI Insight Report (SD).
//
// Starts when the database tells this route a client's numbers are worked out
// (finished_reports.status = 'numbers_worked_out'), which happens right after the client hits
// Submit on the SD pre-session questionnaire. Saves the wording to finished_reports.insight and
// moves the status to 'insight_written'.
//
// Imani runs on her own path: her own prompt (her job description plus DeAnna's voice guide),
// her own results location (finished_reports), her own corrections task name ("SD/ED report"),
// her own run lock and retry, and her own larger length cap. She stays out of the daily content
// queue and its review chain. Every report goes to DeAnna for edit and approval.
//
// Called only by the database (x-cron-secret header). Safe to call twice for the same client:
// a run lock and the status check stop a second run from writing over the first.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { IMANI_VOICE_GUIDE } from './_lib/imaniVoiceGuide.js';
import { IMANI_JOB_DESCRIPTION, IMANI_OUTPUT_FORMAT, JOB_DESCRIPTION_VERSION } from './_lib/imaniJobDescription.js';
import { getAgentCorrections } from './_lib/agentKnowledge.js';

export const config = { maxDuration: 300 };

const AGENT_NAME = 'Imani Whitfield';
const CORRECTIONS_TASK = 'SD/ED report';
const MODEL = 'claude-sonnet-5-5';
const RATE = { in: 2, out: 10 }; // dollars per million tokens, Sonnet 5.5
const MAX_TOKENS = 16000;
const LOCK_MINUTES = 15;
const MAX_ATTEMPTS = 3;

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// The 15 free-assessment statements, in the order the assessment asks them (q1 to q15).
const STATEMENTS: { pillar: string; text: string }[] = [
  { pillar: 'Clarity', text: 'Our organization has a clearly defined AI vision that connects to our overall business strategy.' },
  { pillar: 'Clarity', text: 'Leaders and teams across the organization understand why we are pursuing AI and what success looks like.' },
  { pillar: 'Clarity', text: 'We have identified specific strategic priorities where AI will have the greatest business impact.' },
  { pillar: 'Leadership', text: 'Our organizational leaders can clearly articulate how AI connects to our business strategy and competitive position.' },
  { pillar: 'Leadership', text: 'There is a designated executive sponsor who is accountable for driving AI transformation.' },
  { pillar: 'Leadership', text: 'Our leadership team actively participates in AI learning, development, and decision-making.' },
  { pillar: 'Execution', text: 'We have identified specific business processes where AI can deliver measurable impact.' },
  { pillar: 'Execution', text: 'Our teams have the skills, tools, and resources needed to implement AI solutions today.' },
  { pillar: 'Execution', text: 'We have completed at least one AI pilot or proof of concept in the past 12 months.' },
  { pillar: 'Alignment', text: 'Our AI initiatives are aligned with our overall business goals and strategic plan.' },
  { pillar: 'Alignment', text: 'There is clear and consistent communication between departments about AI priorities and progress.' },
  { pillar: 'Alignment', text: 'Our AI efforts are coordinated across teams and business units rather than operating in silos.' },
  { pillar: 'Results', text: 'We have defined clear Key Performance Indicators to measure the success of our AI initiatives.' },
  { pillar: 'Results', text: 'We can demonstrate measurable return on investment from at least one AI-related initiative.' },
  { pillar: 'Results', text: 'We have a system in place to regularly track and report AI progress to leadership.' },
];

type Spot = { spot_key: string; page: number; sort_order: number; grp: string | null; label: string; writer: string; leading_only: boolean };
type Entry = { spot_key: string; text: string; reason: string };
type Usage = { input: number; output: number };

class StepError extends Error {
  step: string;
  constructor(step: string, message: string) { super(message); this.step = step; }
}

// ── Gather everything Imani is allowed to use ────────────────────────────────
async function gatherClientData(token: string, fr: any) {
  const [respRes, numRes, txtRes, subRes] = await Promise.all([
    supabase.from('diagnostic_responses').select('question_id, answer_text').eq('access_token', token),
    supabase.from('diagnostic_numbers').select('question_id, field_key, item_index, value').eq('access_token', token).order('field_key').order('item_index'),
    supabase.from('diagnostic_texts').select('question_id, field_key, item_index, value').eq('access_token', token).order('field_key').order('item_index'),
    supabase.from('submissions').select('*').ilike('email', String(fr.email).replace(/[\\%_]/g, m => '\\' + m)).order('created_at', { ascending: false }).limit(1),
  ]);
  if (respRes.error) throw new StepError('read pre-session answers', respRes.error.message);
  if (numRes.error) throw new StepError('read number boxes', numRes.error.message);
  if (txtRes.error) throw new StepError('read typed names', txtRes.error.message);
  if (subRes.error) throw new StepError('read free assessment', subRes.error.message);

  const ids = Array.from(new Set((respRes.data ?? []).map((r: any) => r.question_id)));
  const qRes = ids.length
    ? await supabase.from('diagnostic_questions').select('id, framework, pillar, question_order, question_text').in('id', ids)
    : { data: [] as any[], error: null as any };
  if (qRes.error) throw new StepError('read questions', qRes.error.message);
  const qById = new Map<string, any>((qRes.data ?? []).map((q: any) => [q.id, q]));

  const presession = (respRes.data ?? [])
    .map((r: any) => {
      const q = qById.get(r.question_id);
      return q ? {
        framework: q.framework, pillar: q.pillar, question_number: q.question_order,
        question: q.question_text, answer: (r.answer_text ?? '').trim(),
      } : null;
    })
    .filter(Boolean)
    .sort((a: any, b: any) => (a.framework + a.pillar + String(a.question_number).padStart(2, '0')).localeCompare(b.framework + b.pillar + String(b.question_number).padStart(2, '0')));

  const sub = (subRes.data ?? [])[0] ?? null;
  const assessment = sub ? {
    first_name: sub.first_name, last_name: sub.last_name, company: sub.company, role: sub.role,
    total_points: sub.total_score, achievement_level: sub.tier,
    pillar_scores: {
      Clarity: sub.clarity_score, Leadership: sub.leadership_score, Execution: sub.execution_score,
      Alignment: sub.alignment_score, Results: sub.results_score,
    },
    statements: STATEMENTS.map((s, i) => ({ number: i + 1, pillar: s.pillar, statement: s.text, answer: sub['q' + (i + 1)] ?? null })),
  } : null;

  return {
    client: {
      first_name: assessment?.first_name ?? null, last_name: assessment?.last_name ?? null,
      company: assessment?.company ?? null, role: assessment?.role ?? null,
    },
    free_assessment: assessment,
    calculator: fr.numbers,
    presession_answers: presession,
    number_boxes: (numRes.data ?? []).map((n: any) => ({ field: n.field_key, item: n.item_index, value: Number(n.value) })),
    typed_names: (txtRes.data ?? []).map((t: any) => ({ field: t.field_key, item: t.item_index, value: t.value })),
  };
}

// ── One request to Sonnet 5.5 for a batch of spots ───────────────────────────
async function askImani(system: string, clientData: unknown, spots: Spot[], usage: Usage): Promise<Entry[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new StepError('model call', 'ANTHROPIC_API_KEY not set');

  const user = [
    'CLIENT DATA (everything you may use):',
    JSON.stringify(clientData),
    '',
    'SLOT LIST FOR THIS REQUEST (write every spot below):',
    JSON.stringify(spots.map(s => ({ spot_key: s.spot_key, page: s.page, group: s.grp, asks_for: s.label }))),
  ].join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw new StepError('model call', `Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body: any = await res.json();
  usage.input += body.usage?.input_tokens ?? 0;
  usage.output += body.usage?.output_tokens ?? 0;

  const text = (body.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new StepError('read model answer', 'No JSON object in the answer');
  let parsed: any;
  try { parsed = JSON.parse(text.slice(start, end + 1)); }
  catch (e: any) { throw new StepError('read model answer', 'JSON did not parse: ' + e.message); }
  const raw = Array.isArray(parsed?.entries) ? parsed.entries : [];
  return raw
    .filter((e: any) => e && typeof e.spot_key === 'string')
    .map((e: any) => ({ spot_key: e.spot_key, text: typeof e.text === 'string' ? e.text.trim() : '', reason: typeof e.reason === 'string' ? e.reason.trim() : '' }));
}

// A batch gets one retry for any spot that did not come back.
async function writeBatch(system: string, clientData: unknown, spots: Spot[], usage: Usage): Promise<Entry[]> {
  const wanted = new Set(spots.map(s => s.spot_key));
  const got = new Map<string, Entry>();
  let todo = spots;
  for (let attempt = 1; attempt <= 2 && todo.length > 0; attempt++) {
    try {
      const entries = await askImani(system, clientData, todo, usage);
      for (const e of entries) if (wanted.has(e.spot_key) && !got.has(e.spot_key)) got.set(e.spot_key, e);
    } catch (err) {
      if (attempt === 2) throw err;
    }
    todo = spots.filter(s => !got.has(s.spot_key));
  }
  return spots.map(s => got.get(s.spot_key) ?? { spot_key: s.spot_key, text: '', reason: 'No wording came back from the model for this spot.' });
}

// ── Checks that run after the writing, logged as warnings for DeAnna's review ─
function checkWording(entries: Entry[], clientData: unknown): { spot_key: string; warning: string }[] {
  const warnings: { spot_key: string; warning: string }[] = [];
  const norm = (s: string) => s.replace(/[$,]/g, '').replace(/\.0+$/, '');
  const allowed = new Set<string>(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '30', '60', '90', '15', '75', '12']);
  for (const m of JSON.stringify(clientData).matchAll(/\d[\d,]*(\.\d+)?/g)) allowed.add(norm(m[0]));
  for (const e of entries) {
    if (!e.text) continue;
    for (const m of e.text.matchAll(/\$?\d[\d,]*(\.\d+)?/g)) {
      const n = norm(m[0]);
      if (n && !allowed.has(n)) warnings.push({ spot_key: e.spot_key, warning: `Figure ${m[0]} does not appear in the calculator numbers or the client's answers` });
    }
    if (/[—–]/.test(e.text)) warnings.push({ spot_key: e.spot_key, warning: 'Wording contains a dash that DeAnna\'s voice guide does not use' });
    if (/\bbadge\b/i.test(e.text)) warnings.push({ spot_key: e.spot_key, warning: 'Wording says "badge" where client-facing wording says "achievement"' });
  }
  return warnings;
}

async function logRun(row: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('report_writer_runs').insert({ agent_name: AGENT_NAME, ...row });
  if (error) console.error('[imani-report-writer] run log insert failed:', error.message);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers['x-cron-secret'] !== secret) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const token: string | undefined = req.body?.access_token;
  if (!token) { res.status(400).json({ error: 'access_token is required' }); return; }

  const started = Date.now();
  const usage: Usage = { input: 0, output: 0 };
  const base = { access_token: token, model: MODEL, job_description_version: JOB_DESCRIPTION_VERSION };

  // 1. Read the client's row and claim the run lock.
  const { data: fr, error: frErr } = await supabase.from('finished_reports').select('*').eq('access_token', token).maybeSingle();
  if (frErr || !fr) { res.status(404).json({ error: 'No finished report for this token' }); return; }
  if (fr.status !== 'numbers_worked_out') {
    res.status(200).json({ skipped: `status is ${fr.status}` });
    return;
  }
  if ((fr.writer_attempts ?? 0) >= MAX_ATTEMPTS) {
    await logRun({ ...base, status_before: fr.status, status_after: fr.status, error_step: 'attempt limit', error_message: `Stopped after ${MAX_ATTEMPTS} attempts` });
    res.status(200).json({ skipped: 'attempt limit reached' });
    return;
  }
  if (fr.diagnostic_tier !== 'strategic') {
    res.status(200).json({ skipped: 'ED report writing starts after DeAnna reviews the ED report' });
    return;
  }

  const lockCutoff = new Date(Date.now() - LOCK_MINUTES * 60_000).toISOString();
  const { data: claimed, error: claimErr } = await supabase
    .from('finished_reports')
    .update({ writer_started_at: new Date().toISOString(), writer_attempts: (fr.writer_attempts ?? 0) + 1 })
    .eq('access_token', token).eq('status', 'numbers_worked_out')
    .or(`writer_started_at.is.null,writer_started_at.lt.${lockCutoff}`)
    .select('access_token');
  if (claimErr) { res.status(500).json({ error: claimErr.message }); return; }
  if (!claimed || claimed.length === 0) { res.status(200).json({ skipped: 'another run holds the lock' }); return; }

  const releaseLock = () => supabase.from('finished_reports').update({ writer_started_at: null }).eq('access_token', token);

  try {
    // 2. Gather inputs, the slot list and DeAnna's earlier corrections.
    const clientData = await gatherClientData(token, fr);
    if (!fr.numbers || !fr.numbers.badge) throw new StepError('read calculator numbers', 'The calculator numbers are missing for this client');
    const isLeading = fr.numbers.badge === 'LEADING';

    const { data: spotRows, error: spotErr } = await supabase.from('report_spots').select('*').eq('report_type', 'SD').eq('writer', 'imani').order('sort_order');
    if (spotErr) throw new StepError('read spot list', spotErr.message);
    const spots = ((spotRows ?? []) as Spot[]).filter(s => !s.leading_only || isLeading);
    if (spots.length === 0) throw new StepError('read spot list', 'The spot list is empty');

    const corrections = await getAgentCorrections(AGENT_NAME, CORRECTIONS_TASK, 10);
    const system = [IMANI_JOB_DESCRIPTION, IMANI_VOICE_GUIDE, IMANI_OUTPUT_FORMAT].join('\n\n====\n\n') + corrections;

    // 3. Write in parallel batches: the summary pages, each pillar page, the 5D page and the Pathway page.
    const batchOf = (s: Spot) => ([4, 5, 6, 13, 14].includes(s.page) ? 'summary' : String(s.page));
    const batches = new Map<string, Spot[]>();
    for (const s of spots) batches.set(batchOf(s), [...(batches.get(batchOf(s)) ?? []), s]);
    const results = await Promise.all(Array.from(batches.values()).map(b => writeBatch(system, clientData, b, usage)));
    const entries = results.flat();

    // 4. Check, save and move the status.
    const filled = entries.filter(e => e.text);
    const empty = entries.filter(e => !e.text);
    const warnings = checkWording(entries, clientData);
    const emptyReasons = empty.map(e => ({ spot_key: e.spot_key, reason: e.reason || 'No reason given' }));

    const insight = {
      version: 1,
      agent: AGENT_NAME,
      model: MODEL,
      job_description_version: JOB_DESCRIPTION_VERSION,
      written_at: new Date().toISOString(),
      leading_client: isLeading,
      entries: Object.fromEntries(entries.map(e => [e.spot_key, { text: e.text, reason: e.reason }])),
      empty: emptyReasons,
      warnings,
    };
    const { data: saved, error: saveErr } = await supabase
      .from('finished_reports')
      .update({ insight, status: 'insight_written', writer_started_at: null })
      .eq('access_token', token).eq('status', 'numbers_worked_out')
      .select('access_token');
    if (saveErr) throw new StepError('save wording', saveErr.message);
    if (!saved || saved.length === 0) throw new StepError('save wording', 'The report row changed status while Imani was writing');

    const cost = (usage.input / 1e6) * RATE.in + (usage.output / 1e6) * RATE.out;
    await logRun({
      ...base, status_before: 'numbers_worked_out', status_after: 'insight_written',
      spots_requested: spots.length, spots_filled: filled.length, spots_empty: empty.length,
      empty_reasons: emptyReasons, warnings, input_tokens: usage.input, output_tokens: usage.output,
      cost_usd: cost, duration_ms: Date.now() - started,
    });
    await supabase.from('model_usage_log').insert({
      source_file: 'api/imani-report-writer.ts', model: MODEL, input_tokens: usage.input, output_tokens: usage.output,
      cost_usd: cost, duration_ms: Date.now() - started,
    });

    res.status(200).json({ success: true, spots_requested: spots.length, filled: filled.length, empty: empty.length, warnings: warnings.length });
  } catch (err: any) {
    await releaseLock();
    const step = err instanceof StepError ? err.step : 'unexpected';
    console.error(`[imani-report-writer] stopped at "${step}":`, err?.message);
    await logRun({
      ...base, status_before: 'numbers_worked_out', status_after: 'numbers_worked_out',
      input_tokens: usage.input, output_tokens: usage.output,
      cost_usd: (usage.input / 1e6) * RATE.in + (usage.output / 1e6) * RATE.out,
      duration_ms: Date.now() - started, error_step: step, error_message: String(err?.message ?? err).slice(0, 500),
    });
    res.status(500).json({ error: step });
  }
}
