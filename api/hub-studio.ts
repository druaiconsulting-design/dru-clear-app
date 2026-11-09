// DRU AI Leadership Ecosystem™ — api/hub-studio.ts
// Micro Drama Studio, Stage 1: projects and the Usage tab.
//   GET  ?view=projects        → every project (title, product, step reached, last change, estimated cost so far)
//   GET  ?view=project&id=…    → one project
//   GET  ?view=usage           → this month's spend by provider, remaining balances where a provider reports
//                                one, the recent-activity list, and shelf storage
//   POST {action:'create', title?}        → a new empty project
//   POST {action:'rename', id, title}     → rename a project
//   POST {action:'delete', id}            → delete a project (its activity history stays in the Usage tab)
// Stage 2 (Story and Script) additions:
//   GET  ?view=writers                    → the agents (grouped by division), Claude and ChatGPT, for the writer pick-list
//   GET  ?view=scenes&id=                 → a project's scenes in order
//   GET  ?view=versions&id=               → saved versions of the script
//   POST {action:'save_settings', id, patch, mark_done?}  → merge product / film_type / film / story keys into the project
//   POST {action:'choose_story', id, story_id}            → pick a story card; checks off the Story step
//   POST {action:'save_scene', scene_id, fields}          → edit a scene card
//   POST {action:'add_scene', id, after_position}         → insert an empty scene (0 = at the start)
//   POST {action:'duplicate_scene' | 'delete_scene', scene_id}
//   POST {action:'move_scene', scene_id, direction:'up'|'down'}
//   POST {action:'approve_script' | 'unapprove_script', id}
//   POST {action:'restore_version', version_id}
// Admin only: the caller's Supabase login must belong to DeAnna.
// Costs are estimates. Providers do not report the real billed cost of each request.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fail, supabaseConfig, requireAdmin, elevenKey, heygenKey } from './_lib/hubShared.js'
import { rest, UUID, SCENE_COLUMNS, SCENE_TEXT_FIELDS, snapshotScript, type Cfg } from './_lib/studioData.js'

export const config = { maxDuration: 30 }

const PROVIDERS: { id: string; label: string }[] = [
  { id: 'openai', label: 'OpenAI (writing and pictures)' },
  { id: 'elevenlabs', label: 'ElevenLabs' },
  { id: 'higgsfield', label: 'Higgsfield' },
  { id: 'heygen', label: 'HeyGen' },
  { id: 'claude', label: 'Claude writing (all agents in the app)' },
]

const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)

async function getProject(cfg: Cfg, id: string): Promise<any | null> {
  const r = await rest(cfg, `micro_drama_projects?id=eq.${id}&select=id,settings,steps_done,current_step,product_name`)
  return r.ok && Array.isArray(r.body) ? r.body[0] || null : null
}

