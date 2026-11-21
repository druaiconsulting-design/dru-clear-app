// api/support-email-inbound.ts
// Receives each email sent to support@support.druaiconsulting.com or info@info.druaiconsulting.com.
// GHL's Inbound Email workflow posts the email here. This endpoint:
//   1. checks the shared secret (x-support-key) so only GHL can post here
//   2. skips mail from our own addresses, mailer robots and auto-replies
//   3. saves the email as a ticket in support_requests (the same email posted twice is saved once; a follow-up in the same thread is a new ticket)
//   4. password reset emails: Isaiah Carter replies right away with the real reset steps (no approval)
//      and the ticket moves to Replied. Every other email gets Isaiah's instant reply (a short thank-you
//      that says a reply follows within 24 hours), sent from the address they wrote to, in the same conversation.
//   5. every other email: Isaiah drafts the full reply and it waits on the Support Tickets page for DeAnna.
//      Nothing more is sent to the customer until she approves it.
// If the daily spend cap is reached, the ticket stays "open" and Isaiah's daily support report lists it.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { waitUntil } from "@vercel/functions";
import { createHash, timingSafeEqual } from "node:crypto";
import { ISAIAH_INSTANT_REPLY_CODE, INSTANT_REPLY_MAX_TOKENS, buildInstantReplyReading } from "./_lib/isaiahEmailReply.js";
import {
  sb, callIsaiah, loadPreface, isPasswordResetEmail, autoReplyToPasswordReset,
  draftReplyForReview, sendToSender, type SupportTicket,
} from "./_lib/supportIsaiah.js";

export const config = { maxDuration: 300 };


const ALLOWED_ADDRESSES = ["support@support.druaiconsulting.com", "info@info.druaiconsulting.com"];
const OWN_DOMAINS = ["support.druaiconsulting.com", "info.druaiconsulting.com", "noreply.druaiconsulting.com"];
const MAX_TICKETS_PER_SENDER_PER_HOUR = 3;
const MAX_BODY_CHARS = 8000;

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

// Isaiah's instant reply: a short thank-you sent right away so the person knows their email arrived.
// A failure here is logged and never stops the full reply from being drafted.
async function sendInstantReply(t: SupportTicket, preface: string): Promise<void> {
  try {
    const text = await callIsaiah(`${preface}\n\n${ISAIAH_INSTANT_REPLY_CODE}\n\n${buildInstantReplyReading({ fromName: t.fromName, subject: t.subject, body: t.body })}`, INSTANT_REPLY_MAX_TOKENS);
    if (!text) throw new Error("Isaiah returned an empty instant reply");
    const sent = await sendToSender(t, text);
    if (!sent.ok) throw new Error(sent.detail);
    console.log(`[support-email-inbound] Instant reply sent from ${t.toAddress} for ticket ${t.id}`);
  } catch (err) {
    console.error(`[support-email-inbound] Instant reply failed for ticket ${t.id}:`, err);
  }
}

// Runs after the webhook has been answered.
async function handleTicket(t: SupportTicket): Promise<void> {
  let preface = "";
  try {
    preface = await loadPreface();
  } catch (err) {
    console.error(`[support-email-inbound] Could not load Isaiah's knowledge for ticket ${t.id}:`, err);
    return;
  }

  // Password reset emails get Isaiah's reply right away, in place of the instant reply.
  try {
    if (await isPasswordResetEmail(t)) {
      if (await autoReplyToPasswordReset(t, preface)) return;
    }
  } catch (err) {
    console.error(`[support-email-inbound] Password reset reply failed for ticket ${t.id}:`, err);
  }

  await sendInstantReply(t, preface);
  try {
    if (!(await draftReplyForReview(t, preface))) {
      console.warn(`[support-email-inbound] Daily spend cap reached — ticket ${t.id} stays open for the daily report`);
    }
  } catch (err) {
    console.error(`[support-email-inbound] draft failed for ticket ${t.id}:`, err);
  }
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
