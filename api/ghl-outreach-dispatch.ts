// api/ghl-outreach-dispatch.ts
// Sends Aaliyah Foster's approved personalized outreach emails to their real GHL contacts,
// one per lead, via GHL's Conversations/Messages send API -- same pattern as
// ghl-newsletter-dispatch.ts (Nia's fix), but looping over a JSON array of leads instead of
// one flat recipient list, since Aaliyah's card can cover several leads in one run.
//
// Fires from AdminApprovals.tsx's handleApprove() when an "outreach" category card is
// approved (fireOutreachDispatch).
//
// Uses GHL_PRIVATE_INTEGRATIONS_KEY, same credential as the newsletter dispatch.
//
// Writes one row to outreach_log per successfully sent email -- the permanent record of
// who Aaliyah actually reached, when, and with what subject. This is what finally lets
// score -> outreach -> conversion be traced as one line per contact_id.
//
// The LinkedIn DM half of Aaliyah's output is NOT sent here -- GHL has no LinkedIn send
// capability. It stays in the approval card for DeAnna to copy/paste manually. Only the
// email half is dispatched automatically.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from '@supabase/supabase-js';
export const config = { maxDuration: 60 };

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION_ID = 'gl07I4JnbkGgW8zJprSz';
const GHL_VERSION = '2021-07-28';

type OutreachItem = {
  ghl_contact_id?: string;
  email?: string;
  subject?: string;
  email_body?: string;
  linkedin_dm?: string;
};

// GHL's official upsert endpoint -- finds-or-creates by email. Used as a fallback only when
// a lead somehow has no ghl_contact_id (shouldn't happen once the scoring spine is fully in
// place, but keeps this endpoint working even for older/partial data).
async function findContactIdByEmail(email: string, apiKey: string): Promise<string | null> {
  const res = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
    body: JSON.stringify({ locationId: GHL_LOCATION_ID, email }),
  });
  if (!res.ok) { console.error(`[ghl-outreach-dispatch] Contact upsert failed: ${res.status} ${await res.text()}`); return null; }
  const data = await res.json();
  return data.contact?.id ?? null;
}

const UNSUBSCRIBE_FOOTER = '<p style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 12px; color: #888;">DRU AI Consulting — 2002 11th Ave N #56 Texas City, Tx 77592 TX<br>If you\'d rather not receive these emails, <a href="{{unsubscribe}}" style="color: #888;">unsubscribe here</a>.</p>';

function toHtml(body: string): string {
  const paragraphs = (body || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const htmlParas = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n');
  return `<div style="font-family: Georgia, serif; font-size: 15px; line-height: 1.6; color: #0A2342;">${htmlParas}\n${UNSUBSCRIBE_FOOTER}</div>`;
}

async function sendEmailToContact(contactId: string, subject: string, html: string, apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${GHL_API_BASE}/conversations/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
      body: JSON.stringify({ type: 'Email', contactId, subject, html }),
    });
    if (!res.ok) console.error(`[ghl-outreach-dispatch] Send failed for contact ${contactId}: ${res.status} ${await res.text()}`);
    return res.ok;
  } catch (err) {
    console.error(`[ghl-outreach-dispatch] Send error for contact ${contactId}:`, err);
    return false;
  }
}

async function logOutreach(contactId: string, email: string, subject: string, approvalId: string | null): Promise<void> {
  const { error } = await supabase.from('outreach_log').insert({
    ghl_contact_id: contactId, email, subject, channel: 'email', approval_id: approvalId,
  });
  if (error) console.error('[ghl-outreach-dispatch] outreach_log insert failed:', error);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { content, approval_id } = req.body ?? {};
  if (!content) { res.status(400).json({ error: 'content is required' }); return; }

  const apiKey = process.env.GHL_PRIVATE_INTEGRATIONS_KEY;
  if (!apiKey) { res.status(500).json({ error: 'GHL_PRIVATE_INTEGRATIONS_KEY not set' }); return; }

  let parsed: { outreach: OutreachItem[] };
  try {
    parsed = JSON.parse(String(content).replace(/```json|```/g, '').trim());
  } catch (err) {
    console.error('[ghl-outreach-dispatch] Could not parse Aaliyah content as JSON:', err);
    res.status(400).json({ error: 'Content is not valid outreach JSON' });
    return;
  }

  const items = Array.isArray(parsed?.outreach) ? parsed.outreach : [];
  if (items.length === 0) {
    res.status(200).json({ success: true, sent: 0, failed: 0, note: 'No outreach items in this card' });
    return;
  }

  let sent = 0, failed = 0;
  for (const item of items) {
    if (!item.email_body || !item.subject) { failed++; continue; }
    const contactId = item.ghl_contact_id || (item.email ? await findContactIdByEmail(item.email, apiKey) : null);
    if (!contactId) { failed++; console.error('[ghl-outreach-dispatch] No contact_id or email for item — skipped'); continue; }

    const html = toHtml(item.email_body);
    const ok = await sendEmailToContact(contactId, item.subject, html, apiKey);
    if (ok) { sent++; await logOutreach(contactId, item.email || '', item.subject, approval_id || null); }
    else failed++;
  }

  console.log(`[ghl-outreach-dispatch] ${sent} sent, ${failed} failed (approval ${approval_id})`);
  res.status(200).json({ success: failed === 0, sent, failed });
}
