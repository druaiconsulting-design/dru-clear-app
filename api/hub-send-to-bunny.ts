// DRU AI Leadership Ecosystem™ — api/hub-send-to-bunny.ts
// Video Hub step 2: copies a Hub video (kept in the private `hub-videos` bucket)
// into one of three Bunny libraries. The original stays in the Hub.
// Admin only: the caller's Supabase login must belong to DeAnna.

import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = { maxDuration: 300 }

const ADMIN_EMAIL = 'deanna@druaiconsulting.com'

type Destination = 'social' | 'course' | 'members'

// Each Bunny library has its own library ID and its own upload key, both kept in the
// team's shared Vercel variables. The library ID names are the ones DeAnna set up.
// The upload key is also a shared VITE_BUNNY_ variable (plain BUNNY_ names are not used, because
// a project's own variable of the same name would override the shared one). The exact names below
// are tried first, then any VITE_BUNNY_ ...API_KEY variable whose name carries the library's name.
// Only variable NAMES are ever reported, never values.
const DESTINATIONS: Record<Destination, { label: string; libraryEnvs: string[]; keyEnvs: string[]; keyPattern: RegExp }> = {
  social: {
    label: 'Social',
    libraryEnvs: ['VITE_BUNNY_SOCIAL_MEDIA_LIBRARY_ID'],
    keyEnvs: ['VITE_BUNNY_SOCIAL_MEDIA_API_KEY'],
    keyPattern: /SOCIAL/,
  },
  course: {
    label: 'Course',
    libraryEnvs: ['VITE_BUNNY_COURSES_LIBRARY_ID'],
    keyEnvs: ['VITE_BUNNY_COURSES_API_KEY'],
    keyPattern: /COURSE/,
  },
  members: {
    label: 'Members',
    libraryEnvs: ['VITE_BUNNY_DRU_APP_LIBRARY_ID'],
    keyEnvs: ['VITE_BUNNY_DRU_APP_API_KEY'],
    keyPattern: /(DRU_APP|(^|_)APP(_|$))/,
  },
}

function resolveDestination(d: Destination) {
  const cfg = DESTINATIONS[d]
  const libraryName = cfg.libraryEnvs.find(n => !!process.env[n]) || null
  let keyName = cfg.keyEnvs.find(n => !!process.env[n]) || null
  if (!keyName) {
    keyName = Object.keys(process.env).find(
      n => /^VITE_BUNNY/.test(n) && /API_KEY$/.test(n) && !/TOKEN/.test(n) && cfg.keyPattern.test(n) && !!process.env[n]
    ) || null
  }
  return {
    libraryName,
    keyName,
    libraryId: libraryName ? process.env[libraryName]! : null,
    apiKey: keyName ? process.env[keyName]! : null,
  }
}

