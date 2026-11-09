// DRU AI Leadership Ecosystem™ — api/hub-studio-pictures.ts
// Micro Drama Studio, Stage 3: the Cast and Storyboard steps. Admin only.
//   GET  ?view=cast&id=<project>        → characters with their pictures (as links the page can show)
//   GET  ?view=frames&id=<project>      → scenes with their storyboard frames
//   GET  ?view=brandkit                 → saved brand-kit characters
//   POST {action: ...} — add_character, save_character, delete_character, propose_cast, make_cast_picture,
//        upload_cast_picture, approve_cast_picture, delete_cast_picture, make_product_picture, upload_product_picture,
//        approve_product_picture, delete_product_picture, save_cast_to_brand_kit, add_from_brand_kit,
//        delete_brand_kit, make_frame, upload_frame, approve_frame
// Pictures are made by OpenAI and saved in the private studio-media storage. Every picture is logged for the Usage tab.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'
import { fail, supabaseConfig, requireAdmin } from './_lib/hubShared.js'
import { rest, UUID, type Cfg } from './_lib/studioData.js'
import { resolveWriter, writerSystemPrompt, callWriter, extractJson, writerLabel, type Writer } from './_lib/studioWriter.js'
import {
  CAST_SIZE, frameSize, makePicture, saveStudioFile, readStudioFile, deleteStudioFile, fetchPhoto, signPaths, parseDataUrl, extFor,
  syncPictureSteps, type Ref,
} from './_lib/studioImages.js'

export const config = { maxDuration: 300 }

const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)
const CHAR_TEXT = ['name', 'role', 'age_range', 'look', 'wardrobe', 'before_after'] as const

async function one(cfg: Cfg, table: string, id: string, select = '*'): Promise<any | null> {
  const r = await rest(cfg, `${table}?id=eq.${id}&select=${select}`)
  return r.ok && Array.isArray(r.body) ? r.body[0] || null : null
}

async function projectOf(cfg: Cfg, id: string) {
  return one(cfg, 'micro_drama_projects', id, 'id,title,settings,steps_done')
}

async function agentPhoto(cfg: Cfg, slug: string): Promise<{ ok: true; ref: Ref } | { ok: false; error: string }> {
  if (!/^[a-z0-9-]{1,60}$/.test(slug || '')) return { ok: false, error: 'Pick which agent\'s photo to use as this character\'s face first.' }
  const r = await rest(cfg, `agents?slug=eq.${slug}&select=name,photo_url&limit=1`)
  const a = r.ok ? r.body?.[0] : null
  if (!a?.photo_url) return { ok: false, error: 'That agent has no photo saved, so there is no face to use.' }
  const ref = await fetchPhoto(a.photo_url)
  if (!ref) return { ok: false, error: `${a.name}'s photo could not be read.` }
  return { ok: true, ref }
}


// The cast is listed by the same writer who wrote the script (saved on the project), else matched by name, else Claude.
async function scriptWriter(cfg: Cfg, settings: any): Promise<{ writer: Writer; label: string }> {
  const id = settings?.script?.writer_id
  if (id) { const r = await resolveWriter(cfg, String(id)); if (r.ok) return { writer: r.writer, label: writerLabel(r.writer) } }
  const label = String(settings?.script?.writer || '')
  if (label === 'ChatGPT') return { writer: { kind: 'chatgpt' }, label }
  if (label && label !== 'Claude') {
    const a = await rest(cfg, `agents?name=eq.${encodeURIComponent(label)}&select=slug&limit=1`)
    const slug = a.ok ? a.body?.[0]?.slug : null
    if (slug) { const r = await resolveWriter(cfg, `agent:${slug}`); if (r.ok) return { writer: r.writer, label: writerLabel(r.writer) } }
  }
  return { writer: { kind: 'claude' }, label: 'Claude' }
}

function productCard(settings: any) {
  const pr = settings?.product_reference || {}
  return { name: settings?.product?.name || '', what: settings?.product?.what || '', pictures: Array.isArray(pr.pictures) ? pr.pictures : [], approved_id: pr.approved_id || null, approved_path: pr.approved_path || null }
}

