// api/_lib/supportIsaiah.ts
// Shared steps for Isaiah Carter's support email replies. Used by api/support-email-inbound.ts
// (an email arrives) and api/support-draft-reply.ts (DeAnna presses "Have Isaiah write it").
// Files that start with an underscore are not served as routes.

import { GENIUS_MODE, VOICE_DNA, getAgentKnowledge, getAgentCorrections } from "./agentKnowledge.js";
import {
  ISAIAH_EMAIL_REPLY_CODE, EMAIL_REPLY_MAX_TOKENS, buildEmailReplyReading,
  ISAIAH_RESET_CHECK_CODE, RESET_CHECK_MAX_TOKENS, buildResetCheckReading,
  ISAIAH_INSTANT_REPLY_CODE, INSTANT_REPLY_MAX_TOKENS, buildInstantReplyReading,
} from "./isaiahEmailReply.js";
import { sendSupportEmail } from "./ghlSupportSend.js";
import { checkAndReserveSpend } from "./onDemandGuards.js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const sbHeaders = { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

export async function sb(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...sbHeaders, ...(init?.headers ?? {}) } });
}

export interface SupportTicket {
  id: string;
  ghlContactId: string;
  ghlMessageId: string;
  fromName: string | null;
  fromEmail: string;
  toAddress: string;
  subject: string;
  body: string;
  memberName: string | null;
  memberTier: string | null;
  // The earlier messages of the conversation, when there are any. Filled in when Isaiah drafts a reply.
  history?: string;
}

// Builds a SupportTicket from a support_requests row (the question column holds "Subject: ...\n\nbody").
export function ticketFromRow(row: Record<string, unknown>): SupportTicket {
  const question = String(row.question ?? "");
  const m = question.match(/^Subject:\s*(.*)\n/);
  return {
    id: String(row.id),
    ghlContactId: String(row.ghl_contact_id ?? ""),
    ghlMessageId: String(row.ghl_message_id ?? ""),
    fromName: (row.member_name as string | null) ?? null,
    fromEmail: String(row.member_email ?? ""),
    toAddress: String(row.source_address ?? ""),
    subject: (m?.[1] ?? "").trim() || "(no subject)",
    body: (m ? question.slice(m[0].length) : question).trim(),
    memberName: (row.member_name as string | null) ?? null,
    memberTier: (row.member_tier as string | null) ?? null,
  };
}

async function logUsage(model: string, inputTokens: number, outputTokens: number, durationMs: number): Promise<void> {
  const rate = model.startsWith("claude-sonnet-5") ? { in: 2, out: 10 } : model.startsWith("claude-sonnet") ? { in: 3, out: 15 } : { in: 1, out: 5 };
  const cost_usd = (inputTokens / 1_000_000) * rate.in + (outputTokens / 1_000_000) * rate.out;
  await sb("model_usage_log", { method: "POST", body: JSON.stringify({ source_file: "support-email-inbound", model, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd, duration_ms: durationMs }) }).catch(() => {});
}

export async function callIsaiah(prompt: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const model = "claude-haiku-4-5-20251001";
  const startedAt = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`Anthropic error ${res.status}: ${detail}`);
  }
  const data = await res.json();
  await logUsage(model, data.usage?.input_tokens ?? 0, data.usage?.output_tokens ?? 0, Date.now() - startedAt);
  return String(data.content?.[0]?.text ?? "").trim();
}

// The brand knowledge, voice and saved corrections that open every one of Isaiah's replies.
export async function loadPreface(): Promise<string> {
  const [knowledge, corrections] = await Promise.all([getAgentKnowledge(), getAgentCorrections("Isaiah Carter")]);
  return `${GENIUS_MODE}\n\n${knowledge}\n\n${VOICE_DNA}${corrections}`;
}

// Isaiah answers yes or no: is this email asking how to reset a password?
export async function isPasswordResetEmail(t: SupportTicket): Promise<boolean> {
  const answer = await callIsaiah(`${ISAIAH_RESET_CHECK_CODE}\n\n${buildResetCheckReading({ subject: t.subject, body: t.body })}`, RESET_CHECK_MAX_TOKENS);
  return /^\s*yes\b/i.test(answer);
}

// A revision carries Isaiah's earlier draft and DeAnna's corrective feedback on it. They sit at the end
// of what he reads, so he rewrites that draft to follow her feedback exactly.
export interface ReplyRevision { previousDraft: string; feedback: string }

