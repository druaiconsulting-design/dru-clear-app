// api/support-email-inbound.ts
// Receives each email sent to support@support.druaiconsulting.com or info@info.druaiconsulting.com.
// GHL's Inbound Email workflow posts the email here. This endpoint:
//   1. checks the shared secret (x-support-key) so only GHL can post here
//   2. skips mail from our own addresses, mailer robots and auto-replies
//   3. an email that answers an earlier ticket (same email thread, or same sender, address and subject, with activity in the last 10 days)
//      is added to that ticket, the ticket moves back to Waiting on you (a closed ticket reopens), Isaiah drafts his next reply
//      from the whole conversation, and no second instant reply goes out. Any other email is saved as a new ticket in
//      support_requests (the same email posted twice is saved once).
//   4. password reset emails: Isaiah Carter replies right away with the real reset steps (no approval)
//      and the ticket moves to Replied. Every other email gets Isaiah's instant reply (a short thank-you
//      that says a reply follows within 24 hours), sent from the address they wrote to through that address's GHL workflow.
//   5. every other email: Isaiah drafts the full reply and it waits on the Support Tickets page for DeAnna.
//      Nothing more is sent to the customer until she approves it.
// If the daily spend cap is reached, the ticket stays "open" and Isaiah's daily support report lists it.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { waitUntil } from "@vercel/functions";
import { createHash, timingSafeEqual } from "node:crypto";
import { sb, handleTicket, handleFollowUp, recordMessage, ticketFromRow } from "./_lib/supportIsaiah.js";

export const config = { maxDuration: 300 };


const ALLOWED_ADDRESSES = ["support@support.druaiconsulting.com", "info@info.druaiconsulting.com"];
const OWN_DOMAINS = ["support.druaiconsulting.com", "info.druaiconsulting.com", "noreply.druaiconsulting.com"];
const MAX_TICKETS_PER_SENDER_PER_HOUR = 3;
const MAX_BODY_CHARS = 8000;
const FOLLOW_UP_WINDOW_DAYS = 10;           // a ticket takes follow-ups for this many days after its last activity
const MAX_FOLLOW_UP_DRAFTS_PER_TICKET_PER_HOUR = 5;

function keyMatches(given: string, expected: string): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// GHL's webhook action sends the contact's details plus the custom data fields we set.
// Custom data arrives under customData; the top level is read as a fallback.
function pick(payload: Record<string, unknown>, key: string): string {
  const custom = (payload.customData ?? {}) as Record<string, unknown>;
  const v = custom[key] ?? payload[key];
  return typeof v === "string" ? v.trim() : "";
}

function contactIdFrom(payload: Record<string, unknown>): string {
  const direct = payload.contact_id ?? (payload.contact as Record<string, unknown> | undefined)?.id;
  return typeof direct === "string" ? direct : "";
}

function looksAutomated(fromEmail: string, subject: string): boolean {
  const from = fromEmail.toLowerCase();
  const subj = subject.toLowerCase();
  if (/(^|[._-])(mailer-daemon|postmaster|no-?reply|donotreply|do-not-reply|bounce|bounces)([._-]|@)/.test(from)) return true;
  if (OWN_DOMAINS.some((d) => from.endsWith(`@${d}`))) return true;
  return /^(auto:|automatic reply|auto-reply|autoreply|out of office|undeliverable|delivery status notification|mail delivery failed|returned mail)/.test(subj);
}

async function lookUpMember(email: string): Promise<{ id: string | null; name: string | null; tier: string | null }> {
  try {
    const res = await sb(`profiles?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id,first_name,last_name,tier&limit=1`);
    if (!res.ok) return { id: null, name: null, tier: null };
    const row = (await res.json())?.[0];
    if (!row) return { id: null, name: null, tier: null };
    const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || null;
    return { id: row.id ?? null, name, tier: row.tier ?? null };
  } catch {
    return { id: null, name: null, tier: null };
  }
}

async function recentTicketCount(email: string): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const res = await sb(`support_requests?member_email=eq.${encodeURIComponent(email.toLowerCase())}&created_at=gte.${since}&select=id`);
  if (!res.ok) return 0;
  const rows = await res.json();
  return Array.isArray(rows) ? rows.length : 0;
}

// "Re: Fwd: Reset password", "Re: Support: Reset password" and "reset password" are the same subject.
// (Isaiah's replies carry the area, Support: or Info:, at the front of the subject.)
function normalizeSubject(subject: string): string {
  let out = subject.trim();
  for (;;) {
    const next = out.replace(/^(re|fw|fwd|aw|sv|support|info)\s*:\s*/i, "");
    if (next === out) break;
    out = next;
  }
  return out.toLowerCase().replace(/\s+/g, " ").trim();
}

