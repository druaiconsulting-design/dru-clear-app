// DRU AI Leadership Ecosystem™ — api/_lib/hubShared.ts
// Shared helpers for the Video Hub backends (HeyGen and ElevenLabs).
// Files that start with an underscore are not served as routes.

import type { VercelRequest, VercelResponse } from '@vercel/node'

export const ADMIN_EMAIL = 'deanna@druaiconsulting.com'
export const BUCKET = 'hub-videos'

export function fail(res: VercelResponse, status: number, error: string) {
  return res.status(status).json({ ok: false, error })
}

export function supabaseConfig(): { url: string; serviceKey: string } | null {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return { url, serviceKey }
}

export function sbHeaders(serviceKey: string) {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }
}

// Confirms the caller is DeAnna's admin login. Sends the error response itself when not.
export async function requireAdmin(req: VercelRequest, res: VercelResponse, url: string, serviceKey: string): Promise<boolean> {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) { fail(res, 401, 'Sign in again and retry.'); return false }
  const userRes = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${token}` } })
  if (!userRes.ok) { fail(res, 401, 'Sign in again and retry.'); return false }
  const user: any = await userRes.json()
  if (String(user?.email || '').toLowerCase() !== ADMIN_EMAIL) { fail(res, 403, 'Admin only.'); return false }
  return true
}

// Finds a variable by exact names first, then by a name pattern. Returns the name and value.
// Only names are ever reported back to the page, never values of keys.
export function findEnv(exact: string[], pattern?: RegExp, exclude?: RegExp): { name: string; value: string } | null {
  for (const n of exact) {
    const v = process.env[n]
    if (v) return { name: n, value: v }
  }
  if (pattern) {
    for (const n of Object.keys(process.env).sort()) {
      if (pattern.test(n) && !(exclude && exclude.test(n)) && process.env[n]) return { name: n, value: process.env[n]! }
    }
  }
  return null
}

export function namesMatching(pattern: RegExp): string[] {
  return Object.keys(process.env).filter(n => pattern.test(n)).sort()
}

export function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)
}

// Saves a file into the private hub-videos bucket (the shelf's storage).
export async function uploadToShelf(
  cfg: { url: string; serviceKey: string },
  path: string,
  bytes: Buffer,
  mime: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  const r = await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${encoded}`, {
    method: 'POST',
    headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}`, 'Content-Type': mime, 'x-upsert': 'false' },
    body: bytes as any,
  })
  if (r.ok) return { ok: true }
  let msg = `Video Que storage refused the file (${r.status}).`
  try { const b: any = await r.json(); msg = b?.message || b?.error || msg } catch { /* keep default */ }
  return { ok: false, error: msg }
}

export async function insertShelfItem(cfg: { url: string; serviceKey: string }, row: Record<string, unknown>): Promise<{ id?: string; error?: string }> {
  const r = await fetch(`${cfg.url}/rest/v1/video_hub_items`, {
    method: 'POST',
    headers: { ...sbHeaders(cfg.serviceKey), Prefer: 'return=representation' },
    body: JSON.stringify(row),
  })
  if (!r.ok) return { error: `Video Que could not save the item (${r.status}): ${(await r.text()).slice(0, 200)}` }
  const rows: any[] = await r.json()
  return { id: rows?.[0]?.id }
}

// Pulls a readable message out of a provider's error response.
export function providerMessage(raw: string): string {
  try {
    const b: any = JSON.parse(raw)
    const m = b?.detail?.message || b?.detail?.status || b?.error?.message || b?.message || b?.error || b?.detail
    if (typeof m === 'string' && m) return m
    if (m && typeof m === 'object') return JSON.stringify(m).slice(0, 300)
  } catch { /* not JSON */ }
  return raw.slice(0, 300)
}

export function heygenKey() {
  return findEnv(
    ['VITE_HEYGEN_API_KEY', 'HEYGEN_API_KEY'],
    /HEYGEN/,
    /AVATAR|VOICE|TYPE|STYLE|SECRET|WEBHOOK/
  )
}

// ── Activity log: every paid action the Micro Drama Studio and Travis's Videos take ──
export type StudioProvider = 'openai' | 'elevenlabs' | 'higgsfield' | 'heygen' | 'claude'

// Writes one line to studio_activity_log. Logging never stops the real work, so errors are swallowed.
// est_cost_usd stays empty when there is no verified rate for the provider; the Usage tab says so.
export async function logActivity(
  cfg: { url: string; serviceKey: string },
  row: {
    project_id?: string | null
    provider: StudioProvider
    action: string
    detail?: string | null
    units_label?: string | null
    est_cost_usd?: number | null
    status?: 'ok' | 'failed'
  }
): Promise<void> {
  try {
    await fetch(`${cfg.url}/rest/v1/studio_activity_log`, {
      method: 'POST',
      headers: { ...sbHeaders(cfg.serviceKey), Prefer: 'return=minimal' },
      body: JSON.stringify({
        project_id: row.project_id ?? null,
        provider: row.provider,
        action: row.action,
        detail: row.detail ? row.detail.slice(0, 300) : null,
        units_label: row.units_label ?? null,
        est_cost_usd: row.est_cost_usd ?? null,
        status: row.status || 'ok',
      }),
    })
  } catch { /* logging is best effort */ }
}

// ── ElevenLabs text-to-speech, used when a video is made with an ElevenLabs voice ──
export const ELEVEN_MAX_CHARS = 10000

export function elevenKey() {
  return findEnv(['VITE_ELEVENLABS_API_KEY', 'ELEVENLABS_API_KEY', 'XI_API_KEY'], /ELEVEN/, /VOICE|MODEL|AGENT/)
}

// Reads the script in the chosen voice. Returns the mp3 bytes, or a plain-English error.
export async function elevenSpeak(
  key: string, voiceId: string, text: string
): Promise<{ ok: true; audio: Buffer; model: string } | { ok: false; error: string }> {
  const speak = (model: string) =>
    fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: model }),
    })
  let model = 'eleven_v4'
  let r = await speak(model)
  if (!r.ok && [400, 404, 422].includes(r.status)) {
    const first = providerMessage(await r.text())
    if (!/model/i.test(first)) return { ok: false, error: `ElevenLabs would not make the voice (${r.status}): ${first}` }
    model = 'eleven_multilingual_v2'
    r = await speak(model)
  }
  if (!r.ok) {
    const msg = providerMessage(await r.text())
    const money = r.status === 401 || r.status === 402 || /quota|credit|subscription|plan|payment|upgrade|free/i.test(msg)
    return { ok: false, error: `ElevenLabs would not make the voice (${r.status}): ${msg}${money ? ' — this may be where ElevenLabs needs funds or a paid plan.' : ''}` }
  }
  const audio = Buffer.from(await r.arrayBuffer())
  if (!audio.length) return { ok: false, error: 'ElevenLabs returned an empty audio file.' }
  return { ok: true, audio, model }
}
