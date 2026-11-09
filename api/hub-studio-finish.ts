// DRU AI Leadership Ecosystem™ — api/hub-studio-finish.ts
// Micro Drama Studio, Stage 6: the Finish step. Admin only.
//   GET  ?view=finish&id=<project> → approved clips, recordings, music, the saved timeline/end card/versions, ad-policy result and exports
//   POST {action: ...} — save_finish, ad_check, upload_url, register_export, delete_export, export_to_queue
// The film itself is put together in the browser. This file stores the settings, runs the ad-policy check (Claude reads the words
// against Meta's and TikTok's published rules), hands the browser a one-time upload link for the finished file, and lists exports.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHash, randomUUID } from 'node:crypto'
import { fail, supabaseConfig, requireAdmin, insertShelfItem, safeName, BUCKET as SHELF_BUCKET } from './_lib/hubShared.js'
import { rest, UUID, type Cfg } from './_lib/studioData.js'
import { deleteStudioFile, signPaths, STUDIO_BUCKET } from './_lib/studioImages.js'
import { parseLines } from './_lib/studioLines.js'
import { callWriter, extractJson } from './_lib/studioWriter.js'

export const config = { maxDuration: 120 }

const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)
const VERSIONS = ['full', 'cut30', 'cut15'] as const
const SHAPES = ['film', '9:16', '1:1', '16:9'] as const
const encodePath = (p: string) => p.split('/').map(encodeURIComponent).join('/')

async function loadProject(cfg: Cfg, id: string): Promise<any | null> {
  const r = await rest(cfg, `micro_drama_projects?id=eq.${id}&select=id,title,settings,steps_done`)
  return r.ok && Array.isArray(r.body) ? r.body[0] || null : null
}
async function loadScenes(cfg: Cfg, id: string): Promise<any[]> {
  const r = await rest(cfg, `micro_drama_scenes?project_id=eq.${id}&select=id,position,start_s,end_s,dialogue,extra&order=position.asc&limit=2000`)
  return r.ok && Array.isArray(r.body) ? r.body : []
}

const finishOf = (settings: any) => {
  const f = settings?.finish && typeof settings.finish === 'object' ? settings.finish : {}
  const e = f.endcard && typeof f.endcard === 'object' ? f.endcard : {}
  return {
    order: Array.isArray(f.order) ? f.order.filter((x: unknown) => typeof x === 'string') : [],
    trims: f.trims && typeof f.trims === 'object' ? f.trims : {},
    include: f.include && typeof f.include === 'object' ? f.include : {},
    version: (VERSIONS as readonly string[]).includes(f.version) ? f.version : 'full',
    shape: (SHAPES as readonly string[]).includes(f.shape) ? f.shape : 'film',
    captions: f.captions === 'on' ? 'on' : 'off',
    endcard: { on: e.on === true, cta: str(e.cta, 200), website: str(e.website, 120), seconds: Math.min(8, Math.max(2, Math.round(Number(e.seconds) || 3))), logo: e.logo === 'product' ? 'product' : 'none' },
    ad_check: f.ad_check && typeof f.ad_check === 'object' ? f.ad_check : null,
    exports: Array.isArray(f.exports) ? f.exports : [],
  }
}

async function saveFinish(cfg: Cfg, projectId: string, settings: any, fin: Record<string, unknown>) {
  return rest(cfg, `micro_drama_projects?id=eq.${projectId}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ settings: { ...(settings || {}), finish: fin }, updated_at: new Date().toISOString() }),
  })
}

// Finish is done once a full-film export exists.
async function syncFinishStep(cfg: Cfg, projectId: string, settings: any, steps: string[]): Promise<string[]> {
  const done = finishOf(settings).exports.some((x: any) => x?.version === 'full')
  const next = steps.filter(s => s !== 'finish')
  if (done) next.push('finish')
  if (next.length !== steps.length || next.some(s => !steps.includes(s))) {
    await rest(cfg, `micro_drama_projects?id=eq.${projectId}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ steps_done: next, updated_at: new Date().toISOString() }) })
  }
  return next
}

