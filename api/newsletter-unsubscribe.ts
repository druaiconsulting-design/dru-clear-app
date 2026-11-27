// api/newsletter-unsubscribe.ts
// The page behind the unsubscribe link in every newsletter and Jaylen email.
//
// GET  — shows a plain page with one "Unsubscribe me" button. Mail programs sometimes open links
//        automatically to scan for viruses, so the GET never unsubscribes anyone by itself.
// POST — checks the signed code, then does both halves of an unsubscribe at once:
//          1. GHL: turns on the contact's email do-not-disturb, so GHL stops emailing them.
//          2. Database: members (profiles) get newsletter_subscribed turned off and keep their tier
//             and account; non-members get unsubscribed_at stamped and their welcome sequence ended.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { isValidUnsubscribeCode } from './_lib/newsletterUnsubscribe.js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION_ID = 'gl07I4JnbkGgW8zJprSz';
const GHL_VERSION = '2021-07-28';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function page(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title></head>
<body style="margin:0; padding:48px 20px; font-family: Georgia, serif; color:#0A2342; background:#ffffff;">
<div style="max-width:480px; margin:0 auto; text-align:center;">
<h1 style="font-size:24px; line-height:1.3;">${escapeHtml(title)}</h1>
${bodyHtml}
</div></body></html>`;
}

function send(res: VercelResponse, status: number, html: string) {
  res.status(status).setHeader('Content-Type', 'text/html; charset=utf-8').setHeader('Cache-Control', 'no-store').send(html);
}

async function findContactIdByEmail(email: string, apiKey: string): Promise<string | null> {
  const res = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
    body: JSON.stringify({ locationId: GHL_LOCATION_ID, email }),
  });
  if (!res.ok) { console.error(`[newsletter-unsubscribe] Contact upsert failed: ${res.status} ${await res.text()}`); return null; }
  const data = await res.json();
  return data.contact?.id ?? null;
}

async function turnOnGhlEmailDnd(email: string, apiKey: string): Promise<boolean> {
  const contactId = await findContactIdByEmail(email, apiKey);
  if (!contactId) return false;
  const res = await fetch(`${GHL_API_BASE}/contacts/${contactId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
    body: JSON.stringify({ dndSettings: { Email: { status: 'active', message: 'Unsubscribed from the newsletter link', code: 'UNSUBSCRIBED_BY_CONTACT' } } }),
  });
  if (!res.ok) { console.error(`[newsletter-unsubscribe] GHL do-not-disturb update failed for ${email}: ${res.status} ${await res.text()}`); return false; }
  return true;
}

async function updateDatabase(email: string): Promise<boolean> {
  let ok = true;
  const { error: profileError } = await supabase.from('profiles').update({ newsletter_subscribed: false }).eq('email', email);
  if (profileError) { ok = false; console.error(`[newsletter-unsubscribe] Failed to turn off newsletter flag for ${email}:`, profileError); }
  const { error: nmError } = await supabase.from('non_members').update({ unsubscribed_at: new Date().toISOString() }).eq('email', email).is('unsubscribed_at', null);
  if (nmError) { ok = false; console.error(`[newsletter-unsubscribe] Failed to stamp unsubscribed_at for ${email}:`, nmError); }
  const { error: seqError } = await supabase.from('jaylen_sequence_progress').update({ sequence_complete: true }).eq('email', email);
  if (seqError) { ok = false; console.error(`[newsletter-unsubscribe] Failed to end sequence for ${email}:`, seqError); }
  return ok;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const source = req.method === 'POST' ? { ...(req.query ?? {}), ...(typeof req.body === 'object' && req.body ? req.body : {}) } : (req.query ?? {});
  const email = String(source.e ?? '').trim().toLowerCase();
  const code = String(source.t ?? '').trim();

  if (!isValidUnsubscribeCode(email, code)) {
    send(res, 400, page('This unsubscribe link is not valid', '<p style="font-size:16px; line-height:1.6;">Please use the unsubscribe link from your most recent email.</p>'));
    return;
  }

  if (req.method === 'GET') {
    send(res, 200, page('Unsubscribe from LEAD, CLARITY, WIN!', `<p style="font-size:16px; line-height:1.6;">${escapeHtml(email)}</p>
<form method="POST" action="/api/newsletter-unsubscribe?e=${encodeURIComponent(email)}&t=${encodeURIComponent(code)}">
<button type="submit" style="margin-top:16px; padding:14px 32px; font-size:16px; font-family: Georgia, serif; color:#ffffff; background:#0A2342; border:0; border-radius:6px; cursor:pointer;">Unsubscribe me</button>
</form>`));
    return;
  }

  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const apiKey = process.env.GHL_PRIVATE_INTEGRATIONS_KEY;
  if (!apiKey) { send(res, 500, page('Something went wrong', '<p style="font-size:16px; line-height:1.6;">Please try again in a few minutes.</p>')); return; }

  try {
    const ghlOk = await turnOnGhlEmailDnd(email, apiKey);
    const dbOk = await updateDatabase(email);
    if (!ghlOk || !dbOk) {
      console.error(`[newsletter-unsubscribe] Incomplete unsubscribe for ${email}: ghl=${ghlOk} database=${dbOk}`);
      send(res, 500, page('Something went wrong', '<p style="font-size:16px; line-height:1.6;">Please try again in a few minutes.</p>'));
      return;
    }
    console.log(`[newsletter-unsubscribe] ${email} unsubscribed (GHL do-not-disturb on, database updated)`);
    send(res, 200, page('You have been unsubscribed from LEAD, CLARITY, WIN!', ''));
  } catch (err) {
    console.error('[newsletter-unsubscribe] Fatal error:', err);
    send(res, 500, page('Something went wrong', '<p style="font-size:16px; line-height:1.6;">Please try again in a few minutes.</p>'));
  }
}
