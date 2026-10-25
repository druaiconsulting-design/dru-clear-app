// api/pipeline-review.ts
// Pipeline Review — runs daily via dru-pipeline-review-daily
// Picks up governance_cleared items from CSQ. Raymond reads each agent's work and lists EVERY issue the
// agent states (no importance filter -- DeAnna decides what matters; only her named exclusions stay off;
// agent's own words, copied by code, never re-raised), and marks the item
// pipeline_approved for Raymond's synthesis run (api/raymond.ts), which builds the
// Business Outlook Corrections card from the new issues.
// FIX: extractJSON replaces greedy regex that was causing SyntaxError on complex content

import type { VercelRequest, VercelResponse } from "@vercel/node";
export const config = { maxDuration: 300 };

import { GENIUS_MODE } from './_lib/agentKnowledge.js';

interface CSQItem {
  id: string; agent_id: string; agent_name: string; division: string;
  task: string; category: string; raw_output: string; priority: string;
  retry_count?: number; raymond_notes?: string; raymond_action?: string;
  raymond_priority?: string; travis_notes?: string; priya_notes?: string;
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

// Logs every real API call's actual token usage and cost to Supabase so spend
// is visible in the Intelligence Hub instead of estimated by hand.
async function logModelUsage(model: string, inputTokens: number, outputTokens: number): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const rate = model.startsWith('claude-sonnet') ? { in: 3, out: 15 } : { in: 1, out: 5 };
  const cost_usd = (inputTokens / 1_000_000) * rate.in + (outputTokens / 1_000_000) * rate.out;
  await fetch(`${url}/rest/v1/model_usage_log`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ source_file: 'pipeline-review', model, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd }) });
}

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
  await logModelUsage('claude-haiku-4-5-20251001', data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0).catch(() => {});
  return data.content?.[0]?.text ?? '';
}

async function getCSQItems(status: string): Promise<CSQItem[]> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const res = await fetch(`${url}/rest/v1/chief_of_staff_queue?status=eq.${status}&order=created_at.asc`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
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

// ── Issues that need DeAnna (Business Outlook Corrections) ──────────────────────
// Raymond reads each agent's finished work and lists every issue the agent states. He does not judge importance.
// He never writes or rewrites the issue: he only points at the numbered paragraphs of the
// agent's own work, and the text is copied from the agent's own output by code -- so the
// issue DeAnna reads is the agent's own words, word for word, nothing shortened.
// Each issue is stored once in attention_items (permanent list, same pattern as grants).
// A later run never re-raises an issue that is already on the list, in any wording.

interface PastIssue { issue_text: string }

function stripAudit(raw: string): string {
  let out = raw;
  const cutoffs = ['## COMPLIANCE AUDIT', 'COMPLIANCE AUDIT', '## Isabella', 'CORRECTION REQUIRED', '===INTERNAL NOTES==='];
  for (const c of cutoffs) { const i = out.indexOf(c); if (i !== -1) out = out.slice(0, i); }
  // Formatting marks only (**bold**, # headers) -- the words themselves are untouched.
  return out.replace(/\*\*(.*?)\*\*/g, '$1').replace(/^#{1,6}\s*/gm, '').trim();
}

function issueTokens(text: string): Set<string> {
  return new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3));
}
function sameIssue(a: string, b: string): boolean {
  const ta = issueTokens(a); const tb = issueTokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let shared = 0; for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size) >= 0.6;
}

// Items the owner has said never to bring to her.
const EXCLUDED = /route (this |it |these )?to aaliyah|review (this|the|my) draft|trademark (symbol|check)|™[^.\n]{0,40}\bchecks?\b|\bchecks?\b[^.\n]{0,40}™/i;

async function getPastIssues(agentName: string): Promise<PastIssue[]> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const res = await fetch(`${url}/rest/v1/attention_items?agent_name=eq.${encodeURIComponent(agentName)}&select=issue_text&order=created_at.desc&limit=100`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  return res.ok ? await res.json() : [];
}

