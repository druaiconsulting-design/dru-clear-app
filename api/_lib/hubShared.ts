// DRU AI Leadership Ecosystem™ — api/_lib/hubShared.ts
// Shared helpers for the Video Hub backends (voice-overs and HeyGen).
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
  let msg = `The shelf storage refused the file (${r.status}).`
  try { const b: any = await r.json(); msg = b?.message || b?.error || msg } catch { /* keep default */ }
  return { ok: false, error: msg }
}

export async function removeFromShelf(cfg: { url: string; serviceKey: string }, path: string) {
  try {
    const encoded = path.split('/').map(encodeURIComponent).join('/')
    await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${encoded}`, { method: 'DELETE', headers: sbHeaders(cfg.serviceKey) })
  } catch { /* best effort */ }
}

export async function insertShelfItem(cfg: { url: string; serviceKey: string }, row: Record<string, unknown>): Promise<{ id?: string; error?: string }> {
  const r = await fetch(`${cfg.url}/rest/v1/video_hub_items`, {
    method: 'POST',
    headers: { ...sbHeaders(cfg.serviceKey), Prefer: 'return=representation' },
    body: JSON.stringify(row),
  })
  if (!r.ok) return { error: `The shelf could not save the item (${r.status}): ${(await r.text()).slice(0, 200)}` }
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
