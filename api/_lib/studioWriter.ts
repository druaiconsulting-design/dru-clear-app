// DRU AI Leadership Ecosystem™ — api/_lib/studioWriter.ts
// Shared writing helper for the Micro Drama Studio (Stage 2: Story and Script).
// A "writer" is one of DeAnna's agents, plain Claude, or plain ChatGPT. Every call is logged to
// studio_activity_log (shows on the Usage tab and in the project's cost chip) and, for Claude,
// to model_usage_log (the same record every other agent in the app writes to).
// Files that start with an underscore are not served as routes.

import { GENIUS_MODE, getAgentCorrections, fetchBrandCopy } from './agentKnowledge.js'
import { findEnv, logActivity, providerMessage, sbHeaders } from './hubShared.js'

type Cfg = { url: string; serviceKey: string }

export const CLAUDE_WRITING_MODEL = 'claude-sonnet-4-6'
export const CLAUDE_TIDY_MODEL = 'claude-haiku-4-5-20251001'
// Source: OpenAI developers changelog (Sep 22, 2026): GPT-6 Sol, Chat Completions API, $2 input / $10 output per 1M tokens.
export const OPENAI_WRITING_MODEL = 'gpt-6-sol'
const OPENAI_RATE = { in: 2, out: 10 }

export type Writer =
  | { kind: 'agent'; name: string; role: string; slug: string }
  | { kind: 'claude' }
  | { kind: 'chatgpt' }

export function writerLabel(w: Writer): string {
  return w.kind === 'agent' ? w.name : w.kind === 'claude' ? 'Claude' : 'ChatGPT'
}

export function openaiKey() {
  return findEnv(['VITE_OPENAI_API_KEY', 'OPENAI_API_KEY'], /OPENAI/, /ORG|PROJECT|MODEL|BASE|URL/)
}

// 'claude', 'chatgpt', or 'agent:<slug>' → a Writer, or a plain-English error.
export async function resolveWriter(cfg: Cfg, id: string): Promise<{ ok: true; writer: Writer } | { ok: false; error: string }> {
  if (id === 'claude') return { ok: true, writer: { kind: 'claude' } }
  if (id === 'chatgpt') return { ok: true, writer: { kind: 'chatgpt' } }
  const m = /^agent:([a-z0-9-]{1,60})$/.exec(id)
  if (!m) return { ok: false, error: 'Pick a writer first.' }
  const r = await fetch(`${cfg.url}/rest/v1/agents?slug=eq.${m[1]}&select=name,role,slug&limit=1`, { headers: sbHeaders(cfg.serviceKey) })
  const rows: any[] = r.ok ? await r.json() : []
  if (!rows[0]) return { ok: false, error: 'That agent could not be found.' }
  return { ok: true, writer: { kind: 'agent', name: rows[0].name, role: rows[0].role, slug: rows[0].slug } }
}

// The standing instructions a writer receives. Agents get the same shared knowledge the rest of the
// app gives them: Genius Mode, the brand positioning line, and their own saved corrections.
export async function writerSystemPrompt(w: Writer, job: string): Promise<string> {
  const grounding =
    'Ground every specific claim, result, number, credential and testimonial in the product details provided. ' +
    'Write in outcomes and principles wherever no specific detail is given. Keep every line within the "must never be said or shown" limits.'
  if (w.kind !== 'agent') {
    return `You are a skilled writer of micro dramas: short, emotionally gripping films that hold attention from the first second. ${job}\n\n${grounding}`
  }
  const [positioning, corrections] = await Promise.all([fetchBrandCopy('positioning'), getAgentCorrections(w.name)])
  return `${GENIUS_MODE}\n\nYou are ${w.name}, ${w.role} at DRU AI Consulting, working for DeAnna R. Upshaw. ` +
    `DeAnna has asked you to write for her Micro Drama Studio. ${job}\n\n` +
    (positioning ? `BRAND POSITIONING\n${positioning}\n\n` : '') +
    `${grounding}${corrections}`
}

export type Called = { ok: true; text: string; cost: number; model: string } | { ok: false; error: string }

