// DRU AI Leadership Ecosystem™ — api/hub-elevenlabs.ts
// Video Hub: voice-overs made with ElevenLabs.
//   GET  ?action=voices  → the voices in DeAnna's own ElevenLabs account
//   POST {title, text, voice_id, voice_name} → ElevenLabs reads the script, the audio is saved on the
//        shelf (private hub-videos storage) as an original.
// Admin only: the caller's Supabase login must belong to DeAnna.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  fail, supabaseConfig, requireAdmin, findEnv, namesMatching, safeName,
  uploadToShelf, removeFromShelf, insertShelfItem, providerMessage,
} from './_lib/hubShared.js'

export const config = { maxDuration: 300 }

const EL_BASE = 'https://api.elevenlabs.io'
// Longest script ElevenLabs reads in one request (Eleven v4 / Multilingual v2 limit in their docs).
const MAX_CHARS = 10000
const PRIMARY_MODEL = 'eleven_v4'
const FALLBACK_MODEL = 'eleven_multilingual_v2'
// mp3_44100_128 is a steady 128 kbps, so length in seconds = bytes / 16000.
const OUTPUT_FORMAT = 'mp3_44100_128'
const BYTES_PER_SECOND = 16000

function elevenKey() {
  return findEnv(
    ['VITE_ELEVENLABS_API_KEY', 'ELEVENLABS_API_KEY', 'XI_API_KEY'],
    /ELEVEN/,
    /VOICE|MODEL|AGENT/
  )
}

function notConnected(res: VercelResponse) {
  const seen = namesMatching(/ELEVEN|XI_/)
  return fail(
    res, 500,
    `ElevenLabs is not connected yet. This app cannot see the ElevenLabs key (looked for VITE_ELEVENLABS_API_KEY). ` +
    `ElevenLabs variables it can see: ${seen.length ? seen.join(', ') : 'none'}. Check that the Shared variable is linked to dru-clear-app, then redeploy.`
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return fail(res, 405, 'Method not allowed')

  const cfg = supabaseConfig()
  if (!cfg) return fail(res, 500, 'Supabase credentials are not configured for this app.')
  if (!(await requireAdmin(req, res, cfg.url, cfg.serviceKey))) return

  const key = elevenKey()
  if (!key) return notConnected(res)
  const elHeaders = { 'xi-api-key': key.value }

  // ── Voices in DeAnna's account ─────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const voices: { voice_id: string; name: string; category: string | null }[] = []
      let token: string | null = null
      for (let page = 0; page < 5; page++) {
        const qs = new URLSearchParams({ page_size: '100' })
        if (token) qs.set('next_page_token', token)
        const r = await fetch(`${EL_BASE}/v2/voices?${qs.toString()}`, { headers: elHeaders })
        if (!r.ok) return fail(res, 502, `ElevenLabs would not list voices (${r.status}): ${providerMessage(await r.text())}`)
        const body: any = await r.json()
        for (const v of body?.voices || []) voices.push({ voice_id: v.voice_id, name: v.name, category: v.category ?? null })
        if (!body?.has_more || !body?.next_page_token) break
        token = body.next_page_token
      }
      return res.status(200).json({ ok: true, voices, key_name: key.name })
    } catch (e: any) {
      return fail(res, 502, `Could not reach ElevenLabs: ${e?.message || 'unknown error'}`)
    }
  }

  // ── Make a voice-over ──────────────────────────────────────────────────────
  const { title, text, voice_id, voice_name } = (req.body || {}) as { title?: string; text?: string; voice_id?: string; voice_name?: string }
  const script = (text || '').trim()
  if (!title?.trim()) return fail(res, 400, 'Give the voice-over a title.')
  if (!script) return fail(res, 400, 'Paste a script first.')
  if (!voice_id) return fail(res, 400, 'Choose a voice.')
  if (script.length > MAX_CHARS) {
    return fail(res, 400, `This script is ${script.length.toLocaleString()} characters. ElevenLabs reads up to ${MAX_CHARS.toLocaleString()} at a time, so it is ${(script.length - MAX_CHARS).toLocaleString()} over. Shorten it or split it into two voice-overs.`)
  }

  const speak = (model: string) =>
    fetch(`${EL_BASE}/v1/text-to-speech/${encodeURIComponent(voice_id)}?output_format=${OUTPUT_FORMAT}`, {
      method: 'POST',
      headers: { ...elHeaders, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text: script, model_id: model }),
    })

  let modelUsed = PRIMARY_MODEL
  try {
    let r = await speak(PRIMARY_MODEL)
    if (!r.ok && [400, 404, 422].includes(r.status)) {
      // A refused request makes no audio and uses no credits, so one retry on the older model is safe.
      const firstError = providerMessage(await r.text())
      if (/model/i.test(firstError)) {
        modelUsed = FALLBACK_MODEL
        r = await speak(FALLBACK_MODEL)
      } else {
        return fail(res, 502, `ElevenLabs would not make the voice-over (${r.status}): ${firstError}`)
      }
    }
    if (!r.ok) {
      const msg = providerMessage(await r.text())
      const money = r.status === 401 || r.status === 402 || /quota|credit|subscription|plan|payment|upgrade|free/i.test(msg)
      return fail(res, 502, `ElevenLabs would not make the voice-over (${r.status}): ${msg}${money ? ' — this may be where ElevenLabs needs funds or a paid plan.' : ''}`)
    }

    const audio = Buffer.from(await r.arrayBuffer())
    if (!audio.length) return fail(res, 502, 'ElevenLabs returned an empty audio file.')

    const path = `${new Date().getFullYear()}/${crypto.randomUUID()}-${safeName(title.trim())}.mp3`
    const up = await uploadToShelf(cfg, path, audio, 'audio/mpeg')
    if (!up.ok) return fail(res, 500, up.error)

    const saved = await insertShelfItem(cfg, {
      title: title.trim(),
      video_type: 'other',
      source: 'elevenlabs',
      length_seconds: Math.max(1, Math.round(audio.length / BYTES_PER_SECOND)),
      aspect_ratio: null,
      storage_path: path,
      file_name: `${safeName(title.trim())}.mp3`,
      file_size_bytes: audio.length,
      mime_type: 'audio/mpeg',
      status: 'ready',
      notes: `Voice-over · voice: ${voice_name || voice_id} · model: ${modelUsed}`,
      script_text: script,
    })
    if (saved.error) {
      await removeFromShelf(cfg, path)
      return fail(res, 500, saved.error)
    }
    return res.status(200).json({ ok: true, item_id: saved.id, model: modelUsed })
  } catch (e: any) {
    console.error('[hub-elevenlabs] failed:', e)
    return fail(res, 500, e?.message || 'The voice-over failed.')
  }
}
