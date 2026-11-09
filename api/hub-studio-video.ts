// DRU AI Leadership Ecosystem™ — api/hub-studio-video.ts
// Micro Drama Studio, Stage 5: the Video step. Admin only.
//   GET  ?view=video&id=<project>   → each scene's starting frame, prompt, settings and clip (as links the page can play)
//   POST {action: ...} — save_clip_settings, make_clip, check_clip, cancel_clip, approve_clip, delete_clip, upload_clip
// Clips are made by Higgsfield (Seedance 2.5 image-to-video). A clip is started, then checked on until it is ready; the finished
// file is copied into the private studio-media storage because Higgsfield deletes its copy after 7 days.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'
import { fail, supabaseConfig, requireAdmin, findEnv, namesMatching, providerMessage, logActivity } from './_lib/hubShared.js'
import { rest, UUID, type Cfg } from './_lib/studioData.js'
import { saveStudioFile, readStudioFile, deleteStudioFile, signPaths } from './_lib/studioImages.js'

export const config = { maxDuration: 300 }

const HF = 'https://api.higgsfield.ai'
const MODEL_PATH = 'bytedance/seedance-2.5/image-to-video'
// Measured on the real Higgsfield bill (Nov 9, 2026): a 6-second 720p clip with sound off cost $2.36, which is $0.3933 per second.
// Other resolutions have not been measured, so they use the same rate as an estimate.
const FROM_USD_PER_SECOND = 2.36 / 6
const RESOLUTIONS = ['480p', '720p', '1080p']
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024

const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)
const clampLength = (n: unknown, fallback: number) => {
  const v = Math.round(Number(n))
  return Math.min(30, Math.max(4, Number.isFinite(v) && v > 0 ? v : fallback))
}

async function one(cfg: Cfg, table: string, id: string, select = '*'): Promise<any | null> {
  const r = await rest(cfg, `${table}?id=eq.${id}&select=${select}`)
  return r.ok && Array.isArray(r.body) ? r.body[0] || null : null
}

// The Higgsfield credential is "KEY_ID:KEY_SECRET". It can be saved whole in HIGGSFIELD_API_KEY, or as the key id there and the secret in a second variable.
function higgsAuth(): { ok: true; header: string } | { ok: false; error: string } {
  const key = findEnv(['HIGGSFIELD_API_KEY', 'VITE_HIGGSFIELD_API_KEY', 'HF_KEY', 'HF_CREDENTIALS'], /HIGGS|^HF_/, /SECRET/)
  const seen = namesMatching(/HIGGS|^HF_/)
  if (!key) return { ok: false, error: `Higgsfield is not connected yet. This app cannot see the Higgsfield key (looked for HIGGSFIELD_API_KEY). Higgsfield variables it can see: ${seen.length ? seen.join(', ') : 'none'}.` }
  if (key.value.includes(':')) return { ok: true, header: `Key ${key.value}` }
  const secret = findEnv(['HIGGSFIELD_API_SECRET', 'HIGGSFIELD_API_KEY_SECRET', 'VITE_HIGGSFIELD_API_SECRET', 'HF_API_KEY_SECRET', 'HF_SECRET'], /(HIGGS|^HF_).*SECRET/)
  if (secret) return { ok: true, header: `Key ${key.value}:${secret.value}` }
  return { ok: false, error: `Higgsfield's credential is incomplete. The API needs the Key ID and the Secret written together as KEY_ID:KEY_SECRET in ${key.name}, or the Secret saved in a second variable named HIGGSFIELD_API_SECRET. Higgsfield variables this app can see: ${seen.join(', ')}.` }
}

const defaultPrompt = (s: any) => [
  str(s.what_we_see, 600),
  str(s.emotional_beat, 200) ? `Emotion: ${str(s.emotional_beat, 200)}` : '',
  str(s.camera, 300) ? `Camera: ${str(s.camera, 300)}` : '',
].filter(Boolean).join(' ')

