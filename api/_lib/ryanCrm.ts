// api/_lib/ryanCrm.ts
// Ryan Nakamura — CRM Management (GHL). Everything Ryan does inside GoHighLevel lives here.
//
// Two runs:
//   1. generateRyanReport()      — daily. Reads the DRU AI Consulting GHL account, asks Ryan to write one
//                                  report with a section for each of his 16 jobs, checks every change he
//                                  suggests against what was actually read, and writes ONE card to approvals.
//   2. applyApprovedChanges(id)  — after DeAnna approves the card. Ryan makes the changes under the jobs she
//                                  checked, himself. Before each change he re-reads the record and skips the
//                                  change if the value is no longer what he saw or if it would blank out a
//                                  value that is already there. Every change is logged in ryan_change_log.
//
// Ryan uses his own GHL Private Integration ("Ryan's Daily CRM Management"), stored in the Vercel
// environment variable GHL_RYANS_PRIVATE_INTEGRATIONS_KEY. No other agent uses it.
//
// Ryan's instructions are DeAnna's own text word for word (api/_lib/ryanJob.ts).

import { RYAN_JOB_DESCRIPTION } from './ryanJob.js';

export const RYAN_KEY_ENV = 'GHL_RYANS_PRIVATE_INTEGRATIONS_KEY';
const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION_ID = 'gl07I4JnbkGgW8zJprSz';
const GHL_VERSION = '2021-07-28';

// Read limits. Ryan states on the card exactly how much he read, so a limit is never hidden.
const MAX_CONTACT_PAGES = 5;        // 100 contacts per page
const MAX_DEAL_PAGES = 5;           // 100 deals per page
const NOTES_TASKS_CONTACT_CAP = 60; // most recently added contacts get their notes and tasks read
const PROMPT_CONTACT_CAP = 150;     // contacts included in Ryan's prompt
const PROMPT_DEAL_CAP = 200;        // deals included in Ryan's prompt

// ─── The 16 jobs, in DeAnna's order. Titles and group headings are her words (ryanJob.ts). ───
export const RYAN_JOBS: { job: number; group: string; title: string }[] = [
  { job: 1,  group: 'What an agent can do inside GHL',           title: 'Find contacts' },
  { job: 2,  group: 'What an agent can do inside GHL',           title: 'Tags' },
  { job: 3,  group: 'What an agent can do inside GHL',           title: 'Pipelines and deals' },
  { job: 4,  group: 'What an agent can do inside GHL',           title: 'Workflows' },
  { job: 5,  group: 'What an agent can do inside GHL',           title: 'Records' },
  { job: 6,  group: 'What an agent can do inside GHL',           title: 'Account structure' },
  { job: 7,  group: 'What your account holds',                   title: 'Events' },
  { job: 8,  group: 'What your account holds',                   title: 'Leads --> Sales Pipeline' },
  { job: 9,  group: 'What your account holds',                   title: 'Sales Pipeline' },
  { job: 10, group: 'What CRM management agents do in practice', title: 'Hygiene' },
  { job: 11, group: 'What CRM management agents do in practice', title: 'Stale deals and stage correction' },
  { job: 12, group: 'What CRM management agents do in practice', title: 'Nightly summaries' },
  { job: 13, group: 'What CRM management agents do in practice', title: 'Speed-to-lead' },
  { job: 14, group: 'Safety lessons from the same sources',      title: 'Overwriting good data' },
  { job: 15, group: 'Safety lessons from the same sources',      title: 'Merging duplicates' },
  { job: 16, group: 'Safety lessons from the same sources',      title: 'Audit trail' },
];

// ─── Types ───
export type ChangeKind =
  | 'add_tag' | 'remove_tag'
  | 'update_contact_field' | 'update_custom_field'
  | 'add_note' | 'create_task'
  | 'move_deal_stage' | 'set_deal_status'
  | 'enroll_workflow' | 'create_custom_field';

export interface RyanChange {
  id: string;                 // "<job>.<n>"
  kind: ChangeKind;
  summary: string;            // plain-English line shown on the card
  target_type: 'contact' | 'deal' | 'account';
  target_id: string;
  target_label: string;
  field: string | null;
  current_value: string | null;
  new_value: string | null;
  overwrites: boolean;        // true when it replaces a value that is already there
  params: Record<string, unknown>;
}

export interface RyanSection {
  job: number;
  group: string;
  title: string;
  finding: string;
  suggestion: string;
  changes: RyanChange[];
  dropped: number;            // suggestions removed because they did not match what was read from GHL
}

export interface ChangeResult { outcome: 'applied' | 'skipped' | 'failed' | 'not_attempted'; reason: string | null; }

