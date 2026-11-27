// api/jaylen-nonmember-signup.ts
// Fires from druaiconsulting-website's newsletter form (index.html), alongside its existing
// direct GHL webhook call. That existing call already creates the GHL contact and applies
// newsletter/lead-clear-win/website-lead tags — untouched, still does exactly that.
//
// This endpoint does the two things that call didn't: adds the `non-member` tag, and starts
// the row in jaylen_sequence_progress that the daily sequence check reads from (see
// runJaylen() in ghl-agent-trigger.ts).
//
// Nov 26, 2026 addition — a person who already has a member profile (free, Navigator or
// Accelerator) and subscribes on the website is not a non-member. Their website yes turns on
// newsletter_subscribed on their profile, their tier stays as it is, and they are not added to
// non_members, not given the non-member tag, and not started on the welcome series — so they
// receive only their own tier's edition, never two.
//
// Uses GHL_PRIVATE_INTEGRATIONS_KEY (contacts.readonly + contacts.write + conversations/message.write).

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
// duplicate-detection logic (the same logic that produced "This location does not allow
// duplicated contacts" when this file tried to create a contact that already existed).
// Replaces the separate search+create dance entirely — https://marketplace.gohighlevel.com/docs/ghl/contacts/upsert-contact
async function upsertGHLContact(email: string, firstName: string, lastName: string, apiKey: string): Promise<string | null> {
  const res = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
    body: JSON.stringify({ locationId: GHL_LOCATION_ID, email, firstName, lastName }),
  });
  if (!res.ok) {
    console.error(`[jaylen-nonmember-signup] Upsert contact failed: ${res.status} ${await res.text()}`);
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
  if (!res.ok) console.error(`[jaylen-nonmember-signup] Add tags failed for ${contactId}: ${res.status} ${await res.text()}`);
  return res.ok;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { email, first_name, last_name } = req.body ?? {};
  // Social subscribe form (Nov 26, 2026): the link in a post ends with the platform name, and the form passes
  // it along. It becomes a "from-<platform>" tag on the person's GHL record. Letters, numbers and dashes only.
  const rawSource = typeof req.body?.source === 'string' ? req.body.source : '';
  const source = rawSource.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30);
  if (!email || typeof email !== 'string') { res.status(400).json({ error: 'email is required' }); return; }
  const normalizedEmail = email.toLowerCase().trim();

  const apiKey = process.env.GHL_PRIVATE_INTEGRATIONS_KEY;
  if (!apiKey) { res.status(500).json({ error: 'GHL_PRIVATE_INTEGRATIONS_KEY not set' }); return; }

  try {
    // Already a member? Their website yes goes onto their member profile and nothing else changes.
    const { data: member, error: memberLookupError } = await supabase
      .from('profiles')
      .select('id, tier')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (memberLookupError) {
      console.error(`[jaylen-nonmember-signup] Member lookup failed for ${normalizedEmail}:`, memberLookupError);
      res.status(500).json({ error: 'Member lookup failed' });
      return;
    }
    if (member) {
      const { error: carryError } = await supabase
        .from('profiles')
        .update({ newsletter_subscribed: true })
        .eq('id', member.id);
      if (carryError) {
        console.error(`[jaylen-nonmember-signup] Could not turn on newsletter for member ${normalizedEmail}:`, carryError);
        res.status(500).json({ error: 'Could not update member profile' });
        return;
      }
      // A member who subscribes from a social post gets the platform tag on their GHL record (best effort).
      if (source) {
        const memberContactId = await upsertGHLContact(normalizedEmail, first_name ?? '', last_name ?? '', apiKey);
        if (memberContactId) await addTags(memberContactId, [`from-${source}`], apiKey);
      }
      console.log(`[jaylen-nonmember-signup] ${normalizedEmail} is already a ${member.tier} member — newsletter turned on, not added to non-member list`);
      res.status(200).json({ success: true, email: normalizedEmail, existingMember: true, tier: member.tier });
      return;
    }

    const contactId = await upsertGHLContact(normalizedEmail, first_name ?? '', last_name ?? '', apiKey);
    if (!contactId) {
      console.error(`[jaylen-nonmember-signup] Could not upsert GHL contact for ${normalizedEmail}`);
      res.status(500).json({ error: 'Could not upsert GHL contact' });
      return;
    }

    // From the social form: also the newsletter tag and the platform tag. The website form's own direct GHL
    // call already applies the newsletter tag there, so the website path (no source) stays exactly as it was.
    const tagOk = await addTags(contactId, source ? ['non-member', 'newsletter', `from-${source}`] : ['non-member'], apiKey);

    // Record in non_members — this is what dispatch actually reads from now, not a GHL
    // tag search. Upsert since a re-signup shouldn't create a duplicate.
    const { error: nonMemberError } = await supabase
      .from('non_members')
      .upsert(
        { email: normalizedEmail, first_name: first_name ?? null, ghl_contact_id: contactId, tagged_at: new Date().toISOString() },
        { onConflict: 'email' }
      );
    if (nonMemberError) console.error(`[jaylen-nonmember-signup] non_members upsert failed for ${normalizedEmail}:`, nonMemberError);

    // Start (or restart, if they somehow re-signed-up) the sequence tracking row.
    const { error: upsertError } = await supabase
      .from('jaylen_sequence_progress')
      .upsert(
        { email: normalizedEmail, ghl_contact_id: contactId, first_name: first_name ?? null, signup_date: new Date().toISOString().slice(0, 10), current_email_number: 0, sequence_complete: false },
        { onConflict: 'email' }
      );

    if (upsertError) {
      console.error(`[jaylen-nonmember-signup] Supabase upsert failed for ${normalizedEmail}:`, upsertError);
      res.status(500).json({ error: 'Failed to start sequence tracking' });
      return;
    }

    console.log(`[jaylen-nonmember-signup] ${normalizedEmail} → non-member tagged (${tagOk}), sequence started`);
    res.status(200).json({ success: true, email: normalizedEmail, contactId });
  } catch (err) {
    console.error('[jaylen-nonmember-signup] Fatal error:', err);
    res.status(500).json({ error: String(err) });
  }
}