const sceneSeconds = (s: any) => Math.max(0, Number(s.end_s || 0) - Number(s.start_s || 0))

async function syncVideoStep(cfg: Cfg, projectId: string): Promise<string[]> {
  const [proj, scenes] = await Promise.all([
    rest(cfg, `micro_drama_projects?id=eq.${projectId}&select=steps_done`),
    rest(cfg, `micro_drama_scenes?project_id=eq.${projectId}&select=extra`),
  ])
  const steps: string[] = proj.ok && proj.body?.[0]?.steps_done ? proj.body[0].steps_done : []
  const rows: any[] = Array.isArray(scenes.body) ? scenes.body : []
  const done = rows.length > 0 && rows.every(s => !!s.extra?.video_path && s.extra?.video_approved === true)
  const next = steps.filter(s => s !== 'video')
  if (done) next.push('video')
  if (next.length !== steps.length || next.some(s => !steps.includes(s))) {
    await rest(cfg, `micro_drama_projects?id=eq.${projectId}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ steps_done: next, updated_at: new Date().toISOString() }) })
  }
  return next
}

const patchExtra = (cfg: Cfg, sceneId: string, extra: Record<string, unknown>) =>
  rest(cfg, `micro_drama_scenes?id=eq.${sceneId}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ extra }) })

