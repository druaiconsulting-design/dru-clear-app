// DRU AI Leadership Ecosystem™ — api/hub-studio.ts
// Micro Drama Studio, Stage 1: projects and the Usage tab.
//   GET  ?view=projects        → every project (title, product, step reached, last change, estimated cost so far)
//   GET  ?view=project&id=…    → one project
//   GET  ?view=usage           → this month's spend by provider, remaining balances where a provider reports
//                                one, the recent-activity list, and shelf storage
//   POST {action:'create', title?}        → a new empty project
//   POST {action:'rename', id, title}     → rename a project
//   POST {action:'delete', id}            → delete a project (its activity history stays in the Usage tab)
// Admin only: the caller's Supabase login must belong to DeAnna.
// Costs are estimates. Providers do not report the real billed cost of each request.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fail, supabaseConfig, sbHeaders, requireAdmin, elevenKey, heygenKey } from './_lib/hubShared.js'

export const config = { maxDuration: 30 }

const PROVIDERS: { id: string; label: string }[] = [
  { id: 'openai', label: 'OpenAI pictures' },
  { id: 'elevenlabs', label: 'ElevenLabs' },
  { id: 'higgsfield', label: 'Higgsfield' },
  { id: 'heygen', label: 'HeyGen' },
  { id: 'claude', label: 'Claude writing (all agents in the app)' },
]
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Cfg = { url: string; serviceKey: string }

async function rest(cfg: Cfg, path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: any }> {
  const r = await fetch(`${cfg.url}/rest/v1/${path}`, { ...init, headers: { ...sbHeaders(cfg.serviceKey), ...(init?.headers || {}) } })
  let body: any = null
  try { body = await r.json() } catch { /* empty body */ }
  return { ok: r.ok, status: r.status, body }
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

    return fail(res, 400, 'Unknown request.')
  } catch (e: any) {
    console.error('[hub-studio] failed:', e)
    return fail(res, 500, e?.message || 'The studio request failed.')
  }
}
