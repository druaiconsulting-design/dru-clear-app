// api/sd-report-pdf.ts
// Gives DeAnna a short-lived private link to a client's stored report PDF so she can open it from the review page.
// Only DeAnna's admin login can call this.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'deanna@druaiconsulting.com';
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) { res.status(403).json({ error: 'Sign in first.' }); return; }
  const { data: u, error: uErr } = await sb.auth.getUser(h.slice(7));
  if (uErr || (u.user?.email || '').toLowerCase() !== ADMIN_EMAIL) { res.status(403).json({ error: 'Only DeAnna can open this.' }); return; }
  const token = String(req.query.token || '').trim();
  if (!token) { res.status(400).json({ error: 'No report was chosen.' }); return; }
  const { data: row } = await sb.from('finished_reports').select('report_file_path').eq('access_token', token).maybeSingle();
  if (!row?.report_file_path) { res.status(404).json({ error: 'No PDF has been built for this report yet.' }); return; }
  const { data, error } = await sb.storage.from('sd-reports').createSignedUrl(row.report_file_path, 600);
  if (error || !data?.signedUrl) { res.status(500).json({ error: error?.message ?? 'The link could not be made.' }); return; }
  res.status(200).json({ url: data.signedUrl });
}
