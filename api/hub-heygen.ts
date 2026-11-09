// DRU AI Leadership Ecosystem™ — api/hub-heygen.ts
// Video Hub: Travis's videos made with HeyGen (HeyGen's current v3 API).
//   GET  ?action=options → the agents (name, role, photo from the agents table: each agent's photo is the
//        face) and the HeyGen voices saved in the team's Shared variables
//   POST {action:'create', title, script, agent_id, voice_id, aspect_ratio, video_type, voice_source?, voice_name?}
//        → starts the video in HeyGen (the agent's photo animated, HeyGen's photo-to-video) and puts a
//        "Making…" item on the shelf.
//        voice_source 'elevenlabs': ElevenLabs reads the script in that voice first, and the photo speaks
//        to that recording. Otherwise HeyGen reads the script itself in the chosen HeyGen voice.
//   POST {action:'check'} → asks HeyGen about every video still being made; finished ones are saved
//        onto the shelf as originals
// Admin only: the caller's Supabase login must belong to DeAnna.
// Nothing here posts to social or touches Travis's older approval path.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  fail, supabaseConfig, requireAdmin, sbHeaders, namesMatching, safeName, heygenKey,
  uploadToShelf, insertShelfItem, providerMessage, elevenKey, elevenSpeak, ELEVEN_MAX_CHARS, logActivity,
} from './_lib/hubShared.js'

export const config = { maxDuration: 300 }

const HG_BASE = 'https://api.heygen.com'
const ASPECTS = ['9:16', '16:9', '1:1']

// Voice IDs DeAnna saved in the Shared variables (IDs are not secrets).
function savedVoices(): { id: string; label: string }[] {
  const names = namesMatching(/HEYGEN.*VOICE|VOICE.*HEYGEN/).filter(n => !/TYPE|STYLE|SPEED/.test(n))
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

  // ── Options: agents (the faces) and voices ─────────────────────────────────
  if (req.method === 'GET') {
    const notes: string[] = []
    const ar = await fetch(
      `${cfg.url}/rest/v1/agents?select=id,name,role,photo_url&photo_url=not.is.null&order=division_sort.asc,sort_order.asc`,
      { headers: sbHeaders(cfg.serviceKey) }
    )
    if (!ar.ok) return fail(res, 500, `The agents list could not be read (${ar.status}).`)
    const agents: { id: string; name: string; role: string | null; photo_url: string }[] =
      (await ar.json()).filter((a: any) => a.photo_url)
    return res.status(200).json({ ok: true, agents, voices: savedVoices(), notes, key_name: key.name })
  }

  const { action } = (req.body || {}) as { action?: string }

  // ── Start a video ──────────────────────────────────────────────────────────
  if (action === 'create') {
    const { title, script, agent_id, voice_id, aspect_ratio, video_type, voice_source, voice_name } = req.body as {
      title?: string; script?: string; agent_id?: string; voice_id?: string; aspect_ratio?: string; video_type?: string
      voice_source?: string; voice_name?: string
    }
    const text = (script || '').trim()
    if (!title?.trim()) return fail(res, 400, 'Give the video a title.')
    if (!text) return fail(res, 400, 'Paste a script first.')
    if (!agent_id) return fail(res, 400, 'Choose an agent.')
    if (!voice_id) return fail(res, 400, 'Choose a voice.')
    const aspect = ASPECTS.includes(aspect_ratio || '') ? aspect_ratio! : '9:16'
    const type = ['micro_drama', 'course', 'social', 'other'].includes(video_type || '') ? video_type! : 'other'
    const useEleven = voice_source === 'elevenlabs'

    if (useEleven && text.length > ELEVEN_MAX_CHARS) {
      return fail(res, 400, `This script is ${text.length.toLocaleString()} characters. ElevenLabs reads up to ${ELEVEN_MAX_CHARS.toLocaleString()} at a time, so it is ${(text.length - ELEVEN_MAX_CHARS).toLocaleString()} over. Shorten it or split it into two videos.`)
    }

    try {
      // The agent's own photo is the face. It is read from the agents table here, not taken from the page.
      const agentRes = await fetch(
        `${cfg.url}/rest/v1/agents?id=eq.${encodeURIComponent(agent_id)}&select=name,photo_url`,
        { headers: sbHeaders(cfg.serviceKey) }
      )
      const agentRows: { name: string; photo_url: string | null }[] = agentRes.ok ? await agentRes.json() : []
      const agent = agentRows[0]
      if (!agent?.photo_url) return fail(res, 400, 'That agent has no photo saved, so there is no face to use.')
      const face = { type: 'url', url: agent.photo_url }

      let heygenBody: Record<string, unknown>
      if (useEleven) {
        // 1. ElevenLabs reads the script in the chosen voice.
        const el = elevenKey()
        if (!el) {
          return fail(res, 500, `ElevenLabs is not connected yet. This app cannot see the ElevenLabs key (looked for VITE_ELEVENLABS_API_KEY). Check that the Shared variable is linked to dru-clear-app, then redeploy.`)
        }
        const spoken = await elevenSpeak(el.value, voice_id, text)
        if (!spoken.ok) {
          await logActivity(cfg, { provider: 'elevenlabs', action: "Voice reading for Travis's video", detail: `${title.trim()} · ${spoken.error}`, status: 'failed' })
          return fail(res, 502, spoken.error)
        }
        await logActivity(cfg, {
          provider: 'elevenlabs', action: "Voice reading for Travis's video",
          detail: `${title.trim()} · ${voice_name || voice_id}`, units_label: `${text.length.toLocaleString()} characters`,
        })

        // 2. The recording goes to HeyGen's file storage.
        const form = new FormData()
        form.append('file', new Blob([new Uint8Array(spoken.audio)], { type: 'audio/mpeg' }), 'voice.mp3')
        const up = await hgJson('/v3/assets', key.value, { method: 'POST', body: form })
        const assetId = up.body?.data?.asset_id || up.body?.data?.id
        if (!up.ok || !assetId) {
          return fail(res, 502, `ElevenLabs made the voice (its characters were used), but HeyGen would not take the audio file: ${hgError(up)}`)
        }
        // 3. The agent's photo speaks to that recording.
        heygenBody = { type: 'image', image: face, audio_asset_id: assetId, aspect_ratio: aspect, title: title.trim() }
      } else {
        heygenBody = { type: 'image', image: face, voice_id, script: text, aspect_ratio: aspect, title: title.trim() }
      }

      const made = await hgJson('/v3/videos', key.value, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(heygenBody),
      })
      const videoId = made.body?.data?.video_id
      await logActivity(cfg, {
        provider: 'heygen', action: "Travis's video sent to HeyGen",
        detail: made.ok && videoId ? `${title.trim()} · ${aspect}` : `${title.trim()} · ${hgError(made)}`,
        units_label: made.ok && videoId ? aspect : null,
        status: made.ok && videoId ? 'ok' : 'failed',
      })
      if (!made.ok || !videoId) {
        return fail(res, 502, `${useEleven ? 'ElevenLabs made the voice (its characters were used), but ' : ''}HeyGen would not start the video: ${hgError(made)}`)
      }

      const saved = await insertShelfItem(cfg, {
        title: title.trim(),
        video_type: type,
        source: 'heygen',
        aspect_ratio: aspect,
        storage_path: '',
        status: 'making',
        notes: `Made by Travis with HeyGen · face: ${agent.name} · voice: ${useEleven ? `ElevenLabs ${voice_name || voice_id}` : 'HeyGen voice'}`,
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