// One writing call. Logs to the activity log on success and on failure.
export async function callWriter(
  cfg: Cfg,
  w: Writer,
  system: string,
  user: string,
  opts: { maxTokens: number; projectId: string | null; action: string; detail?: string; tidy?: boolean }
): Promise<Called> {
  const label = writerLabel(w)
  const detail = [label, opts.detail].filter(Boolean).join(' · ')

  if (w.kind === 'chatgpt') {
    const key = openaiKey()
    if (!key) return { ok: false, error: 'The OpenAI key is not available to the app yet. Check that VITE_OPENAI_API_KEY is shared with this project and redeploy.' }
    let r: Response
    try {
      r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key.value}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OPENAI_WRITING_MODEL,
          max_completion_tokens: opts.maxTokens * 2, // reasoning models spend part of this thinking
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        }),
      })
    } catch (e: any) {
      await logActivity(cfg, { project_id: opts.projectId, provider: 'openai', action: opts.action, detail, status: 'failed' })
      return { ok: false, error: `ChatGPT could not be reached: ${e?.message || 'network error'}` }
    }
    if (!r.ok) {
      const msg = providerMessage(await r.text())
      await logActivity(cfg, { project_id: opts.projectId, provider: 'openai', action: opts.action, detail, status: 'failed' })
      const money = r.status === 401 || r.status === 402 || r.status === 429 || /quota|billing|credit|fund|balance/i.test(msg)
      return { ok: false, error: `ChatGPT would not write this (${r.status}): ${msg}${money ? ' This may be where the OpenAI API account needs funds (separate from the ChatGPT subscription).' : ''}` }
    }
    const data: any = await r.json()
    const text: string = data?.choices?.[0]?.message?.content || ''
    const inTok = Number(data?.usage?.prompt_tokens || 0)
    const outTok = Number(data?.usage?.completion_tokens || 0)
    const cost = (inTok / 1e6) * OPENAI_RATE.in + (outTok / 1e6) * OPENAI_RATE.out
    await logActivity(cfg, {
      project_id: opts.projectId, provider: 'openai', action: opts.action, detail,
      units_label: `${inTok.toLocaleString()} in / ${outTok.toLocaleString()} out tokens`, est_cost_usd: Math.round(cost * 10000) / 10000,
    })
    if (!text.trim()) return { ok: false, error: 'ChatGPT returned an empty answer. Try again.' }
    return { ok: true, text, cost, model: OPENAI_WRITING_MODEL }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { ok: false, error: 'The Claude key is not available to the app.' }
  const model = opts.tidy ? CLAUDE_TIDY_MODEL : CLAUDE_WRITING_MODEL
  let r: Response
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: opts.maxTokens, system, messages: [{ role: 'user', content: user }] }),
    })
  } catch (e: any) {
    await logActivity(cfg, { project_id: opts.projectId, provider: 'claude', action: opts.action, detail, status: 'failed' })
    return { ok: false, error: `Claude could not be reached: ${e?.message || 'network error'}` }
  }
  if (!r.ok) {
    const msg = providerMessage(await r.text())
    await logActivity(cfg, { project_id: opts.projectId, provider: 'claude', action: opts.action, detail, status: 'failed' })
    const money = r.status === 402 || /credit|balance|billing/i.test(msg)
    return { ok: false, error: `Claude would not write this (${r.status}): ${msg}${money ? ' This may be where the Anthropic account needs funds.' : ''}` }
  }
  const data: any = await r.json()
  const text: string = (data?.content || []).map((b: any) => b?.text || '').join('')
  const inTok = Number(data?.usage?.input_tokens || 0)
  const outTok = Number(data?.usage?.output_tokens || 0)
  const rate = model.startsWith('claude-sonnet') ? { in: 3, out: 15 } : { in: 1, out: 5 } // same rates the rest of the app uses
  const cost = (inTok / 1e6) * rate.in + (outTok / 1e6) * rate.out
  try {
    await fetch(`${cfg.url}/rest/v1/model_usage_log`, {
      method: 'POST',
      headers: { ...sbHeaders(cfg.serviceKey), Prefer: 'return=minimal' },
      body: JSON.stringify({ source_file: 'hub-studio-writer', model, input_tokens: inTok, output_tokens: outTok, cost_usd: cost }),
    })
  } catch { /* usage record is best effort */ }
  await logActivity(cfg, {
    project_id: opts.projectId, provider: 'claude', action: opts.action, detail,
    units_label: `${inTok.toLocaleString()} in / ${outTok.toLocaleString()} out tokens`, est_cost_usd: Math.round(cost * 10000) / 10000,
  })
  if (!text.trim()) return { ok: false, error: 'Claude returned an empty answer. Try again.' }
  return { ok: true, text, cost, model }
}

// Pulls the first complete JSON object out of a model answer (models sometimes add a sentence or a code fence).
export function extractJson(text: string): any | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try { return JSON.parse(text.slice(start, end + 1)) } catch { return null }
}
