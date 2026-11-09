// DRU AI Leadership Ecosystem™ — api/hub-studio-audio.ts
// Micro Drama Studio, Stage 4: the Audio step. Admin only.
//   GET  ?view=audio&id=<project>   → the voices chosen, each scene's spoken lines and recording, and the music track
//   POST {action: ...} — save_voice, make_recording, approve_recording, delete_recording,
//        save_music_brief, make_music, upload_music, approve_music, delete_music
// Recordings are made by ElevenLabs Text to Dialogue (one recording per scene, each speaker in their own voice) and saved in the
// private studio-media storage. Music is made by ElevenLabs Music or uploaded (for example from Suno). Every paid call is logged for the Usage tab.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fail, supabaseConfig, requireAdmin, elevenKey, providerMessage, logActivity, namesMatching } from './_lib/hubShared.js'
import { rest, UUID, type Cfg } from './_lib/studioData.js'
import { saveStudioFile, deleteStudioFile, signPaths } from './_lib/studioImages.js'

export const config = { maxDuration: 300 }

const EL = 'https://api.elevenlabs.io'
const SPEECH_USD_PER_1K_CHARS = 0.08 // ElevenLabs API pricing page, v3 / v4 text to speech and dialogue
const MUSIC_USD_PER_MINUTE = 0.15 // ElevenLabs API pricing page, Music
const MP3_BYTES_PER_SECOND = 16000 // mp3_44100_128 is 128 kbps
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024 // keeps the request under the server's body limit once encoded
const MAX_DIALOGUE_CHARS = 2000

const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)

type Line = { speaker: string; text: string }

// Stage directions in parentheses, like "(soft, to herself)", stay in the script but are not spoken.
const spokenOnly = (t: string) => t.replace(/\([^)]*\)/g, ' ').replace(/\s{2,}/g, ' ').replace(/\s+([.,!?;:])/g, '$1').trim()

// The script writes each spoken line as "Name: words". In narration films the whole field is the narrator's.
function parseLines(dialogue: string | null, sound: string): { lines: Line[]; problem: string | null } {
  const raw = String(dialogue || '').trim()
  if (!raw) return { lines: [], problem: null }
  if (sound === 'narration') {
    const text = spokenOnly(raw.replace(/\s*\n+\s*/g, ' '))
    return { lines: text ? [{ speaker: 'Narrator', text }] : [], problem: null }
  }
  const lines: Line[] = []
  for (const part of raw.split(/\n+/).map(x => x.trim()).filter(Boolean)) {
    const m = /^[*_"'\[(\s]*([^:\n(]{1,40}?)[*_"'\])\s]*:\s*(.+)$/.exec(part)
    if (m && m[1].trim()) lines.push({ speaker: m[1].trim(), text: m[2].trim() })
    else if (lines.length) lines[lines.length - 1].text += ' ' + part
    else return { lines: [], problem: 'The first line has no speaker name. On the Script step, start each line with the speaker\'s name and a colon, like "Name: words".' }
  }
  return { lines: lines.map(l => ({ speaker: l.speaker, text: spokenOnly(l.text) })).filter(l => l.text), problem: null }
}

async function one(cfg: Cfg, table: string, id: string, select = '*'): Promise<any | null> {
  const r = await rest(cfg, `${table}?id=eq.${id}&select=${select}`)
  return r.ok && Array.isArray(r.body) ? r.body[0] || null : null
}

const audioSettings = (settings: any) => {
  const a = settings?.audio || {}
  return { voices: (a.voices && typeof a.voices === 'object' ? a.voices : {}) as Record<string, any>, music: (a.music && typeof a.music === 'object' ? a.music : null) as any }
}

async function saveAudioSettings(cfg: Cfg, projectId: string, settings: any, patch: { voices?: Record<string, any>; music?: any | null }) {
  const cur = audioSettings(settings)
  const next = { voices: patch.voices ?? cur.voices, music: patch.music === undefined ? cur.music : patch.music }
  return rest(cfg, `micro_drama_projects?id=eq.${projectId}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ settings: { ...(settings || {}), audio: next }, updated_at: new Date().toISOString() }),
  })
}

// Audio is done when every scene with spoken lines has an approved, up-to-date recording. A film with no spoken lines is done
// when its music is approved.
async function syncAudioStep(cfg: Cfg, projectId: string): Promise<string[]> {
  const [proj, scenes] = await Promise.all([
    rest(cfg, `micro_drama_projects?id=eq.${projectId}&select=steps_done,settings`),
    rest(cfg, `micro_drama_scenes?project_id=eq.${projectId}&select=dialogue,extra`),
  ])
  const steps: string[] = proj.ok && proj.body?.[0]?.steps_done ? proj.body[0].steps_done : []
  const settings = proj.ok ? proj.body?.[0]?.settings : null
  const rows: any[] = Array.isArray(scenes.body) ? scenes.body : []
  const spoken = rows.filter(s => String(s.dialogue || '').trim())
  const music = audioSettings(settings).music
  const done = spoken.length
    ? spoken.every(s => s.extra?.audio_approved === true && s.extra?.audio_path && s.extra?.audio_text === String(s.dialogue || ''))
    : !!(music && music.approved && music.path)
  const next = steps.filter(s => s !== 'audio')
  if (done) next.push('audio')
  if (next.length !== steps.length || next.some(s => !steps.includes(s))) {
    await rest(cfg, `micro_drama_projects?id=eq.${projectId}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ steps_done: next, updated_at: new Date().toISOString() }) })
  }
  return next
}