const needsFunds = (status: number, msg: string) => status === 401 || status === 402 || status === 403 || status === 429 || /credit|balance|fund|billing|insufficient|payment/i.test(msg)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return fail(res, 405, 'Method not allowed')
  const cfg = supabaseConfig()
  if (!cfg) return fail(res, 500, 'Supabase credentials are not configured for this app.')
  if (!(await requireAdmin(req, res, cfg.url, cfg.serviceKey))) return

  try {
    // ── Read ─────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const id = String(req.query.id || '')
      if (String(req.query.view || '') !== 'video') return fail(res, 400, 'Unknown view.')
      if (!UUID.test(id)) return fail(res, 400, 'That project is not valid.')
      const [proj, sc] = await Promise.all([
        one(cfg, 'micro_drama_projects', id, 'id,settings'),
        rest(cfg, `micro_drama_scenes?project_id=eq.${id}&select=id,position,start_s,end_s,what_we_see,emotional_beat,camera,frame_path,extra&order=position.asc&limit=2000`),
      ])
      if (!proj) return fail(res, 404, 'That project was not found.')
      if (!sc.ok) return fail(res, 500, `The scenes could not be read (${sc.status}).`)
      const rows: any[] = sc.body
      const urls = await signPaths(cfg, rows.flatMap(s => [s.frame_path, s.extra?.video_path]))
      const auth = higgsAuth()
      const scenes = rows.map(s => {
        const x = s.extra || {}
        const prompt = typeof x.video_prompt === 'string' ? x.video_prompt : defaultPrompt(s)
        const length = clampLength(x.video_length, sceneSeconds(s) || 5)
        const resolution = RESOLUTIONS.includes(x.video_resolution) ? x.video_resolution : '720p'
        const made = x.video_made && typeof x.video_made === 'object' ? x.video_made : null
        return {
          id: s.id, position: s.position, scene_seconds: sceneSeconds(s),
          frame_key: s.frame_path || null, frame_url: s.frame_path ? urls[s.frame_path] || null : null, frame_approved: x.frame_approved === true,
          prompt, length, resolution,
          status: x.video_status || (x.video_path ? 'completed' : 'none'), error: x.video_error || null,
          clip_key: x.video_path || null, clip_url: x.video_path ? urls[x.video_path] || null : null, source: x.video_source || (x.video_path ? 'made' : null),
          cost_usd: typeof x.video_cost === 'number' ? x.video_cost : null, approved: x.video_approved === true && !!x.video_path,
          needs_review: !!x.video_path && !!made && (made.frame_path !== s.frame_path || made.prompt !== prompt),
          estimate_usd: Math.round(length * FROM_USD_PER_SECOND * 100) / 100,
        }
      })
      const stepsDone = await syncVideoStep(cfg, id)
      return res.status(200).json({ ok: true, steps_done: stepsDone, key_error: auth.ok ? null : auth.error, scenes })
    }

    // ── Writes ───────────────────────────────────────────────────────────────
    const b = (req.body || {}) as Record<string, any>
    const action = String(b.action || '')
    const bad = (m: string) => fail(res, 400, m)
    const scene = UUID.test(String(b.scene_id)) ? await one(cfg, 'micro_drama_scenes', b.scene_id, 'id,project_id,position,start_s,end_s,what_we_see,emotional_beat,camera,frame_path,extra') : null
    if (!scene) return fail(res, 404, 'That scene was not found.')
    const x: Record<string, any> = { ...(scene.extra || {}) }

    if (action === 'save_clip_settings') {
      if (typeof b.prompt === 'string') x.video_prompt = str(b.prompt, 4000)
      if (b.length !== undefined) x.video_length = clampLength(b.length, 5)
      if (RESOLUTIONS.includes(b.resolution)) x.video_resolution = b.resolution
      const r = await patchExtra(cfg, scene.id, x)
      return r.ok ? res.status(200).json({ ok: true }) : fail(res, 500, `That could not be saved (${r.status}).`)
    }

    if (action === 'approve_clip') {
      if (!x.video_path) return bad('Make or upload a clip first.')
      x.video_approved = b.approved !== false
      const r = await patchExtra(cfg, scene.id, x)
      if (!r.ok) return fail(res, 500, `That could not be saved (${r.status}).`)
      await syncVideoStep(cfg, scene.project_id)
      return res.status(200).json({ ok: true })
    }

    if (action === 'delete_clip') {
      if (x.video_status === 'queued' || x.video_status === 'in_progress') return bad('This clip is still being made. Cancel it first, or wait for it to finish.')
      if (x.video_path) await deleteStudioFile(cfg, x.video_path)
      for (const k of ['video_path', 'video_cost', 'video_approved', 'video_made', 'video_status', 'video_error', 'video_request_id', 'video_status_url', 'video_cancel_url', 'video_source', 'video_started_at']) delete x[k]
      const r = await patchExtra(cfg, scene.id, x)
      if (!r.ok) return fail(res, 500, `That could not be removed (${r.status}).`)
      await syncVideoStep(cfg, scene.project_id)
      return res.status(200).json({ ok: true })
    }

    if (action === 'upload_clip') {
      const m = /^data:(video\/(?:mp4|quicktime));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.data_url || ''))
      if (!m) return bad('Upload an MP4 or MOV clip.')
      const bytes = Buffer.from(m[2], 'base64')
      if (bytes.length > MAX_UPLOAD_BYTES) return bad('That clip is too large to upload here. Use one under 3 MB.')
      const path = `projects/${scene.project_id}/video/scene-${scene.position}-${Date.now()}.${m[1] === 'video/quicktime' ? 'mov' : 'mp4'}`
      const saved = await saveStudioFile(cfg, path, bytes, m[1])
      if (!saved.ok) return fail(res, 500, saved.error)
      const old = x.video_path
      Object.assign(x, { video_path: path, video_source: 'upload', video_status: 'completed', video_approved: false, video_cost: null, video_made: null, video_error: null })
      delete x.video_request_id; delete x.video_status_url; delete x.video_cancel_url
      const r = await patchExtra(cfg, scene.id, x)
      if (!r.ok) { await deleteStudioFile(cfg, path); return fail(res, 500, `The clip could not be saved (${r.status}).`) }
      if (old) await deleteStudioFile(cfg, old)
      await syncVideoStep(cfg, scene.project_id)
      return res.status(200).json({ ok: true })
    }

    // Everything below talks to Higgsfield.
    const auth = higgsAuth()
    if (!auth.ok) return fail(res, 500, auth.error)
    const headers = { Authorization: auth.header, Accept: 'application/json' }

    if (action === 'make_clip') {
      if (x.video_status === 'queued' || x.video_status === 'in_progress') return bad('A clip for this scene is already being made.')
      if (!scene.frame_path || x.frame_approved !== true) return bad('Approve this scene\'s frame on the Storyboard step first. The clip starts from that picture.')
      const prompt = typeof x.video_prompt === 'string' ? x.video_prompt : defaultPrompt(scene)
      const length = clampLength(x.video_length, sceneSeconds(scene) || 5)
      const resolution = RESOLUTIONS.includes(x.video_resolution) ? x.video_resolution : '720p'

      const frame = await readStudioFile(cfg, scene.frame_path)
      if (!frame) return fail(res, 500, 'This scene\'s frame could not be read from storage.')
      const up = await fetch(`${HF}/files/generate-upload-url`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ content_type: frame.mime }) })
      if (!up.ok) {
        const msg = providerMessage(await up.text())
        return fail(res, 502, `Higgsfield would not accept the picture (${up.status}): ${msg}${needsFunds(up.status, msg) ? ' Check the credential, and that the Higgsfield API account has funds (Add funds in the Higgsfield API console).' : ''}`)
      }
      const slot: any = await up.json()
      if (!slot?.upload_url || !slot?.public_url) return fail(res, 502, 'Higgsfield did not return a place to put the picture. Try again.')
      const put = await fetch(slot.upload_url, { method: 'PUT', headers: (slot.upload_headers && typeof slot.upload_headers === 'object' ? slot.upload_headers : { 'Content-Type': frame.mime }) as Record<string, string>, body: frame.bytes as any })
      if (!put.ok) return fail(res, 502, `The picture could not be sent to Higgsfield (${put.status}).`)

      const body: Record<string, unknown> = { image_url: slot.public_url, duration: length, resolution, output_format: 'mp4', generate_audio: false }
      if (prompt.trim()) body.prompt = prompt.trim()
      const r = await fetch(`${HF}/${MODEL_PATH}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() }, body: JSON.stringify(body) })
      if (!r.ok) {
        const msg = providerMessage(await r.text())
        await logActivity(cfg, { project_id: scene.project_id, provider: 'higgsfield', action: 'clip', detail: `Scene ${scene.position}`, status: 'failed' })
        return fail(res, 502, `Higgsfield would not start the clip (${r.status}): ${msg}${needsFunds(r.status, msg) ? ' This may be where the Higgsfield API account needs funds (Add funds in the Higgsfield API console).' : ''}`)
      }
      const job: any = await r.json()
      if (!job?.request_id || !job?.status_url) return fail(res, 502, 'Higgsfield did not return a request number for the clip. Try again.')
      Object.assign(x, {
        video_status: job.status || 'queued', video_request_id: job.request_id, video_status_url: job.status_url, video_cancel_url: job.cancel_url || null,
        video_error: null, video_started_at: new Date().toISOString(), video_prompt: prompt, video_length: length, video_resolution: resolution,
        video_pending: { prompt, frame_path: scene.frame_path, length, resolution },
      })
      const s = await patchExtra(cfg, scene.id, x)
      if (!s.ok) return fail(res, 500, `The clip started but could not be recorded (${s.status}). Request number: ${job.request_id}.`)
      return res.status(200).json({ ok: true, status: x.video_status, estimate_usd: Math.round(length * FROM_USD_PER_SECOND * 100) / 100 })
    }

    if (action === 'cancel_clip') {
      if (!x.video_cancel_url) return bad('There is nothing to cancel for this scene.')
      const r = await fetch(x.video_cancel_url, { method: 'POST', headers })
      if (!r.ok) return bad('Higgsfield has already started this clip, so it can no longer be cancelled. It will finish and you can use or remove it.')
      for (const k of ['video_status', 'video_error', 'video_request_id', 'video_status_url', 'video_cancel_url', 'video_pending', 'video_started_at']) delete x[k]
      if (x.video_path) x.video_status = 'completed'
      const s = await patchExtra(cfg, scene.id, x)
      return s.ok ? res.status(200).json({ ok: true }) : fail(res, 500, `That could not be saved (${s.status}).`)
    }

    if (action === 'check_clip') {
      if (!x.video_status_url || (x.video_status !== 'queued' && x.video_status !== 'in_progress')) return res.status(200).json({ ok: true, status: x.video_status || 'none' })
      const r = await fetch(x.video_status_url, { headers })
      if (!r.ok) return fail(res, 502, `Higgsfield would not report on this clip (${r.status}): ${providerMessage(await r.text())}`)
      const job: any = await r.json()
      const status = String(job?.status || '')
      if (status === 'queued' || status === 'in_progress') {
        if (x.video_status !== status) { x.video_status = status; await patchExtra(cfg, scene.id, x) }
        return res.status(200).json({ ok: true, status })
      }
      const pending = x.video_pending || {}
      const length = Number(pending.length || x.video_length || 5)
      if (status === 'completed') {
        const url: string | undefined = job?.video?.url || job?.videos?.[0]?.url
        if (!url) return fail(res, 502, 'Higgsfield says the clip is finished but did not give a file. Press Check again in a moment.')
        const f = await fetch(url)
        if (!f.ok) return fail(res, 502, `The finished clip could not be downloaded (${f.status}). Press Check again in a moment.`)
        const bytes = Buffer.from(await f.arrayBuffer())
        const path = `projects/${scene.project_id}/video/scene-${scene.position}-${Date.now()}.mp4`
        const saved = await saveStudioFile(cfg, path, bytes, 'video/mp4')
        if (!saved.ok) return fail(res, 500, saved.error)
        const old = x.video_path
        const cost = Math.round(length * FROM_USD_PER_SECOND * 10000) / 10000
        Object.assign(x, { video_path: path, video_source: 'made', video_status: 'completed', video_error: null, video_approved: false, video_cost: cost, video_made: pending })
        for (const k of ['video_request_id', 'video_status_url', 'video_cancel_url', 'video_pending', 'video_started_at']) delete x[k]
        const s = await patchExtra(cfg, scene.id, x)
        if (!s.ok) { await deleteStudioFile(cfg, path); return fail(res, 500, `The clip could not be saved (${s.status}).`) }
        if (old) await deleteStudioFile(cfg, old)
        await logActivity(cfg, { project_id: scene.project_id, provider: 'higgsfield', action: 'clip', detail: `Scene ${scene.position}`, units_label: `${length} seconds · ${pending.resolution || x.video_resolution || '720p'} · Seedance 2.5`, est_cost_usd: cost })
        await syncVideoStep(cfg, scene.project_id)
        return res.status(200).json({ ok: true, status: 'completed', cost_usd: cost })
      }
      // failed, nsfw or canceled
      const why = status === 'nsfw' ? 'Higgsfield\'s safety check stopped this clip. Change the prompt or the frame and try again.' : status === 'canceled' ? 'This clip was cancelled.' : `Higgsfield could not make this clip${job?.error ? `: ${typeof job.error === 'string' ? job.error : JSON.stringify(job.error).slice(0, 300)}` : '.'}`
      for (const k of ['video_request_id', 'video_status_url', 'video_cancel_url', 'video_pending', 'video_started_at']) delete x[k]
      x.video_status = x.video_path ? 'completed' : 'failed'
      x.video_error = why
      await patchExtra(cfg, scene.id, x)
      await logActivity(cfg, { project_id: scene.project_id, provider: 'higgsfield', action: 'clip', detail: `Scene ${scene.position}`, status: 'failed' })
      return res.status(200).json({ ok: true, status: 'failed', error: why })
    }

    return fail(res, 400, 'Unknown request.')
  } catch (e: any) {
    console.error('[hub-studio-video] failed:', e)
    return fail(res, 500, e?.message || 'The video request failed.')
  }
}