export function buildRevisionReading(r: ReplyRevision): string {
  return `\n\nYour earlier draft of this reply:\n${r.previousDraft}\n\nDeAnna's corrective feedback on that draft:\n${r.feedback}\n\nWrite the reply again. Apply DeAnna's corrective feedback exactly as she wrote it, and keep the rest of your earlier draft as it is.`;
}

export async function writeFullReply(t: SupportTicket, preface: string, revision?: ReplyRevision): Promise<string> {
  const prompt = `${preface}\n\n${ISAIAH_EMAIL_REPLY_CODE}\n\n${buildEmailReplyReading({
    fromName: t.fromName, fromEmail: t.fromEmail, toAddress: t.toAddress, subject: t.subject, body: t.body,
    memberName: t.memberName, memberTier: t.memberTier, history: t.history,
  })}${revision ? buildRevisionReading(revision) : ""}`;
  const text = (await callIsaiah(prompt, EMAIL_REPLY_MAX_TOKENS)).replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").trim();
  if (!text) throw new Error("Isaiah returned an empty reply");
  return text;
}

// Sends text to the person from the address they wrote to (support@ or info@), through the GHL workflow
// for that address. It never falls back to another address: a failed send is reported to the caller.
export async function sendToSender(t: SupportTicket, text: string): Promise<{ ok: boolean; detail: string }> {
  const result = await sendSupportEmail({ toEmail: t.fromEmail, fromAddress: t.toAddress, originalSubject: t.subject, replyText: text });
  return { ok: result.ok, detail: result.ok ? "sent" : `Send failed (${result.status || "no answer"}): ${result.detail}` };
}

// Writes a "Support Reply" card for the ticket. "pending" waits on DeAnna; "sent" records a reply
// that already went out (Isaiah's automatic password reset reply).
export async function createReplyCard(t: SupportTicket, text: string, kind: "pending" | "sent", correctionNote?: string): Promise<void> {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Chicago" });
  const sender = t.fromName ? `${t.fromName} <${t.fromEmail}>` : t.fromEmail;
  const res = await sb("approvals", {
    method: "POST",
    body: JSON.stringify({
      source: kind === "sent" ? "support_email_auto" : "support_email",
      trigger_type: kind === "sent" ? "support_email_auto_reply" : "support_email_reply",
      agent_name: "Isaiah Carter",
      agent_role: "Customer Support",
      division: "Customer Support",
      task_brief: `Support Reply — ${t.fromName || t.fromEmail} | ${t.subject} | ${today}`,
      original_content: `From: ${sender}\nWritten to: ${t.toAddress}\nSubject: ${t.subject}\n\n${t.body}`,
      output: text,
      status: kind === "sent" ? "approved" : "pending",
      notify_deanna: kind === "pending",
      priority: "high",
      category: "support_reply",
      platform: null,
      title: t.subject,
      ghl_contact_id: t.ghlContactId || null,
      context: JSON.stringify({
        support_request_id: t.id,
        from_email: t.fromEmail,
        to_address: t.toAddress,
        subject: t.subject,
        ghl_contact_id: t.ghlContactId || null,
        ghl_message_id: t.ghlMessageId || null,
        correction_note: correctionNote || null,
      }),
    }),
  });
  if (!res.ok) throw new Error(`Approvals write failed: ${res.status} ${await res.text()}`);
}

export async function setTicketStatus(ticketId: string, status: string): Promise<void> {
  await sb(`support_requests?id=eq.${ticketId}`, { method: "PATCH", body: JSON.stringify({ status }) });
}

// ── The conversation inside a ticket ──────────────────────────────────────────
// The ticket's first message is kept in support_requests.question. Every message after it
// (the client's follow-ups, Isaiah's replies, DeAnna's replies) is a row in ticket_messages.
export type MessageDirection = "client" | "isaiah" | "deanna";