async function patchSceneExtra(cfg: Cfg, sceneId: string, extra: Record<string, unknown>) {
  return rest(cfg, `micro_drama_scenes?id=eq.${sceneId}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ extra }) })
}

const money = (status: number, msg: string) => status === 401 || status === 402 || status === 429 || /quota|credit|subscription|plan|payment|upgrade|free|paid/i.test(msg)

async function elevenError(what: string, r: Response): Promise<string> {
  const msg = providerMessage(await r.text())
  return `ElevenLabs would not make ${what} (${r.status}): ${msg}${money(r.status, msg) ? ' This may be where ElevenLabs needs credits or a paid plan.' : ''}`
}

function parseAudioUrl(dataUrl: string): { ok: true; bytes: Buffer; mime: string } | { ok: false; error: string } {
  const m = /^data:(audio\/(?:mpeg|mp3|wav|x-wav|mp4|x-m4a|aac|ogg|webm));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''))
  if (!m) return { ok: false, error: 'Upload an MP3, WAV, M4A, AAC or OGG music file.' }
  const bytes = Buffer.from(m[2], 'base64')
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, error: 'That music file is too large to upload here. Use one under 3 MB (a 2-minute MP3 is about 2 MB).' }
  return { ok: true, bytes, mime: m[1] === 'audio/mp3' ? 'audio/mpeg' : m[1] }
}

const audioExt = (mime: string) => (mime === 'audio/wav' || mime === 'audio/x-wav' ? 'wav' : mime === 'audio/mp4' || mime === 'audio/x-m4a' ? 'm4a' : mime === 'audio/aac' ? 'aac' : mime === 'audio/ogg' ? 'ogg' : mime === 'audio/webm' ? 'webm' : 'mp3')

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return fail(res, 405, 'Method not allowed')
  const cfg = supabaseConfig()
  if (!cfg) return fail(res, 500, 'Supabase credentials are not configured for this app.')
  if (!(await requireAdmin(req, res, cfg.url, cfg.serviceKey))) return

  try {
    // ── Read ─────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const id = String(req.query.id || '')
      if (String(req.query.view || '') !== 'audio') return fail(res, 400, 'Unknown view.')
      if (!UUID.test(id)) return fail(res, 400, 'That project is not valid.')
      const [proj, sc, ch] = await Promise.all([
        one(cfg, 'micro_drama_projects', id, 'id,settings'),
        rest(cfg, `micro_drama_scenes?project_id=eq.${id}&select=id,position,start_s,end_s,dialogue,extra&order=position.asc&limit=2000`),
        rest(cfg, `micro_drama_characters?project_id=eq.${id}&select=name`),
      ])
      if (!proj) return fail(res, 404, 'That project was not found.')
      if (!sc.ok) return fail(res, 500, `The scenes could not be read (${sc.status}).`)
      const film = proj.settings?.film || {}
      const sound = String(film.sound || '')
      const { voices, music } = audioSettings(proj.settings)
      const castNames = (ch.ok && Array.isArray(ch.body) ? ch.body : []).map((c: any) => String(c.name || '').toLowerCase())
      const rows: any[] = sc.body
      const urls = await signPaths(cfg, [...rows.map(s => s.extra?.audio_path), music?.path])

      const speakerMap = new Map<string, string>()
      const scenes = rows.map(s => {
        const parsed = parseLines(s.dialogue, sound)
        for (const l of parsed.lines) if (!speakerMap.has(l.speaker.toLowerCase())) speakerMap.set(l.speaker.toLowerCase(), l.speaker)
        const dialogue = String(s.dialogue || '')
        const hasRec = !!s.extra?.audio_path
        return {
          id: s.id, position: s.position, length_s: Math.max(0, Number(s.end_s || 0) - Number(s.start_s || 0)),
          lines: parsed.lines, problem: parsed.problem,
          recording_url: hasRec ? urls[s.extra.audio_path] || null : null,
          seconds: typeof s.extra?.audio_seconds === 'number' ? s.extra.audio_seconds : null,
          cost_usd: typeof s.extra?.audio_cost === 'number' ? s.extra.audio_cost : null,
          approved: s.extra?.audio_approved === true && hasRec,
          stale: hasRec && s.extra?.audio_text !== dialogue, // the lines changed on the Script step after this was recorded
        }
      })
      const speakers = Array.from(speakerMap.entries()).map(([key, name]) => ({
        key, name, in_cast: castNames.some(n => n === key || n.split(/\s+/)[0] === key.split(/\s+/)[0]),
        voice_id: voices[key]?.voice_id || '', voice_name: voices[key]?.voice_name || '',
      }))
      const stepsDone = await syncAudioStep(cfg, id)
      return res.status(200).json({
        ok: true, steps_done: stepsDone, sound, length_s: Number(film.length_s || 0), speakers, scenes,
        music: music ? { prompt: music.prompt || '', instrumental: music.instrumental !== false, source: music.source || 'made', seconds: music.seconds ?? null, cost_usd: music.cost_usd ?? null, approved: !!music.approved, url: music.path ? urls[music.path] || null : null } : null,
      })
    }

    // ── Writes ───────────────────────────────────────────────────────────────
    const b = (req.body || {}) as Record<string, any>
    const action = String(b.action || '')
    const bad = (m: string) => fail(res, 400, m)

    // Voices -------------------------------------------------------------------
    if (action === 'save_voice') {
      if (!UUID.test(String(b.project_id))) return bad('That project is not valid.')
      const proj = await one(cfg, 'micro_drama_projects', b.project_id, 'id,settings')
      if (!proj) return fail(res, 404, 'That project was not found.')
      const key = str(b.speaker, 60).toLowerCase()
      if (!key) return bad('Which speaker is this voice for?')
      const { voices } = audioSettings(proj.settings)
      const next = { ...voices }
      const voiceId = str(b.voice_id, 80)
      if (voiceId) next[key] = { speaker: str(b.speaker, 60), voice_id: voiceId, voice_name: str(b.voice_name, 120) }
      else delete next[key]
      const r = await saveAudioSettings(cfg, b.project_id, proj.settings, { voices: next })
      if (!r.ok) return fail(res, 500, `The voice could not be saved (${r.status}).`)
      return res.status(200).json({ ok: true })
    }

    // Recordings ---------------------------------------------------------------
    if (action === 'make_recording') {
      const scene = UUID.test(String(b.scene_id)) ? await one(cfg, 'micro_drama_scenes', b.scene_id, 'id,project_id,position,dialogue,extra') : null
      if (!scene) return fail(res, 404, 'That scene was not found.')
      const proj = await one(cfg, 'micro_drama_projects', scene.project_id, 'id,settings')
      if (!proj) return fail(res, 404, 'That project was not found.')
      const sound = String(proj.settings?.film?.sound || '')
      if (sound === 'song') return bad('This film\'s sound is set to song. Lyrics are sung, and that part of the Audio step is coming next. Use the music box below for now.')
      const { lines, problem } = parseLines(scene.dialogue, sound)
      if (problem) return bad(problem)
      if (!lines.length) return bad('This scene has no spoken lines. Add them on the Script step first.')
      const { voices } = audioSettings(proj.settings)
      const noVoice = Array.from(new Set(lines.filter(l => !voices[l.speaker.toLowerCase()]?.voice_id).map(l => l.speaker)))
      if (noVoice.length) return bad(`Choose a voice for ${noVoice.join(', ')} first.`)
      const chars = lines.reduce((n, l) => n + l.text.length, 0)
      if (chars > MAX_DIALOGUE_CHARS) return bad(`This scene has ${chars} characters of speech. ElevenLabs works best at ${MAX_DIALOGUE_CHARS} or fewer. Shorten the lines on the Script step.`)
      const key = elevenKey()
      if (!key) return fail(res, 500, `ElevenLabs is not connected yet. This app cannot see the ElevenLabs key (looked for VITE_ELEVENLABS_API_KEY). ElevenLabs variables it can see: ${namesMatching(/ELEVEN|XI_/).join(', ') || 'none'}.`)

      const body = (model: string) => JSON.stringify({ model_id: model, inputs: lines.map(l => ({ text: l.text, voice_id: voices[l.speaker.toLowerCase()].voice_id })) })
      const call = (model: string) => fetch(`${EL}/v1/text-to-dialogue?output_format=mp3_44100_128`, {
        method: 'POST', headers: { 'xi-api-key': key.value, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: body(model),
      })
      let r = await call('eleven_v4')
      if (!r.ok && [400, 404, 422].includes(r.status)) {
        const first = providerMessage(await r.text())
        if (!/model/i.test(first)) {
          await logActivity(cfg, { project_id: scene.project_id, provider: 'elevenlabs', action: 'scene recording', detail: `Scene ${scene.position}`, status: 'failed' })
          return fail(res, 502, `ElevenLabs would not make the recording (${r.status}): ${first}`)
        }
        r = await call('eleven_v3')
      }
      if (!r.ok) {
        await logActivity(cfg, { project_id: scene.project_id, provider: 'elevenlabs', action: 'scene recording', detail: `Scene ${scene.position}`, status: 'failed' })
        return fail(res, 502, await elevenError('the recording', r))
      }
      const audio = Buffer.from(await r.arrayBuffer())
      if (!audio.length) return fail(res, 502, 'ElevenLabs returned an empty recording. Try again.')

      const path = `projects/${scene.project_id}/audio/scene-${scene.position}-${Date.now()}.mp3`
      const saved = await saveStudioFile(cfg, path, audio, 'audio/mpeg')
      if (!saved.ok) return fail(res, 500, saved.error)
      const seconds = Math.round((audio.length / MP3_BYTES_PER_SECOND) * 10) / 10
      const cost = Math.round((chars / 1000) * SPEECH_USD_PER_1K_CHARS * 10000) / 10000
      const old = scene.extra?.audio_path
      const upd = await patchSceneExtra(cfg, scene.id, { ...(scene.extra || {}), audio_path: path, audio_seconds: seconds, audio_cost: cost, audio_approved: false, audio_text: String(scene.dialogue || '') })
      if (!upd.ok) { await deleteStudioFile(cfg, path); return fail(res, 500, `The recording could not be saved (${upd.status}).`) }
      if (old) await deleteStudioFile(cfg, old)
      await logActivity(cfg, { project_id: scene.project_id, provider: 'elevenlabs', action: 'scene recording', detail: `Scene ${scene.position}`, units_label: `${chars.toLocaleString()} characters`, est_cost_usd: cost })
      await syncAudioStep(cfg, scene.project_id)
      return res.status(200).json({ ok: true, cost_usd: cost, seconds })
    }

    if (action === 'approve_recording' || action === 'delete_recording') {
      const scene = UUID.test(String(b.scene_id)) ? await one(cfg, 'micro_drama_scenes', b.scene_id, 'id,project_id,extra') : null
      if (!scene) return fail(res, 404, 'That scene was not found.')
      const extra = { ...(scene.extra || {}) }
      if (action === 'approve_recording') {
        if (!extra.audio_path) return bad('Make a recording first.')
        extra.audio_approved = b.approved !== false
      } else {
        if (extra.audio_path) await deleteStudioFile(cfg, extra.audio_path)
        for (const k of ['audio_path', 'audio_seconds', 'audio_cost', 'audio_approved', 'audio_text']) delete extra[k]
      }
      const upd = await patchSceneExtra(cfg, scene.id, extra)
      if (!upd.ok) return fail(res, 500, `That could not be saved (${upd.status}).`)
      await syncAudioStep(cfg, scene.project_id)
      return res.status(200).json({ ok: true })
    }

    // Music --------------------------------------------------------------------
    if (['save_music_brief', 'make_music', 'upload_music', 'approve_music', 'delete_music'].includes(action)) {
      if (!UUID.test(String(b.project_id))) return bad('That project is not valid.')
      const proj = await one(cfg, 'micro_drama_projects', b.project_id, 'id,settings')
      if (!proj) return fail(res, 404, 'That project was not found.')
      const { music } = audioSettings(proj.settings)
      const keepFile = async (m: any) => { if (m?.path) await deleteStudioFile(cfg, m.path) }

      if (action === 'save_music_brief') {
        const next = { ...(music || {}), prompt: str(b.prompt, 4100), instrumental: b.instrumental !== false }
        const r = await saveAudioSettings(cfg, b.project_id, proj.settings, { music: next })
        return r.ok ? res.status(200).json({ ok: true }) : fail(res, 500, `The music description could not be saved (${r.status}).`)
      }

      if (action === 'approve_music') {
        if (!music?.path) return bad('Make or upload a music track first.')
        const r = await saveAudioSettings(cfg, b.project_id, proj.settings, { music: { ...music, approved: b.approved !== false } })
        if (!r.ok) return fail(res, 500, `That could not be saved (${r.status}).`)
        await syncAudioStep(cfg, b.project_id)
        return res.status(200).json({ ok: true })
      }

      if (action === 'delete_music') {
        await keepFile(music)
        const r = await saveAudioSettings(cfg, b.project_id, proj.settings, { music: music ? { prompt: music.prompt || '', instrumental: music.instrumental !== false } : null })
        if (!r.ok) return fail(res, 500, `That could not be removed (${r.status}).`)
        await syncAudioStep(cfg, b.project_id)
        return res.status(200).json({ ok: true })
      }

      if (action === 'upload_music') {
        const parsed = parseAudioUrl(b.data_url)
        if (!parsed.ok) return bad(parsed.error)
        const path = `projects/${b.project_id}/audio/music-${Date.now()}.${audioExt(parsed.mime)}`
        const saved = await saveStudioFile(cfg, path, parsed.bytes, parsed.mime)
        if (!saved.ok) return fail(res, 500, saved.error)
        const next = { prompt: music?.prompt || '', instrumental: music?.instrumental !== false, path, source: 'upload', seconds: null, cost_usd: null, approved: false }
        const r = await saveAudioSettings(cfg, b.project_id, proj.settings, { music: next })
        if (!r.ok) { await deleteStudioFile(cfg, path); return fail(res, 500, `The music could not be saved (${r.status}).`) }
        await keepFile(music)
        await syncAudioStep(cfg, b.project_id)
        return res.status(200).json({ ok: true })
      }

      // make_music
      const prompt = str(b.prompt, 4100)
      if (!prompt) return bad('Describe the music you want first.')
      const instrumental = b.instrumental !== false
      const lengthS = Math.min(600, Math.max(3, Number(proj.settings?.film?.length_s) || 30))
      const key = elevenKey()
      if (!key) return fail(res, 500, `ElevenLabs is not connected yet. This app cannot see the ElevenLabs key (looked for VITE_ELEVENLABS_API_KEY). ElevenLabs variables it can see: ${namesMatching(/ELEVEN|XI_/).join(', ') || 'none'}.`)
      const call = (model: string) => fetch(`${EL}/v1/music?output_format=mp3_44100_128`, {
        method: 'POST', headers: { 'xi-api-key': key.value, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ prompt, music_length_ms: lengthS * 1000, model_id: model, force_instrumental: instrumental }),
      })
      let r: Response | null = null
      let firstError = ''
      for (const model of ['music_v2_5', 'music_v2', 'music_v1']) {
        r = await call(model)
        if (r.ok) break
        if (![400, 404, 422].includes(r.status)) break
        const msg = providerMessage(await r.text())
        if (!/model/i.test(msg)) { firstError = `ElevenLabs would not make the music (${r.status}): ${msg}${money(r.status, msg) ? ' This may be where ElevenLabs needs credits or a paid plan.' : ''}`; r = null; break }
      }
      if (!r || !r.ok) {
        await logActivity(cfg, { project_id: b.project_id, provider: 'elevenlabs', action: 'music', status: 'failed' })
        return fail(res, 502, firstError || (r ? await elevenError('the music', r) : 'ElevenLabs would not make the music.'))
      }
      const audio = Buffer.from(await r.arrayBuffer())
      if (!audio.length) return fail(res, 502, 'ElevenLabs returned an empty music file. Try again.')
      const path = `projects/${b.project_id}/audio/music-${Date.now()}.mp3`
      const saved = await saveStudioFile(cfg, path, audio, 'audio/mpeg')
      if (!saved.ok) return fail(res, 500, saved.error)
      const cost = Math.round((lengthS / 60) * MUSIC_USD_PER_MINUTE * 10000) / 10000
      const next = { prompt, instrumental, path, source: 'made', seconds: lengthS, cost_usd: cost, approved: false }
      const upd = await saveAudioSettings(cfg, b.project_id, proj.settings, { music: next })
      if (!upd.ok) { await deleteStudioFile(cfg, path); return fail(res, 500, `The music could not be saved (${upd.status}).`) }
      await keepFile(music)
      await logActivity(cfg, { project_id: b.project_id, provider: 'elevenlabs', action: 'music', units_label: `${lengthS} seconds · ${instrumental ? 'instrumental' : 'with vocals'}`, est_cost_usd: cost })
      await syncAudioStep(cfg, b.project_id)
      return res.status(200).json({ ok: true, cost_usd: cost })
    }

    return fail(res, 400, 'Unknown request.')
  } catch (e: any) {
    console.error('[hub-studio-audio] failed:', e)
    return fail(res, 500, e?.message || 'The audio request failed.')
  }
}