export interface RyanReport {
  v: 1;
  kind: 'ryan_crm_report';
  generated_at: string;
  read_summary: {
    contacts_total: number | null; contacts_read: number;
    deals_total: number | null; deals_read: number;
    notes_tasks_read_for: number;
    workflows_read: number; custom_fields_read: number; pipelines_read: number;
  };
  read_errors: { what: string; status: number; message: string }[];
  sections: RyanSection[];
  checked: number[];
  approved_at: string | null;
  applied_at: string | null;
  results: Record<string, ChangeResult>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

// ─── GHL client (Ryan's own key) ───
interface GhlResult { ok: boolean; status: number; data: Json; error?: string }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function ghl(method: string, path: string, opts: { query?: Record<string, string | number | undefined>; body?: unknown } = {}, attempt = 0): Promise<GhlResult> {
  const key = process.env[RYAN_KEY_ENV];
  if (!key) return { ok: false, status: 0, data: null, error: `${RYAN_KEY_ENV} is not set in Vercel` };
  const url = new URL(GHL_API_BASE + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  try {
    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${key}`, Version: GHL_VERSION, Accept: 'application/json',
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 429 && attempt < 3) { await sleep(1500 * (attempt + 1)); return ghl(method, path, opts, attempt + 1); }
    const text = await res.text();
    let data: Json = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (res.ok) return { ok: true, status: res.status, data };
    const msg = (data && (data.message || data.error || data.msg)) ? String(Array.isArray(data.message) ? data.message.join('; ') : (data.message || data.error || data.msg)) : text.slice(0, 200);
    return { ok: false, status: res.status, data, error: msg };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Supabase (service role) ───
function sbEnv() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}
async function sb(method: string, path: string, body?: unknown, prefer?: string): Promise<{ ok: boolean; status: number; data: Json }> {
  const env = sbEnv();
  if (!env) return { ok: false, status: 0, data: null };
  const res = await fetch(`${env.url}/rest/v1/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', apikey: env.key, Authorization: `Bearer ${env.key}`, ...(prefer ? { Prefer: prefer } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: Json = null;
  try { const t = await res.text(); data = t ? JSON.parse(t) : null; } catch { data = null; }
  return { ok: res.ok, status: res.status, data };
}

async function logModelUsage(model: string, inputTokens: number, outputTokens: number, durationMs: number): Promise<void> {
  const rate = model.startsWith('claude-sonnet') ? { in: 3, out: 15 } : { in: 1, out: 5 };
  const cost_usd = (inputTokens / 1_000_000) * rate.in + (outputTokens / 1_000_000) * rate.out;
  await sb('POST', 'model_usage_log', { source_file: 'ryan-crm-report', model, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd, duration_ms: durationMs }, 'return=minimal');
}

async function callAnthropic(prompt: string, maxTokens: number, model = 'claude-haiku-4-5-20251001'): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const startedAt = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = await res.json();
  console.log(`[ryan-crm] ${model} stop_reason: ${data.stop_reason ?? 'unknown'}`);
  await logModelUsage(model, data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0, Date.now() - startedAt).catch(() => {});
  return data.content?.[0]?.text ?? '';
}

// ─── Small helpers ───
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v)).trim();
const norm = (v: unknown): string => str(v).replace(/\s+/g, ' ');
const lc = (v: unknown): string => norm(v).toLowerCase();
const digits = (v: unknown): string => str(v).replace(/\D/g, '');
const clip = (v: unknown, n: number): string => { const s = str(v); return s.length > n ? s.slice(0, n) + '…' : s; };
const contactName = (c: Json): string => {
  const n = [str(c?.firstName), str(c?.lastName)].filter(Boolean).join(' ') || str(c?.contactName) || str(c?.name);
  return n || str(c?.email) || str(c?.phone) || str(c?.id);
};
const daysSince = (iso: unknown): number | null => {
  const t = Date.parse(str(iso));
  return Number.isFinite(t) ? Math.floor((Date.now() - t) / 86_400_000) : null;
};

// ─── Snapshot: everything Ryan reads from GHL ───
interface Snapshot {
  contacts: Json[]; contactsTotal: number | null;
  pipelines: Json[]; deals: Json[]; dealsTotal: number | null;
  workflows: Json[]; customFields: Json[];
  notes: Record<string, Json[]>; tasks: Record<string, Json[]>; notesTasksReadFor: number;
  readErrors: { what: string; status: number; message: string }[];
}

