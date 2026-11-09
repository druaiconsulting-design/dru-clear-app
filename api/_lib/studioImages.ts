// DRU AI Leadership Ecosystem™ — api/_lib/studioImages.ts
// Pictures for the Micro Drama Studio (Stage 3): OpenAI picture calls, the private studio-media storage,
// and signed links so the page can show the pictures. Every picture is logged for the Usage tab.
// Files that start with an underscore are not served as routes.

import { logActivity, providerMessage } from './hubShared.js'
import { openaiKey } from './studioWriter.js'
import { rest, UUID, type Cfg } from './studioData.js'

export const STUDIO_BUCKET = 'studio-media'
// Source: OpenAI image generation guide. gpt-image-2.5-sunburst is the editing-precision model; the guide lists
// $30 per 1M image output tokens, $8 per 1M image input tokens and $5 per 1M text input tokens for GPT Image 2.5.
export const IMAGE_MODEL = 'gpt-image-2.5-sunburst'
const RATE = { out: 30, imgIn: 8, textIn: 5 }

export const CAST_SIZE = '1024x1536'

// Picture sizes by film shape. OpenAI needs multiples of 16 and between 1:3 and 3:1.
export function frameSize(shape: string | undefined): string | null {
  const s = String(shape || '')
  if (/9\s*:\s*16/.test(s)) return '864x1536'
  if (/16\s*:\s*9/.test(s)) return '1536x864'
  if (/1\s*:\s*1/.test(s)) return '1024x1024'
  return null
}

export type Ref = { bytes: Buffer; mime: string }
export type Made = { ok: true; bytes: Buffer; mime: string; cost: number; tokens: string } | { ok: false; error: string }

// One picture. With reference pictures it uses the edits endpoint; without, plain generation.
export async function makePicture(
  cfg: Cfg,
  opts: { prompt: string; size: string; quality: 'low' | 'medium'; refs: Ref[]; projectId: string | null; action: string; detail?: string }
): Promise<Made> {
  const key = openaiKey()
  if (!key) return { ok: false, error: 'The OpenAI key is not available to the app yet. Check that VITE_OPENAI_API_KEY is shared with this project and redeploy.' }
  const fields = { model: IMAGE_MODEL, prompt: opts.prompt, size: opts.size, quality: opts.quality, output_format: 'jpeg', n: '1' }
  const fail = async (r: Response | null, text: string) => {
    await logActivity(cfg, { project_id: opts.projectId, provider: 'openai', action: opts.action, detail: opts.detail, status: 'failed' })
    return { ok: false as const, error: text }
  }

  let r: Response
  try {
    if (opts.refs.length) {
      const form = new FormData()
      for (const [k, v] of Object.entries(fields)) form.append(k, v)
      opts.refs.forEach((ref, i) => form.append('image[]', new Blob([ref.bytes as any], { type: ref.mime }), `reference-${i + 1}.${ref.mime === 'image/png' ? 'png' : ref.mime === 'image/webp' ? 'webp' : 'jpg'}`))
      r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key.value}` }, body: form })
    } else {
      r = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST', headers: { Authorization: `Bearer ${key.value}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, n: 1 }),
      })
    }
  } catch (e: any) {
    return fail(null, `OpenAI could not be reached: ${e?.message || 'network error'}`)
  }
  if (!r.ok) {
    const msg = providerMessage(await r.text())
    const money = r.status === 401 || r.status === 402 || r.status === 429 || /quota|billing|credit|fund|balance/i.test(msg)
    const verify = /verif/i.test(msg)
    return fail(r, `OpenAI would not make this picture (${r.status}): ${msg}${money ? ' This may be where the OpenAI API account needs funds (separate from the ChatGPT subscription).' : ''}${verify ? ' OpenAI may need Organization Verification completed in your OpenAI account before picture models work.' : ''}`)
  }
  const data: any = await r.json()
  const b64: string | undefined = data?.data?.[0]?.b64_json
  if (!b64) return fail(r, 'OpenAI returned no picture. Try again.')
  const u = data?.usage || {}
  const out = Number(u.output_tokens || 0)
  const imgIn = Number(u.input_tokens_details?.image_tokens || 0)
  const textIn = u.input_tokens_details?.text_tokens != null ? Number(u.input_tokens_details.text_tokens) : Math.max(0, Number(u.input_tokens || 0) - imgIn)
  const cost = (out / 1e6) * RATE.out + (imgIn / 1e6) * RATE.imgIn + (textIn / 1e6) * RATE.textIn
  const tokens = `${out.toLocaleString()} picture tokens out, ${(imgIn + textIn).toLocaleString()} in`
  await logActivity(cfg, {
    project_id: opts.projectId, provider: 'openai', action: opts.action, detail: opts.detail,
    units_label: `${opts.quality} quality · ${opts.size} · ${tokens}`, est_cost_usd: Math.round(cost * 10000) / 10000,
  })
  return { ok: true, bytes: Buffer.from(b64, 'base64'), mime: 'image/jpeg', cost, tokens }
}

