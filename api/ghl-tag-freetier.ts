// api/ghl-tag-freetier.ts
// Tags a brand-new free-tier member in GHL right after their portal account is created.
// Called from druaiconsulting-assessment's Results.tsx, right after supabase.auth.signUp()
// succeeds — a cross-repo call, since the assessment app has no backend of its own.
//
// Uses GHL_PRIVATE_INTEGRATIONS_KEY (contacts.readonly + contacts.write + conversations/message.write
// — the contacts.write scope was added Aug 18, 2026 specifically for this and the
// ghl-subscription-webhook.ts tag sync).
//
// Handles the race condition where GHL's own inbound-webhook contact creation (fired by the
// SAME assessment-completion event, via the separate "Non-Members Newsletter" workflow) hasn't
// landed yet: looks up the contact by email first, creates it directly if not found, then tags
// it free-tier either way.

import type { VercelRequest, VercelResponse } from "@vercel/node";
export const config = { maxDuration: 30 };

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION_ID = 'gl07I4JnbkGgW8zJprSz';
const GHL_VERSION = '2021-07-28';

async function findContactIdByEmail(email: string, apiKey: string): Promise<string | null> {
  const res = await fetch(`${GHL_API_BASE}/contacts/search?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
  });
  if (!res.ok) {
    console.error(`[ghl-tag-freetier] Contact search failed: ${res.status} ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  return data.contacts?.[0]?.id ?? null;
}

async function createContact(email: string, apiKey: string): Promise<string | null> {
  const res = await fetch(`${GHL_API_BASE}/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
    body: JSON.stringify({ locationId: GHL_LOCATION_ID, email }),
  });
  if (!res.ok) {
    console.error(`[ghl-tag-freetier] Create contact failed: ${res.status} ${await res.text()}`);
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
  if (!res.ok) console.error(`[ghl-tag-freetier] Add tags failed for ${contactId}: ${res.status} ${await res.text()}`);
  return res.ok;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { email } = req.body ?? {};
  if (!email || typeof email !== 'string') { res.status(400).json({ error: 'email is required' }); return; }

  const apiKey = process.env.GHL_PRIVATE_INTEGRATIONS_KEY;
  if (!apiKey) { res.status(500).json({ error: 'GHL_PRIVATE_INTEGRATIONS_KEY not set' }); return; }

  try {
    let contactId = await findContactIdByEmail(email, apiKey);
    if (!contactId) {
      console.log(`[ghl-tag-freetier] No GHL contact found yet for ${email} — creating directly`);
      contactId = await createContact(email, apiKey);
    }
    if (!contactId) {
      console.error(`[ghl-tag-freetier] Could not find or create a GHL contact for ${email}`);
      res.status(500).json({ error: 'Could not find or create GHL contact' });
      return;
    }

    const ok = await addTags(contactId, ['free-tier'], apiKey);
    console.log(`[ghl-tag-freetier] ${email} → free-tier tag ${ok ? 'added' : 'FAILED'}`);
    res.status(200).json({ success: ok, email, contactId });
  } catch (err) {
    console.error('[ghl-tag-freetier] Fatal error:', err);
    res.status(500).json({ error: String(err) });
  }
}