async function readSnapshot(): Promise<Snapshot> {
  const snap: Snapshot = { contacts: [], contactsTotal: null, pipelines: [], deals: [], dealsTotal: null, workflows: [], customFields: [], notes: {}, tasks: {}, notesTasksReadFor: 0, readErrors: [] };
  const fail = (what: string, r: GhlResult) => snap.readErrors.push({ what, status: r.status, message: clip(r.error ?? 'unknown error', 200) });

  // Contacts
  for (let page = 1; page <= MAX_CONTACT_PAGES; page++) {
    let r = await ghl('POST', '/contacts/search', { body: { locationId: GHL_LOCATION_ID, pageLimit: 100, page, sort: [{ field: 'dateAdded', direction: 'desc' }] } });
    if (!r.ok && r.status === 422) r = await ghl('POST', '/contacts/search', { body: { locationId: GHL_LOCATION_ID, pageLimit: 100, page } });
    if (!r.ok) { fail('contacts', r); break; }
    const list: Json[] = r.data?.contacts ?? [];
    if (typeof r.data?.total === 'number') snap.contactsTotal = r.data.total;
    snap.contacts.push(...list);
    if (list.length < 100) break;
  }

  // Pipelines
  {
    const r = await ghl('GET', '/opportunities/pipelines', { query: { locationId: GHL_LOCATION_ID } });
    if (r.ok) snap.pipelines = r.data?.pipelines ?? []; else fail('pipelines', r);
  }

  // Deals
  {
    let startAfter: string | undefined; let startAfterId: string | undefined;
    for (let page = 1; page <= MAX_DEAL_PAGES; page++) {
      const r = await ghl('GET', '/opportunities/search', { query: { location_id: GHL_LOCATION_ID, status: 'all', limit: 100, startAfter, startAfterId } });
      if (!r.ok) { fail('deals', r); break; }
      const list: Json[] = r.data?.opportunities ?? [];
      if (typeof r.data?.meta?.total === 'number') snap.dealsTotal = r.data.meta.total;
      snap.deals.push(...list);
      const m = r.data?.meta;
      if (list.length < 100 || !m?.startAfter || !m?.startAfterId) break;
      startAfter = String(m.startAfter); startAfterId = String(m.startAfterId);
    }
    if (snap.dealsTotal === null && snap.readErrors.every(e => e.what !== 'deals')) snap.dealsTotal = snap.deals.length;
  }

  // Workflows
  {
    const r = await ghl('POST', '/workflows/search', { query: { locationId: GHL_LOCATION_ID }, body: { limit: 100 } });
    if (r.ok) snap.workflows = r.data?.workflows ?? []; else fail('workflows', r);
  }

  // Custom fields (contacts and deals)
  {
    const r = await ghl('GET', `/locations/${GHL_LOCATION_ID}/customFields`, { query: { model: 'all' } });
    if (r.ok) snap.customFields = r.data?.customFields ?? []; else fail('custom fields', r);
  }

  // Notes and tasks for the most recently added contacts
  const subset = snap.contacts.slice(0, NOTES_TASKS_CONTACT_CAP);
  snap.notesTasksReadFor = subset.length;
  let noteErr: GhlResult | null = null, taskErr: GhlResult | null = null;
  const queue = [...subset];
  const worker = async () => {
    while (queue.length) {
      const c = queue.shift();
      if (!c) break;
      const [n, t] = await Promise.all([ghl('GET', `/contacts/${c.id}/notes`), ghl('GET', `/contacts/${c.id}/tasks`)]);
      if (n.ok) snap.notes[c.id] = n.data?.notes ?? []; else noteErr = noteErr ?? n;
      if (t.ok) snap.tasks[c.id] = t.data?.tasks ?? []; else taskErr = taskErr ?? t;
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  if (noteErr) fail('contact notes', noteErr);
  if (taskErr) fail('contact tasks', taskErr);
  return snap;
}

// ─── Facts computed by code (the same every time) ───
function computeFacts(snap: Snapshot) {
  const dupGroups: { reason: string; contact_ids: string[]; names: string[] }[] = [];
  const bucket = (reason: string, keyFn: (c: Json) => string) => {
    const m = new Map<string, Json[]>();
    for (const c of snap.contacts) { const k = keyFn(c); if (k) m.set(k, [...(m.get(k) ?? []), c]); }
    for (const [k, list] of m) if (list.length > 1) dupGroups.push({ reason: `${reason}: ${k}`, contact_ids: list.map(c => c.id), names: list.map(contactName) });
  };
  bucket('same email', c => lc(c.email));
  bucket('same phone', c => { const d = digits(c.phone); return d.length >= 7 ? d.slice(-10) : ''; });
  bucket('same full name', c => { const f = lc(c.firstName), l = lc(c.lastName); return f && l ? `${f} ${l}` : ''; });

  const missing = snap.contacts.map(c => ({
    id: c.id, name: contactName(c),
    missing: ['firstName', 'lastName', 'email', 'phone'].filter(f => !str(c[f])),
  })).filter(m => m.missing.length > 0);

  const stageMap = stageIndex(snap);
  const dealsByStage: Record<string, number> = {};
  for (const d of snap.deals) {
    const s = stageMap.get(d.pipelineStageId);
    const key = `${s?.pipelineName ?? d.pipelineId} / ${s?.name ?? d.pipelineStageId} / ${d.status}`;
    dealsByStage[key] = (dealsByStage[key] ?? 0) + 1;
  }
  const newLast24h = snap.contacts.filter(c => { const t = Date.parse(str(c.dateAdded)); return Number.isFinite(t) && Date.now() - t < 86_400_000; }).map(c => c.id);
  return { dupGroups, missing, dealsByStage, newLast24h };
}

function stageIndex(snap: Snapshot) {
  const m = new Map<string, { name: string; pipelineId: string; pipelineName: string }>();
  for (const p of snap.pipelines) for (const s of (p.stages ?? [])) m.set(s.id, { name: str(s.name), pipelineId: p.id, pipelineName: str(p.name) });
  return m;
}

async function auditFacts() {
  const r = await sb('GET', 'ryan_change_log?select=outcome,created_at&order=created_at.desc&limit=1000');
  const rows: Json[] = Array.isArray(r.data) ? r.data : [];
  return {
    changes_logged_total: rows.length,
    changes_applied_total: rows.filter(x => x.outcome === 'applied').length,
    changes_skipped_total: rows.filter(x => x.outcome === 'skipped').length,
    changes_failed_total: rows.filter(x => x.outcome === 'failed').length,
    last_change_logged_at: rows[0]?.created_at ?? null,
  };
}

// ─── Ryan's prompt ───
const OUTPUT_FORMAT = `OUTPUT FORMAT
Return one JSON object and nothing else. It has a "sections" array holding exactly 16 items, job 1 to job 16 in the order above.
Each item looks like: {"job": 1, "finding": "...", "suggestion": "...", "changes": []}
Write "finding" and "suggestion" in plain English, based on the data above. Describe duplicate contacts in the finding and suggestion so DeAnna can merge them in GHL herself.
Fill "changes" with the changes that need DeAnna's approval under that job. Use contact ids, deal ids, stage ids, workflow ids and field ids exactly as they appear in the data, and current values exactly as they appear in the data. Leave "changes" as an empty array when a job needs no change.
Each change is one of these shapes:
{"kind":"add_tag","contact_id":"...","tag":"..."}
{"kind":"remove_tag","contact_id":"...","tag":"..."}
{"kind":"update_contact_field","contact_id":"...","field":"firstName|lastName|email|phone|address1|city|state|postalCode|website|timezone|country","current_value":"...","new_value":"..."}
{"kind":"update_custom_field","contact_id":"...","field_id":"...","current_value":"...","new_value":"..."}
{"kind":"add_note","contact_id":"...","note":"..."}
{"kind":"create_task","contact_id":"...","title":"...","body":"...","due_in_days":2}
{"kind":"move_deal_stage","deal_id":"...","current_stage_id":"...","new_stage_id":"..."}
{"kind":"set_deal_status","deal_id":"...","current_status":"open","new_status":"won|lost|abandoned|open"}
{"kind":"enroll_workflow","contact_id":"...","workflow_id":"..."}
{"kind":"create_custom_field","name":"...","data_type":"TEXT|LARGE_TEXT|NUMERICAL|PHONE|DATE","model":"contact|opportunity"}`;

function buildPrompt(snap: Snapshot, audit: Json): string {
  const facts = computeFacts(snap);
  const stageMap = stageIndex(snap);
  const pipelineName = new Map<string, string>(snap.pipelines.map(p => [p.id, str(p.name)]));
  const dealsByContact = new Map<string, string[]>();
  for (const d of snap.deals) if (d.contactId) dealsByContact.set(d.contactId, [...(dealsByContact.get(d.contactId) ?? []), d.id]);

  const contacts = snap.contacts.slice(0, PROMPT_CONTACT_CAP).map(c => ({
    id: c.id, firstName: str(c.firstName), lastName: str(c.lastName), email: str(c.email), phone: str(c.phone),
    tags: c.tags ?? [], source: str(c.source), dateAdded: c.dateAdded ?? null, dateUpdated: c.dateUpdated ?? null,
    customFields: (c.customFields ?? []).map((f: Json) => ({ id: f.id, value: f.value ?? f.fieldValue ?? null })),
    deal_ids: dealsByContact.get(c.id) ?? [],
    notes: snap.notes[c.id] ? snap.notes[c.id].slice(0, 10).map((n: Json) => ({ body: clip(n.body, 300), dateAdded: n.dateAdded ?? null })) : 'not read',
    tasks: snap.tasks[c.id] ? snap.tasks[c.id].slice(0, 10).map((t: Json) => ({ title: clip(t.title, 120), dueDate: t.dueDate ?? null, completed: !!t.completed })) : 'not read',
  }));
  const deals = snap.deals.slice(0, PROMPT_DEAL_CAP).map(d => ({
    id: d.id, name: str(d.name), contactId: d.contactId ?? null,
    pipeline: pipelineName.get(d.pipelineId) ?? d.pipelineId, pipelineId: d.pipelineId,
    stage: stageMap.get(d.pipelineStageId)?.name ?? d.pipelineStageId, stageId: d.pipelineStageId,
    status: d.status, monetaryValue: d.monetaryValue ?? null, createdAt: d.createdAt ?? null,
    lastStageChangeAt: d.lastStageChangeAt ?? null, updatedAt: d.updatedAt ?? null,
    days_since_stage_change: daysSince(d.lastStageChangeAt ?? d.updatedAt ?? d.createdAt),
  }));
  const data = {
    today: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' }),
    read_scope: {
      contacts_in_account: snap.contactsTotal, contacts_read: snap.contacts.length, contacts_shown_to_you: contacts.length,
      deals_in_account: snap.dealsTotal, deals_read: snap.deals.length, deals_shown_to_you: deals.length,
      notes_and_tasks_read_for_this_many_contacts: snap.notesTasksReadFor,
    },
    read_errors: snap.readErrors,
    pipelines: snap.pipelines.map(p => ({ id: p.id, name: str(p.name), stages: (p.stages ?? []).map((s: Json) => ({ id: s.id, name: str(s.name) })) })),
    workflows: snap.workflows.map(w => ({ id: w.id, name: str(w.name), status: w.status ?? null })),
    custom_fields: snap.customFields.map(f => ({ id: f.id, name: str(f.name), fieldKey: f.fieldKey ?? null, dataType: f.dataType ?? null, model: f.model ?? null })),
    contacts, deals,
    checks_run_by_code: {
      possible_duplicate_contacts: facts.dupGroups,
      contacts_with_missing_fields: facts.missing,
      deals_per_pipeline_stage_status: facts.dealsByStage,
      contacts_added_in_last_24_hours: facts.newLast24h,
    },
    audit_trail: audit,
  };
  return `You are Ryan Nakamura, CRM Management Agent for DRU AI Consulting — DeAnna R. Upshaw, AI Authority.

${RYAN_JOB_DESCRIPTION}

Here is what was read from the DRU AI Consulting GHL account today:
${JSON.stringify(data)}

Write one report with a section for each of the 16 jobs, in the order above. In each section give the finding, your suggestion, and what needs DeAnna's approval.

List each change that needs approval on its own line: the change, the contact or deal it applies to, its current value, and its new value.

${OUTPUT_FORMAT}`;
}

// ─── Parse and check what Ryan wrote ───
function parseJsonObject(text: string): Json | null {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
}

const CONTACT_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'address1', 'city', 'state', 'postalCode', 'website', 'timezone', 'country'];
const TEXT_TYPES = new Set(['TEXT', 'LARGE_TEXT', 'PHONE']);
const NEW_FIELD_TYPES = new Set(['TEXT', 'LARGE_TEXT', 'NUMERICAL', 'PHONE', 'DATE']);
const DEAL_STATUSES = new Set(['open', 'won', 'lost', 'abandoned']);

function checkChange(raw: Json, snap: Snapshot): Omit<RyanChange, 'id'> | null {
  if (!raw || typeof raw !== 'object') return null;
  const contactById = new Map<string, Json>(snap.contacts.map(c => [c.id, c]));
  const dealById = new Map<string, Json>(snap.deals.map(d => [d.id, d]));
  const stages = stageIndex(snap);
  const kind = str(raw.kind) as ChangeKind;
  const contact = raw.contact_id ? contactById.get(str(raw.contact_id)) : undefined;
  const base = (c: Json) => ({ target_type: 'contact' as const, target_id: c.id as string, target_label: contactName(c) });

  switch (kind) {
    case 'add_tag': {
      const tag = norm(raw.tag); if (!contact || !tag || tag.length > 100) return null;
      if ((contact.tags ?? []).some((t: string) => lc(t) === tag.toLowerCase())) return null;
      return { kind, ...base(contact), summary: `Add the tag "${tag}" to ${contactName(contact)}`, field: 'tags', current_value: (contact.tags ?? []).join(', ') || null, new_value: tag, overwrites: false, params: { tag } };
    }
    case 'remove_tag': {
      const wanted = norm(raw.tag); if (!contact || !wanted) return null;
      const existing = (contact.tags ?? []).find((t: string) => lc(t) === wanted.toLowerCase()); if (!existing) return null;
      return { kind, ...base(contact), summary: `Remove the tag "${existing}" from ${contactName(contact)}`, field: 'tags', current_value: existing, new_value: null, overwrites: false, params: { tag: existing } };
    }
    case 'update_contact_field': {
      const field = str(raw.field); if (!contact || !CONTACT_FIELDS.includes(field)) return null;
      const current = norm(contact[field]); const next = norm(raw.new_value);
      if (norm(raw.current_value) !== current) return null;           // Ryan must quote the value exactly as it stands in GHL
      if (!next || next === current || next.length > 500) return null; // never a blank over a value, never a no-op
      if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) return null;
      if (field === 'phone' && digits(next).length < 7) return null;
      return { kind, ...base(contact), summary: `Change ${field} for ${contactName(contact)}`, field, current_value: current || null, new_value: next, overwrites: !!current, params: { field } };
    }
    case 'update_custom_field': {
      const fieldId = str(raw.field_id); if (!contact || !fieldId) return null;
      const def = snap.customFields.find(f => f.id === fieldId && (f.model === 'contact' || !f.model)); if (!def || !TEXT_TYPES.has(str(def.dataType))) return null;
      const entry = (contact.customFields ?? []).find((f: Json) => f.id === fieldId);
      const current = norm(entry?.value ?? entry?.fieldValue ?? ''); const next = norm(raw.new_value);
      if (norm(raw.current_value) !== current) return null;
      if (!next || next === current || next.length > 1000) return null;
      return { kind, ...base(contact), summary: `Change "${str(def.name)}" for ${contactName(contact)}`, field: str(def.name), current_value: current || null, new_value: next, overwrites: !!current, params: { field_id: fieldId, field_name: str(def.name) } };
    }
    case 'add_note': {
      const note = str(raw.note); if (!contact || !note || note.length > 2000) return null;
      return { kind, ...base(contact), summary: `Add a note to ${contactName(contact)}`, field: 'note', current_value: null, new_value: note, overwrites: false, params: { note } };
    }
    case 'create_task': {
      const title = norm(raw.title); const days = Math.round(Number(raw.due_in_days));
      if (!contact || !title || title.length > 200 || !Number.isFinite(days) || days < 0 || days > 60) return null;
      const body = clip(raw.body, 1000);
      return { kind, ...base(contact), summary: `Create the task "${title}" for ${contactName(contact)}, due in ${days} day${days === 1 ? '' : 's'}`, field: 'task', current_value: null, new_value: title, overwrites: false, params: { title, body, due_in_days: days } };
    }
    case 'move_deal_stage': {
      const deal = dealById.get(str(raw.deal_id)); if (!deal || deal.status !== 'open') return null;
      const cur = str(raw.current_stage_id), nxt = str(raw.new_stage_id);
      if (cur !== deal.pipelineStageId || nxt === cur) return null;
      const curS = stages.get(cur), nxtS = stages.get(nxt);
      if (!curS || !nxtS || nxtS.pipelineId !== deal.pipelineId) return null;
      return { kind, target_type: 'deal', target_id: deal.id, target_label: str(deal.name) || deal.id, summary: `Move the deal "${str(deal.name)}" from ${curS.name} to ${nxtS.name} (${nxtS.pipelineName})`, field: 'stage', current_value: curS.name, new_value: nxtS.name, overwrites: false, params: { pipeline_id: deal.pipelineId, current_stage_id: cur, new_stage_id: nxt } };
    }
    case 'set_deal_status': {
      const deal = dealById.get(str(raw.deal_id)); if (!deal) return null;
      const cur = str(raw.current_status), nxt = str(raw.new_status);
      if (cur !== deal.status || !DEAL_STATUSES.has(nxt) || nxt === cur) return null;
      return { kind, target_type: 'deal', target_id: deal.id, target_label: str(deal.name) || deal.id, summary: `Mark the deal "${str(deal.name)}" as ${nxt}`, field: 'status', current_value: cur, new_value: nxt, overwrites: false, params: { current_status: cur, new_status: nxt } };
    }
    case 'enroll_workflow': {
      const wf = snap.workflows.find(w => w.id === str(raw.workflow_id)); if (!contact || !wf) return null;
      if (wf.status && lc(wf.status) !== 'published') return null;
      return { kind, ...base(contact), summary: `Add ${contactName(contact)} to the workflow "${str(wf.name)}"`, field: 'workflow', current_value: null, new_value: str(wf.name), overwrites: false, params: { workflow_id: wf.id, workflow_name: str(wf.name) } };
    }
    case 'create_custom_field': {
      const name = norm(raw.name); const dt = str(raw.data_type).toUpperCase(); const model = str(raw.model);
      if (!name || name.length > 100 || !NEW_FIELD_TYPES.has(dt) || !['contact', 'opportunity'].includes(model)) return null;
      if (snap.customFields.some(f => lc(f.name) === name.toLowerCase() && (f.model === model || !f.model))) return null;
      return { kind, target_type: 'account', target_id: GHL_LOCATION_ID, target_label: 'DRU AI Consulting GHL account', summary: `Create the ${model} custom field "${name}" (${dt})`, field: name, current_value: null, new_value: `${name} (${dt})`, overwrites: false, params: { name, data_type: dt, model } };
    }
    default: return null;
  }
}