const encodePath = (p: string) => p.split('/').map(encodeURIComponent).join('/')

export async function saveStudioFile(cfg: Cfg, path: string, bytes: Buffer, mime: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await fetch(`${cfg.url}/storage/v1/object/${STUDIO_BUCKET}/${encodePath(path)}`, {
    method: 'POST',
    headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}`, 'Content-Type': mime, 'x-upsert': 'false' },
    body: bytes as any,
  })
  if (r.ok) return { ok: true }
  let msg = `Storage refused the picture (${r.status}).`
  try { const b: any = await r.json(); msg = b?.message || b?.error || msg } catch { /* keep default */ }
  return { ok: false, error: msg }
}

export async function readStudioFile(cfg: Cfg, path: string): Promise<Ref | null> {
  const r = await fetch(`${cfg.url}/storage/v1/object/${STUDIO_BUCKET}/${encodePath(path)}`, { headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}` } })
  if (!r.ok) return null
  return { bytes: Buffer.from(await r.arrayBuffer()), mime: r.headers.get('content-type')?.split(';')[0] || 'image/jpeg' }
}

export async function deleteStudioFile(cfg: Cfg, path: string): Promise<void> {
  try {
    await fetch(`${cfg.url}/storage/v1/object/${STUDIO_BUCKET}/${encodePath(path)}`, { method: 'DELETE', headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}` } })
  } catch { /* cleanup is best effort */ }
}

// An agent's public photo, as a reference picture.
export async function fetchPhoto(url: string): Promise<Ref | null> {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const mime = r.headers.get('content-type')?.split(';')[0] || 'image/png'
    if (!/^image\/(png|jpeg|webp)$/.test(mime)) return null
    return { bytes: Buffer.from(await r.arrayBuffer()), mime }
  } catch { return null }
}

// Links the page can show for private pictures (valid for an hour).
export async function signPaths(cfg: Cfg, paths: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)))
  if (!unique.length) return {}
  const r = await fetch(`${cfg.url}/storage/v1/object/sign/${STUDIO_BUCKET}`, {
    method: 'POST', headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 3600, paths: unique }),
  })
  const out: Record<string, string> = {}
  if (!r.ok) return out
  const rows: any[] = await r.json()
  for (const row of rows) if (row?.signedURL && row?.path) out[row.path] = `${cfg.url}/storage/v1${row.signedURL}`
  return out
}

// A browser upload arrives as a data URL. Returns the picture bytes, or a plain-English error.
export function parseDataUrl(dataUrl: string): { ok: true; bytes: Buffer; mime: string } | { ok: false; error: string } {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''))
  if (!m) return { ok: false, error: 'Upload a JPG, PNG or WebP picture.' }
  const bytes = Buffer.from(m[2], 'base64')
  if (bytes.length > 4 * 1024 * 1024) return { ok: false, error: 'That picture is too large. Use one under 4 MB.' }
  return { ok: true, bytes, mime: m[1] }
}

export const extFor = (mime: string) => (mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg')

// Recomputes whether the Cast and Storyboard steps are done: Cast when every character and the product have an approved picture,
// Storyboard when every scene has an approved frame.
export async function syncPictureSteps(cfg: Cfg, projectId: string): Promise<string[]> {
  if (!UUID.test(projectId)) return []
  const [proj, chars, scenes] = await Promise.all([
    rest(cfg, `micro_drama_projects?id=eq.${projectId}&select=steps_done,settings`),
    rest(cfg, `micro_drama_characters?project_id=eq.${projectId}&select=approved_path`),
    rest(cfg, `micro_drama_scenes?project_id=eq.${projectId}&select=frame_path,extra`),
  ])
  const steps: string[] = proj.ok && proj.body?.[0]?.steps_done ? proj.body[0].steps_done : []
  const productApproved = !!(proj.ok && proj.body?.[0]?.settings?.product_reference?.approved_path)
  const castDone = productApproved && Array.isArray(chars.body) && chars.body.length > 0 && chars.body.every((c: any) => !!c.approved_path)
  const boardDone = Array.isArray(scenes.body) && scenes.body.length > 0 && scenes.body.every((s: any) => !!s.frame_path && s.extra?.frame_approved === true)
  let next = steps.filter(s => s !== 'cast' && s !== 'storyboard')
  if (castDone) next.push('cast')
  if (boardDone) next.push('storyboard')
  next = Array.from(new Set(next))
  if (next.length !== steps.length || next.some(s => !steps.includes(s))) {
    await rest(cfg, `micro_drama_projects?id=eq.${projectId}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ steps_done: next, updated_at: new Date().toISOString() }) })
  }
  return next
}
