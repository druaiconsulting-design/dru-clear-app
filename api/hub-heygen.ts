// DRU AI Leadership Ecosystem™ — api/hub-heygen.ts
// Video Hub: Travis's videos made with HeyGen (HeyGen's current v3 API).
//   GET  ?action=options → avatars (saved in Shared, plus the ones HeyGen lists for the account) and
//        voices (the ones saved in the team's Shared variables)
//   POST {action:'create', title, script, avatar_id, voice_id, aspect_ratio, video_type}
//        → starts the video in HeyGen and puts a "Making…" item on the shelf
//   POST {action:'check'} → asks HeyGen about every video still being made; finished ones are saved
//        onto the shelf as originals
// Admin only: the caller's Supabase login must belong to DeAnna.
// Nothing here posts to social or touches Travis's older approval path.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  fail, supabaseConfig, requireAdmin, sbHeaders, findEnv, namesMatching, safeName,
  uploadToShelf, insertShelfItem, providerMessage,
} from './_lib/hubShared.js'

export const config = { maxDuration: 300 }

const HG_BASE = 'https://api.heygen.com'
const ASPECTS = ['9:16', '16:9', '1:1']

function heygenKey() {
  return findEnv(
    ['VITE_HEYGEN_API_KEY', 'HEYGEN_API_KEY'],
    /HEYGEN/,
    /AVATAR|VOICE|TYPE|STYLE|SECRET|WEBHOOK/
  )
}

// Avatar and voice IDs DeAnna saved in the Shared variables (IDs are not secrets).
function savedChoices(kind: 'AVATAR' | 'VOICE'): { id: string; label: string }[] {
  const names = namesMatching(new RegExp(`HEYGEN.*${kind}|${kind}.*HEYGEN`)).filter(n => !/TYPE|STYLE|SPEED/.test(n))
  return names
    .map(n => ({ id: (process.env[n] || '').trim(), label: `Saved: ${n}` }))
    .filter(c => c.id)
}

function notConnected(res: VercelResponse) {
  const seen = namesMatching(/HEYGEN/)
  return fail(
    res, 500,
    `HeyGen is not connected yet. This app cannot see the HeyGen key (looked for VITE_HEYGEN_API_KEY or HEYGEN_API_KEY). ` +
    `HeyGen variables it can see: ${seen.length ? seen.join(', ') : 'none'}. Check that the Shared variable is linked to dru-clear-app, then redeploy.`
  )
}

async function hgJson(path: string, key: string, init?: RequestInit) {
  const r = await fetch(`${HG_BASE}${path}`, {
    ...init,
    headers: { 'x-api-key': key, Accept: 'application/json', ...(init?.headers || {}) },
  })
  const raw = await r.text()
  let body: any = null
  try { body = JSON.parse(raw) } catch { /* not JSON */ }
  return { ok: r.ok, status: r.status, body, raw }
}

