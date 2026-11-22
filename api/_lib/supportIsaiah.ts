// api/_lib/supportIsaiah.ts
// Shared steps for Isaiah Carter's support email replies (English tickets) and Yara Mansour's (Spanish, French
// and Arabic tickets). Used by api/support-email-inbound.ts
// (an email arrives) and api/support-draft-reply.ts (DeAnna presses "Have Isaiah write it").
// Files that start with an underscore are not served as routes.

import { GENIUS_MODE, VOICE_DNA, getAgentKnowledge, getAgentCorrections } from "./agentKnowledge.js";
import {
  ISAIAH_EMAIL_REPLY_CODE, EMAIL_REPLY_MAX_TOKENS, buildEmailReplyReading,
  ISAIAH_RESET_CHECK_CODE, RESET_CHECK_MAX_TOKENS, buildResetCheckReading,
  ISAIAH_INSTANT_REPLY_CODE, INSTANT_REPLY_MAX_TOKENS, buildInstantReplyReading,
} from "./isaiahEmailReply.js";
import {
  YARA_EMAIL_REPLY_CODE, buildYaraReplyReading, YARA_INSTANT_REPLY_CODE, buildYaraInstantReplyReading,
  YARA_TO_ENGLISH_CODE, buildToEnglishReading, YARA_FROM_ENGLISH_CODE, buildFromEnglishReading,
  YARA_DETECT_LANGUAGE_CODE, buildDetectLanguageReading, TRANSLATION_MAX_TOKENS, DETECT_MAX_TOKENS,
  LANGUAGE_NAMES, isSupportLanguage,
} from "./yaraEmailReply.js";
import type { SupportLanguage } from "./yaraEmailReply.js";
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
  // The language the person wrote in: en, es, fr or ar. English tickets stay with Isaiah, the others go to Yara.
  // Left out, the language is read from the message when the ticket is handled.
  language?: SupportLanguage;
}

export type AgentName = "Isaiah Carter" | "Yara Mansour";

