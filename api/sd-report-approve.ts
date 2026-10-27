// api/sd-report-approve.ts
// Step 8 of the SD client journey: DeAnna approves a client's Strategic AI Insight Report.
// One call does the whole job, in this order, and stops at the first failure:
//   1. claim the send (locks the report; a second click or second tab cannot send twice)
//   2. build the client's 16-page PDF from the report page and store it privately (skipped on a retry: the stored PDF is reused)
//   3. email it to the client through DeAnna's GHL account with the PDF attached
//   4. record the sent time
// If anything fails, the report stays unsent, the error is saved on the report, and the same call can be made again.
// Only DeAnna's admin login can call this.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { buildSdReportPdf } from './_lib/sdReportPdf.js';

export const config = { maxDuration: 300 };

const ADMIN_EMAIL = 'deanna@druaiconsulting.com';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const sb = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION_ID = 'gl07I4JnbkGgW8zJprSz';
const GHL_VERSION = '2021-07-28';
const BUCKET = 'sd-reports';

const SUBJECT = 'Your Strategic AI Insight Report is ready';

function emailBody(firstName: string): { html: string; text: string } {
  const hello = firstName ? `Hello ${firstName},` : 'Hello,';
  const paras = [
    hello,
    'Your Strategic AI Insight Report is attached. All figures are based on your responses.',
    'Begin with your five pillars, ranked from lowest to highest. The lowest score identifies the area where work should begin.',
    'We will collaborate during our call.',
  ];
  const sign = ['Your Partner,', 'DeAnna R. Upshaw', 'DRU AI Consulting'];
  const text = paras.join('\n\n') + '\n\n' + sign.join('\n');
  const html = `<div style="font-family: Georgia, serif; font-size: 15px; line-height: 1.6; color: #0A2342;">`
    + paras.map(p => `<p>${p}</p>`).join('')
    + `<p>${sign.join('<br>')}</p></div>`;
  return { html, text };
}

async function findContactIdByEmail(email: string, apiKey: string): Promise<string> {
  const res = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
    body: JSON.stringify({ locationId: GHL_LOCATION_ID, email }),
  });
  if (!res.ok) throw new Error(`GHL contact lookup failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const id = data?.contact?.id;
  if (!id) throw new Error('GHL contact lookup returned no contact.');
  return id;
}

async function sendEmail(contactId: string, firstName: string, pdfUrl: string, apiKey: string): Promise<string | null> {
  const { html } = emailBody(firstName);
  const res = await fetch(`${GHL_API_BASE}/conversations/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
    body: JSON.stringify({ type: 'Email', contactId, subject: SUBJECT, html, attachments: [pdfUrl] }),
  });
  const bodyText = await res.text();
  if (!res.ok) throw new Error(`GHL did not send the email (${res.status}): ${bodyText.slice(0, 400)}`);
  try {
    const j = JSON.parse(bodyText);
    return j?.messageId || j?.emailMessageId || j?.id || null;
  } catch { return null; }
}

async function bearerEmail(req: VercelRequest): Promise<string | null> {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return null;
  const { data, error } = await sb.auth.getUser(h.slice(7));
  if (error || !data.user) return null;
  return (data.user.email || '').toLowerCase();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  if ((await bearerEmail(req)) !== ADMIN_EMAIL) { res.status(403).json({ error: 'Only DeAnna can approve a report.' }); return; }
  const token = String((req.body && req.body.token) || '').trim();
  if (!token) { res.status(400).json({ error: 'No report was chosen.' }); return; }
  const apiKey = process.env.GHL_PRIVATE_INTEGRATIONS_KEY;
  if (!apiKey) { res.status(500).json({ error: 'GHL_PRIVATE_INTEGRATIONS_KEY is not set.' }); return; }

  const { data: claim, error: claimErr } = await sb.rpc('claim_sd_report_send', { p_token: token });
  if (claimErr) { res.status(500).json({ error: claimErr.message }); return; }
  if (!claim) { res.status(404).json({ error: 'This report was not found.' }); return; }
  if (claim.status === 'sent') { res.status(200).json({ ok: true, already: true, sent_at: claim.sent_at }); return; }
  if (!claim.claimed) {
    res.status(409).json({ error: claim.sending ? 'This report is already being sent.' : 'This report is not ready to send.' });
    return;
  }

  try {
    const { data: report, error: rErr } = await sb.rpc('sd_report_core', { p_token: token });
    if (rErr || !report) throw new Error(rErr?.message || 'The report data could not be read.');
    const email = String(report.send_to || report.email || '').trim();
    if (!email) throw new Error('This client has no email address on file.');

    let path: string | null = claim.report_file_path;
    let overLength = 0;
    if (!path) {
      const built = await buildSdReportPdf(report);
      overLength = built.overLength;
      path = `reports/${token}/Strategic-AI-Insight-Report.pdf`;
      const { error: upErr } = await sb.storage.from(BUCKET).upload(path, built.pdf, { contentType: 'application/pdf', upsert: true });
      if (upErr) throw new Error(`The PDF could not be stored: ${upErr.message}`);
      const { error: pErr } = await sb.from('finished_reports').update({ report_file_path: path, status: 'report_built', updated_at: new Date().toISOString() }).eq('access_token', token);
      if (pErr) throw new Error(`The PDF path could not be saved: ${pErr.message}`);
    }

    const { data: signed, error: sErr } = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7, { download: 'Strategic-AI-Insight-Report.pdf' });
    if (sErr || !signed?.signedUrl) throw new Error(`The PDF link could not be made: ${sErr?.message ?? 'no link'}`);

    const contactId = await findContactIdByEmail(email, apiKey);
    const messageId = await sendEmail(contactId, String(report.first_name || '').trim(), signed.signedUrl, apiKey);

    const { error: doneErr } = await sb.from('finished_reports').update({
      status: 'sent', sent_at: new Date().toISOString(), send_error: null, send_started_at: null,
      ghl_message_id: messageId, updated_at: new Date().toISOString(),
    }).eq('access_token', token);
    if (doneErr) console.error('[sd-report-approve] Sent, but the sent time could not be saved:', doneErr);

    res.status(200).json({ ok: true, sent_to: email, overLength });
  } catch (err) {
    const message = (err as Error)?.message || 'The report could not be sent.';
    console.error('[sd-report-approve] failed:', message);
    await sb.from('finished_reports').update({ send_error: message.slice(0, 900), send_started_at: null, updated_at: new Date().toISOString() }).eq('access_token', token);
    res.status(500).json({ error: message });
  }
}