export async function recordMessage(
  ticketId: string, direction: MessageDirection, body: string,
  opts?: { ghlMessageId?: string; dedupeKey?: string },
): Promise<"saved" | "duplicate" | "failed"> {
  try {
    const res = await sb("ticket_messages", {
      method: "POST",
      body: JSON.stringify({
        ticket_id: ticketId, direction, body: body.slice(0, 20000),
        ghl_message_id: opts?.ghlMessageId || null, dedupe_key: opts?.dedupeKey || null,
      }),
    });
    if (res.status === 409) return "duplicate";
    if (!res.ok) {
      console.error(`[support] Could not save a ${direction} message on ticket ${ticketId}: ${res.status} ${await res.text()}`);
      return "failed";
    }
    return "saved";
  } catch (err) {
    console.error(`[support] Could not save a ${direction} message on ticket ${ticketId}:`, err);
    return "failed";
  }
}

const HISTORY_LABEL: Record<string, string> = { client: "The client wrote", isaiah: "Isaiah Carter replied", deanna: "DeAnna replied" };
const HISTORY_ENTRY_CHARS = 1500;
const HISTORY_TOTAL_CHARS = 6000;

// Reads the whole conversation and splits it: the client's latest message (the one to answer) and
// everything else, in order, as a block of earlier messages. A ticket with no saved messages beyond
// its first one answers that first message with no earlier messages.
export async function loadConversation(t: SupportTicket): Promise<{ latest: string; history: string }> {
  try {
    const [qRes, mRes] = await Promise.all([
      sb(`support_requests?id=eq.${t.id}&select=question&limit=1`),
      sb(`ticket_messages?ticket_id=eq.${t.id}&select=direction,body&order=created_at.asc&limit=200`),
    ]);
    if (!qRes.ok || !mRes.ok) return { latest: t.body, history: "" };
    const question = String((await qRes.json())?.[0]?.question ?? "");
    const rows = (await mRes.json()) as { direction: MessageDirection; body: string }[];
    const m = question.match(/^Subject:\s*(.*)\n/);
    const opening = (m ? question.slice(m[0].length) : question).trim() || t.body;
    const items: { direction: MessageDirection; body: string }[] = [{ direction: "client", body: opening }, ...rows];
    let latestIdx = 0;
    items.forEach((it, i) => { if (it.direction === "client") latestIdx = i; });
    const earlier = items.filter((_, i) => i !== latestIdx).map((it) => `${HISTORY_LABEL[it.direction] ?? it.direction}:\n${it.body.trim().slice(0, HISTORY_ENTRY_CHARS)}`);
    const kept: string[] = [];
    let total = 0;
    for (let i = earlier.length - 1; i >= 0; i--) {
      if (total + earlier[i].length > HISTORY_TOTAL_CHARS && kept.length > 0) break;
      kept.unshift(earlier[i]);
      total += earlier[i].length;
    }
    return { latest: items[latestIdx].body.trim() || t.body, history: kept.join("\n\n") };
  } catch (err) {
    console.error(`[support] Could not read the conversation for ticket ${t.id}:`, err);
    return { latest: t.body, history: "" };
  }
}

// Isaiah writes the full reply and it waits in Waiting on you. Returns false when the daily spend cap stops it.
// A correctionNote (DeAnna's corrective feedback on his earlier draft) marks the new draft as his correction.
export async function draftReplyForReview(t: SupportTicket, preface: string, correctionNote?: string, previousDraft?: string): Promise<boolean> {
  const spend = await checkAndReserveSpend();
  if (!spend.ok) return false;
  const revision = correctionNote && previousDraft ? { previousDraft, feedback: correctionNote } : undefined;
  // Isaiah reads the whole conversation and answers the client's latest message.
  const convo = await loadConversation(t);
  const reading: SupportTicket = { ...t, body: convo.latest, history: convo.history };
  const draft = await writeFullReply(reading, preface, revision);
  await createReplyCard(reading, draft, "pending", correctionNote);
  await setTicketStatus(t.id, "awaiting_approval");
  return true;
}

// A client answered an email thread that already has a ticket. Isaiah drafts his next reply from the whole
// conversation and it waits on DeAnna. No instant reply goes out for a follow-up. When the draft cannot be
// written (spend cap or an error), the ticket returns to "open" so it shows as waiting with no reply drafted.
export async function handleFollowUp(t: SupportTicket): Promise<void> {
  try {
    const preface = await loadPreface();
    if (!(await draftReplyForReview(t, preface))) {
      console.warn(`[support] Daily spend cap reached — follow-up on ticket ${t.id} stays open for the daily report`);
      await setTicketStatus(t.id, "open");
    }
  } catch (err) {
    console.error(`[support] Follow-up draft failed for ticket ${t.id}:`, err);
    await setTicketStatus(t.id, "open");
  }
}