function buildSections(parsed: Json | null, snap: Snapshot): RyanSection[] {
  const rawSections: Json[] = Array.isArray(parsed?.sections) ? parsed.sections : [];
  const seen = new Set<string>();
  return RYAN_JOBS.map(j => {
    const raw = rawSections.find(s => Number(s?.job) === j.job) ?? rawSections[j.job - 1] ?? null;
    const rawChanges: Json[] = Array.isArray(raw?.changes) ? raw.changes : [];
    const changes: RyanChange[] = []; let dropped = 0;
    for (const rc of rawChanges) {
      const ok = checkChange(rc, snap);
      if (!ok) { dropped++; continue; }
      const sig = `${ok.kind}|${ok.target_id}|${ok.field}|${ok.new_value}`;
      if (seen.has(sig)) { dropped++; continue; }
      seen.add(sig);
      changes.push({ ...ok, id: `${j.job}.${changes.length + 1}` });
    }
    return {
      job: j.job, group: j.group, title: j.title,
      finding: str(raw?.finding) || 'Ryan did not write a finding for this job.',
      suggestion: str(raw?.suggestion) || 'Ryan did not write a suggestion for this job.',
      changes, dropped,
    };
  });
}

function reportToText(r: RyanReport): string {
  const lines: string[] = [];
  lines.push(`CRM Review — Ryan Nakamura | read ${r.read_summary.contacts_read} of ${r.read_summary.contacts_total ?? '?'} contacts and ${r.read_summary.deals_read} of ${r.read_summary.deals_total ?? '?'} deals`);
  if (r.read_errors.length) { lines.push('GHL refused or failed these reads:'); r.read_errors.forEach(e => lines.push(`- ${e.what} (status ${e.status}): ${e.message}`)); }
  let group = '';
  for (const s of r.sections) {
    if (s.group !== group) { group = s.group; lines.push('', group.toUpperCase()); }
    lines.push('', `${s.job}. ${s.title}`, `Finding: ${s.finding}`, `Suggestion: ${s.suggestion}`);
    if (s.changes.length) {
      lines.push('Needs your approval:');
      s.changes.forEach(c => lines.push(`- ${c.summary} | ${c.target_label} | current: ${c.current_value ?? '(none)'} | new: ${c.new_value ?? '(none)'}`));
    } else lines.push('Needs your approval: nothing.');
  }
  return lines.join('\n');
}

