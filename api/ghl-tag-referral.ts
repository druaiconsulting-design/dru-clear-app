// api/ghl-tag-referral.ts
// Called from druaiconsulting-assessment's Share.tsx, alongside the existing referral-email
// webhook call (which sends the actual email to the colleague and already works — untouched).
//
// That webhook call only logs a "referral_email_sent" activity note on the REFERRER's own
// GHL contact — it never creates a contact for the person being referred, so they were
// invisible to Omar's lead scan even after receiving and clicking the referral email.
//
// This endpoint closes that gap directly via the GHL API (same upsert pattern as
// ghl-tag-freetier.ts), tagging the referred email `referral-pending` only. No GHL workflow
// is attached to this tag — deliberately, since the referred person never opted into
// anything themselves. They should not be auto-enrolled in a welcome sequence or any other
// nurture just because someone else sent their email in.
//
// Uses GHL_PRIVATE_INTEGRATIONS_KEY (contacts.readonly + contacts.write + conversations/message.write).

import type { VercelRequest, VercelResponse } from "@vercel/node";

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION_ID = 'gl07I4JnbkGgW8zJprSz';
const GHL_VERSION = '2021-07-28';

// GHL's official upsert endpoint — finds-or-creates by email using GHL's own duplicate
// detection. https://marketplace.gohighlevel.com/docs/ghl/contacts/upsert-contact
async function upsertGHLContact(email: string, apiKey: string): Promise<string | null> {
  const res = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
    body: JSON.stringify({ locationId: GHL_LOCATION_ID, email }),
  });
  if (!res.ok) {
    console.error(`[ghl-tag-referral] Contact upsert failed: ${res.status} ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  return data.contact?.id ?? null;
}

async function addTags(contactId: string, tags: string[], apiKey: string): Promise<boolean> {
  const res = await fetch(`${GHL_API_BASE}/contacts/${contactId}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) console.error(`[ghl-tag-referral] Add tags failed for ${contactId}: ${res.status} ${await res.text()}`);
  return res.ok;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { referred_email } = req.body ?? {};
  if (!referred_email || typeof referred_email !== 'string') { res.status(400).json({ error: 'referred_email is required' }); return; }
  const normalizedEmail = referred_email.toLowerCase().trim();

  const apiKey = process.env.GHL_PRIVATE_INTEGRATIONS_KEY;
  if (!apiKey) { res.status(500).json({ error: 'GHL_PRIVATE_INTEGRATIONS_KEY not set' }); return; }

  try {
    const contactId = await upsertGHLContact(normalizedEmail, apiKey);
    if (!contactId) {
      console.error(`[ghl-tag-referral] Could not upsert GHL contact for ${normalizedEmail}`);
      res.status(500).json({ error: 'Could not upsert GHL contact' });
      return;
    }

    const ok = await addTags(contactId, ['referral-pending'], apiKey);

    console.log(`[ghl-tag-referral] ${normalizedEmail} → referral-pending tag ${ok ? 'added' : 'FAILED'}`);
    res.status(200).json({ success: ok, email: normalizedEmail, contactId });
  } catch (err) {
    console.error('[ghl-tag-referral] Fatal error:', err);
    res.status(500).json({ error: String(err) });
  }
}
