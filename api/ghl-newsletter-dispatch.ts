// api/ghl-newsletter-dispatch.ts
// Sends an approved LEAD, CLARITY, WIN! Newsletter/Jaylen email to its real recipient list via
// GHL's Conversations/Messages send API.
//
// Fires from AdminApprovals.tsx's handleApprove() when an Email-platform card is approved
// (fireEmailDispatch), instead of the LinkedIn/Facebook/Instagram social-publisher path.
//
// Uses GHL_PRIVATE_INTEGRATIONS_KEY — plural "INTEGRATIONS" — NOT GHL_API_KEY (a different,
// older credential used elsewhere in this codebase for Omar/Ryan's lead scoring).
//
// RECIPIENT LOOKUP — Aug 19, 2026 architecture, replaces an earlier GHL tag-search approach
// that was never verifiable against real GHL behavior and, once tested, turned out to be
// broken. Recipients now come from Supabase directly: `profiles.tier` for free-tier/
// navigator/accelerator (independently verified reliable since May 2026), and a dedicated
// `non_members` table for true non-members (people with no login, tracked separately — see
// TIER_SOURCE_MAP below). GHL is still used, but only for the part it's actually needed for:
// finding/creating each person's real contact record by email (via the official Upsert
// Contact endpoint, confirmed working) and sending the message. GHL tags themselves still
// exist and stay in sync for her own reference in the GHL UI, but dispatch no longer reads
// them to decide who gets an email.

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

// Maps each newsletter/weekly-email trigger_type to which Supabase table holds its
// recipients. Aug 19, 2026 — replaces GHL tag search entirely. The GHL tags themselves still
// exist and stay in sync (that part is proven working via ghl-subscription-webhook.ts /
// ghl-tag-freetier.ts), but dispatch no longer asks GHL "who has this tag" — it asks
// Supabase directly, independently verified reliable since May 2026 (profiles.tier), plus
// the new non_members table (Aug 2026) for true non-members, who have no profiles row.
const TIER_SOURCE_MAP: Record<string, { table: 'non_members' | 'profiles'; tierValue?: string }> = {
  newsletter_nonmember:      { table: 'non_members' },
  newsletter_freetier:       { table: 'profiles', tierValue: 'free' },
  newsletter_navigator:      { table: 'profiles', tierValue: 'navigator' },
  newsletter_accelerator:    { table: 'profiles', tierValue: 'accelerator' },
  jaylen_weekly_freetier:    { table: 'profiles', tierValue: 'free' },
  jaylen_weekly_navigator:   { table: 'profiles', tierValue: 'navigator' },
  jaylen_weekly_accelerator: { table: 'profiles', tierValue: 'accelerator' },
};

async function getSupabaseTierContacts(trigger_type: string, apiKey: string): Promise<Array<{ id: string; firstName: string | null }>> {
  const source = TIER_SOURCE_MAP[trigger_type];
  if (!source) return [];

  let rows: Array<{ email: string; first_name: string | null; ghl_contact_id?: string | null }> = [];
  if (source.table === 'non_members') {
    const { data, error } = await supabase.from('non_members').select('email, first_name, ghl_contact_id').is('converted_at', null);
    if (error) { console.error('[ghl-newsletter-dispatch] non_members query failed:', error); return []; }
    rows = data ?? [];
  } else {
    const { data, error } = await supabase.from('profiles').select('email, first_name').eq('tier', source.tierValue);
    if (error) { console.error('[ghl-newsletter-dispatch] profiles query failed:', error); return []; }
    rows = data ?? [];
  }

  const contactsOut: Array<{ id: string; firstName: string | null }> = [];
  for (const row of rows) {
    const contactId = row.ghl_contact_id || await findContactIdByEmail(row.email, apiKey);
    if (contactId) contactsOut.push({ id: contactId, firstName: row.first_name });
    else console.error(`[ghl-newsletter-dispatch] No GHL contact for ${row.email} — skipped`);
  }
  return contactsOut;
}

// Jaylen's non-member 5-email sequence (Aug 2026) doesn't use tags at all — recipients are
// whoever's currently due in jaylen_sequence_progress, not a stable GHL tag. Stage number is
// the last character of the trigger_type (jaylen_sequence_1 .. jaylen_sequence_5).
const SEQUENCE_DAY_OFFSETS: Record<number, number> = { 1: 0, 2: 3, 3: 7, 4: 10, 5: 14 };

const FALLBACK_SUBJECT = "Lead, Clarity, Win! — This Week's Insight";