// ─── Run 1: the daily report ───
export async function generateRyanReport(): Promise<{ approval_id: string | null; sections_with_changes: number; read_errors: number; note?: string }> {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Chicago' });
  const writeCard = async (record: Record<string, unknown>) => {
    const r = await sb('POST', 'approvals', {
      source: 'ryan_crm_report', trigger_type: 'crm_review', agent_name: 'Ryan Nakamura', agent_role: 'CRM Management (GHL)', division: 'Revenue, Growth & Sales',
      task_brief: `CRM Review — Ryan Nakamura | ${today}`, status: 'pending', notify_deanna: false, priority: 'normal', category: 'crm_review', platform: null, ...record,
    }, 'return=representation');
    return r.ok ? (r.data?.[0]?.id ?? null) : null;
  };

  try {
    const keyMissing = !process.env[RYAN_KEY_ENV];
    if (keyMissing) {
      const id = await writeCard({ output: `Ryan's CRM Review did not run today.\n\nRyan's GHL key is not available: ${RYAN_KEY_ENV} is not set in Vercel.\n\nNo changes are proposed.` });
      return { approval_id: id, sections_with_changes: 0, read_errors: 1, note: 'key missing' };
    }
    const snap = await readSnapshot();
    // Contacts are what most of the 16 jobs are about. Without them a report would be guesses, so no report is written.
    const coreRefused = snap.readErrors.some(e => e.what === 'contacts');
    if (coreRefused) {
      const id = await writeCard({ output: `Ryan's CRM Review did not run today.\n\nGHL refused to let Ryan read the contacts, so there is nothing reliable to report on. These reads failed:\n${snap.readErrors.map(e => `- ${e.what} (status ${e.status}): ${e.message}`).join('\n')}\n\nThis usually means the permissions on Ryan's GHL Private Integration need a second look.\nNo changes are proposed.` });
      return { approval_id: id, sections_with_changes: 0, read_errors: snap.readErrors.length, note: 'GHL refused the main reads' };
    }
    const audit = await auditFacts();
    const prompt = buildPrompt(snap, audit);

    let parsed: Json | null = null;
    for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
      const text = await callAnthropic(attempt === 0 ? prompt : `${prompt}\n\nYour last reply was not valid JSON. Return the JSON object only.`, 8000);
      parsed = parseJsonObject(text);
    }

    if (!parsed) {
      const id = await writeCard({ output: `Ryan's CRM Review could not be assembled today.\n\nWhat was read from GHL: ${snap.contacts.length} contacts, ${snap.deals.length} deals.\n${snap.readErrors.map(e => `- ${e.what} (status ${e.status}): ${e.message}`).join('\n') || 'GHL refused no reads.'}\n\nThe report text Ryan wrote could not be read as a report. No changes are proposed.` });
      return { approval_id: id, sections_with_changes: 0, read_errors: snap.readErrors.length, note: 'report text could not be parsed' };
    }

    const sections = buildSections(parsed, snap);
    const report: RyanReport = {
      v: 1, kind: 'ryan_crm_report', generated_at: new Date().toISOString(),
      read_summary: {
        contacts_total: snap.contactsTotal, contacts_read: snap.contacts.length,
        deals_total: snap.dealsTotal, deals_read: snap.deals.length,
        notes_tasks_read_for: snap.notesTasksReadFor,
        workflows_read: snap.workflows.length, custom_fields_read: snap.customFields.length, pipelines_read: snap.pipelines.length,
      },
      read_errors: snap.readErrors,
      sections, checked: [], approved_at: null, applied_at: null, results: {},
    };
    const id = await writeCard({ output: reportToText(report), original_content: JSON.stringify(report) });
    return { approval_id: id, sections_with_changes: sections.filter(s => s.changes.length > 0).length, read_errors: report.read_errors.length };
  } catch (err) {
    console.error('[ryan-crm] report failed:', err);
    const id = await writeCard({ output: `Ryan's CRM Review did not run today.\n\nReason: ${err instanceof Error ? err.message : String(err)}\n\nNo changes are proposed.` });
    return { approval_id: id, sections_with_changes: 0, read_errors: 0, note: 'report run failed' };
  }
}