async function patchProject(cfg: Cfg, id: string, patch: Record<string, unknown>) {
  return rest(cfg, `micro_drama_projects?id=eq.${id}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  })
}

async function getScene(cfg: Cfg, sceneId: string): Promise<any | null> {
  const r = await rest(cfg, `micro_drama_scenes?id=eq.${sceneId}&select=*`)
  return r.ok && Array.isArray(r.body) ? r.body[0] || null : null
}

// Gives a project's scenes the positions 1..n in their current order (one upsert, so it is quick for long films).
async function resequence(cfg: Cfg, projectId: string, ordered: { id: string }[]) {
  if (!ordered.length) return
  await rest(cfg, 'micro_drama_scenes?on_conflict=id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(ordered.map((s, i) => ({ id: s.id, project_id: projectId, position: i + 1 }))),
  })
}

function withStep(steps: string[], step: string, on: boolean): string[] {
  const rest2 = (steps || []).filter(s => s !== step)
  return on ? [...rest2, step] : rest2
}

function monthStartIso(): string {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString()
}

// What each project has cost so far, from the activity log (only lines that carry an estimate).
async function costByProject(cfg: Cfg): Promise<Record<string, number>> {
  const r = await rest(cfg, 'studio_activity_log?select=project_id,est_cost_usd&project_id=not.is.null&status=eq.ok&est_cost_usd=not.is.null&limit=10000')
  const out: Record<string, number> = {}
  if (r.ok && Array.isArray(r.body)) {
    for (const row of r.body) out[row.project_id] = (out[row.project_id] || 0) + Number(row.est_cost_usd || 0)
  }
  return out
}

// ── Remaining balances, for the providers that report one ──
type Balance = { provider: string; text: string } | null

async function heygenBalance(): Promise<Balance> {
  const key = heygenKey()
  if (!key) return null
  try {
    const r = await fetch('https://api.heygen.com/v3/users/me', { headers: { 'x-api-key': key.value, Accept: 'application/json' } })
    if (!r.ok) return null
    const d: any = (await r.json())?.data || {}
    if (d.billing_type === 'wallet' && d.wallet && d.wallet.remaining_balance != null) {
      const unit = d.wallet.currency === 'usd' ? `$${Number(d.wallet.remaining_balance).toFixed(2)}` : `${d.wallet.remaining_balance} credits`
      return { provider: 'heygen', text: `${unit} left (prepaid)` }
    }
    if (d.billing_type === 'subscription' && d.subscription?.credits) {
      const c = d.subscription.credits
      const parts: string[] = []
      if (c.premium_credits?.remaining != null) parts.push(`${c.premium_credits.remaining} premium credits`)
      if (c.add_on_credits?.remaining != null) parts.push(`${c.add_on_credits.remaining} add-on credits`)
      if (parts.length) return { provider: 'heygen', text: `${parts.join(' + ')} left` }
    }
    if (d.billing_type === 'usage_based' && d.usage_based) {
      const u = d.usage_based
      return { provider: 'heygen', text: `$${Number(u.spending_current_usd ?? 0).toFixed(2)} spent of a $${Number(u.spending_cap_usd ?? 0).toFixed(2)} cap` }
    }
  } catch { /* balance is optional */ }
  return null
}

async function elevenBalance(): Promise<Balance> {
  const key = elevenKey()
  if (!key) return null
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': key.value, Accept: 'application/json' } })
    if (!r.ok) return null
    const d: any = await r.json()
    if (typeof d.character_limit !== 'number' || typeof d.character_count !== 'number') return null
    const left = Math.max(0, d.character_limit - d.character_count)
    const reset = typeof d.next_character_count_reset_unix === 'number'
      ? ` · resets ${new Date(d.next_character_count_reset_unix * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`
      : ''
    return { provider: 'elevenlabs', text: `${left.toLocaleString()} of ${d.character_limit.toLocaleString()} characters left${reset}` }
  } catch { /* balance is optional */ }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return fail(res, 405, 'Method not allowed')

  const cfg = supabaseConfig()
  if (!cfg) return fail(res, 500, 'Supabase credentials are not configured for this app.')
  if (!(await requireAdmin(req, res, cfg.url, cfg.serviceKey))) return

  try {
    // ── Reads ────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const view = String(req.query.view || 'projects')

      if (view === 'projects') {
        const [list, costs] = await Promise.all([
          rest(cfg, 'micro_drama_projects?select=id,title,product_name,current_step,steps_done,created_at,updated_at&order=updated_at.desc'),
          costByProject(cfg),
        ])
        if (!list.ok) return fail(res, 500, `Projects could not be read (${list.status}).`)
        const projects = (list.body as any[]).map(p => ({ ...p, est_cost_usd: Math.round((costs[p.id] || 0) * 10000) / 10000 }))
        return res.status(200).json({ ok: true, projects })
      }

      if (view === 'project') {
        const id = String(req.query.id || '')
        if (!UUID.test(id)) return fail(res, 400, 'That project link is not valid.')
        const [one, costs] = await Promise.all([
          rest(cfg, `micro_drama_projects?id=eq.${id}&select=id,title,product_name,current_step,steps_done,settings,created_at,updated_at`),
          costByProject(cfg),
        ])
        if (!one.ok) return fail(res, 500, `The project could not be read (${one.status}).`)
        const p = (one.body as any[])[0]
        if (!p) return fail(res, 404, 'That project no longer exists.')
        return res.status(200).json({ ok: true, project: { ...p, est_cost_usd: Math.round((costs[id] || 0) * 10000) / 10000 } })
      }

      if (view === 'usage') {
        const since = monthStartIso()
        const [log, recent, claude, shelf, hg, el] = await Promise.all([
          rest(cfg, `studio_activity_log?created_at=gte.${encodeURIComponent(since)}&select=provider,est_cost_usd,status&limit=10000`),
          rest(cfg, 'studio_activity_log?select=id,provider,action,detail,units_label,est_cost_usd,status,created_at,project_id,micro_drama_projects(title)&order=created_at.desc&limit=50'),
          rest(cfg, `model_usage_log?created_at=gte.${encodeURIComponent(since)}&select=cost_usd&limit=20000`),
          rest(cfg, 'video_hub_items?select=file_size_bytes&file_size_bytes=not.is.null&limit=10000'),
          heygenBalance(),
          elevenBalance(),
        ])
        if (!log.ok) return fail(res, 500, `The activity log could not be read (${log.status}).`)

        const balances: Record<string, string> = {}
        if (hg) balances.heygen = hg.text
        if (el) balances.elevenlabs = el.text

        const byProvider = PROVIDERS.map(p => {
          if (p.id === 'claude') {
            const rows: any[] = claude.ok && Array.isArray(claude.body) ? claude.body : []
            const cost = rows.reduce((s, r) => s + Number(r.cost_usd || 0), 0)
            return { id: p.id, label: p.label, actions: rows.length, est_cost_usd: Math.round(cost * 100) / 100, unpriced: 0, balance: balances[p.id] || null }
          }
          const rows = (log.body as any[]).filter(r => r.provider === p.id && r.status === 'ok')
          const priced = rows.filter(r => r.est_cost_usd !== null && r.est_cost_usd !== undefined)
          const cost = priced.reduce((s, r) => s + Number(r.est_cost_usd), 0)
          return {
            id: p.id, label: p.label, actions: rows.length,
            est_cost_usd: Math.round(cost * 100) / 100,
            unpriced: rows.length - priced.length,
            balance: balances[p.id] || null,
          }
        })

        const shelfRows: any[] = shelf.ok && Array.isArray(shelf.body) ? shelf.body : []
        return res.status(200).json({
          ok: true,
          month_start: since,
          providers: byProvider,
          recent: recent.ok ? recent.body : [],
          storage: { shelf_files: shelfRows.length, shelf_bytes: shelfRows.reduce((s, r) => s + Number(r.file_size_bytes || 0), 0) },
        })
      }


      if (view === 'writers') {
        const r = await rest(cfg, 'agents?select=slug,name,role,division&order=division_sort.asc,sort_order.asc&limit=300')
        if (!r.ok) return fail(res, 500, `The agents could not be read (${r.status}).`)
        return res.status(200).json({ ok: true, agents: (r.body as any[]).filter(a => a.slug) })
      }

      if (view === 'scenes' || view === 'versions') {
        const id = String(req.query.id || '')
        if (!UUID.test(id)) return fail(res, 400, 'That project link is not valid.')
        if (view === 'scenes') {
          const r = await rest(cfg, `micro_drama_scenes?project_id=eq.${id}&select=${SCENE_COLUMNS}&order=position.asc&limit=2000`)
          if (!r.ok) return fail(res, 500, `The scenes could not be read (${r.status}).`)
          return res.status(200).json({ ok: true, scenes: r.body })
        }
        const r = await rest(cfg, `micro_drama_versions?project_id=eq.${id}&kind=eq.script&select=id,label,created_at,snapshot&order=created_at.desc&limit=30`)
        if (!r.ok) return fail(res, 500, `The versions could not be read (${r.status}).`)
        const versions = (r.body as any[]).map(v => ({ id: v.id, label: v.label, created_at: v.created_at, scene_count: Array.isArray(v.snapshot?.scenes) ? v.snapshot.scenes.length : 0 }))
        return res.status(200).json({ ok: true, versions })
      }

      return fail(res, 400, 'Unknown view.')
    }

    // ── Writes ───────────────────────────────────────────────────────────────
    const { action, id, title } = (req.body || {}) as { action?: string; id?: string; title?: string }

    if (action === 'create') {
      const name = (title || '').trim().slice(0, 120) || 'Untitled project'
      const made = await rest(cfg, 'micro_drama_projects', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ title: name }),
      })
      if (!made.ok || !Array.isArray(made.body) || !made.body[0]) return fail(res, 500, `The project could not be created (${made.status}).`)
      return res.status(200).json({ ok: true, project: { ...made.body[0], est_cost_usd: 0 } })
    }

    if (action === 'rename') {
      if (!id || !UUID.test(id)) return fail(res, 400, 'That project is not valid.')
      const name = (title || '').trim().slice(0, 120)
      if (!name) return fail(res, 400, 'A project needs a title.')
      const upd = await rest(cfg, `micro_drama_projects?id=eq.${id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ title: name, updated_at: new Date().toISOString() }),
      })
      if (!upd.ok) return fail(res, 500, `The title could not be saved (${upd.status}).`)
      return res.status(200).json({ ok: true })
    }

    if (action === 'delete') {
      if (!id || !UUID.test(id)) return fail(res, 400, 'That project is not valid.')
      const del = await rest(cfg, `micro_drama_projects?id=eq.${id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
      if (!del.ok) return fail(res, 500, `The project could not be deleted (${del.status}).`)
      return res.status(200).json({ ok: true })
    }


    const body = (req.body || {}) as Record<string, any>

    if (action === 'save_settings') {
      if (!id || !UUID.test(id)) return fail(res, 400, 'That project is not valid.')
      const proj = await getProject(cfg, id)
      if (!proj) return fail(res, 404, 'That project no longer exists.')
      const settings = { ...(proj.settings || {}) }
      const patch = (body.patch || {}) as Record<string, any>
      let productName: string | undefined
      if (patch.product && typeof patch.product === 'object') {
        const p = patch.product
        settings.product = {
          name: str(p.name, 200), what: str(p.what, 1200), audience: str(p.audience, 600), link: str(p.link, 300), never: str(p.never, 1000),
        }
        productName = settings.product.name
      }
      if (patch.film_type !== undefined) settings.film_type = str(patch.film_type, 80)
      if (patch.film && typeof patch.film === 'object') {
        const f = patch.film, cur = { ...(settings.film || {}) }
        if (f.length_s !== undefined) {
          const n = Number(f.length_s)
          if (!Number.isFinite(n) || n < 20 || n > 3600) return fail(res, 400, 'Film length must be between 20 seconds and 60 minutes.')
          cur.length_s = Math.round(n)
        }
        if (f.scene_mode !== undefined) { if (!['short', 'long'].includes(f.scene_mode)) return fail(res, 400, 'Scene length must be short or long.'); cur.scene_mode = f.scene_mode }
        if (f.sound !== undefined) { if (!['dialogue', 'narration', 'song'].includes(f.sound)) return fail(res, 400, 'Sound must be dialogue, narration or song.'); cur.sound = f.sound }
        if (f.shape !== undefined) cur.shape = str(f.shape, 60)
        if (f.style !== undefined) cur.style = str(f.style, 80)
        settings.film = cur
      }
      if (patch.own_idea !== undefined) settings.story = { ...(settings.story || {}), own_idea: str(patch.own_idea, 8000) }

      const upd: Record<string, unknown> = { settings }
      if (productName !== undefined) upd.product_name = productName || null
      if (body.mark_done === 'product') {
        if (!settings.product?.name || !settings.product?.what) return fail(res, 400, 'Add the product name and what it is first.')
        upd.steps_done = withStep(proj.steps_done, 'product', true)
        if (proj.current_step === 'product') upd.current_step = 'story'
      }
      const saved = await patchProject(cfg, id, upd)
      if (!saved.ok) return fail(res, 500, `That could not be saved (${saved.status}).`)
      return res.status(200).json({ ok: true, settings, steps_done: upd.steps_done ?? proj.steps_done })
    }

    if (action === 'choose_story') {
      if (!id || !UUID.test(id)) return fail(res, 400, 'That project is not valid.')
      const proj = await getProject(cfg, id)
      if (!proj) return fail(res, 404, 'That project no longer exists.')
      const options: any[] = proj.settings?.story?.options || []
      const card = options.find(o => o.id === body.story_id)
      if (!card) return fail(res, 400, 'That story card is no longer in the list.')
      const settings = { ...(proj.settings || {}), story: { ...(proj.settings?.story || {}), chosen: card } }
      const upd: Record<string, unknown> = { settings, steps_done: withStep(proj.steps_done, 'story', true) }
      if (['product', 'story'].includes(proj.current_step)) upd.current_step = 'script'
      const saved = await patchProject(cfg, id, upd)
      if (!saved.ok) return fail(res, 500, `The story could not be saved (${saved.status}).`)
      return res.status(200).json({ ok: true, settings, steps_done: upd.steps_done })
    }

    if (action === 'save_scene') {
      const sceneId = String(body.scene_id || '')
      if (!UUID.test(sceneId)) return fail(res, 400, 'That scene is not valid.')
      const f = (body.fields || {}) as Record<string, any>
      const upd: Record<string, unknown> = {}
      for (const k of SCENE_TEXT_FIELDS) if (f[k] !== undefined) upd[k] = str(f[k], k === 'image_prompt' || k === 'what_we_see' ? 1500 : 800)
      for (const k of ['start_s', 'end_s'] as const) {
        if (f[k] === undefined) continue
        const n = Number(f[k])
        if (!Number.isFinite(n) || n < 0 || n > 36000) return fail(res, 400, 'Start and end seconds must be numbers.')
        upd[k] = n
      }
      if (!Object.keys(upd).length) return res.status(200).json({ ok: true })
      const scene = await getScene(cfg, sceneId)
      if (!scene) return fail(res, 404, 'That scene no longer exists.')
      const saved = await rest(cfg, `micro_drama_scenes?id=eq.${sceneId}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ...upd, updated_at: new Date().toISOString() }) })
      if (!saved.ok) return fail(res, 500, `The scene could not be saved (${saved.status}).`)
      await patchProject(cfg, scene.project_id, {})
      return res.status(200).json({ ok: true })
    }

    if (action === 'add_scene' || action === 'duplicate_scene' || action === 'delete_scene' || action === 'move_scene') {
      let projectId = id || ''
      let scene: any = null
      if (action !== 'add_scene') {
        const sceneId = String(body.scene_id || '')
        if (!UUID.test(sceneId)) return fail(res, 400, 'That scene is not valid.')
        scene = await getScene(cfg, sceneId)
        if (!scene) return fail(res, 404, 'That scene no longer exists.')
        projectId = scene.project_id
      } else if (!UUID.test(projectId)) return fail(res, 400, 'That project is not valid.')

      const list = await rest(cfg, `micro_drama_scenes?project_id=eq.${projectId}&select=id,position&order=position.asc&limit=2000`)
      if (!list.ok) return fail(res, 500, `The scenes could not be read (${list.status}).`)
      const ordered: { id: string }[] = [...(list.body as any[])]

      if (action === 'delete_scene') {
        const del = await rest(cfg, `micro_drama_scenes?id=eq.${scene.id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
        if (!del.ok) return fail(res, 500, `The scene could not be deleted (${del.status}).`)
        await resequence(cfg, projectId, ordered.filter(s => s.id !== scene.id))
      } else if (action === 'move_scene') {
        const i = ordered.findIndex(s => s.id === scene.id)
        const j = body.direction === 'up' ? i - 1 : i + 1
        if (j >= 0 && j < ordered.length) { [ordered[i], ordered[j]] = [ordered[j], ordered[i]]; await resequence(cfg, projectId, ordered) }
      } else {
        // add or duplicate: create the row, then place it and renumber
        const blank: Record<string, unknown> = { project_id: projectId, position: ordered.length + 1, start_s: 0, end_s: 0 }
        let at = ordered.length
        if (action === 'duplicate_scene') {
          for (const k of [...SCENE_TEXT_FIELDS, 'start_s', 'end_s']) blank[k] = scene[k]
          at = ordered.findIndex(s => s.id === scene.id) + 1
        } else {
          const after = Math.max(0, Math.min(ordered.length, Number(body.after_position) || 0))
          at = after
        }
        const made = await rest(cfg, 'micro_drama_scenes', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(blank) })
        if (!made.ok || !Array.isArray(made.body) || !made.body[0]) return fail(res, 500, `The scene could not be added (${made.status}).`)
        ordered.splice(at, 0, { id: made.body[0].id })
        await resequence(cfg, projectId, ordered)
      }
      await patchProject(cfg, projectId, {})
      return res.status(200).json({ ok: true })
    }

    if (action === 'approve_script' || action === 'unapprove_script') {
      if (!id || !UUID.test(id)) return fail(res, 400, 'That project is not valid.')
      const proj = await getProject(cfg, id)
      if (!proj) return fail(res, 404, 'That project no longer exists.')
      const on = action === 'approve_script'
      if (on) {
        const n = await rest(cfg, `micro_drama_scenes?project_id=eq.${id}&select=id&limit=1`)
        if (!n.ok || !(n.body as any[]).length) return fail(res, 400, 'There are no scenes to approve yet.')
        await snapshotScript(cfg, id, 'Approved')
      }
      const upd: Record<string, unknown> = { steps_done: withStep(proj.steps_done, 'script', on) }
      if (on && ['product', 'story', 'script'].includes(proj.current_step)) upd.current_step = 'cast'
      if (!on && proj.current_step !== 'script') upd.current_step = 'script'
      const saved = await patchProject(cfg, id, upd)
      if (!saved.ok) return fail(res, 500, `That could not be saved (${saved.status}).`)
      return res.status(200).json({ ok: true, steps_done: upd.steps_done })
    }

    if (action === 'restore_version') {
      const versionId = String(body.version_id || '')
      if (!UUID.test(versionId)) return fail(res, 400, 'That version is not valid.')
      const v = await rest(cfg, `micro_drama_versions?id=eq.${versionId}&select=project_id,snapshot`)
      const ver = v.ok && Array.isArray(v.body) ? v.body[0] : null
      const scenes: any[] = Array.isArray(ver?.snapshot?.scenes) ? ver.snapshot.scenes : []
      if (!ver || !scenes.length) return fail(res, 404, 'That version could not be found.')
      const projectId = ver.project_id as string
      await snapshotScript(cfg, projectId, 'Before restoring an earlier version')
      const del = await rest(cfg, `micro_drama_scenes?project_id=eq.${projectId}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
      if (!del.ok) return fail(res, 500, `The current scenes could not be cleared (${del.status}).`)
      const ins = await rest(cfg, 'micro_drama_scenes', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(scenes.map((s, i) => {
          const row: Record<string, unknown> = { project_id: projectId, position: i + 1, start_s: s.start_s ?? 0, end_s: s.end_s ?? 0 }
          for (const k of SCENE_TEXT_FIELDS) row[k] = s[k] ?? null
          return row
        })),
      })
      if (!ins.ok) return fail(res, 500, `The scenes could not be restored (${ins.status}).`)
      const proj = await getProject(cfg, projectId)
      const upd: Record<string, unknown> = { steps_done: withStep(proj?.steps_done || [], 'script', false) }
      if (ver.snapshot?.film) upd.settings = { ...(proj?.settings || {}), film: ver.snapshot.film }
      await patchProject(cfg, projectId, upd)
      return res.status(200).json({ ok: true })
    }

    return fail(res, 400, 'Unknown request.')
  } catch (e: any) {
    console.error('[hub-studio] failed:', e)
    return fail(res, 500, e?.message || 'The studio request failed.')
  }
}