const clipOk = (s: any) => !!s.extra?.video_path && s.extra?.video_approved === true
const audioOk = (s: any) => !!s.extra?.audio_path && s.extra?.audio_approved === true && s.extra?.audio_text === String(s.dialogue || '')
const sceneSeconds = (s: any) => Math.max(0, Number(s.end_s || 0) - Number(s.start_s || 0))

// The scenes that are in the selected version, in timeline order.
function selectedScenes(rows: any[], fin: ReturnType<typeof finishOf>): any[] {
  const byId = new Map(rows.map(s => [s.id, s]))
  const ordered = [...fin.order.map((id: string) => byId.get(id)).filter(Boolean), ...rows.filter(s => !fin.order.includes(s.id))]
  if (fin.version === 'full') return ordered
  const inc: string[] | undefined = Array.isArray(fin.include[fin.version]) ? fin.include[fin.version] : undefined
  return inc ? ordered.filter(s => inc.includes(s.id)) : ordered
}

// Everything the ad-policy check reads: the spoken words of the scenes in this version, plus the end card.
function adText(settings: any, rows: any[], fin: ReturnType<typeof finishOf>): string {
  const sound = String(settings?.film?.sound || '')
  const parts: string[] = []
  for (const s of selectedScenes(rows, fin)) {
    const lines = parseLines(s.dialogue, sound).lines
    for (const l of lines) parts.push(`Scene ${s.position} · spoken by ${l.speaker}: "${l.text}"`)
  }
  if (fin.endcard.on) {
    if (fin.endcard.cta) parts.push(`End card · call to action: "${fin.endcard.cta}"`)
    if (fin.endcard.website) parts.push(`End card · website: "${fin.endcard.website}"`)
  }
  return parts.join('\n')
}
const hashOf = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 16)