// ─── Run 2: Ryan makes the approved changes ───
async function getContact(id: string): Promise<{ ok: boolean; contact: Json | null; error?: string }> {
  const r = await ghl('GET', `/contacts/${id}`);
  return { ok: r.ok, contact: r.ok ? (r.data?.contact ?? r.data) : null, error: r.error };
}
async function getDeal(id: string): Promise<{ ok: boolean; deal: Json | null; error?: string }> {
  const r = await ghl('GET', `/opportunities/${id}`);
  return { ok: r.ok, deal: r.ok ? (r.data?.opportunity ?? r.data) : null, error: r.error };
}

async function applyOne(c: RyanChange): Promise<ChangeResult> {
  const done = (): ChangeResult => ({ outcome: 'applied', reason: null });
  const skip = (reason: string): ChangeResult => ({ outcome: 'skipped', reason });
  const failed = (r: GhlResult): ChangeResult => ({ outcome: 'failed', reason: `GHL said ${r.status}: ${clip(r.error ?? 'no message', 160)}` });

  switch (c.kind) {
    case 'add_tag': case 'remove_tag': {
      const tag = str(c.params.tag);
      const cur = await getContact(c.target_id); if (!cur.ok || !cur.contact) return skip(`could not re-read the contact (${cur.error ?? 'no answer'})`);
      const has = (cur.contact.tags ?? []).some((t: string) => lc(t) === lc(tag));
      if (c.kind === 'add_tag') {
        if (has) return skip('the contact already has this tag');
        const r = await ghl('POST', `/contacts/${c.target_id}/tags`, { body: { tags: [tag] } }); return r.ok ? done() : failed(r);
      }
      if (!has) return skip('the contact no longer has this tag');
      const r = await ghl('DELETE', `/contacts/${c.target_id}/tags`, { body: { tags: [tag] } }); return r.ok ? done() : failed(r);
    }
    case 'update_contact_field': {
      const field = str(c.field); const cur = await getContact(c.target_id); if (!cur.ok || !cur.contact) return skip(`could not re-read the contact (${cur.error ?? 'no answer'})`);
      if (norm(cur.contact[field]) !== norm(c.current_value)) return skip('the value in GHL is different from what Ryan saw');
      if (!norm(c.new_value)) return skip('the new value was blank');
      const r = await ghl('PUT', `/contacts/${c.target_id}`, { body: { [field]: norm(c.new_value) } }); return r.ok ? done() : failed(r);
    }
    case 'update_custom_field': {
      const fieldId = str(c.params.field_id); const cur = await getContact(c.target_id); if (!cur.ok || !cur.contact) return skip(`could not re-read the contact (${cur.error ?? 'no answer'})`);
      const entry = (cur.contact.customFields ?? []).find((f: Json) => f.id === fieldId);
      if (norm(entry?.value ?? entry?.fieldValue ?? '') !== norm(c.current_value)) return skip('the value in GHL is different from what Ryan saw');
      if (!norm(c.new_value)) return skip('the new value was blank');
      const r = await ghl('PUT', `/contacts/${c.target_id}`, { body: { customFields: [{ id: fieldId, fieldValue: norm(c.new_value) }] } }); return r.ok ? done() : failed(r);
    }
    case 'add_note': {
      const note = str(c.params.note);
      const ex = await ghl('GET', `/contacts/${c.target_id}/notes`); if (!ex.ok) return skip(`could not re-read the notes (${ex.error ?? 'no answer'})`);
      if ((ex.data?.notes ?? []).some((n: Json) => norm(n.body) === norm(note))) return skip('the contact already has an identical note');
      const r = await ghl('POST', `/contacts/${c.target_id}/notes`, { body: { body: note } }); return r.ok ? done() : failed(r);
    }
    case 'create_task': {
      const title = str(c.params.title);
      const ex = await ghl('GET', `/contacts/${c.target_id}/tasks`); if (!ex.ok) return skip(`could not re-read the tasks (${ex.error ?? 'no answer'})`);
      if ((ex.data?.tasks ?? []).some((t: Json) => !t.completed && lc(t.title) === lc(title))) return skip('an open task with this title already exists');
      const due = new Date(Date.now() + Number(c.params.due_in_days ?? 1) * 86_400_000).toISOString();
      const r = await ghl('POST', `/contacts/${c.target_id}/tasks`, { body: { title, body: str(c.params.body), dueDate: due, completed: false } }); return r.ok ? done() : failed(r);
    }
    case 'move_deal_stage': {
      const cur = await getDeal(c.target_id); if (!cur.ok || !cur.deal) return skip(`could not re-read the deal (${cur.error ?? 'no answer'})`);
      if (cur.deal.status !== 'open') return skip('the deal is no longer open');
      if (cur.deal.pipelineStageId !== c.params.current_stage_id) return skip('the deal is in a different stage than Ryan saw');
      const r = await ghl('PUT', `/opportunities/${c.target_id}`, { body: { pipelineId: c.params.pipeline_id, pipelineStageId: c.params.new_stage_id } }); return r.ok ? done() : failed(r);
    }
    case 'set_deal_status': {
      const cur = await getDeal(c.target_id); if (!cur.ok || !cur.deal) return skip(`could not re-read the deal (${cur.error ?? 'no answer'})`);
      if (cur.deal.status !== c.params.current_status) return skip('the deal status is different from what Ryan saw');
      const r = await ghl('PUT', `/opportunities/${c.target_id}/status`, { body: { status: c.params.new_status } }); return r.ok ? done() : failed(r);
    }
    case 'enroll_workflow': {
      const cur = await getContact(c.target_id); if (!cur.ok || !cur.contact) return skip(`could not re-read the contact (${cur.error ?? 'no answer'})`);
      const r = await ghl('POST', `/contacts/${c.target_id}/workflow/${c.params.workflow_id}`, { body: {} }); return r.ok ? done() : failed(r);
    }
    case 'create_custom_field': {
      const ex = await ghl('GET', `/locations/${GHL_LOCATION_ID}/customFields`, { query: { model: 'all' } }); if (!ex.ok) return skip(`could not re-read the custom fields (${ex.error ?? 'no answer'})`);
      if ((ex.data?.customFields ?? []).some((f: Json) => lc(f.name) === lc(c.params.name) && (f.model === c.params.model || !f.model))) return skip('a custom field with this name already exists');
      const r = await ghl('POST', `/locations/${GHL_LOCATION_ID}/customFields`, { body: { name: c.params.name, dataType: c.params.data_type, model: c.params.model } }); return r.ok ? done() : failed(r);
    }
    default: return skip('Ryan does not know this kind of change');
  }
}