async function saveIssue(item: CSQItem, issueText: string): Promise<void> {
  const url = process.env.VITE_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const res = await fetch(`${url}/rest/v1/attention_items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=minimal' },
    body: JSON.stringify({ agent_id: item.agent_id, agent_name: item.agent_name, division: item.division, task: item.task, csq_id: item.id, issue_text: issueText }),
  });
  if (!res.ok) console.error(`[pipeline-review] attention_items write failed: ${await res.text()}`);
}

async function runPipelineReview(): Promise<{ reviewed: number; new_issues: number }> {
  const items = await getCSQItems('governance_cleared');
  console.log(`[pipeline-review] Reviewing ${items.length} governance-cleared items (Raymond solo -- one call per item)...`);
  if (items.length === 0) return { reviewed: 0, new_issues: 0 };
  let newIssues = 0;

  for (const item of items) {
    try {
      const paragraphs = stripAudit(item.raw_output ?? '').split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 0).slice(0, 60);
      const numbered = paragraphs.map((p, i) => `[${i + 1}] ${p}`).join('\n\n').slice(0, 20000);
      const past = await getPastIssues(item.agent_name);
      const pastList = past.slice(0, 30).map(p => `- ${p.issue_text.slice(0, 200).replace(/\s+/g, ' ')}`).join('\n') || '(none yet)';

      const rawRaymond = await callAnthropic(
        `${GENIUS_MODE}\nYou are Raymond Holloway, Chief of Staff for DRU AI Consulting. DeAnna R. Upshaw decides what matters to her, so every issue goes to her and you rank or filter none of them. Read ${item.agent_name}'s finished work (${item.division} | task: ${item.task}) and list every place the agent states a problem, a risk, a conflict, something blocked, a decision needed, or a question for DeAnna -- whatever its size.\n\nThe work is split into numbered paragraphs. You write and reword nothing. You point at the paragraph numbers where the agent states each issue, and include every paragraph the issue needs so it reads complete.\n\nThese items stay off the list, because DeAnna has asked to leave them out:\n- "please review this draft" and other ordinary requests to look over the agent's own work\n- anything about routing to Aaliyah or upsell routing\n- trademark symbol (TM) or "checks" items\n- an issue that is already on the list below, even if the wording differs\n\nISSUES ALREADY RAISED FOR THIS AGENT:\n${pastList}\n\nTHE WORK:\n${numbered}\n\nIf the agent states no new issue, return an empty list. Output ONLY this JSON: {"priority":"normal","issues":[[3],[7,8]]}  -- "issues" is a list of issues, each issue a list of paragraph numbers. "priority" is normal, high, or critical (critical for a true blocker).`,
        1000
      );

      const raymond = JSON.parse(extractJSON(rawRaymond));
      const raisedThisRun: string[] = [];
      const issues: unknown[] = Array.isArray(raymond?.issues) ? raymond.issues : [];
      for (const group of issues) {
        const nums = (Array.isArray(group) ? group : [group]).map(n => Number(n)).filter(n => Number.isInteger(n) && n >= 1 && n <= paragraphs.length);
        if (nums.length === 0) continue;
        const text = [...new Set(nums)].sort((a, b) => a - b).map(n => paragraphs[n - 1]).join('\n\n');
        if (EXCLUDED.test(text)) continue;
        if (past.some(p => sameIssue(p.issue_text, text)) || raisedThisRun.some(t => sameIssue(t, text))) continue;
        await saveIssue(item, text);
        raisedThisRun.push(text);
        newIssues++;
      }

      const priority = ['normal', 'high', 'critical'].includes(raymond?.priority) ? raymond.priority : 'normal';
      await updateCSQ(item.id, {
        raymond_reviewed: true,
        raymond_notes: '',
        raymond_priority: priority,
        raymond_action: raisedThisRun.length > 0 ? 'needs_deanna' : 'no_issue',
        travis_notes: '',
        priya_notes: '',
        pipeline_approved_at: new Date().toISOString(),
        status: 'pipeline_approved',
        priority,
      });

      console.log(`[pipeline-review] Approved: ${item.agent_name} (${raisedThisRun.length} new issue${raisedThisRun.length === 1 ? '' : 's'})`);
    } catch (error) {
      console.error(`[pipeline-review] Failed item ${item.id}:`, error);
    }
  }

  console.log(`[pipeline-review] ${items.length} items pipeline-approved, ${newIssues} new issues`);
  return { reviewed: items.length, new_issues: newIssues };
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
  console.log('[pipeline-review] Raymond Holloway running pipeline review');
  const result = await runPipelineReview();
  res.status(202).json({ success: true, ...result });
}