const POLICY_SYSTEM = `You review the words of a short AI-generated marketing film before it is posted as an ad on Meta and TikTok. Flag wording that could get the ad rejected, using only these published rules:

META (Advertising Standards, "Unrealistic outcomes"):
- Employment or income: guarantees of pay or employment without details; quick-profit or get-rich-quick claims; claims that someone can make money with little or no work; vague income offers such as "Make $1,000 every month."
- Health: claims to cure incurable or terminal conditions; specific results or testimonials without qualifying language; sensational clickbait; specific weight-loss promises.

TIKTOK (Advertising Policies, "Misleading and false content"):
- Ads that promise or exaggerate a product's effects, such as "Get slim legs right away" or "Get money in 10 seconds."
- Absolute terms about a product in relation to time, region or brand.
- Superlative and ranking claims such as "Number 1".
- Before-and-after comparisons that give a false or distorted impression of results.
- Comparative claims need supporting evidence or a clear disclaimer.
- Misleading calls to action, and promotion, price or discount details that do not match the landing page or leave out terms.

Also flag guarantee wording such as "risk-free", "guaranteed" or "money-back" so the owner confirms the terms are stated on the landing page.

The owner's confirmed product facts are provided. A statement that the confirmed facts plainly support is fine, except superlatives, absolutes and guarantees, which are always flagged for the owner to check. Quote the exact words. Flag only what the text contains; do not invent problems and do not rewrite the film.

Reply with JSON only, in this shape:
{"flags":[{"kind":"a short label such as Unsupported superlative, Exaggerated result, Income claim, Health claim, Guarantee wording, Before-and-after impression, Misleading call to action","where":"Scene 3 · spoken, or End card","quote":"the exact words","why":"one plain sentence on which published rule this touches","fix":"one plain sentence on how the owner could soften it or support it"}]}
If nothing needs attention, reply {"flags":[]}.`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return fail(res, 405, 'Method not allowed')
  const cfg = supabaseConfig()
  if (!cfg) return fail(res, 500, 'Supabase credentials are not configured for this app.')
  if (!(await requireAdmin(req, res, cfg.url, cfg.serviceKey))) return

  try {
    // ── Read ─────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const id = String(req.query.id || '')
      if (String(req.query.view || '') !== 'finish') return fail(res, 400, 'Unknown view.')
      if (!UUID.test(id)) return fail(res, 400, 'That project is not valid.')
      const proj = await loadProject(cfg, id)
      if (!proj) return fail(res, 404, 'That project was not found.')
      const rows = await loadScenes(cfg, id)
      const settings = proj.settings || {}
      const fin = finishOf(settings)
      const sound = String(settings.film?.sound || '')
      const music = settings.audio?.music && typeof settings.audio.music === 'object' ? settings.audio.music : null
      const productPath: string | null = settings.product_reference?.approved_path || null
      const urls = await signPaths(cfg, [
        ...rows.filter(clipOk).map(s => s.extra.video_path), ...rows.filter(audioOk).map(s => s.extra.audio_path),
        music?.approved ? music.path : null, productPath, ...fin.exports.map((x: any) => x?.path),
      ])
      const scenes = rows.map(s => ({
        id: s.id, position: s.position, needs_s: sceneSeconds(s) || 6,
        clip_key: clipOk(s) ? s.extra.video_path : null, clip_url: clipOk(s) ? urls[s.extra.video_path] || null : null,
        audio_key: audioOk(s) ? s.extra.audio_path : null, audio_url: audioOk(s) ? urls[s.extra.audio_path] || null : null,
        audio_seconds: typeof s.extra?.audio_seconds === 'number' ? s.extra.audio_seconds : null,
        lines: parseLines(s.dialogue, sound).lines,
      }))
      const stepsDone = await syncFinishStep(cfg, id, settings, proj.steps_done || [])
      return res.status(200).json({
        ok: true, steps_done: stepsDone, title: proj.title,
        film: { shape: String(settings.film?.shape || ''), sound, length_s: Number(settings.film?.length_s || 0) },
        scenes,
        music: music?.approved && music?.path ? { key: music.path, url: urls[music.path] || null } : null,
        product_photo: productPath ? { key: productPath, url: urls[productPath] || null } : null,
        product: { name: str(settings.product?.name, 200), link: str(settings.product?.link, 300) },
        finish: { order: fin.order, trims: fin.trims, include: fin.include, version: fin.version, shape: fin.shape, captions: fin.captions, endcard: fin.endcard },
        ad_check: fin.ad_check, ad_hash: hashOf(adText(settings, rows, fin)),
        exports: fin.exports.map((x: any) => ({ ...x, url: x?.path ? urls[x.path] || null : null })),
      })
    }

    // ── Writes ───────────────────────────────────────────────────────────────
    const b = (req.body || {}) as Record<string, any>
    const action = String(b.action || '')
    const bad = (m: string) => fail(res, 400, m)
    if (!UUID.test(String(b.project_id))) return bad('That project is not valid.')
    const projectId: string = b.project_id
    const proj = await loadProject(cfg, projectId)
    if (!proj) return fail(res, 404, 'That project was not found.')
    const settings = proj.settings || {}
    const fin = finishOf(settings)

    if (action === 'save_finish') {
      const f = (b.finish || {}) as Record<string, any>
      const next: Record<string, unknown> = { ...fin }
      if (Array.isArray(f.order)) next.order = f.order.filter((x: unknown) => typeof x === 'string' && UUID.test(x)).slice(0, 200)
      if (f.trims && typeof f.trims === 'object') {
        const t: Record<string, { in: number; out: number }> = {}
        for (const [k, v] of Object.entries(f.trims as Record<string, any>)) {
          if (!UUID.test(k) || !v || typeof v !== 'object') continue
          const i = Number(v.in), o = Number(v.out)
          if (Number.isFinite(i) && Number.isFinite(o) && i >= 0 && o > i) t[k] = { in: Math.round(i * 10) / 10, out: Math.round(o * 10) / 10 }
        }
        next.trims = t
      }
      if (f.include && typeof f.include === 'object') {
        const inc: Record<string, string[]> = {}
        for (const v of ['cut30', 'cut15']) if (Array.isArray(f.include[v])) inc[v] = f.include[v].filter((x: unknown) => typeof x === 'string' && UUID.test(x))
        next.include = { ...fin.include, ...inc }
      }
      if ((VERSIONS as readonly string[]).includes(f.version)) next.version = f.version
      if ((SHAPES as readonly string[]).includes(f.shape)) next.shape = f.shape
      if (f.captions === 'on' || f.captions === 'off') next.captions = f.captions
      if (f.endcard && typeof f.endcard === 'object') {
        const e = f.endcard
        next.endcard = {
          on: e.on === true, cta: str(e.cta, 200), website: str(e.website, 120),
          seconds: Math.min(8, Math.max(2, Math.round(Number(e.seconds) || 3))), logo: e.logo === 'product' ? 'product' : 'none',
        }
      }
      const r = await saveFinish(cfg, projectId, settings, next)
      return r.ok ? res.status(200).json({ ok: true }) : fail(res, 500, `That could not be saved (${r.status}).`)
    }

    if (action === 'ad_check') {
      const rows = await loadScenes(cfg, projectId)
      const text = adText(settings, rows, fin)
      const hash = hashOf(text)
      if (!text.trim()) {
        const r = await saveFinish(cfg, projectId, settings, { ...fin, ad_check: { hash, at: new Date().toISOString(), flags: [] } })
        return r.ok ? res.status(200).json({ ok: true, hash, flags: [] }) : fail(res, 500, `That could not be saved (${r.status}).`)
      }
      const p = settings.product || {}
      const facts = [
        `Product: ${str(p.name, 200)}`, `What it is: ${str(p.what, 1200)}`,
        p.audience ? `Who it is for: ${str(p.audience, 600)}` : '', p.link ? `Landing page: ${str(p.link, 300)}` : '',
        p.never ? `Must never be said or shown: ${str(p.never, 1000)}` : '',
      ].filter(Boolean).join('\n')
      const called = await callWriter(cfg, { kind: 'claude' }, POLICY_SYSTEM, `CONFIRMED PRODUCT FACTS\n${facts}\n\nTHE FILM'S WORDS\n${text}`, {
        maxTokens: 1800, projectId, action: 'ad-policy check', detail: `${fin.version === 'full' ? 'Full film' : fin.version === 'cut30' ? '30-second cutdown' : '15-second cutdown'}`,
      })
      if (!called.ok) return fail(res, 502, called.error)
      const parsed = extractJson(called.text)
      if (!parsed || !Array.isArray(parsed.flags)) return fail(res, 502, 'The ad-policy check came back in a form I could not read. Press Check again.')
      const flags = parsed.flags.slice(0, 20).map((x: any) => ({ kind: str(x?.kind, 80), where: str(x?.where, 80), quote: str(x?.quote, 300), why: str(x?.why, 300), fix: str(x?.fix, 300) })).filter((x: any) => x.kind && x.quote)
      const r = await saveFinish(cfg, projectId, settings, { ...fin, ad_check: { hash, at: new Date().toISOString(), flags } })
      return r.ok ? res.status(200).json({ ok: true, hash, flags }) : fail(res, 500, `That could not be saved (${r.status}).`)
    }

    if (action === 'upload_url') {
      const ext = b.mime === 'video/mp4' ? 'mp4' : b.mime === 'video/webm' ? 'webm' : ''
      if (!ext) return bad('The finished film must be an MP4 or WebM file.')
      const path = `projects/${projectId}/finish/film-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`
      const r = await fetch(`${cfg.url}/storage/v1/object/upload/sign/${STUDIO_BUCKET}/${encodePath(path)}`, {
        method: 'POST', headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}`, 'Content-Type': 'application/json' }, body: '{}',
      })
      if (!r.ok) return fail(res, 502, `Storage would not give an upload link (${r.status}).`)
      const j: any = await r.json()
      const token: string | undefined = j?.token || (typeof j?.url === 'string' ? new URL(j.url, cfg.url).searchParams.get('token') || undefined : undefined)
      if (!token) return fail(res, 502, 'Storage did not return an upload token.')
      return res.status(200).json({ ok: true, path, token })
    }

    if (action === 'register_export') {
      const path = str(b.path, 300)
      if (!path.startsWith(`projects/${projectId}/finish/`)) return bad('That file is not in this project.')
      const info = await fetch(`${cfg.url}/storage/v1/object/info/${STUDIO_BUCKET}/${encodePath(path)}`, { headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}` } })
      if (!info.ok) return bad('The finished film was not found in storage. Press Render again.')
      const version = (VERSIONS as readonly string[]).includes(b.version) ? b.version : 'full'
      const n = fin.exports.length + 1
      const entry = {
        id: randomUUID(), n, version, path, mime: b.mime === 'video/webm' ? 'video/webm' : 'video/mp4',
        created_at: new Date().toISOString(), seconds: Math.round(Number(b.seconds) * 100) / 100 || null,
        expected_seconds: Math.round(Number(b.expected_seconds) * 100) / 100 || null,
        width: Math.round(Number(b.width)) || null, height: Math.round(Number(b.height)) || null,
        bytes: Math.round(Number(b.bytes)) || null, verified: b.verified === true,
      }
      const next = { ...fin, exports: [...fin.exports, entry] }
      const r = await saveFinish(cfg, projectId, settings, next)
      if (!r.ok) { await deleteStudioFile(cfg, path); return fail(res, 500, `The export could not be recorded (${r.status}).`) }
      await syncFinishStep(cfg, projectId, { ...settings, finish: next }, proj.steps_done || [])
      return res.status(200).json({ ok: true })
    }

    if (action === 'export_to_queue') {
      const hit = fin.exports.find((x: any) => x?.id === b.export_id)
      if (!hit || !hit.path) return fail(res, 404, 'That export was not found.')
      if (hit.queue_item_id) return bad('That film is already in Video Que.')
      const ext = hit.mime === 'video/webm' ? 'webm' : 'mp4'
      const label = hit.version === 'cut30' ? '30-second cutdown' : hit.version === 'cut15' ? '15-second cutdown' : 'Full film'
      const title = `${str(proj.title, 120) || 'Micro drama'} · ${label} v${hit.n}`
      const dest = `${new Date().getFullYear()}/${randomUUID()}-${safeName(title)}.${ext}`
      const copy = await fetch(`${cfg.url}/storage/v1/object/copy`, {
        method: 'POST',
        headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketId: STUDIO_BUCKET, sourceKey: hit.path, destinationBucket: SHELF_BUCKET, destinationKey: dest }),
      })
      if (!copy.ok) return fail(res, 502, `Video Que could not receive the film (${copy.status}): ${(await copy.text()).slice(0, 200)}`)
      const ratio = hit.width && hit.height ? (hit.width === hit.height ? '1:1' : hit.height > hit.width ? '9:16' : '16:9') : null
      const saved = await insertShelfItem(cfg, {
        title, video_type: 'micro_drama', source: 'micro_drama_studio', aspect_ratio: ratio, storage_path: dest,
        file_name: `${safeName(title)}.${ext}`, file_size_bytes: hit.bytes || null, mime_type: hit.mime || 'video/mp4', status: 'ready',
        length_seconds: hit.seconds ? Math.round(hit.seconds) : null, notes: 'Made in the Micro Drama Studio Finish step.',
      })
      if (saved.error || !saved.id) {
        await fetch(`${cfg.url}/storage/v1/object/${SHELF_BUCKET}/${encodePath(dest)}`, { method: 'DELETE', headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}` } })
        return fail(res, 500, saved.error || 'Video Que could not record the film.')
      }
      const next = { ...fin, exports: fin.exports.map((x: any) => (x?.id === hit.id ? { ...x, queue_item_id: saved.id } : x)) }
      const r = await saveFinish(cfg, projectId, settings, next)
      if (!r.ok) return fail(res, 500, `The film is in Video Que, but this list could not be updated (${r.status}).`)
      return res.status(200).json({ ok: true, item_id: saved.id })
    }

    if (action === 'delete_export') {
      const hit = fin.exports.find((x: any) => x?.id === b.export_id)
      if (!hit) return fail(res, 404, 'That export was not found.')
      if (hit.path) await deleteStudioFile(cfg, hit.path)
      const next = { ...fin, exports: fin.exports.filter((x: any) => x?.id !== b.export_id) }
      const r = await saveFinish(cfg, projectId, settings, next)
      if (!r.ok) return fail(res, 500, `That could not be removed (${r.status}).`)
      await syncFinishStep(cfg, projectId, { ...settings, finish: next }, proj.steps_done || [])
      return res.status(200).json({ ok: true })
    }

    return fail(res, 400, 'Unknown request.')
  } catch (e: any) {
    console.error('[hub-studio-finish] failed:', e)
    return fail(res, 500, e?.message || 'The finish request failed.')
  }
}