// The only web address an automatic reply may carry.
const ALLOWED_ADDRESSES_IN_AUTO_REPLY = ["members.druaiconsulting.com"];

// Returns every web or email address in the text that is not on the allowed list (a misspelling counts).
export function unexpectedAddresses(text: string): string[] {
  const found = text.match(/[a-z0-9][a-z0-9._-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,24}\b/gi) ?? [];
  const bad = found
    .map((a) => a.toLowerCase().replace(/^www\./, ""))
    .filter((a) => !ALLOWED_ADDRESSES_IN_AUTO_REPLY.includes(a));
  return Array.from(new Set(bad));
}

// Password reset emails: Isaiah writes the reply and it goes out right away. The ticket moves to Replied.
// When the send does not go through, the reply waits in Waiting on you instead. Returns false when the
// daily spend cap stops it (the caller then follows the usual path).
export async function autoReplyToPasswordReset(t: SupportTicket, preface: string): Promise<boolean> {
  const spend = await checkAndReserveSpend();
  if (!spend.ok) return false;
  const text = await writeFullReply(t, preface);
  const unexpected = unexpectedAddresses(text);
  if (unexpected.length > 0) {
    // A misspelled or unknown web address must not reach a customer on its own: the reply waits for DeAnna.
    console.warn(`[support] Password reset reply held for ticket ${t.id}: unexpected web address ${unexpected.join(", ")}`);
    await createReplyCard(t, text, "pending");
    await setTicketStatus(t.id, "awaiting_approval");
    return true;
  }
  const sent = await sendToSender(t, text);
  if (sent.ok) {
    try { await createReplyCard(t, text, "sent"); } catch (err) { console.error(`[support] Auto-reply record failed for ticket ${t.id}:`, err); }
    await recordMessage(t.id, "isaiah", text);
    await setTicketStatus(t.id, "replied");
    console.log(`[support] Password reset reply sent from ${t.toAddress} for ticket ${t.id}`);
  } else {
    console.error(`[support] Password reset reply not sent for ticket ${t.id}: ${sent.detail}`);
    await createReplyCard(t, text, "pending");
    await setTicketStatus(t.id, "awaiting_approval");
  }
  return true;
}

// Isaiah's instant reply: a short thank-you sent right away so the person knows their message arrived.
// A failure here is logged and never stops the full reply from being drafted.
async function sendInstantReply(t: SupportTicket, preface: string): Promise<void> {
  try {
    const text = await callIsaiah(`${preface}\n\n${ISAIAH_INSTANT_REPLY_CODE}\n\n${buildInstantReplyReading({ fromName: t.fromName, subject: t.subject, body: t.body })}`, INSTANT_REPLY_MAX_TOKENS);
    if (!text) throw new Error("Isaiah returned an empty instant reply");
    const sent = await sendToSender(t, text);
    if (!sent.ok) throw new Error(sent.detail);
    await recordMessage(t.id, "isaiah", text);
    console.log(`[support] Instant reply sent from ${t.toAddress} for ticket ${t.id}`);
  } catch (err) {
    console.error(`[support] Instant reply failed for ticket ${t.id}:`, err);
  }
}

// Runs for every new ticket, from an email (api/support-email-inbound.ts) or the Support Hub
// (api/support-hub-submit.ts), after the request has been answered.
export async function handleTicket(t: SupportTicket): Promise<void> {
  let preface = "";
  try {
    preface = await loadPreface();
  } catch (err) {
    console.error(`[support] Could not load Isaiah's knowledge for ticket ${t.id}:`, err);
    return;
  }

  // Password reset requests get Isaiah's reply right away, in place of the instant reply.
  try {
    if (await isPasswordResetEmail(t)) {
      if (await autoReplyToPasswordReset(t, preface)) return;
    }
  } catch (err) {
    console.error(`[support] Password reset reply failed for ticket ${t.id}:`, err);
  }

  await sendInstantReply(t, preface);
  try {
    if (!(await draftReplyForReview(t, preface))) {
      console.warn(`[support] Daily spend cap reached — ticket ${t.id} stays open for the daily report`);
    }
  } catch (err) {
    console.error(`[support] draft failed for ticket ${t.id}:`, err);
  }
}