// Pulls the subject line out of Nia's already-cleaned card content (the "output" field —
// markdown bold is already stripped by raymond.ts, but heading markers like ## are not).
// Falls back to FALLBACK_SUBJECT if no "SUBJECT LINE" section is found. Also strips the
// subject-line heading/text out of the body so it isn't duplicated inside the email itself.
function extractSubjectAndBody(content: string): { subject: string; body: string } {
  const lines = content.split('\n');
  let subject = '';
  let headingIdx = -1;
  let textIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (/subject\s*line/i.test(lines[i])) {
      headingIdx = i;
      const sameLine = lines[i].replace(/^#{1,6}\s*/, '').replace(/subject\s*line\s*[:|]?\s*/i, '').trim();
      if (sameLine) {
        subject = sameLine;
        textIdx = i;
      } else {
        for (let j = i + 1; j < lines.length; j++) {
          const candidate = lines[j].trim();
          if (candidate) {
            subject = candidate.replace(/^#{1,6}\s*/, '').trim();
            textIdx = j;
            break;
          }
        }
      }
      break;
    }
  }

  if (!subject) subject = FALLBACK_SUBJECT;

  let bodyLines = lines;
  if (headingIdx !== -1) {
    const removeIndices = new Set([headingIdx]);
    if (textIdx !== -1 && textIdx !== headingIdx) removeIndices.add(textIdx);

    // The model sometimes writes literal section labels/dividers (e.g. "---" then "BODY:")
    // despite the format instruction being descriptive, not literal text to include — strip
    // any of those found in the few lines right after the subject, so they never reach the
    // actual sent email. Scans up to 3 non-blank lines past the subject.
    let checked = 0;
    for (let j = (textIdx !== -1 ? textIdx : headingIdx) + 1; j < lines.length && checked < 3; j++) {
      const trimmed = lines[j].trim();
      if (!trimmed) continue;
      checked++;
      if (/^[-_—=]{3,}$/.test(trimmed) || /^body\s*:?\s*$/i.test(trimmed)) {
        removeIndices.add(j);
      } else {
        break; // real content starts here — stop scanning
      }
    }

    bodyLines = lines.filter((_, idx) => !removeIndices.has(idx));
  }
  const body = bodyLines.join('\n').trim();
  return { subject, body };
}

function toHtml(body: string): string {
  const paragraphs = body.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const htmlParas = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n');
  return `<div style="font-family: Georgia, serif; font-size: 15px; line-height: 1.6; color: #0A2342;">${htmlParas}</div>`;
}

// Substitutes the {{contact.first_name}} merge tag ourselves rather than relying on GHL to
// resolve it — that resolution is confirmed for GHL's own Workflow "Send Email" action, but
// this dispatch calls /conversations/messages directly, a different path with no confirmed
// merge-tag support. Doing it in our own code means it's guaranteed, not assumed. No-op on
// content that doesn't contain the tag (e.g. Nia's newsletters), so this is safe to apply
// universally rather than branching by agent.
function personalize(html: string, firstName: string | null | undefined): string {
  return html.replace(/\{\{\s*contact\.first_name\s*\}\}/gi, firstName?.trim() || 'there');
}

async function sendEmailToContact(contactId: string, subject: string, html: string, apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${GHL_API_BASE}/conversations/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
      body: JSON.stringify({ type: 'Email', contactId, subject, html }),
    });
    if (!res.ok) console.error(`[ghl-newsletter-dispatch] Send failed for contact ${contactId}: ${res.status} ${await res.text()}`);
    return res.ok;
  } catch (err) {
    console.error(`[ghl-newsletter-dispatch] Send error for contact ${contactId}:`, err);
    return false;
  }
}

// Re-computes who's currently due for this stage at dispatch/approval time (not a frozen
// list from when the content was generated) — simpler than threading a recipient list
// through the CSQ->approval pipeline, and correct as long as approval happens same-day,
// which is the norm. If approval happens later than the generation day, this naturally
// picks up anyone newly due since then too, rather than silently missing them.
async function getDueSequenceContacts(stage: number): Promise<Array<{ email: string; ghl_contact_id: string | null; first_name: string | null }>> {
  const { data, error } = await supabase
    .from('jaylen_sequence_progress')
    .select('email, ghl_contact_id, first_name, current_email_number, signup_date')
    .eq('sequence_complete', false)
    .eq('current_email_number', stage - 1);
  if (error) { console.error('[ghl-newsletter-dispatch] Sequence lookup failed:', error); return []; }

  const offset = SEQUENCE_DAY_OFFSETS[stage] ?? 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return (data ?? [])
    .filter(row => {
      const signup = new Date(row.signup_date + 'T00:00:00');
      const daysSince = Math.floor((today.getTime() - signup.getTime()) / 86400000);
      return daysSince >= offset;
    })
    .map(row => ({ email: row.email, ghl_contact_id: row.ghl_contact_id, first_name: row.first_name }));
}

