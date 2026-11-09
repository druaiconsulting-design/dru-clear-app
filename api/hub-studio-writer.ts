// DRU AI Leadership Ecosystem™ — api/hub-studio-writer.ts
// Micro Drama Studio, Stage 2: the writing steps. Admin only.
//   POST {action:'story_ideas', project_id, writer, mode, own_idea?, base_id?}
//        mode: 'new' (three ideas, replaces the list) | 'more' (three more, added) |
//              'more_dramatic' (one sharper version of base_id) | 'another' (one new angle on base_id)
//   POST {action:'clean_up', project_id, text}    → tidied wording of DeAnna's own story idea
//   POST {action:'script', project_id, writer, restart?}
//        Writes up to 20 scenes per call and reports how much of the film is covered; the page calls again until done.
// The writer is 'agent:<slug>', 'claude' or 'chatgpt'. Every call is logged for the Usage tab.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'
import { fail, supabaseConfig, requireAdmin } from './_lib/hubShared.js'
import { rest, UUID, SCENE_TEXT_FIELDS, snapshotScript } from './_lib/studioData.js'
import { resolveWriter, writerSystemPrompt, callWriter, extractJson, writerLabel, type Writer } from './_lib/studioWriter.js'

export const config = { maxDuration: 300 }

const SCENES_PER_CALL = 20
const SCENE_RULES = {
  short: { min: 4, max: 8, avg: 6, label: 'short takes (4 to 8 seconds each)' },
  long: { min: 10, max: 30, avg: 20, label: 'long takes (10 to 30 seconds each)' },
} as const

const clean = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)

function productBlock(settings: any): string {
  const p = settings?.product || {}
  return [
    'PRODUCT DETAILS (from DeAnna)',
    `Name: ${clean(p.name, 200)}`,
    `What it is: ${clean(p.what, 1200)}`,
    p.audience ? `Who it is for: ${clean(p.audience, 600)}` : '',
    p.link ? `Where viewers go next: ${clean(p.link, 300)}` : '',
    p.never ? `Must never be said or shown: ${clean(p.never, 1000)}` : 'Must never be said or shown: nothing listed',
  ].filter(Boolean).join('\n')
}