export function agentNameFor(language: SupportLanguage | undefined): AgentName {
  return !language || language === "en" ? "Isaiah Carter" : "Yara Mansour";
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
    language: isSupportLanguage(row.language) ? row.language : "en",
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

// ── Yara's translation steps ──────────────────────────────────────────────────
// Yara translates a person's message into English for DeAnna, and DeAnna's approved English reply into the
// person's language. She also reads which language a new ticket is written in.
function cleanTranslation(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").trim();
}

export async function translateToEnglish(text: string, from: SupportLanguage): Promise<string> {
  const out = cleanTranslation(await callIsaiah(`${YARA_TO_ENGLISH_CODE}\n\n${buildToEnglishReading(text, LANGUAGE_NAMES[from])}`, TRANSLATION_MAX_TOKENS));
  if (!out) throw new Error("Yara returned an empty translation");
  return out;
}

export async function translateFromEnglish(text: string, to: SupportLanguage): Promise<string> {
  const out = cleanTranslation(await callIsaiah(`${YARA_FROM_ENGLISH_CODE}\n\n${buildFromEnglishReading(text, LANGUAGE_NAMES[to])}`, TRANSLATION_MAX_TOKENS));
  if (!out) throw new Error("Yara returned an empty translation");
  return out;
}

// Reads the ticket's language from its message. A ticket whose language cannot be read stays English with Isaiah.
async function detectLanguage(text: string): Promise<SupportLanguage> {
  try {
    const answer = (await callIsaiah(`${YARA_DETECT_LANGUAGE_CODE}\n\n${buildDetectLanguageReading(text)}`, DETECT_MAX_TOKENS)).trim().toLowerCase().slice(0, 2);
    return isSupportLanguage(answer) ? answer : "en";
  } catch (err) {
    console.error("[support] Could not read the ticket's language:", err);
    return "en";
  }
}

// The brand knowledge, voice and saved corrections that open every one of the agent's replies.
export async function loadPreface(agent: AgentName = "Isaiah Carter"): Promise<string> {
  const [knowledge, corrections] = await Promise.all([getAgentKnowledge(), getAgentCorrections(agent)]);
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

// The full reply. An English ticket is answered by Isaiah. For another language, Yara writes the draft in English
// from the English reading of the ticket (t.body is already English), and it is translated after DeAnna approves it.
export async function writeFullReply(t: SupportTicket, preface: string, revision?: ReplyRevision): Promise<string> {
  const language = t.language ?? "en";
  const reading = language === "en"
    ? `${ISAIAH_EMAIL_REPLY_CODE}\n\n${buildEmailReplyReading({
        fromName: t.fromName, fromEmail: t.fromEmail, toAddress: t.toAddress, subject: t.subject, body: t.body,
        memberName: t.memberName, memberTier: t.memberTier, history: t.history,
      })}`
    : `${YARA_EMAIL_REPLY_CODE}\n\n${buildYaraReplyReading({
        fromName: t.fromName, fromEmail: t.fromEmail, toAddress: t.toAddress, subject: t.subject, bodyEnglish: t.body,
        languageName: LANGUAGE_NAMES[language], memberName: t.memberName, memberTier: t.memberTier, history: t.history,
      })}`;
  const prompt = `${preface}\n\n${reading}${revision ? buildRevisionReading(revision) : ""}`;
  const text = cleanTranslation(await callIsaiah(prompt, EMAIL_REPLY_MAX_TOKENS));
  if (!text) throw new Error(`${agentNameFor(language)} returned an empty reply`);
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
// For a ticket in another language, t.body is the English reading and `original` is what the person wrote.
export async function createReplyCard(t: SupportTicket, text: string, kind: "pending" | "sent", correctionNote?: string, original?: string): Promise<void> {
  const language = t.language ?? "en";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Chicago" });
  const sender = t.fromName ? `${t.fromName} <${t.fromEmail}>` : t.fromEmail;
  const res = await sb("approvals", {
    method: "POST",
    body: JSON.stringify({
      source: kind === "sent" ? "support_email_auto" : "support_email",
      trigger_type: kind === "sent" ? "support_email_auto_reply" : "support_email_reply",
      agent_name: agentNameFor(language),
      agent_role: "Customer Support",
      division: "Customer Support",
      task_brief: `Support Reply — ${t.fromName || t.fromEmail} | ${t.subject} | ${today}`,
      original_content: language === "en" || original === undefined
        ? `From: ${sender}\nWritten to: ${t.toAddress}\nSubject: ${t.subject}\n\n${t.body}`
        : `From: ${sender}\nWritten to: ${t.toAddress}\nLanguage: ${LANGUAGE_NAMES[language]}\nSubject: ${t.subject}\n\n${original}\n\n--- Yara's English translation ---\n${t.body}`,
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
        language,
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
export type MessageDirection = "client" | "isaiah" | "yara" | "deanna";

export async function recordMessage(
  ticketId: string, direction: MessageDirection, body: string,
  opts?: { ghlMessageId?: string; dedupeKey?: string; bodyEn?: string },
): Promise<"saved" | "duplicate" | "failed"> {
  try {
    const res = await sb("ticket_messages", {
      method: "POST",
      body: JSON.stringify({
        ticket_id: ticketId, direction, body: body.slice(0, 20000),
        ghl_message_id: opts?.ghlMessageId || null, dedupe_key: opts?.dedupeKey || null,
        body_en: opts?.bodyEn ? opts.bodyEn.slice(0, 20000) : null,
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

const HISTORY_LABEL: Record<string, string> = { client: "The client wrote", isaiah: "Isaiah Carter replied", yara: "Yara Mansour replied", deanna: "DeAnna replied" };
const HISTORY_ENTRY_CHARS = 1500;
const HISTORY_TOTAL_CHARS = 6000;

// Reads the whole conversation and splits it: the client's latest message (the one to answer) and
// everything else, in order, as a block of earlier messages. A ticket with no saved messages beyond
// its first one answers that first message with no earlier messages.
// For a ticket in another language, Yara translates the client's latest message into English (saved on the
// ticket so it is translated once) and the earlier messages are read in English where a translation is saved.
// latestOriginal is what the person wrote.
export async function loadConversation(t: SupportTicket): Promise<{ latest: string; latestOriginal: string; history: string }> {
  const language = t.language ?? "en";
  try {
    const [qRes, mRes] = await Promise.all([
      sb(`support_requests?id=eq.${t.id}&select=question,question_en&limit=1`),
      sb(`ticket_messages?ticket_id=eq.${t.id}&select=id,direction,body,body_en&order=created_at.asc&limit=200`),
    ]);
    if (!qRes.ok || !mRes.ok) return { latest: t.body, latestOriginal: t.body, history: "" };
    const qRow = (await qRes.json())?.[0] ?? {};
    const question = String(qRow.question ?? "");
    const rows = (await mRes.json()) as { id: string; direction: MessageDirection; body: string; body_en: string | null }[];
    const m = question.match(/^Subject:\s*(.*)\n/);
    const opening = (m ? question.slice(m[0].length) : question).trim() || t.body;
    const items: { id: string | null; direction: MessageDirection; body: string; bodyEn: string | null }[] = [
      { id: null, direction: "client", body: opening, bodyEn: (qRow.question_en as string | null) ?? null },
      ...rows.map((r) => ({ id: r.id, direction: r.direction, body: r.body, bodyEn: r.body_en })),
    ];
    let latestIdx = 0;
    items.forEach((it, i) => { if (it.direction === "client") latestIdx = i; });

    const latestOriginal = items[latestIdx].body.trim() || t.body;
    let latest = latestOriginal;
    if (language !== "en") {
      let english = items[latestIdx].bodyEn?.trim() ?? "";
      if (!english) {
        english = await translateToEnglish(latestOriginal, language);
        const target = items[latestIdx].id === null
          ? sb(`support_requests?id=eq.${t.id}`, { method: "PATCH", body: JSON.stringify({ question_en: english }) })
          : sb(`ticket_messages?id=eq.${items[latestIdx].id}`, { method: "PATCH", body: JSON.stringify({ body_en: english }) });
        await target.catch(() => {});
      }
      latest = english;
    }

    const earlier = items.filter((_, i) => i !== latestIdx).map((it) => {
      const text = language !== "en" && it.bodyEn ? it.bodyEn : it.body;
      return `${HISTORY_LABEL[it.direction] ?? it.direction}:\n${text.trim().slice(0, HISTORY_ENTRY_CHARS)}`;
    });
    const kept: string[] = [];
    let total = 0;
    for (let i = earlier.length - 1; i >= 0; i--) {
      if (total + earlier[i].length > HISTORY_TOTAL_CHARS && kept.length > 0) break;
      kept.unshift(earlier[i]);
      total += earlier[i].length;
    }
    return { latest, latestOriginal, history: kept.join("\n\n") };
  } catch (err) {
    console.error(`[support] Could not read the conversation for ticket ${t.id}:`, err);
    return { latest: t.body, latestOriginal: t.body, history: "" };
  }
}

// The agent writes the full reply and it waits in Waiting on you. Returns false when the daily spend cap stops it.
// A correctionNote (DeAnna's corrective feedback on the earlier draft) marks the new draft as the agent's correction.
// Isaiah answers English tickets. Yara answers the others: she reads the English translation and writes the draft in English.
export async function draftReplyForReview(t: SupportTicket, preface: string, correctionNote?: string, previousDraft?: string): Promise<boolean> {
  const spend = await checkAndReserveSpend();
  if (!spend.ok) return false;
  const revision = correctionNote && previousDraft ? { previousDraft, feedback: correctionNote } : undefined;
  // The agent reads the whole conversation and answers the client's latest message.
  const convo = await loadConversation(t);
  const reading: SupportTicket = { ...t, body: convo.latest, history: convo.history };
  const draft = await writeFullReply(reading, preface, revision);
  await createReplyCard(reading, draft, "pending", correctionNote, convo.latestOriginal);
  await setTicketStatus(t.id, "awaiting_approval");
  return true;
}

// A client answered an email thread that already has a ticket. The ticket's agent (Isaiah, or Yara for another
// language) drafts the next reply from the whole conversation and it waits on DeAnna. No instant reply goes out
// for a follow-up. When the draft cannot be written (spend cap or an error), the ticket returns to "open" so it
// shows as waiting with no reply drafted.
export async function handleFollowUp(t: SupportTicket): Promise<void> {
  try {
    const preface = await loadPreface(agentNameFor(t.language));
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

// The direction a sent agent message is saved under.
function directionFor(language: SupportLanguage | undefined): MessageDirection {
  return !language || language === "en" ? "isaiah" : "yara";
}

// Password reset emails: the agent writes the reply and it goes out right away. The ticket moves to Replied.
// For another language, Yara writes the reply in English and translates it into the person's language before it is sent.
// When the send does not go through, the reply waits in Waiting on you instead. Returns false when the
// daily spend cap stops it (the caller then follows the usual path).
export async function autoReplyToPasswordReset(t: SupportTicket, preface: string): Promise<boolean> {
  const spend = await checkAndReserveSpend();
  if (!spend.ok) return false;
  const language = t.language ?? "en";
  // For another language the reading is the English translation, and the card keeps what the person wrote.
  const original = t.body;
  const reading: SupportTicket = language === "en" ? t : { ...t, body: await translateToEnglish(t.body, language) };
  const english = await writeFullReply(reading, preface);
  const text = language === "en" ? english : await translateFromEnglish(english, language);
  const unexpected = unexpectedAddresses(text);
  if (unexpected.length > 0) {
    // A misspelled or unknown web address must not reach a customer on its own: the reply waits for DeAnna.
    console.warn(`[support] Password reset reply held for ticket ${t.id}: unexpected web address ${unexpected.join(", ")}`);
    await createReplyCard(reading, english, "pending", undefined, original);
    await setTicketStatus(t.id, "awaiting_approval");
    return true;
  }
  const sent = await sendToSender(t, text);
  if (sent.ok) {
    try { await createReplyCard(reading, english, "sent", undefined, original); } catch (err) { console.error(`[support] Auto-reply record failed for ticket ${t.id}:`, err); }
    await recordMessage(t.id, directionFor(language), text, language === "en" ? undefined : { bodyEn: english });
    await setTicketStatus(t.id, "replied");
    console.log(`[support] Password reset reply sent from ${t.toAddress} for ticket ${t.id}`);
  } else {
    console.error(`[support] Password reset reply not sent for ticket ${t.id}: ${sent.detail}`);
    await createReplyCard(reading, english, "pending", undefined, original);
    await setTicketStatus(t.id, "awaiting_approval");
  }
  return true;
}

// The instant reply: a short thank-you sent right away so the person knows their message arrived.
// Isaiah writes it in English. Yara writes it in the person's language.
// A failure here is logged and never stops the full reply from being drafted.
async function sendInstantReply(t: SupportTicket, preface: string): Promise<void> {
  try {
    const language = t.language ?? "en";
    const prompt = language === "en"
      ? `${preface}\n\n${ISAIAH_INSTANT_REPLY_CODE}\n\n${buildInstantReplyReading({ fromName: t.fromName, subject: t.subject, body: t.body })}`
      : `${preface}\n\n${YARA_INSTANT_REPLY_CODE}\n\n${buildYaraInstantReplyReading({ fromName: t.fromName, subject: t.subject, body: t.body }, LANGUAGE_NAMES[language])}`;
    const text = await callIsaiah(prompt, language === "en" ? INSTANT_REPLY_MAX_TOKENS : TRANSLATION_MAX_TOKENS);
    if (!text) throw new Error(`${agentNameFor(language)} returned an empty instant reply`);
    const sent = await sendToSender(t, text);
    if (!sent.ok) throw new Error(sent.detail);
    await recordMessage(t.id, directionFor(language), text);
    console.log(`[support] Instant reply sent from ${t.toAddress} for ticket ${t.id}`);
  } catch (err) {
    console.error(`[support] Instant reply failed for ticket ${t.id}:`, err);
  }
}

// Runs for every new ticket, from an email (api/support-email-inbound.ts), the Support Hub
// (api/support-hub-submit.ts) or the website chat (api/chat-agent.ts), after the request has been answered.
// English tickets go to Isaiah. Spanish, French and Arabic tickets go to Yara. A ticket that arrives without a
// language has its language read from the message and saved on the ticket.
export async function handleTicket(input: SupportTicket): Promise<void> {
  let t = input;
  if (!t.language) {
    const language = await detectLanguage(`${t.subject}\n${t.body}`);
    t = { ...t, language };
    if (language !== "en") await sb(`support_requests?id=eq.${t.id}`, { method: "PATCH", body: JSON.stringify({ language }) }).catch(() => {});
  }
  let preface = "";
  try {
    preface = await loadPreface(agentNameFor(t.language));
  } catch (err) {
    console.error(`[support] Could not load ${agentNameFor(t.language)}'s knowledge for ticket ${t.id}:`, err);
    return;
  }

  // Password reset requests get the agent's reply right away, in place of the instant reply.
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
