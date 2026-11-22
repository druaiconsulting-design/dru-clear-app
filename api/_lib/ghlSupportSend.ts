// api/_lib/ghlSupportSend.ts
// Sends Isaiah's support emails (the instant reply and the approved reply) through the two GHL workflows
// that send from the support address: "Support Reply Sender - support@" and "Support Reply Sender - info@".
// The address the person wrote to decides which workflow sends, so the email always comes from that same
// address and the person can answer it. Nothing is ever sent from the noreply address.
//
// Each workflow starts with an Inbound Webhook. The app posts { email, subject, message } to the workflow's
// private web address (SUPPORT_REPLY_WORKFLOW_URL and INFO_REPLY_WORKFLOW_URL in the app's hosting settings).
// GHL answers 200 as soon as it accepts the request; the workflow then finds the contact by email and sends
// the email. The app can see a refused or unreachable request, and treats that as a failed send.

export const SUPPORT_FROM_ADDRESSES = ["support@support.druaiconsulting.com", "info@info.druaiconsulting.com"];

const SEND_TIMEOUT_MS = 15000;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function toHtml(text: string): string {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const body = paragraphs.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("\n");
  return `<div style="font-family: Georgia, serif; font-size: 15px; line-height: 1.6; color: #0A2342;">${body}</div>`;
}

// The private web address of the workflow that sends from this support address, or null when it is not set.
function workflowUrlFor(fromAddress: string): string | null {
  const address = fromAddress.trim().toLowerCase();
  if (address === "support@support.druaiconsulting.com") return process.env.SUPPORT_REPLY_WORKFLOW_URL || null;
  if (address === "info@info.druaiconsulting.com") return process.env.INFO_REPLY_WORKFLOW_URL || null;
  return null;
}

export interface SupportEmail {
  toEmail: string;
  fromAddress: string;
  originalSubject: string;
  replyText: string;
}

export function replySubject(originalSubject: string): string {
  const original = originalSubject.trim();
  return /^re:/i.test(original) ? original : `Re: ${original || "your message"}`;
}

export async function sendSupportEmail(e: SupportEmail): Promise<{ ok: boolean; status: number; detail: string }> {
  const url = workflowUrlFor(e.fromAddress);
  if (!url) return { ok: false, status: 0, detail: `No sending workflow is set up for ${e.fromAddress}` };
  const toEmail = e.toEmail.trim();
  if (!toEmail) return { ok: false, status: 0, detail: "No email address to send to" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: toEmail, subject: replySubject(e.originalSubject), message: toHtml(e.replyText) }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      console.error(`[ghlSupportSend] Workflow for ${e.fromAddress} refused the send: ${res.status} ${detail}`);
      return { ok: false, status: res.status, detail };
    }
    return { ok: true, status: res.status, detail: "" };
  } catch (err) {
    const detail = err instanceof Error && err.name === "AbortError" ? "The sending workflow did not answer in time" : String(err);
    console.error(`[ghlSupportSend] Could not reach the workflow for ${e.fromAddress}: ${detail}`);
    return { ok: false, status: 0, detail };
  } finally {
    clearTimeout(timer);
  }
}