function subjectOfQuestion(question: unknown): string {
  const m = String(question ?? "").match(/^Subject:\s*(.*)\n/);
  return (m?.[1] ?? "").trim();
}

// A ticket only takes follow-ups for 10 days after its last activity (the client's email, Isaiah's reply or yours).
// After that the same email thread or subject starts a new ticket.
async function activeWithinWindow(rows: Record<string, unknown>[]): Promise<Record<string, unknown> | null> {
  if (rows.length === 0) return null;
  const cutoff = Date.now() - FOLLOW_UP_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const ids = rows.map((r) => String(r.id)).join(",");
  const res = await sb(`ticket_messages?ticket_id=in.(${ids})&select=ticket_id,created_at&order=created_at.desc&limit=500`);
  const last = new Map<string, number>();
  if (res.ok) {
    for (const m of (await res.json()) as { ticket_id: string; created_at: string }[]) {
      if (!last.has(m.ticket_id)) last.set(m.ticket_id, new Date(m.created_at).getTime());
    }
  }
  for (const r of rows) {
    const activity = Math.max(new Date(String(r.created_at)).getTime(), last.get(String(r.id)) ?? 0);
    if (activity >= cutoff) return r;
  }
  return null;
}

// Finds the ticket an email belongs to. First the email thread (GHL's message id is the same for every email
// in a thread, from the same sender). Then the same sender, the same address and the same subject.
// Either way the ticket must have had activity within the last 10 days. No match means a new ticket.
async function findTicketForFollowUp(fromEmail: string, toAddress: string, messageId: string, subject: string): Promise<Record<string, unknown> | null> {
  const enc = encodeURIComponent;
  const byThread = await sb(`support_requests?member_email=eq.${enc(fromEmail)}&ghl_message_id=eq.${enc(messageId)}&select=*&order=created_at.desc&limit=20`);
  if (byThread.ok) {
    const hit = await activeWithinWindow((await byThread.json()) as Record<string, unknown>[]);
    if (hit) return hit;
  }
  const wanted = normalizeSubject(subject);
  if (!wanted || wanted === "(no subject)") return null;
  const recent = await sb(`support_requests?member_email=eq.${enc(fromEmail)}&source_address=eq.${enc(toAddress)}&select=*&order=created_at.desc&limit=50`);
  if (!recent.ok) return null;
  const rows = (await recent.json()) as Record<string, unknown>[];
  return activeWithinWindow(rows.filter((r) => normalizeSubject(subjectOfQuestion(r.question)) === wanted));
}

