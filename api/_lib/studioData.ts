// DRU AI Leadership Ecosystem™ — api/_lib/studioData.ts
// Small database helpers shared by the Micro Drama Studio backends.
// Files that start with an underscore are not served as routes.

import { sbHeaders } from './hubShared.js'

export type Cfg = { url: string; serviceKey: string }

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function rest(cfg: Cfg, path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: any }> {
  const r = await fetch(`${cfg.url}/rest/v1/${path}`, { ...init, headers: { ...sbHeaders(cfg.serviceKey), ...(init?.headers || {}) } })
  let body: any = null
  try { body = await r.json() } catch { /* empty body */ }
  return { ok: r.ok, status: r.status, body }
}

// The text fields of a scene card, in the order they appear on the page.
export const SCENE_TEXT_FIELDS = [
  'setting', 'characters', 'what_we_see', 'emotional_beat', 'dialogue', 'product_appearance', 'camera', 'image_prompt',
] as const

export const SCENE_COLUMNS = ['id', 'position', 'start_s', 'end_s', ...SCENE_TEXT_FIELDS].join(',')

// Saves the project's current scenes as a version DeAnna can look at and restore.
export async function snapshotScript(cfg: Cfg, projectId: string, label: string, extra?: Record<string, unknown>): Promise<boolean> {
  const [scenes, proj] = await Promise.all([
    rest(cfg, `micro_drama_scenes?project_id=eq.${projectId}&select=${SCENE_COLUMNS.replace('id,', '')}&order=position.asc`),
    rest(cfg, `micro_drama_projects?id=eq.${projectId}&select=settings`),
  ])
  if (!scenes.ok || !Array.isArray(scenes.body) || scenes.body.length === 0) return false
  const film = proj.ok && proj.body?.[0]?.settings?.film ? proj.body[0].settings.film : null
  const saved = await rest(cfg, 'micro_drama_versions', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ project_id: projectId, kind: 'script', label: label.slice(0, 160), snapshot: { scenes: scenes.body, film, ...(extra || {}) } }),
  })
  return saved.ok
}