export async function applyApprovedChanges(approvalId: string, deadlineMs = Date.now() + 270_000): Promise<{ ok: boolean; error?: string; applied: number; skipped: number; failed: number; not_attempted: number }> {
  const none = { applied: 0, skipped: 0, failed: 0, not_attempted: 0 };
  const row = await sb('GET', `approvals?id=eq.${approvalId}&select=id,status,source,original_content&limit=1`);
  const approval = Array.isArray(row.data) ? row.data[0] : null;
  if (!approval) return { ok: false, error: 'approval not found', ...none };
  if (approval.source !== 'ryan_crm_report') return { ok: false, error: 'this is not a Ryan CRM Review card', ...none };
  if (approval.status !== 'approved') return { ok: false, error: `card status is "${approval.status}", not approved`, ...none };
  let report: RyanReport;
  try { report = JSON.parse(approval.original_content); } catch { return { ok: false, error: 'card has no readable report', ...none }; }
  if (report.applied_at) return { ok: true, error: 'these changes were already made', ...none };

  const checked = new Set<number>(report.checked ?? []);
  const results: Record<string, ChangeResult> = { ...(report.results ?? {}) };
  const counts = { ...none };

  for (const section of report.sections) {
    if (!checked.has(section.job)) continue;
    for (const change of section.changes) {
      if (results[change.id] && results[change.id].outcome !== 'not_attempted') continue;
      if (Date.now() > deadlineMs) { results[change.id] = { outcome: 'not_attempted', reason: 'ran out of time before Ryan reached this change — it was not made' }; counts.not_attempted++; continue; }

      // Claim the change first. The unique (approval_id, change_id) row means a change can never be made twice.
      const claim = await sb('POST', 'ryan_change_log', {
        approval_id: approvalId, change_id: change.id, section_id: section.job, kind: change.kind,
        target_type: change.target_type, target_id: change.target_id, target_label: change.target_label,
        field: change.field, value_before: change.current_value, value_after: change.new_value, outcome: 'started',
      }, 'return=minimal');
      if (!claim.ok) {
        const already = claim.status === 409;
        results[change.id] = { outcome: already ? 'skipped' : 'failed', reason: already ? 'Ryan already started this change earlier — check GHL before trying again' : 'could not write the audit log, so the change was not made' };
        counts[already ? 'skipped' : 'failed']++;
        continue;
      }

      let result: ChangeResult;
      try { result = await applyOne(change); } catch (err) { result = { outcome: 'failed', reason: err instanceof Error ? err.message : String(err) }; }
      results[change.id] = result;
      counts[result.outcome === 'applied' ? 'applied' : result.outcome === 'skipped' ? 'skipped' : 'failed']++;
      await sb('PATCH', `ryan_change_log?approval_id=eq.${approvalId}&change_id=eq.${encodeURIComponent(change.id)}`, { outcome: result.outcome, reason: result.reason, finished_at: new Date().toISOString() }, 'return=minimal');
      await sleep(120);
    }
  }

  const complete = counts.not_attempted === 0;
  const next: RyanReport = { ...report, results, applied_at: complete ? new Date().toISOString() : null };
  const save = await sb('PATCH', `approvals?id=eq.${approvalId}`, { original_content: JSON.stringify(next) }, 'return=minimal');
  return { ok: save.ok, error: save.ok ? undefined : 'changes were made but the card could not be updated', ...counts };
}