// GHL's official upsert endpoint — finds-or-creates by email using GHL's own duplicate
// detection, replacing the unverified advanced-search approach entirely.
// https://marketplace.gohighlevel.com/docs/ghl/contacts/upsert-contact
async function findContactIdByEmail(email: string, apiKey: string): Promise<string | null> {
  const res = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
    body: JSON.stringify({ locationId: GHL_LOCATION_ID, email }),
  });
  if (!res.ok) { console.error(`[ghl-newsletter-dispatch] Contact upsert failed: ${res.status} ${await res.text()}`); return null; }
  const data = await res.json();
  return data.contact?.id ?? null;
}

async function markSequenceSent(email: string, stage: number): Promise<void> {
  const { error } = await supabase
    .from('jaylen_sequence_progress')
    .update({ current_email_number: stage, last_sent_at: new Date().toISOString(), sequence_complete: stage >= 5 })
    .eq('email', email);
  if (error) console.error(`[ghl-newsletter-dispatch] Failed to update sequence progress for ${email}:`, error);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { content, trigger_type, approval_id } = req.body ?? {};
  if (!content || !trigger_type) { res.status(400).json({ error: 'content and trigger_type are required' }); return; }

  const apiKey = process.env.GHL_PRIVATE_INTEGRATIONS_KEY;
  if (!apiKey) { res.status(500).json({ error: 'GHL_PRIVATE_INTEGRATIONS_KEY not set' }); return; }

  // Non-member sequence — recipients come from Supabase, not a GHL tag.
  const sequenceMatch = /^jaylen_sequence_(\d)$/.exec(trigger_type);
  if (sequenceMatch) {
    const stage = parseInt(sequenceMatch[1], 10);
    try {
      const dueContacts = await getDueSequenceContacts(stage);
      if (dueContacts.length === 0) {
        console.log(`[ghl-newsletter-dispatch] No contacts due for sequence stage ${stage} (approval ${approval_id})`);
        res.status(200).json({ success: true, sent: 0, failed: 0, note: `No contacts due for stage ${stage}` });
        return;
      }

      const { subject, body } = extractSubjectAndBody(content);
      const html = toHtml(body);

      let sent = 0, failed = 0;
      for (const contact of dueContacts) {
        const contactId = contact.ghl_contact_id ?? await findContactIdByEmail(contact.email, apiKey);
        if (!contactId) { failed++; console.error(`[ghl-newsletter-dispatch] No GHL contact for ${contact.email} — skipped`); continue; }
        const personalizedHtml = personalize(html, contact.first_name);
        const ok = await sendEmailToContact(contactId, subject, personalizedHtml, apiKey);
        if (ok) { sent++; await markSequenceSent(contact.email, stage); } else { failed++; }
      }

      console.log(`[ghl-newsletter-dispatch] jaylen_sequence_${stage}: ${sent} sent, ${failed} failed (approval ${approval_id})`);
      res.status(200).json({ success: failed === 0, sent, failed });
    } catch (err) {
      console.error('[ghl-newsletter-dispatch] Fatal error (sequence):', err);
      res.status(500).json({ error: String(err) });
    }
    return;
  }

  const source = TIER_SOURCE_MAP[trigger_type];
  if (!source) { res.status(400).json({ error: `No recipient source mapped for trigger_type: ${trigger_type}` }); return; }

  try {
    const contacts = await getSupabaseTierContacts(trigger_type, apiKey);
    if (contacts.length === 0) {
      console.log(`[ghl-newsletter-dispatch] No contacts found for ${trigger_type} (source: ${source.table}) — approval ${approval_id}`);
      res.status(200).json({ success: true, sent: 0, failed: 0, note: `No contacts found for ${trigger_type}` });
      return;
    }

    const { subject, body } = extractSubjectAndBody(content);
    const html = toHtml(body);

    const results = await Promise.all(contacts.map(c => sendEmailToContact(c.id, subject, personalize(html, c.firstName), apiKey)));
    const sent = results.filter(Boolean).length;
    const failed = results.length - sent;

    console.log(`[ghl-newsletter-dispatch] ${trigger_type} (source: ${source.table}): ${sent} sent, ${failed} failed (approval ${approval_id})`);
    res.status(200).json({ success: failed === 0, sent, failed });
  } catch (err) {
    console.error('[ghl-newsletter-dispatch] Fatal error:', err);
    res.status(500).json({ error: String(err) });
  }
}