function hgError(r: { status: number; body: any; raw: string }) {
  const m = r.body?.error?.message || r.body?.message || providerMessage(r.raw)
  const money = r.status === 402 || /credit|balance|quota|payment|fund|insufficient|billing/i.test(String(m))
  return `${m} (${r.status})${money ? ' — this is where HeyGen needs API credits added.' : ''}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return fail(res, 405, 'Method not allowed')

  const cfg = supabaseConfig()
  if (!cfg) return fail(res, 500, 'Supabase credentials are not configured for this app.')
  if (!(await requireAdmin(req, res, cfg.url, cfg.serviceKey))) return

  const key = heygenKey()
  if (!key) return notConnected(res)

  // ── Options: avatars and voices ────────────────────────────────────────────
  if (req.method === 'GET') {
    const avatars = savedChoices('AVATAR')
    const voices = savedChoices('VOICE')
    const notes: string[] = []

    try {
      const a = await hgJson('/v3/avatars/looks?limit=50', key.value)
      if (a.ok) {
        const list: any[] = a.body?.data || a.body?.looks || []
        for (const l of list) {
          const id = l.id || l.look_id || l.avatar_id
          const name = l.name || l.look_name || l.avatar_name
          if (id && !avatars.some(x => x.id === id)) avatars.push({ id, label: name ? String(name) : String(id) })
        }
      } else notes.push(`HeyGen would not list avatars (${a.status}).`)
    } catch { notes.push('Could not reach HeyGen to list avatars.') }

    // Voices come only from the variables saved in Shared (ElevenLabs is used for most voices).

    return res.status(200).json({ ok: true, avatars, voices, notes, key_name: key.name })
  }

  const { action } = (req.body || {}) as { action?: string }

  // ── Start a video ──────────────────────────────────────────────────────────
  if (action === 'create') {
    const { title, script, avatar_id, voice_id, aspect_ratio, video_type } = req.body as {
      title?: string; script?: string; avatar_id?: string; voice_id?: string; aspect_ratio?: string; video_type?: string
    }
    const text = (script || '').trim()
    if (!title?.trim()) return fail(res, 400, 'Give the video a title.')
    if (!text) return fail(res, 400, 'Paste a script first.')
    if (!avatar_id) return fail(res, 400, 'Choose an avatar.')
    if (!voice_id) return fail(res, 400, 'Choose a voice.')
    const aspect = ASPECTS.includes(aspect_ratio || '') ? aspect_ratio! : '9:16'
    const type = ['micro_drama', 'course', 'social', 'other'].includes(video_type || '') ? video_type! : 'other'

    try {
      const made = await hgJson('/v3/videos', key.value, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'avatar', avatar_id, voice_id, script: text, aspect_ratio: aspect, title: title.trim() }),
      })
      const videoId = made.body?.data?.video_id
      if (!made.ok || !videoId) return fail(res, 502, `HeyGen would not start the video: ${hgError(made)}`)

      const saved = await insertShelfItem(cfg, {
        title: title.trim(),
        video_type: type,
        source: 'heygen',
        aspect_ratio: aspect,
        storage_path: '',
        status: 'making',
        notes: 'Made by Travis with HeyGen',
        script_text: text,
        provider_video_id: videoId,
      })
      if (saved.error) {
        return fail(res, 500, `HeyGen started the video (HeyGen video number ${videoId}) but the shelf could not record it: ${saved.error}`)
      }
      return res.status(200).json({ ok: true, item_id: saved.id, video_id: videoId })
    } catch (e: any) {
      console.error('[hub-heygen] create failed:', e)
      return fail(res, 500, e?.message || 'Could not start the HeyGen video.')
    }
  }

  // ── Check videos still being made; save finished ones onto the shelf ───────
  if (action === 'check') {
    // A video stuck in "saving" for over 10 minutes (a check was cut off) goes back to "making" and is retried.
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    await fetch(`${cfg.url}/rest/v1/video_hub_items?source=eq.heygen&status=eq.saving&updated_at=lt.${encodeURIComponent(staleBefore)}`, {
      method: 'PATCH',
      headers: { ...sbHeaders(cfg.serviceKey), Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'making', updated_at: new Date().toISOString() }),
    }).catch(() => undefined)

    const listRes = await fetch(
      `${cfg.url}/rest/v1/video_hub_items?source=eq.heygen&status=eq.making&select=id,title,provider_video_id`,
      { headers: sbHeaders(cfg.serviceKey) }
    )
    const pending: { id: string; title: string; provider_video_id: string | null }[] = listRes.ok ? await listRes.json() : []
    let finished = 0, failed = 0, stillMaking = 0
    const problems: string[] = []

    for (const item of pending) {
      if (!item.provider_video_id) continue
      try {
        const st = await hgJson(`/v3/videos/${encodeURIComponent(item.provider_video_id)}`, key.value)
        if (!st.ok) { problems.push(`HeyGen status for “${item.title}”: ${hgError(st)}`); stillMaking++; continue }
        const d = st.body?.data || {}

        if (d.status === 'failed') {
          await fetch(`${cfg.url}/rest/v1/video_hub_items?id=eq.${item.id}&status=eq.making`, {
            method: 'PATCH',
            headers: { ...sbHeaders(cfg.serviceKey), Prefer: 'return=minimal' },
            body: JSON.stringify({
              status: 'failed',
              error_detail: String(d.failure_message || d.failure_code || 'HeyGen could not make this video.').slice(0, 500),
              updated_at: new Date().toISOString(),
            }),
          })
          failed++
          continue
        }

        if (d.status !== 'completed' || !d.video_url) { stillMaking++; continue }

        // Claim it so two checks at once never save it twice.
        const claim = await fetch(`${cfg.url}/rest/v1/video_hub_items?id=eq.${item.id}&status=eq.making`, {
          method: 'PATCH',
          headers: { ...sbHeaders(cfg.serviceKey), Prefer: 'return=representation' },
          body: JSON.stringify({ status: 'saving', updated_at: new Date().toISOString() }),
        })
        const claimed: any[] = claim.ok ? await claim.json() : []
        if (!claimed.length) continue

        const revert = async (msg: string) => {
          await fetch(`${cfg.url}/rest/v1/video_hub_items?id=eq.${item.id}`, {
            method: 'PATCH',
            headers: { ...sbHeaders(cfg.serviceKey), Prefer: 'return=minimal' },
            body: JSON.stringify({ status: 'making', error_detail: msg.slice(0, 300), updated_at: new Date().toISOString() }),
          })
          problems.push(`“${item.title}”: ${msg}`)
          stillMaking++
        }

        const file = await fetch(d.video_url)
        if (!file.ok) { await revert(`Could not download the finished video from HeyGen (${file.status}). It will be tried again.`); continue }
        const bytes = Buffer.from(await file.arrayBuffer())
        const path = `${new Date().getFullYear()}/${crypto.randomUUID()}-${safeName(item.title)}.mp4`
        const up = await uploadToShelf(cfg, path, bytes, 'video/mp4')
        if (!up.ok) { await revert(up.error + ' It will be tried again.'); continue }

        await fetch(`${cfg.url}/rest/v1/video_hub_items?id=eq.${item.id}`, {
          method: 'PATCH',
          headers: { ...sbHeaders(cfg.serviceKey), Prefer: 'return=minimal' },
          body: JSON.stringify({
            status: 'ready',
            storage_path: path,
            file_name: `${safeName(item.title)}.mp4`,
            file_size_bytes: bytes.length,
            mime_type: 'video/mp4',
            length_seconds: typeof d.duration === 'number' ? Math.round(d.duration) : null,
            error_detail: null,
            updated_at: new Date().toISOString(),
          }),
        })
        finished++
      } catch (e: any) {
        problems.push(`“${item.title}”: ${e?.message || 'check failed'}`)
        stillMaking++
      }
    }
    return res.status(200).json({ ok: true, finished, failed, still_making: stillMaking, problems })
  }

  return fail(res, 400, 'Unknown request.')
}