async function requireAdmin(req: VercelRequest, res: VercelResponse, supaUrl: string, serviceKey: string): Promise<boolean> {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) { fail(res, 401, 'Sign in again and retry.'); return false }
  const userRes = await fetch(`${supaUrl}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
  })
  if (!userRes.ok) { fail(res, 401, 'Sign in again and retry.'); return false }
  const user: any = await userRes.json()
  if (String(user?.email || '').toLowerCase() !== ADMIN_EMAIL) { fail(res, 403, 'Admin only.'); return false }
  return true
}

interface BunnyCopy {
  destination: Destination
  library_id: string
  bunny_video_id: string
  sent_at: string
}

function fail(res: VercelResponse, status: number, error: string) {
  return res.status(status).json({ ok: false, error })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') return fail(res, 405, 'Method not allowed')

  const supaUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !serviceKey) return fail(res, 500, 'Supabase credentials are not configured for this app.')

  // 1. Confirm the caller is DeAnna's admin login.
  if (!(await requireAdmin(req, res, supaUrl, serviceKey))) return

  // Connection check: which library ID and upload key variables this app can see (names only).
  if (req.method === 'GET') {
    const status: Record<string, { library_id_name: string | null; upload_key_name: string | null }> = {}
    for (const d of Object.keys(DESTINATIONS) as Destination[]) {
      const r = resolveDestination(d)
      status[d] = { library_id_name: r.libraryName, upload_key_name: r.keyName }
    }
    const bunny_names = Object.keys(process.env).filter(n => /BUNNY/.test(n)).sort()
    return res.status(200).json({ ok: true, status, bunny_names })
  }

  // 2. Read the request.
  const { item_id, destination } = (req.body || {}) as { item_id?: string; destination?: Destination }
  const dest = destination && DESTINATIONS[destination]
  if (!item_id || !dest || !destination) return fail(res, 400, 'Choose a video and a destination (social, course or members).')

  // 3. Make sure this library's ID and upload key reach the app.
  const resolved = resolveDestination(destination)
  const libraryId = resolved.libraryId
  const apiKey = resolved.apiKey
  const missing = [
    !libraryId && `the library ID (${dest.libraryEnvs.join(' or ')})`,
    !apiKey && `the upload key (looked for ${dest.keyEnvs.join(', ')}, or any VITE_BUNNY_ API key variable named for ${dest.label})`,
  ].filter(Boolean)
  if (missing.length) {
    const seen = Object.keys(process.env).filter(n => /BUNNY/.test(n)).sort()
    return fail(
      res, 500,
      `The ${dest.label} library is not connected yet. This app cannot see ${missing.join(' and ')}. ` +
      `Bunny variables it can see: ${seen.length ? seen.join(', ') : 'none'}.`
    )
  }

  const sbHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }

  // 4. Load the shelf item.
  const itemRes = await fetch(`${supaUrl}/rest/v1/video_hub_items?id=eq.${encodeURIComponent(item_id)}&select=*`, { headers: sbHeaders })
  const items: any[] = itemRes.ok ? await itemRes.json() : []
  const item = items[0]
  if (!item) return fail(res, 404, 'That video is not in Video Que.')

  const copies: BunnyCopy[] = Array.isArray(item.bunny_copies) ? item.bunny_copies : []
  if (copies.some(c => c.destination === destination)) {
    return fail(res, 409, `This video already has a copy in the ${dest.label} library.`)
  }

  let guid: string | undefined
  try {
    // 5. A short-lived private link to the original, for this transfer only.
    const signRes = await fetch(
      `${supaUrl}/storage/v1/object/sign/hub-videos/${item.storage_path.split('/').map(encodeURIComponent).join('/')}`,
      { method: 'POST', headers: sbHeaders, body: JSON.stringify({ expiresIn: 3600 }) }
    )
    if (!signRes.ok) return fail(res, 500, `Could not open the original in the Hub (${signRes.status}).`)
    const signed: any = await signRes.json()
    const sourceUrl = `${supaUrl}/storage/v1${signed.signedURL}`

    // 6. Create the video in Bunny, then stream the original into it.
    const createRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
      method: 'POST',
      headers: { AccessKey: apiKey!, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ title: item.title }),
    })
    if (!createRes.ok) return fail(res, 502, `Bunny refused to create the video (${createRes.status}): ${(await createRes.text()).slice(0, 200)}`)
    guid = (await createRes.json())?.guid
    if (!guid) return fail(res, 502, 'Bunny did not return a video ID.')

    const source = await fetch(sourceUrl)
    if (!source.ok || !source.body) throw new Error(`Could not read the original (${source.status}).`)

    const uploadRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`, {
      method: 'PUT',
      headers: { AccessKey: apiKey! },
      body: source.body as any,
      // Required in Node 18+ when streaming a request body
      // @ts-ignore
      duplex: 'half',
    })
    if (!uploadRes.ok) throw new Error(`Bunny upload ${uploadRes.status}: ${(await uploadRes.text()).slice(0, 200)}`)

    // 7. Record the copy on the shelf item.
    const copy: BunnyCopy = { destination, library_id: String(libraryId), bunny_video_id: guid, sent_at: new Date().toISOString() }
    const saveRes = await fetch(`${supaUrl}/rest/v1/video_hub_items?id=eq.${encodeURIComponent(item_id)}`, {
      method: 'PATCH',
      headers: { ...sbHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({ bunny_copies: [...copies, copy], updated_at: new Date().toISOString() }),
    })
    if (!saveRes.ok) {
      // The copy exists in Bunny; report its ID so nothing is lost.
      return fail(res, 500, `The copy is in Bunny (video ID ${guid}) but Video Que could not be updated (${saveRes.status}).`)
    }
    return res.status(200).json({ ok: true, copy })
  } catch (err: any) {
    // Remove the empty Bunny video if the transfer failed part-way.
    if (guid) {
      try {
        await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`, { method: 'DELETE', headers: { AccessKey: apiKey! } })
      } catch { /* best effort */ }
    }
    console.error('[hub-send-to-bunny] failed:', err)
    return fail(res, 500, err?.message || 'The transfer to Bunny failed.')
  }
}