function firstName(n: string) { return String(n || '').trim().split(/\s+/)[0].toLowerCase() }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return fail(res, 405, 'Method not allowed')
  const cfg = supabaseConfig()
  if (!cfg) return fail(res, 500, 'Supabase credentials are not configured for this app.')
  if (!(await requireAdmin(req, res, cfg.url, cfg.serviceKey))) return

  try {
    // ── Reads ────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const view = String(req.query.view || '')
      const id = String(req.query.id || '')

      if (view === 'cast') {
        if (!UUID.test(id)) return fail(res, 400, 'That project is not valid.')
        const [r, projRow] = await Promise.all([rest(cfg, `micro_drama_characters?project_id=eq.${id}&select=*&order=created_at.asc`), projectOf(cfg, id)])
        if (!r.ok) return fail(res, 500, `The cast could not be read (${r.status}).`)
        const rows: any[] = r.body
        const prod = productCard(projRow?.settings)
        const urls = await signPaths(cfg, [...rows.flatMap(c => [...(c.reference_paths || []).map((p: any) => p.path), c.approved_path]), ...prod.pictures.map((p: any) => p.path)])
        const characters = rows.map(c => ({
          id: c.id, name: c.name, role: c.role, age_range: c.age_range, look: c.look, wardrobe: c.wardrobe, before_after: c.before_after,
          face_source: c.extra?.face_source || 'invented', agent_slug: c.extra?.agent_slug || '',
          approved_id: c.extra?.approved_id || null, approved_url: c.approved_path ? urls[c.approved_path] || null : null,
          pictures: (c.reference_paths || []).map((p: any) => ({ id: p.id, view: p.view, source: p.source, url: urls[p.path] || null })),
        }))
        const product = { name: prod.name, what: prod.what, approved_id: prod.approved_id, approved_url: prod.approved_path ? urls[prod.approved_path] || null : null,
          pictures: prod.pictures.map((p: any) => ({ id: p.id, view: 'front', source: p.source, url: urls[p.path] || null })) }
        return res.status(200).json({ ok: true, characters, product, script_writer: (await scriptWriter(cfg, projRow?.settings)).label })
      }

      if (view === 'frames') {
        if (!UUID.test(id)) return fail(res, 400, 'That project is not valid.')
        const [proj, sc, ch] = await Promise.all([
          projectOf(cfg, id),
          rest(cfg, `micro_drama_scenes?project_id=eq.${id}&select=id,position,start_s,end_s,characters,image_prompt,what_we_see,product_appearance,frame_path,extra&order=position.asc&limit=2000`),
          rest(cfg, `micro_drama_characters?project_id=eq.${id}&select=name,approved_path`),
        ])
        if (!sc.ok) return fail(res, 500, `The scenes could not be read (${sc.status}).`)
        const rows: any[] = sc.body
        const urls = await signPaths(cfg, rows.map(s => s.frame_path))
        const film = proj?.settings?.film || {}
        const prodApproved = !!proj?.settings?.product_reference?.approved_path
        const chars: any[] = ch.ok ? ch.body : []
        const frames = rows.map(s => {
          const text = String(s.characters || '').toLowerCase()
          const missing = chars.filter(c => !c.approved_path && c.name && (text.includes(String(c.name).toLowerCase()) || (firstName(c.name).length >= 3 && text.includes(firstName(c.name))))).map(c => c.name)
          return {
            id: s.id, position: s.position, start_s: s.start_s, end_s: s.end_s, characters: s.characters, prompt: s.image_prompt || s.what_we_see || '',
            frame_url: s.frame_path ? urls[s.frame_path] || null : null, quality: s.extra?.frame_quality || null, approved: s.extra?.frame_approved === true,
            missing_cast: [...missing, ...(String(s.product_appearance || '').trim() && !prodApproved ? ['the product'] : [])],
          }
        })
        return res.status(200).json({ ok: true, frames, shape: film.shape || '', size: frameSize(film.shape) })
      }

      if (view === 'brandkit') {
        const r = await rest(cfg, 'micro_drama_brand_cast?select=*&order=created_at.desc&limit=200')
        if (!r.ok) return fail(res, 500, `The brand kit could not be read (${r.status}).`)
        const rows: any[] = r.body
        const urls = await signPaths(cfg, rows.map(k => k.approved_path))
        return res.status(200).json({ ok: true, kit: rows.map(k => ({ id: k.id, kind: k.kind, name: k.name, role: k.role, look: k.look, picture_url: k.approved_path ? urls[k.approved_path] || null : null })) })
      }
      return fail(res, 400, 'Unknown view.')
    }

    // ── Writes ───────────────────────────────────────────────────────────────
    const b = (req.body || {}) as Record<string, any>
    const action = String(b.action || '')
    const bad = (m: string) => fail(res, 400, m)

    // Characters ---------------------------------------------------------------
    if (action === 'add_character') {
      if (!UUID.test(String(b.project_id))) return bad('That project is not valid.')
      const made = await rest(cfg, 'micro_drama_characters', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ project_id: b.project_id, name: str(b.name, 80) || 'New character', extra: { face_source: 'invented' } }) })
      if (!made.ok) return fail(res, 500, `The character could not be added (${made.status}).`)
      await syncPictureSteps(cfg, b.project_id)
      return res.status(200).json({ ok: true })
    }

    if (action === 'save_character') {
      if (!UUID.test(String(b.character_id))) return bad('That character is not valid.')
      const c = await one(cfg, 'micro_drama_characters', b.character_id)
      if (!c) return fail(res, 404, 'That character no longer exists.')
      const f = (b.fields || {}) as Record<string, any>
      const upd: Record<string, unknown> = {}
      for (const k of CHAR_TEXT) if (f[k] !== undefined) upd[k] = str(f[k], k === 'name' ? 80 : 800)
      const extra = { ...(c.extra || {}) }
      if (f.face_source !== undefined) { if (!['invented', 'agent', 'upload'].includes(f.face_source)) return bad('Face source must be invented, agent or upload.'); extra.face_source = f.face_source }
      if (f.agent_slug !== undefined) extra.agent_slug = /^[a-z0-9-]{0,60}$/.test(f.agent_slug) ? f.agent_slug : ''
      upd.extra = extra
      const saved = await rest(cfg, `micro_drama_characters?id=eq.${c.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ...upd, updated_at: new Date().toISOString() }) })
      if (!saved.ok) return fail(res, 500, `The character could not be saved (${saved.status}).`)
      return res.status(200).json({ ok: true })
    }

    if (action === 'delete_character') {
      if (!UUID.test(String(b.character_id))) return bad('That character is not valid.')
      const c = await one(cfg, 'micro_drama_characters', b.character_id, 'id,project_id')
      if (!c) return fail(res, 404, 'That character no longer exists.')
      const del = await rest(cfg, `micro_drama_characters?id=eq.${c.id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
      if (!del.ok) return fail(res, 500, `The character could not be deleted (${del.status}).`)
      await syncPictureSteps(cfg, c.project_id)
      return res.status(200).json({ ok: true })
    }

    if (action === 'propose_cast') {
      const projectId = String(b.project_id || '')
      if (!UUID.test(projectId)) return bad('That project is not valid.')
      const proj = await projectOf(cfg, projectId)
      if (!proj) return fail(res, 404, 'That project no longer exists.')
      const sw = await scriptWriter(cfg, proj.settings)
      const resolved = { ok: true as const, writer: sw.writer }
      const [sc, ex] = await Promise.all([
        rest(cfg, `micro_drama_scenes?project_id=eq.${projectId}&select=position,characters,what_we_see,dialogue&order=position.asc&limit=2000`),
        rest(cfg, `micro_drama_characters?project_id=eq.${projectId}&select=name`),
      ])
      const scenes: any[] = sc.ok ? sc.body : []
      if (!scenes.length) return bad('Write the script first. The cast is read from the scenes.')
      const have = new Set((ex.ok ? ex.body : []).map((c: any) => String(c.name).toLowerCase()))
      const chosen = proj.settings?.story?.chosen
      const system = await writerSystemPrompt(resolved.writer, 'You are building the cast list for a micro drama from its finished script.')
      const user =
        `FILM STYLE: ${str(proj.settings?.film?.style, 80) || 'not set'}\nSTORY: ${chosen?.title || ''}. ${chosen?.summary || ''}\n\n` +
        `SCENES\n${scenes.map(s => `#${s.position} Characters: ${str(s.characters, 200)} | ${str(s.what_we_see, 200)} | ${str(s.dialogue, 160)}`).join('\n')}\n\n` +
        `TASK\nList every character who appears or speaks in these scenes. ${have.size ? `Leave out these characters, who are already in the cast: ${Array.from(have).join(', ')}.` : ''}\n` +
        `For each one give the name, role in the story, age range, physical look, wardrobe, and how the character changes from the start to the end of the film (or "no change").\n` +
        `Reply with JSON only: {"characters":[{"name":"","role":"","age_range":"","look":"","wardrobe":"","before_after":""}]}`
      const out = await callWriter(cfg, resolved.writer, system, user, { maxTokens: 3000, projectId, action: 'Cast: characters proposed from the script' })
      if (!out.ok) return fail(res, 502, out.error)
      const list: any[] = Array.isArray(extractJson(out.text)?.characters) ? extractJson(out.text).characters : []
      const rows = list.filter(c => str(c.name, 80) && !have.has(str(c.name, 80).toLowerCase())).map(c => ({
        project_id: projectId, name: str(c.name, 80), role: str(c.role, 300), age_range: str(c.age_range, 80), look: str(c.look, 800), wardrobe: str(c.wardrobe, 800), before_after: str(c.before_after, 800), extra: { face_source: 'invented' },
      }))
      if (!rows.length) return res.status(200).json({ ok: true, added: 0, writer: sw.label })
      const ins = await rest(cfg, 'micro_drama_characters', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows) })
      if (!ins.ok) return fail(res, 500, `The characters could not be saved (${ins.status}).`)
      await syncPictureSteps(cfg, projectId)
      return res.status(200).json({ ok: true, added: rows.length, writer: sw.label })
    }

    // Cast pictures --------------------------------------------------------------
    if (action === 'make_cast_picture' || action === 'upload_cast_picture') {
      if (!UUID.test(String(b.character_id))) return bad('That character is not valid.')
      const view = b.view === 'three_quarter' ? 'three_quarter' : 'front'
      const c = await one(cfg, 'micro_drama_characters', b.character_id)
      if (!c) return fail(res, 404, 'That character no longer exists.')
      const proj = await projectOf(cfg, c.project_id)
      const film = proj?.settings?.film || {}
      const source: string = c.extra?.face_source || 'invented'
      const path = `projects/${c.project_id}/cast/${c.id}/${view}-${Date.now()}`
      let bytes: Buffer, mime: string, cost = 0

      if (action === 'upload_cast_picture') {
        const parsed = parseDataUrl(b.data_url)
        if (!parsed.ok) return bad(parsed.error)
        bytes = parsed.bytes; mime = parsed.mime
      } else {
        if (source === 'upload') return bad('This character uses an uploaded picture. Use Upload picture.')
        const refs: Ref[] = []
        if (source === 'agent') {
          const a = await agentPhoto(cfg, c.extra?.agent_slug)
          if (!a.ok) return bad(a.error)
          refs.push(a.ref)
        }
        if (view === 'three_quarter') {
          const pics: any[] = (c.reference_paths || []).filter((p: any) => p.view === 'front')
          const front = pics.find(p => p.path === c.approved_path) || pics[pics.length - 1]
          const file = front ? await readStudioFile(cfg, front.path) : null
          if (!file) return bad('Make or upload the front view first. The three-quarter view is made from it.')
          refs.push(file)
        }
        const look = [`Name: ${c.name}`, c.role && `Role: ${c.role}`, c.age_range && `Age range: ${c.age_range}`, c.look && `Look: ${c.look}`, c.wardrobe && `Wardrobe: ${c.wardrobe}`].filter(Boolean).join('\n')
        const prompt =
          (view === 'front'
            ? 'Character reference picture of one person: full body, front view, standing, plain neutral studio background, even soft lighting.'
            : 'Character reference picture of the same person as in the reference picture: full body, three-quarter view with the body turned slightly to the left, same face, same hair, same wardrobe, same plain neutral background and lighting.') +
          (source === 'agent' ? ' The first reference picture is a photo of the person whose face and likeness this character has; keep that face recognizable.' : '') +
          `\nVisual style: ${str(film.style, 80) || 'cinematic realism'}.\n${look}`
        const made = await makePicture(cfg, { prompt, size: CAST_SIZE, quality: 'medium', refs, projectId: c.project_id, action: `Cast picture: ${view === 'front' ? 'front view' : 'three-quarter view'}`, detail: c.name })
        if (!made.ok) return fail(res, 502, made.error)
        bytes = made.bytes; mime = made.mime; cost = made.cost
      }
      const file = `${path}.${extFor(mime)}`
      const saved = await saveStudioFile(cfg, file, bytes, mime)
      if (!saved.ok) return fail(res, 500, saved.error)
      const pic = { id: randomUUID(), view, path: file, source: action === 'upload_cast_picture' ? 'upload' : 'made' }
      const upd = await rest(cfg, `micro_drama_characters?id=eq.${c.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ reference_paths: [...(c.reference_paths || []), pic], updated_at: new Date().toISOString() }) })
      if (!upd.ok) return fail(res, 500, `The picture could not be saved on the character (${upd.status}).`)
      return res.status(200).json({ ok: true, cost_usd: Math.round(cost * 10000) / 10000 })
    }

    if (action === 'approve_cast_picture' || action === 'delete_cast_picture') {
      if (!UUID.test(String(b.character_id))) return bad('That character is not valid.')
      const c = await one(cfg, 'micro_drama_characters', b.character_id)
      if (!c) return fail(res, 404, 'That character no longer exists.')
      const pics: any[] = c.reference_paths || []
      const extra = { ...(c.extra || {}) }
      let approvedPath: string | null = c.approved_path
      if (action === 'approve_cast_picture') {
        if (b.picture_id === null) { approvedPath = null; extra.approved_id = null } else {
          const p = pics.find(x => x.id === b.picture_id)
          if (!p) return fail(res, 404, 'That picture no longer exists.')
          approvedPath = p.path; extra.approved_id = p.id
        }
      } else {
        const p = pics.find(x => x.id === b.picture_id)
        if (!p) return fail(res, 404, 'That picture no longer exists.')
        pics.splice(pics.indexOf(p), 1)
        if (approvedPath === p.path) { approvedPath = null; extra.approved_id = null }
      }
      const upd = await rest(cfg, `micro_drama_characters?id=eq.${c.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ reference_paths: pics, approved_path: approvedPath, extra, updated_at: new Date().toISOString() }) })
      if (!upd.ok) return fail(res, 500, `That could not be saved (${upd.status}).`)
      const steps = await syncPictureSteps(cfg, c.project_id)
      return res.status(200).json({ ok: true, steps_done: steps })
    }

    // Brand kit ---------------------------------------------------------------------
    if (action === 'save_cast_to_brand_kit') {
      if (!UUID.test(String(b.project_id))) return bad('That project is not valid.')
      const [proj, chars, existing] = await Promise.all([
        projectOf(cfg, b.project_id),
        rest(cfg, `micro_drama_characters?project_id=eq.${b.project_id}&select=*`),
        rest(cfg, 'micro_drama_brand_cast?select=name,kind,approved_path&limit=500'),
      ])
      const saved = new Set((existing.ok ? existing.body : []).map((k: any) => `${k.kind}|${String(k.name).toLowerCase()}|${k.approved_path}`))
      const rows: any[] = []
      for (const c of (chars.ok ? chars.body : []) as any[]) {
        if (!c.approved_path || saved.has(`character|${String(c.name).toLowerCase()}|${c.approved_path}`)) continue
        rows.push({ kind: 'character', name: c.name, role: c.role, age_range: c.age_range, look: c.look, wardrobe: c.wardrobe, before_after: c.before_after, face_source: c.extra?.face_source || 'invented', agent_slug: c.extra?.agent_slug || null, approved_path: c.approved_path })
      }
      const prod = productCard(proj?.settings)
      if (prod.approved_path && !saved.has(`product|${prod.name.toLowerCase()}|${prod.approved_path}`)) {
        rows.push({ kind: 'product', name: prod.name || 'Product', look: prod.what || null, approved_path: prod.approved_path, face_source: null })
      }
      if (!rows.length) return res.status(200).json({ ok: true, saved: 0, note: 'Everything with an approved picture is already in the brand kit, or nothing is approved yet.' })
      const ins = await rest(cfg, 'micro_drama_brand_cast', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows) })
      if (!ins.ok) return fail(res, 500, `The brand kit could not be saved (${ins.status}).`)
      return res.status(200).json({ ok: true, saved: rows.length })
    }

    // Product reference pictures -------------------------------------------------------
    if (action === 'make_product_picture' || action === 'upload_product_picture' || action === 'approve_product_picture' || action === 'delete_product_picture') {
      if (!UUID.test(String(b.project_id))) return bad('That project is not valid.')
      const proj = await projectOf(cfg, b.project_id)
      if (!proj) return fail(res, 404, 'That project no longer exists.')
      const settings = { ...(proj.settings || {}) }
      const pr = { pictures: [] as any[], approved_id: null as string | null, approved_path: null as string | null, ...(settings.product_reference || {}) }
      pr.pictures = Array.isArray(pr.pictures) ? [...pr.pictures] : []
      let cost = 0

      if (action === 'make_product_picture' || action === 'upload_product_picture') {
        let bytes: Buffer, mime: string
        if (action === 'upload_product_picture') {
          const parsed = parseDataUrl(b.data_url)
          if (!parsed.ok) return bad(parsed.error)
          bytes = parsed.bytes; mime = parsed.mime
        } else {
          const name = str(settings.product?.name, 200), what = str(settings.product?.what, 1200)
          if (!name || !what) return bad('Fill in the product name and what it is on the Product step first.')
          const film = settings.film || {}
          const prompt = `Product reference picture: a clean, well-lit studio shot of ${name}. ${what}\nVisual style: ${str(film.style, 80) || 'cinematic realism'}. Plain neutral background. No text, captions or logos unless they are part of the product itself.`
          const made = await makePicture(cfg, { prompt, size: '1024x1024', quality: 'medium', refs: [], projectId: b.project_id, action: 'Product reference picture', detail: name })
          if (!made.ok) return fail(res, 502, made.error)
          bytes = made.bytes; mime = made.mime; cost = made.cost
        }
        const file = `projects/${b.project_id}/product/${Date.now()}.${extFor(mime)}`
        const saved = await saveStudioFile(cfg, file, bytes, mime)
        if (!saved.ok) return fail(res, 500, saved.error)
        pr.pictures.push({ id: randomUUID(), view: 'front', path: file, source: action === 'upload_product_picture' ? 'upload' : 'made' })
      } else if (action === 'approve_product_picture') {
        if (b.picture_id === null) { pr.approved_id = null; pr.approved_path = null } else {
          const p = pr.pictures.find((x: any) => x.id === b.picture_id)
          if (!p) return fail(res, 404, 'That picture no longer exists.')
          pr.approved_id = p.id; pr.approved_path = p.path
        }
      } else {
        const p = pr.pictures.find((x: any) => x.id === b.picture_id)
        if (!p) return fail(res, 404, 'That picture no longer exists.')
        pr.pictures.splice(pr.pictures.indexOf(p), 1)
        if (pr.approved_path === p.path) { pr.approved_id = null; pr.approved_path = null }
      }
      settings.product_reference = pr
      const upd = await rest(cfg, `micro_drama_projects?id=eq.${b.project_id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ settings, updated_at: new Date().toISOString() }) })
      if (!upd.ok) return fail(res, 500, `That could not be saved (${upd.status}).`)
      const steps = await syncPictureSteps(cfg, b.project_id)
      return res.status(200).json({ ok: true, steps_done: steps, cost_usd: Math.round(cost * 10000) / 10000 })
    }

    if (action === 'add_from_brand_kit') {
      if (!UUID.test(String(b.project_id)) || !UUID.test(String(b.kit_id))) return bad('That is not valid.')
      const k = await one(cfg, 'micro_drama_brand_cast', b.kit_id)
      if (!k) return fail(res, 404, 'That brand-kit item no longer exists.')
      const pid = randomUUID()
      if (k.kind === 'product') {
        const proj = await projectOf(cfg, b.project_id)
        if (!proj) return fail(res, 404, 'That project no longer exists.')
        const pr = proj.settings?.product_reference || {}
        const pics = [...(Array.isArray(pr.pictures) ? pr.pictures : []), { id: pid, view: 'front', path: k.approved_path, source: 'brand kit' }]
        const upd = await rest(cfg, `micro_drama_projects?id=eq.${b.project_id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ settings: { ...(proj.settings || {}), product_reference: { pictures: pics, approved_id: pid, approved_path: k.approved_path } }, updated_at: new Date().toISOString() }) })
        if (!upd.ok) return fail(res, 500, `The product picture could not be added (${upd.status}).`)
        await syncPictureSteps(cfg, b.project_id)
        return res.status(200).json({ ok: true })
      }
      const ins = await rest(cfg, 'micro_drama_characters', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
        project_id: b.project_id, name: k.name, role: k.role, age_range: k.age_range, look: k.look, wardrobe: k.wardrobe, before_after: k.before_after,
        reference_paths: k.approved_path ? [{ id: pid, view: 'front', path: k.approved_path, source: 'brand kit' }] : [], approved_path: k.approved_path,
        extra: { face_source: k.face_source || 'invented', agent_slug: k.agent_slug || '', approved_id: k.approved_path ? pid : null },
      }) })
      if (!ins.ok) return fail(res, 500, `The character could not be added (${ins.status}).`)
      await syncPictureSteps(cfg, b.project_id)
      return res.status(200).json({ ok: true })
    }

    if (action === 'delete_brand_kit') {
      if (!UUID.test(String(b.kit_id))) return bad('That is not valid.')
      const del = await rest(cfg, `micro_drama_brand_cast?id=eq.${b.kit_id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
      if (!del.ok) return fail(res, 500, `That could not be removed (${del.status}).`)
      return res.status(200).json({ ok: true })
    }

    // Storyboard frames ------------------------------------------------------------------
    if (action === 'make_frame' || action === 'upload_frame' || action === 'approve_frame') {
      if (!UUID.test(String(b.scene_id))) return bad('That scene is not valid.')
      const s = await one(cfg, 'micro_drama_scenes', b.scene_id)
      if (!s) return fail(res, 404, 'That scene no longer exists.')

      if (action === 'approve_frame') {
        const on = b.on !== false
        if (on && !s.frame_path) return bad('Make or upload a frame first.')
        const upd = await rest(cfg, `micro_drama_scenes?id=eq.${s.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ extra: { ...(s.extra || {}), frame_approved: on }, updated_at: new Date().toISOString() }) })
        if (!upd.ok) return fail(res, 500, `That could not be saved (${upd.status}).`)
        const steps = await syncPictureSteps(cfg, s.project_id)
        return res.status(200).json({ ok: true, steps_done: steps })
      }

      let bytes: Buffer, mime: string, cost = 0, quality = 'upload'
      if (action === 'upload_frame') {
        const parsed = parseDataUrl(b.data_url)
        if (!parsed.ok) return bad(parsed.error)
        bytes = parsed.bytes; mime = parsed.mime
      } else {
        const proj = await projectOf(cfg, s.project_id)
        const film = proj?.settings?.film || {}
        const size = frameSize(film.shape)
        if (!size) return bad('The storyboard needs a shape of 1:1, 9:16 or 16:9. Set it on the Script step (unapprove the script to change it).')
        const chars = await rest(cfg, `micro_drama_characters?project_id=eq.${s.project_id}&select=name,approved_path`)
        const text = String(s.characters || '').toLowerCase()
        const inScene = (chars.ok ? chars.body : []).filter((c: any) => c.name && (text.includes(String(c.name).toLowerCase()) || (firstName(c.name).length >= 3 && text.includes(firstName(c.name)))))
        const unapproved = inScene.filter((c: any) => !c.approved_path).map((c: any) => c.name)
        if (unapproved.length) return bad(`Approve a picture for ${unapproved.join(' and ')} on the Cast step first.`)
        const refs: Ref[] = []
        const fix = str(b.fix, 600)
        if (fix) {
          const cur = s.frame_path ? await readStudioFile(cfg, s.frame_path) : null
          if (!cur) return bad('There is no frame to fix yet. Make one first.')
          refs.push(cur)
        }
        for (const c of inScene.slice(0, 3)) {
          const f = await readStudioFile(cfg, c.approved_path)
          if (f) refs.push(f)
        }
        const showsProduct = !!String(s.product_appearance || '').trim()
        const productPath: string | null = proj?.settings?.product_reference?.approved_path || null
        if (showsProduct && !productPath) return bad('Approve a picture for the product on the Cast step first.')
        if (showsProduct && productPath) {
          const f = await readStudioFile(cfg, productPath)
          if (f) refs.push(f)
        }
        const style = str(film.style, 80) || 'cinematic realism'
        const never = str(proj?.settings?.product?.never, 500)
        const base = s.image_prompt || s.what_we_see || ''
        const prompt = fix
          ? `Edit the first picture: ${fix}. Keep the characters, framing and everything else the same. Visual style: ${style}.`
          : `Starting frame for scene ${s.position} of a micro drama. Visual style: ${style}.\n${base}\n` +
            `${s.setting ? `Setting: ${s.setting}\n` : ''}${s.product_appearance ? `Product: ${s.product_appearance}\n` : ''}` +
            `${refs.length ? 'The characters look exactly like the reference pictures: same face, hair and wardrobe.\n' : ''}` +
            `${showsProduct ? 'The product looks exactly like its reference picture.\n' : ''}` +
            `${never ? `Never show: ${never}\n` : ''}No text, captions or logos in the picture unless described above.`
        quality = b.quality === 'final' ? 'final' : 'draft'
        const made = await makePicture(cfg, { prompt, size, quality: quality === 'final' ? 'medium' : 'low', refs, projectId: s.project_id, action: fix ? 'Storyboard frame: fix' : `Storyboard frame (${quality})`, detail: `Scene ${s.position}` })
        if (!made.ok) return fail(res, 502, made.error)
        bytes = made.bytes; mime = made.mime; cost = made.cost
      }
      const file = `projects/${s.project_id}/frames/${s.id}-${Date.now()}.${extFor(mime)}`
      const saved = await saveStudioFile(cfg, file, bytes, mime)
      if (!saved.ok) return fail(res, 500, saved.error)
      const upd = await rest(cfg, `micro_drama_scenes?id=eq.${s.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ frame_path: file, extra: { ...(s.extra || {}), frame_quality: quality, frame_approved: false }, updated_at: new Date().toISOString() }) })
      if (!upd.ok) return fail(res, 500, `The frame could not be saved (${upd.status}).`)
      if (s.frame_path) await deleteStudioFile(cfg, s.frame_path)
      await syncPictureSteps(cfg, s.project_id)
      return res.status(200).json({ ok: true, cost_usd: Math.round(cost * 10000) / 10000 })
    }

    return fail(res, 400, 'Unknown request.')
  } catch (e: any) {
    console.error('[hub-studio-pictures] failed:', e)
    return fail(res, 500, e?.message || 'The picture request failed.')
  }
}