async function recentClientMessageCount(ticketId: string): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const res = await sb(`ticket_messages?ticket_id=eq.${ticketId}&direction=eq.client&created_at=gte.${since}&select=id`);
  if (!res.ok) return 0;
  const rows = await res.json();
  return Array.isArray(rows) ? rows.length : 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const given = String(req.headers["x-support-key"] ?? "");
  if (!keyMatches(given, process.env.SUPPORT_EMAIL_WEBHOOK_SECRET ?? "")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const payload = (req.body ?? {}) as Record<string, unknown>;
  const toAddress = pick(payload, "to_address").toLowerCase();
  const messageId = pick(payload, "message_id");
  const fromEmail = pick(payload, "from_email").toLowerCase();
  const fromName = pick(payload, "from_name") || null;
  const subject = pick(payload, "subject") || "(no subject)";
  const body = pick(payload, "body").slice(0, MAX_BODY_CHARS);

  if (!fromEmail || !messageId || !body || !ALLOWED_ADDRESSES.includes(toAddress)) {
    console.warn(`[support-email-inbound] Missing or unexpected fields — has from_email:${!!fromEmail} message_id:${!!messageId} body:${!!body} to_address:${toAddress || "none"}`);
    res.status(400).json({ error: "from_email, message_id, body and an allowed to_address are required" });
    return;
  }

  if (looksAutomated(fromEmail, subject)) {
    console.log(`[support-email-inbound] Skipped automated or own-domain mail from ${fromEmail}`);
    res.status(200).json({ ok: true, skipped: "automated" });
    return;
  }

  // GHL reuses one message id for every email in the same thread, so the id alone cannot tell a retry
  // from a follow-up. The id plus the email's own words can.
  const dedupeKey = `${messageId}:${createHash("sha256").update(`${subject}\n${body}`).digest("hex").slice(0, 24)}`;

  // The same email posted again (a retry) is never saved twice.
  const already = await sb(`support_requests?dedupe_key=eq.${encodeURIComponent(dedupeKey)}&select=id&limit=1`);
  if (already.ok && ((await already.json()) as unknown[]).length > 0) {
    console.log(`[support-email-inbound] Skipped repeat of an email already saved (from ${fromEmail}, message ${messageId})`);
    res.status(200).json({ ok: true, duplicate: true });
    return;
  }

  // A client answering an email thread adds to that ticket and the ticket moves back to "Waiting on you".
  const existing = await findTicketForFollowUp(fromEmail, toAddress, messageId, subject);
  if (existing) {
    const ticketId = String(existing.id);
    const tooManyFollowUps = (await recentClientMessageCount(ticketId)) >= MAX_FOLLOW_UP_DRAFTS_PER_TICKET_PER_HOUR;

    // The message is saved first, so a repeat of the same email (a retry) stops here and changes nothing.
    const saved = await recordMessage(ticketId, "client", body, { ghlMessageId: messageId, dedupeKey });
    if (saved === "duplicate") {
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }
    if (saved === "failed") {
      res.status(500).json({ error: "Follow-up save failed" });
      return;
    }

    // The ticket moves back to Waiting on you (a closed ticket reopens). A ticket that is being drafted
    // or sent this moment is left alone; the message is saved either way.
    const reopen = await sb(`support_requests?id=eq.${ticketId}&status=not.in.(replying,drafting)`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: tooManyFollowUps ? "open" : "drafting" }),
    });
    const reopened = reopen.ok ? await reopen.json() : [];
    const didReopen = Array.isArray(reopened) && reopened.length > 0;
    const canDraft = didReopen && !tooManyFollowUps;

    res.status(200).json({ ok: true, ticket_id: ticketId, follow_up: true, drafting: canDraft });

    if (!canDraft && !didReopen) {
      console.warn(`[support-email-inbound] Follow-up saved on ticket ${ticketId} without a draft (ticket is being drafted or sent)`);
      return;
    }

    const base = ticketFromRow(existing);
    waitUntil((async () => {
      // The earlier draft is out of date now that the client has written again.
      await sb(`approvals?category=eq.support_reply&status=eq.pending&context=like.*${ticketId}*`, { method: "PATCH", body: JSON.stringify({ status: "closed" }) }).catch(() => {});
      if (!canDraft) {
        console.warn(`[support-email-inbound] Follow-up saved on ticket ${ticketId} without a draft (too many follow-ups this hour)`);
        return;
      }
      await handleFollowUp({
        ...base,
        ghlContactId: contactIdFrom(payload) || base.ghlContactId,
        ghlMessageId: messageId,
        fromName: fromName ?? base.fromName,
        toAddress,
        body,
      });
    })());
    return;
  }

  const member = await lookUpMember(fromEmail);
  const tooMany = (await recentTicketCount(fromEmail)) >= MAX_TICKETS_PER_SENDER_PER_HOUR;

  const insert = await sb("support_requests", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      category: "email",
      question: `Subject: ${subject}\n\n${body}`,
      status: "open",
      member_id: member.id,
      member_email: fromEmail,
      member_name: member.name ?? fromName,
      member_tier: member.tier,
      source_address: toAddress,
      ghl_contact_id: contactIdFrom(payload) || null,
      ghl_message_id: messageId,
      dedupe_key: dedupeKey,
    }),
  });

  if (insert.status === 409) {
    console.log(`[support-email-inbound] Skipped repeat of an email already saved (from ${fromEmail}, message ${messageId})`);
    res.status(200).json({ ok: true, duplicate: true });
    return;
  }
  if (!insert.ok) {
    console.error(`[support-email-inbound] Ticket save failed: ${insert.status} ${await insert.text()}`);
    res.status(500).json({ error: "Ticket save failed" });
    return;
  }
  const ticketId = (await insert.json())?.[0]?.id as string | undefined;
  if (!ticketId) { res.status(500).json({ error: "Ticket save returned no id" }); return; }

  res.status(200).json({ ok: true, ticket_id: ticketId, drafting: !tooMany });

  if (tooMany) {
    console.warn(`[support-email-inbound] ${fromEmail} already has ${MAX_TICKETS_PER_SENDER_PER_HOUR}+ tickets this hour — saved without a draft`);
    return;
  }

  waitUntil(handleTicket({
    id: ticketId, ghlContactId: contactIdFrom(payload), ghlMessageId: messageId,
    fromName, fromEmail, toAddress, subject, body,
    memberName: member.name ?? fromName, memberTier: member.tier,
  }));
}