async function loadProject(cfg: any, id: string) {
  const r = await rest(cfg, `micro_drama_projects?id=eq.${id}&select=id,title,settings,steps_done`)
  return r.ok && Array.isArray(r.body) ? r.body[0] || null : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed')
  const cfg = supabaseConfig()
  if (!cfg) return fail(res, 500, 'Supabase credentials are not configured for this app.')
  if (!(await requireAdmin(req, res, cfg.url, cfg.serviceKey))) return

  try {
    const b = (req.body || {}) as Record<string, any>
    const action = String(b.action || '')
    const projectId = String(b.project_id || '')
    if (!UUID.test(projectId)) return fail(res, 400, 'That project is not valid.')
    const project = await loadProject(cfg, projectId)
    if (!project) return fail(res, 404, 'That project no longer exists.')
    const settings = project.settings || {}

    // ── Tidy DeAnna's own story idea ─────────────────────────────────────────
    if (action === 'clean_up') {
      const text = clean(b.text, 8000)
      if (!text) return fail(res, 400, 'Type or dictate your idea first.')
      const w: Writer = { kind: 'claude' }
      const sys = 'You tidy spoken or rough story ideas for a micro drama writer. Fix spelling and punctuation, split the text into clear paragraphs, and keep every detail, name, event and the author\'s meaning exactly as given. Reply with the tidied text only.'
      const out = await callWriter(cfg, w, sys, text, { maxTokens: 3000, projectId, action: 'Tidied the story idea', tidy: true })
      if (!out.ok) return fail(res, 502, out.error)
      return res.status(200).json({ ok: true, text: out.text.trim() })
    }

    // Both writing actions need a writer and the Product step.
    const resolved = await resolveWriter(cfg, String(b.writer || ''))
    if (!resolved.ok) return fail(res, 400, resolved.error)
    const writer = resolved.writer
    if (!clean(settings?.product?.name, 200) || !clean(settings?.product?.what, 1200)) {
      return fail(res, 400, 'Fill in the product name and what it is on the Product step first.')
    }

    // ── Story ideas ──────────────────────────────────────────────────────────
    if (action === 'story_ideas') {
      const mode = String(b.mode || 'new')
      if (!['new', 'more', 'more_dramatic', 'another'].includes(mode)) return fail(res, 400, 'Unknown story request.')
      const story = settings.story || {}
      const options: any[] = Array.isArray(story.options) ? story.options : []
      const ownIdea = clean(b.own_idea ?? story.own_idea, 8000)
      const base = options.find(o => o.id === b.base_id)
      if ((mode === 'more_dramatic' || mode === 'another') && !base) return fail(res, 400, 'That story card is no longer in the list.')

      const n = mode === 'new' || mode === 'more' ? 3 : 1
      let task: string
      if (mode === 'more_dramatic') {
        task = `Rewrite this story with higher stakes and a sharper emotional turn, keeping its core premise.\nSTORY: ${base.title}. ${base.summary}`
      } else if (mode === 'another') {
        task = `Write a fresh version of this premise from a different angle: new characters or a new turning point.\nSTORY: ${base.title}. ${base.summary}`
      } else if (mode === 'more') {
        task = `Write 3 new story ideas that differ from these existing ones: ${options.map(o => o.title).join('; ') || 'none yet'}.`
      } else {
        task = `Write 3 story ideas for this film.`
      }
      if (ownIdea) task += `\nDEANNA'S OWN IDEA, which every story builds on:\n${ownIdea}`

      const system = await writerSystemPrompt(
        writer,
        'You are writing story ideas for a micro drama. Each idea is a complete short story in outline: who the characters are, what happens from the first beat to the last, and what the viewer feels.'
      )
      const user = `${productBlock(settings)}\n\nFILM TYPE: ${clean(settings.film_type, 80) || 'not chosen yet'}\n\nTASK\n${task}\n\n` +
        `Reply with JSON only, in this shape:\n{"stories":[{"category":"a 2 to 3 word tag","title":"story title","summary":"3 to 5 sentences covering the characters, the turning point and the ending"}]}\nWrite exactly ${n} ${n === 1 ? 'story' : 'stories'}.`

      const actionLabel = mode === 'more_dramatic' ? 'Story: more dramatic version' : mode === 'another' ? 'Story: another version' : mode === 'more' ? 'Story: three more ideas' : 'Story: three ideas'
      const out = await callWriter(cfg, writer, system, user, { maxTokens: 2500, projectId, action: actionLabel })
      if (!out.ok) return fail(res, 502, out.error)
      const parsed = extractJson(out.text)
      const list: any[] = Array.isArray(parsed?.stories) ? parsed.stories : []
      const cards = list.slice(0, n).map(s => ({
        id: randomUUID(), category: clean(s.category, 40) || 'Story', title: clean(s.title, 140), summary: clean(s.summary, 1500), writer: writerLabel(writer),
      })).filter(c => c.title && c.summary)
      if (!cards.length) return fail(res, 502, 'The writer\'s answer could not be read as story cards. Try again.')

      let next: any[]
      if (mode === 'new') next = cards
      else if (mode === 'more') next = [...options, ...cards]
      else { const at = options.findIndex(o => o.id === base.id); next = [...options.slice(0, at + 1), ...cards, ...options.slice(at + 1)] }

      const newStory = { ...story, options: next, own_idea: ownIdea || story.own_idea || '', writer: writerLabel(writer) }
      const upd = await rest(cfg, `micro_drama_projects?id=eq.${projectId}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ settings: { ...settings, story: newStory }, updated_at: new Date().toISOString() }),
      })
      if (!upd.ok) return fail(res, 500, `The story cards could not be saved (${upd.status}).`)
      return res.status(200).json({ ok: true, story: newStory, cost_usd: Math.round(out.cost * 10000) / 10000 })
    }

    // ── Script ───────────────────────────────────────────────────────────────
    if (action === 'script') {
      const film = settings.film || {}
      const total = Number(film.length_s)
      const rule = SCENE_RULES[film.scene_mode as 'short' | 'long']
      if (!Number.isFinite(total) || total < 20 || total > 3600) return fail(res, 400, 'Set the film length (20 seconds to 60 minutes) in the film settings first.')
      if (!rule) return fail(res, 400, 'Choose short or long scenes in the film settings first.')
      if (!['dialogue', 'narration', 'song'].includes(film.sound)) return fail(res, 400, 'Choose dialogue, narration or song in the film settings first.')
      const chosen = settings.story?.chosen
      if (!chosen?.title) return fail(res, 400, 'Choose a story on the Story step first.')

      if (b.restart) {
        await snapshotScript(cfg, projectId, 'Before rewriting the script')
        const del = await rest(cfg, `micro_drama_scenes?project_id=eq.${projectId}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
        if (!del.ok) return fail(res, 500, `The old scenes could not be cleared (${del.status}).`)
        const steps = (project.steps_done as string[]).filter(s => s !== 'script')
        await rest(cfg, `micro_drama_projects?id=eq.${projectId}`, {
          method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ steps_done: steps, updated_at: new Date().toISOString() }),
        })
      }

      const existing = await rest(cfg, `micro_drama_scenes?project_id=eq.${projectId}&select=position,start_s,end_s,characters,what_we_see,dialogue&order=position.asc`)
      if (!existing.ok) return fail(res, 500, `The scenes could not be read (${existing.status}).`)
      const have: any[] = existing.body || []
      const covered = have.length ? Number(have[have.length - 1].end_s) || 0 : 0
      if (total - covered < rule.min) return res.status(200).json({ ok: true, done: true, covered_s: covered, scene_count: have.length })

      const remaining = total - covered
      const count = Math.min(SCENES_PER_CALL, Math.max(1, Math.ceil(remaining / rule.avg)))
      let windowEnd = Math.min(total, covered + count * rule.avg)
      if (total - windowEnd < rule.min) windowEnd = total
      const atEnd = windowEnd >= total
      const soundRule =
        film.sound === 'dialogue' ? 'The "dialogue" field holds the lines the characters speak, each prefixed with the speaker\'s name.'
        : film.sound === 'narration' ? 'The "dialogue" field holds the narrator\'s lines for that scene.'
        : 'The "dialogue" field holds the song lyrics sung during that scene.'
      const earlier = have.map(s => `#${s.position} [${s.start_s}s-${s.end_s}s] ${clean(s.characters, 120)} | ${clean(s.what_we_see, 160)} | ${clean(s.dialogue, 120)}`).join('\n')

      const system = await writerSystemPrompt(
        writer,
        'You are turning a chosen story into a scene-by-scene script for a micro drama. Every scene is one continuous camera moment that an AI video model will film from your description.'
      )
      const user =
        `${productBlock(settings)}\n\nFILM TYPE: ${clean(settings.film_type, 80) || 'not chosen'}\n` +
        `CHOSEN STORY: ${chosen.title} (${chosen.category})\n${chosen.summary}\n\n` +
        `FILM SETTINGS\nTotal length: ${total} seconds\nScene length: ${rule.label}\nShape: ${clean(film.shape, 60) || 'not set'}\nVisual style: ${clean(film.style, 80) || 'not set'}\nSound: ${film.sound}\n` +
        `${soundRule}\n\n` +
        (have.length ? `SCENES ALREADY WRITTEN\n${earlier}\n\n` : '') +
        `TASK\nWrite about ${count} scenes covering second ${covered} to second ${windowEnd} of the ${total}-second film. ` +
        `Each scene runs between ${rule.min} and ${rule.max} seconds. Keep character names, looks and settings consistent with the scenes already written. ` +
        (atEnd ? 'These scenes bring the story to its ending.' : 'The story continues after these scenes, so the last scene leaves the story open.') + '\n' +
        `For each scene, "image_prompt" describes the starting frame as a picture: who is in it, where, the light and mood, and the camera framing, in the film's visual style.\n\n` +
        `Reply with JSON only, in this shape:\n{"scenes":[{"length_s":6,"setting":"","characters":"","what_we_see":"","emotional_beat":"","dialogue":"","product_appearance":"how the product shows up, or empty","camera":"","image_prompt":""}]}`

      const out = await callWriter(cfg, writer, system, user, {
        maxTokens: 8000, projectId, action: have.length ? 'Script: next scenes' : 'Script: scenes written', detail: `seconds ${Math.round(covered)} to ${Math.round(windowEnd)}`,
      })
      if (!out.ok) return fail(res, 502, out.error)
      const parsed = extractJson(out.text)
      const list: any[] = Array.isArray(parsed?.scenes) ? parsed.scenes : []
      if (!list.length) return fail(res, 502, 'The writer\'s answer could not be read as scenes. Try again.')

      let t = covered
      let pos = have.length ? Number(have[have.length - 1].position) : 0
      const rows = list.slice(0, count + 4).map(s => {
        const len = Math.min(rule.max, Math.max(rule.min, Number(s.length_s) || rule.avg))
        const row: Record<string, unknown> = { project_id: projectId, position: ++pos, start_s: t, end_s: t + len }
        t += len
        for (const f of SCENE_TEXT_FIELDS) row[f] = clean(s[f], f === 'image_prompt' || f === 'what_we_see' ? 1500 : 800)
        return row
      })
      const ins = await rest(cfg, 'micro_drama_scenes', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows) })
      if (!ins.ok) return fail(res, 500, `The scenes could not be saved (${ins.status}).`)

      const done = total - t < rule.min
      if (done) await snapshotScript(cfg, projectId, `Written by ${writerLabel(writer)}`, { writer: writerLabel(writer) })
      await rest(cfg, `micro_drama_projects?id=eq.${projectId}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ settings: { ...settings, script: { ...(settings.script || {}), writer: writerLabel(writer), writer_id: String(b.writer) } }, current_step: 'script', updated_at: new Date().toISOString() }),
      })
      return res.status(200).json({ ok: true, done, covered_s: t, scene_count: pos, cost_usd: Math.round(out.cost * 10000) / 10000 })
    }

    return fail(res, 400, 'Unknown request.')
  } catch (e: any) {
    console.error('[hub-studio-writer] failed:', e)
    return fail(res, 500, e?.message || 'The writing request failed.')
  }
}
