// api/support-email-inbound.ts
// Receives each email sent to support@support.druaiconsulting.com or info@info.druaiconsulting.com.
// GHL's Inbound Email workflow posts the email here. This endpoint:
//   1. checks the shared secret (x-support-key) so only GHL can post here
//   2. skips mail from our own addresses, mailer robots and auto-replies
//   3. saves the email as a ticket in support_requests (a repeated message id is saved once)
//   4. has Isaiah Carter draft the reply, then sends it through the same review chain as every
//      other on-demand agent (Isabella → Governance → Pipeline Review → a "Support Reply" card
//      in the Approvals page). Nothing is sent to the customer until DeAnna approves the card.
// If the review chain cannot start (daily spend cap reached, or another chain is still running),
// the ticket stays "open" and Isaiah's daily support report lists it.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { waitUntil } from "@vercel/functions";
import { timingSafeEqual } from "node:crypto";
import { GENIUS_MODE, VOICE_DNA, getAgentKnowledge, getAgentCorrections } from "./_lib/agentKnowledge.js";
import { ISAIAH_EMAIL_REPLY_CODE, EMAIL_REPLY_MAX_TOKENS, buildEmailReplyReading } from "./_lib/isaiahEmailReply.js";
import { acquireLockWithRetries, releaseLock, checkAndReserveSpend } from "./_lib/onDemandGuards.js";

export const config = { maxDuration: 300 };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BASE_URL = "https://app.druaiconsulting.com";

const ALLOWED_ADDRESSES = ["support@support.druaiconsulting.com", "info@info.druaiconsulting.com"];
const OWN_DOMAINS = ["support.druaiconsulting.com", "info.druaiconsulting.com", "noreply.druaiconsulting.com"];
const MAX_TICKETS_PER_SENDER_PER_HOUR = 3;
const MAX_BODY_CHARS = 8000;

const sbHeaders = { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

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

async function sb(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...sbHeaders, ...(init?.headers ?? {}) } });
}

async function logUsage(model: string, inputTokens: number, outputTokens: number, durationMs: number): Promise<void> {
  const rate = model.startsWith("claude-sonnet-5") ? { in: 2, out: 10 } : model.startsWith("claude-sonnet") ? { in: 3, out: 15 } : { in: 1, out: 5 };
  const cost_usd = (inputTokens / 1_000_000) * rate.in + (outputTokens / 1_000_000) * rate.out;
  await sb("model_usage_log", { method: "POST", body: JSON.stringify({ source_file: "support-email-inbound", model, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd, duration_ms: durationMs }) }).catch(() => {});
}

async function callIsaiah(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const model = "claude-haiku-4-5-20251001";
  const startedAt = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: EMAIL_REPLY_MAX_TOKENS, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const data = await res.json();
  await logUsage(model, data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0, Date.now() - startedAt);
  return String(data.content?.[0]?.text ?? "").trim();
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

interface Ticket {
  id: string;
  fromName: string | null;
  fromEmail: string;
  toAddress: string;
  subject: string;
  body: string;
  memberName: string | null;
  memberTier: string | null;
}

// Isaiah drafts the reply, then the review chain takes over. Returns quietly on any gate
// that stops the draft; the ticket stays "open" for Isaiah's daily report in that case.
async function draftAndSendToReview(t: Ticket): Promise<void> {
  const spend = await checkAndReserveSpend();
  if (!spend.ok) {
    console.warn(`[support-email-inbound] Daily spend cap reached — ticket ${t.id} stays open for the daily report`);
    return;
  }
  const gotLock = await acquireLockWithRetries("Isaiah Carter (support email)", 5, 15000);
  if (!gotLock) {
    console.warn(`[support-email-inbound] Another chain is still running — ticket ${t.id} stays open for the daily report`);
    return;
  }

  let chainFired = false;
  try {
    const [knowledge, corrections] = await Promise.all([getAgentKnowledge(), getAgentCorrections("Isaiah Carter")]);
    const prompt = `${GENIUS_MODE}\n\n${knowledge}\n\n${VOICE_DNA}${corrections}\n\n${ISAIAH_EMAIL_REPLY_CODE}\n\n${buildEmailReplyReading({
      fromName: t.fromName, fromEmail: t.fromEmail, toAddress: t.toAddress, subject: t.subject, body: t.body,
      memberName: t.memberName, memberTier: t.memberTier,
    })}`;
    const draft = await callIsaiah(prompt);
    if (!draft) throw new Error("Isaiah returned an empty draft");

    const csqRes = await sb("chief_of_staff_queue", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        agent_id: "isaiah",
        agent_name: "Isaiah Carter",
        division: "Customer Support",
        task: "support_email_reply",
        category: "issue_resolution",
        raw_output: draft,
        priority: "high",
        status: "pending",
        retry_count: 0,
        context: t.id,
        raymond_notes: `Email reply draft for support ticket ${t.id}`,
      }),
    });
    if (!csqRes.ok) throw new Error(`CSQ write failed: ${csqRes.status} ${await csqRes.text()}`);
    const csqId = (await csqRes.json())?.[0]?.id as string | undefined;
    if (!csqId) throw new Error("CSQ write returned no id");

    // The chain releases the lock on every exit once it starts.
    chainFired = true;
    const chainRes = await fetch(`${BASE_URL}/api/process-on-demand`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": process.env.CRON_SECRET ?? "" },
      body: JSON.stringify({ csq_id: csqId }),
    }).catch((err) => { chainFired = false; throw err; });
    console.log(`[support-email-inbound] review chain responded ${chainRes.status} for ticket ${t.id}`);
  } catch (err) {
    console.error(`[support-email-inbound] draft failed for ticket ${t.id}:`, err);
    if (!chainFired) await releaseLock();
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
    }),
  });

  if (insert.status === 409) {
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

  waitUntil(draftAndSendToReview({
    id: ticketId, fromName, fromEmail, toAddress, subject, body,
    memberName: member.name ?? fromName, memberTier: member.tier,
  }));
}
