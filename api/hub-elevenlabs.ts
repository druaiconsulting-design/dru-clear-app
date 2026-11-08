// DRU AI Leadership Ecosystem™ — api/hub-elevenlabs.ts
// Video Hub: the voices in DeAnna's own ElevenLabs account, with a sample recording of each.
//   GET → the list of voices (name, description, sample) for the Voice box in Travis's Videos.
// The voice recordings for Travis's videos are made in api/hub-heygen.ts.
// Admin only: the caller's Supabase login must belong to DeAnna.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  fail, supabaseConfig, requireAdmin, namesMatching, providerMessage, elevenKey,
} from './_lib/hubShared.js'

export const config = { maxDuration: 60 }

const EL_BASE = 'https://api.elevenlabs.io'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return fail(res, 405, 'Method not allowed')

  const cfg = supabaseConfig()
  if (!cfg) return fail(res, 500, 'Supabase credentials are not configured for this app.')
  if (!(await requireAdmin(req, res, cfg.url, cfg.serviceKey))) return

  const key = elevenKey()
  if (!key) {
    const seen = namesMatching(/ELEVEN|XI_/)
    return fail(
      res, 500,
      `ElevenLabs is not connected yet. This app cannot see the ElevenLabs key (looked for VITE_ELEVENLABS_API_KEY). ` +
      `ElevenLabs variables it can see: ${seen.length ? seen.join(', ') : 'none'}. Check that the Shared variable is linked to dru-clear-app, then redeploy.`
    )
  }

  try {
    const voices: { voice_id: string; name: string; category: string | null; preview_url: string | null; description: string | null }[] = []
    let token: string | null = null
    for (let page = 0; page < 5; page++) {
      const qs = new URLSearchParams({ page_size: '100' })
      if (token) qs.set('next_page_token', token)
      const r = await fetch(`${EL_BASE}/v2/voices?${qs.toString()}`, { headers: { 'xi-api-key': key.value } })
      if (!r.ok) return fail(res, 502, `ElevenLabs would not list voices (${r.status}): ${providerMessage(await r.text())}`)
      const body: any = await r.json()
      for (const v of body?.voices || []) {
        const labels = v.labels && typeof v.labels === 'object' ? Object.values(v.labels).filter(x => typeof x === 'string' && x).join(' · ') : ''
        voices.push({
          voice_id: v.voice_id, name: v.name, category: v.category ?? null,
          preview_url: typeof v.preview_url === 'string' && v.preview_url ? v.preview_url : null, // ElevenLabs' own sample recording; costs no credits
          description: (typeof v.description === 'string' && v.description.trim()) || labels || null,
        })
      }
      if (!body?.has_more || !body?.next_page_token) break
      token = body.next_page_token
    }
    return res.status(200).json({ ok: true, voices, key_name: key.name })
  } catch (e: any) {
    return fail(res, 502, `Could not reach ElevenLabs: ${e?.message || 'unknown error'}`)
  }
}
