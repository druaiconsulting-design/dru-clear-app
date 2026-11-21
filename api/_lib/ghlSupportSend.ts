// api/_lib/ghlSupportSend.ts
// Sends an email through GHL's Conversations API into the sender's existing conversation, from the
// support address the person wrote to. Used by the instant reply (api/support-email-inbound.ts) and by
// the approved reply (api/ghl-support-reply-dispatch.ts). Uses GHL_PRIVATE_INTEGRATIONS_KEY (plural).

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";
const GHL_LOCATION_ID = "gl07I4JnbkGgW8zJprSz";

export const SUPPORT_FROM_ADDRESSES = ["support@support.druaiconsulting.com", "info@info.druaiconsulting.com"];

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function toHtml(text: string): string {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const body = paragraphs.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("\n");
  return `<div style="font-family: Georgia, serif; font-size: 15px; line-height: 1.6; color: #0A2342;">${body}</div>`;
}

export async function findContactIdByEmail(email: string, apiKey: string): Promise<string | null> {
  const res = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
    body: JSON.stringify({ locationId: GHL_LOCATION_ID, email }),
  });
  if (!res.ok) { console.error(`[ghlSupportSend] Contact lookup failed: ${res.status} ${await res.text()}`); return null; }
  const data = await res.json();
  return data?.contact?.id ?? null;
}

async function post(payload: Record<string, unknown>, apiKey: string): Promise<{ ok: boolean; status: number; detail: string }> {
  const res = await fetch(`${GHL_API_BASE}/conversations/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, status: res.status, detail: res.ok ? "" : await res.text() };
}

export interface SupportEmail {
  contactId: string;
  fromAddress: string;
  originalSubject: string;
  replyText: string;
  replyToMessageId?: string | null;
}

// First try replying to the customer's own message so GHL threads it; when GHL does not accept that
// reference, send again from the same address without it. A message never goes out from another address.
export async function sendSupportEmail(e: SupportEmail, apiKey: string): Promise<{ ok: boolean; status: number; detail: string }> {
  const original = e.originalSubject.trim();
  const subject = /^re:/i.test(original) ? original : `Re: ${original || "your message"}`;
  const base = { type: "Email", contactId: e.contactId, subject, html: toHtml(e.replyText), emailFrom: e.fromAddress };

  let result = e.replyToMessageId ? await post({ ...base, replyMessageId: e.replyToMessageId }, apiKey) : await post(base, apiKey);
  if (!result.ok && e.replyToMessageId && result.status >= 400 && result.status < 500) {
    console.warn(`[ghlSupportSend] Threaded send refused (${result.status}): ${result.detail} — retrying without the message reference`);
    result = await post(base, apiKey);
  }
  return result;
}
