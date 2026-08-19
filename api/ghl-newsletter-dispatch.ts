// api/ghl-newsletter-dispatch.ts
// Sends an approved LEAD, CLARITY, WIN! Newsletter edition to its real recipient list via
// GHL's Conversations/Messages send API — the piece that was missing entirely before this.
//
// Fires from AdminApprovals.tsx's handleApprove() when an Email-platform "social" card is
// approved (fireEmailDispatch), instead of the LinkedIn/Facebook/Instagram social-publisher path.
//
// Uses GHL_PRIVATE_INTEGRATIONS_KEY — NOT GHL_API_KEY (a different, older credential used
// elsewhere in this codebase for Omar/Ryan's lead scoring). This key is scoped specifically for
// contacts.readonly + conversations/message.write, confirmed live Aug 16, 2026.
//
// Recipient tags (created live in GHL, Aug 2026): non-member, free-tier, navigator, accelerator.
// free-tier has no newsletter edition yet (Nia doesn't write one) — TIER_TAG_MAP includes it
// for when that 4th edition exists; until then no trigger_type of "newsletter_freetier" will
// exist to dispatch, since Nia isn't writing that content yet outside this build. Once she is,
// no changes are needed here — the mapping already covers it.
//
// KNOWN RISK, flagged honestly rather than guessed past: the exact filter schema GHL's
// POST /contacts/search expects for tag-based filtering could not be fully confirmed against
// official docs (the docs site is JS-rendered and blocked full extraction; one third-party
// report suggested friction with tag filters specifically). The shape used below —
// {"field":"tags","operator":"contains","value":"<tag>"} — matches GHL's own documented
// example format for advanced filters. This is the one part of this build that needs a real
// first-test check: confirm the contact count returned for a known tag matches what's actually
// in GHL before trusting a real send.

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

// Maps each newsletter edition's trigger_type to the GHL tag identifying its recipients.
// Jaylen's weekly tier emails (Aug 2026 addition) reuse the exact same tier tags Nia's
// newsletter uses — same recipients, different content, different day (Tuesday vs Thursday).
const TIER_TAG_MAP: Record<string, string> = {
  newsletter_nonmember:   'non-member',
  newsletter_freetier:    'free-tier',
  newsletter_navigator:   'navigator-tier',
  newsletter_accelerator: 'accelerator-tier',
  jaylen_weekly_freetier:    'free-tier',
  jaylen_weekly_navigator:   'navigator-tier',
  jaylen_weekly_accelerator: 'accelerator-tier',
};

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

// Paginates through GHL's contact search for a given tag. Hard safety cap of 50 pages
// (5,000 contacts) — well beyond current real list sizes; prevents a runaway loop if GHL's
// pagination cursor behaves unexpectedly.
async function getTaggedContacts(tag: string, apiKey: string): Promise<Array<{ id: string; firstName: string | null }>> {
  const contactsOut: Array<{ id: string; firstName: string | null }> = [];
  let startAfterId: string | undefined;
  let startAfter: number | undefined;

  for (let page = 0; page < 50; page++) {
    const body: Record<string, unknown> = {
      locationId: GHL_LOCATION_ID,
      pageLimit: 100,
      filters: [{ field: 'tags', operator: 'contains', value: tag }],
    };
    if (startAfterId) body.startAfterId = startAfterId;
    if (startAfter)   body.startAfter = startAfter;

    const res = await fetch(`${GHL_API_BASE}/contacts/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`[ghl-newsletter-dispatch] Contact search failed for tag "${tag}": ${res.status} ${await res.text()}`);
      break;
    }
    const data = await res.json();
    const contacts = data.contacts ?? [];
    for (const c of contacts) if (c.id) contactsOut.push({ id: c.id, firstName: c.firstName ?? null });
    if (contacts.length < 100) break;
    const last = contacts[contacts.length - 1];
    startAfterId = last.id;
    startAfter = last.dateAdded ? new Date(last.dateAdded).getTime() : undefined;
  }
  return contactsOut;
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

async function findContactIdByEmail(email: string, apiKey: string): Promise<string | null> {
  const res = await fetch(`${GHL_API_BASE}/contacts/search?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
  });
  if (!res.ok) { console.error(`[ghl-newsletter-dispatch] Contact search failed: ${res.status} ${await res.text()}`); return null; }
  const data = await res.json();
  return data.contacts?.[0]?.id ?? null;
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

  const tag = TIER_TAG_MAP[trigger_type];
  if (!tag) { res.status(400).json({ error: `No recipient tag mapped for trigger_type: ${trigger_type}` }); return; }

  try {
    const contacts = await getTaggedContacts(tag, apiKey);
    if (contacts.length === 0) {
      console.log(`[ghl-newsletter-dispatch] No contacts found tagged "${tag}" for approval ${approval_id}`);
      res.status(200).json({ success: true, sent: 0, failed: 0, note: `No contacts tagged "${tag}"` });
      return;
    }

    const { subject, body } = extractSubjectAndBody(content);
    const html = toHtml(body);

    const results = await Promise.all(contacts.map(c => sendEmailToContact(c.id, subject, personalize(html, c.firstName), apiKey)));
    const sent = results.filter(Boolean).length;
    const failed = results.length - sent;

    console.log(`[ghl-newsletter-dispatch] ${trigger_type} → tag "${tag}": ${sent} sent, ${failed} failed (approval ${approval_id})`);
    res.status(200).json({ success: failed === 0, sent, failed });
  } catch (err) {
    console.error('[ghl-newsletter-dispatch] Fatal error:', err);
    res.status(500).json({ error: String(err) });
  }
}
