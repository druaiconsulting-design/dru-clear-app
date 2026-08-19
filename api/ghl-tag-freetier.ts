// api/ghl-tag-freetier.ts
// Tags a brand-new free-tier member in GHL right after their portal account is created.
// Called from druaiconsulting-assessment's Results.tsx, right after supabase.auth.signUp()
// succeeds — a cross-repo call, since the assessment app has no backend of its own.
//
// Uses GHL_PRIVATE_INTEGRATIONS_KEY (contacts.readonly + contacts.write + conversations/message.write).
//
// Aug 19, 2026 addition — the seamless non-member -> free-tier handoff: if this email was
// already tracked as a non-member (signed up for the newsletter before ever taking the
// assessment), converting to free-tier now means they're not a non-member anymore. This
// closes out that status everywhere it's tracked: the non_members table (marked converted,
// not deleted, so history isn't lost), the 5-email welcome sequence (stopped — they already
// took the exact action that sequence exists to drive), and the GHL non-member tag (removed,
// so a contact never carries two tier tags at once).

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from '@supabase/supabase-js';
export const config = { maxDuration: 30 };

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION_ID = 'gl07I4JnbkGgW8zJprSz';
const GHL_VERSION = '2021-07-28';

// GHL's official upsert endpoint — one call finds-or-creates by email using GHL's own
// duplicate-detection logic, replacing the separate search+create dance entirely.
// https://marketplace.gohighlevel.com/docs/ghl/contacts/upsert-contact
async function upsertGHLContact(email: string, apiKey: string): Promise<string | null> {
  const res = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
    body: JSON.stringify({ locationId: GHL_LOCATION_ID, email }),
  });
  if (!res.ok) {
    console.error(`[ghl-tag-freetier] Contact upsert failed: ${res.status} ${await res.text()}`);
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

async function removeTags(contactId: string, tags: string[], apiKey: string): Promise<boolean> {
  const res = await fetch(`${GHL_API_BASE}/contacts/${contactId}/tags`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) console.error(`[ghl-tag-freetier] Remove tags failed for ${contactId}: ${res.status} ${await res.text()}`);
  return res.ok;
}

// Closes out non-member status everywhere it's tracked. Never blocks or fails the response —
// the free-tier tagging above already succeeded, which is what matters most; a hiccup here
// just means a stale non-member record lingers, logged clearly so it's visible, not silent.
async function closeOutNonMemberStatus(email: string, contactId: string, apiKey: string): Promise<void> {
  try {
    const { data: existing } = await supabase.from('non_members').select('email').eq('email', email).maybeSingle();
    if (!existing) return; // never was a non-member — nothing to close out

    await supabase.from('non_members').update({ converted_at: new Date().toISOString() }).eq('email', email);
    await supabase.from('jaylen_sequence_progress').update({ sequence_complete: true }).eq('email', email);
    await removeTags(contactId, ['non-member'], apiKey);
    console.log(`[ghl-tag-freetier] ${email} converted from non-member — sequence stopped, non-member tag removed`);
  } catch (err) {
    console.error(`[ghl-tag-freetier] Non-member close-out error for ${email}:`, err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { email } = req.body ?? {};
  if (!email || typeof email !== 'string') { res.status(400).json({ error: 'email is required' }); return; }
  const normalizedEmail = email.toLowerCase().trim();

  const apiKey = process.env.GHL_PRIVATE_INTEGRATIONS_KEY;
  if (!apiKey) { res.status(500).json({ error: 'GHL_PRIVATE_INTEGRATIONS_KEY not set' }); return; }

  try {
    const contactId = await upsertGHLContact(normalizedEmail, apiKey);
    if (!contactId) {
      console.error(`[ghl-tag-freetier] Could not upsert GHL contact for ${normalizedEmail}`);
      res.status(500).json({ error: 'Could not upsert GHL contact' });
      return;
    }

    const ok = await addTags(contactId, ['free-tier'], apiKey);
    await closeOutNonMemberStatus(normalizedEmail, contactId, apiKey);

    console.log(`[ghl-tag-freetier] ${normalizedEmail} → free-tier tag ${ok ? 'added' : 'FAILED'}`);
    res.status(200).json({ success: ok, email: normalizedEmail, contactId });
  } catch (err) {
    console.error('[ghl-tag-freetier] Fatal error:', err);
    res.status(500).json({ error: String(err) });
  }
}
