// api/ghl-newsletter-dispatch.ts
// Sends an approved LEAD, CLARITY, WIN! Newsletter edition to its real recipient list via
// GHL's Conversations/Messages send API — the piece that was missing entirely before this.
//
// Fires from AdminApprovals.tsx's handleApprove() when an Email-platform "social" card is
// approved (fireEmailDispatch), instead of the LinkedIn/Facebook/Instagram social-publisher path.
//
// Uses GHL_PRIVATE_INTEGRATION_KEY — NOT GHL_API_KEY (a different, older credential used
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
export const config = { maxDuration: 60 };

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION_ID = 'gl07I4JnbkGgW8zJprSz';
const GHL_VERSION = '2021-07-28';

// Maps each newsletter edition's trigger_type to the GHL tag identifying its recipients.
const TIER_TAG_MAP: Record<string, string> = {
  newsletter_nonmember:   'non-member',
  newsletter_freetier:    'free-tier',
  newsletter_navigator:   'navigator',
  newsletter_accelerator: 'accelerator',
};

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

// Paginates through GHL's contact search for a given tag. Hard safety cap of 50 pages
// (5,000 contacts) — well beyond current real list sizes; prevents a runaway loop if GHL's
// pagination cursor behaves unexpectedly.
async function getTaggedContactIds(tag: string, apiKey: string): Promise<string[]> {
  const ids: string[] = [];
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
    for (const c of contacts) if (c.id) ids.push(c.id);
    if (contacts.length < 100) break;
    const last = contacts[contacts.length - 1];
    startAfterId = last.id;
    startAfter = last.dateAdded ? new Date(last.dateAdded).getTime() : undefined;
  }
  return ids;
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { content, trigger_type, approval_id } = req.body ?? {};
  if (!content || !trigger_type) { res.status(400).json({ error: 'content and trigger_type are required' }); return; }

  const apiKey = process.env.GHL_PRIVATE_INTEGRATION_KEY;
  if (!apiKey) { res.status(500).json({ error: 'GHL_PRIVATE_INTEGRATION_KEY not set' }); return; }

  const tag = TIER_TAG_MAP[trigger_type];
  if (!tag) { res.status(400).json({ error: `No recipient tag mapped for trigger_type: ${trigger_type}` }); return; }

  try {
    const contactIds = await getTaggedContactIds(tag, apiKey);
    if (contactIds.length === 0) {
      console.log(`[ghl-newsletter-dispatch] No contacts found tagged "${tag}" for approval ${approval_id}`);
      res.status(200).json({ success: true, sent: 0, failed: 0, note: `No contacts tagged "${tag}"` });
      return;
    }

    const { subject, body } = extractSubjectAndBody(content);
    const html = toHtml(body);

    const results = await Promise.all(contactIds.map(id => sendEmailToContact(id, subject, html, apiKey)));
    const sent = results.filter(Boolean).length;
    const failed = results.length - sent;

    console.log(`[ghl-newsletter-dispatch] ${trigger_type} → tag "${tag}": ${sent} sent, ${failed} failed (approval ${approval_id})`);
    res.status(200).json({ success: failed === 0, sent, failed });
  } catch (err) {
    console.error('[ghl-newsletter-dispatch] Fatal error:', err);
    res.status(500).json({ error: String(err) });
  }
}
