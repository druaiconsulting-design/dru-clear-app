// api/ghl-support-reply-dispatch.ts
// Sends an approved "Support Reply" card — Isaiah's reply to an email that came in at
// support@support.druaiconsulting.com or info@info.druaiconsulting.com — through GHL into the
// same conversation, from the address the person wrote to.
//
// Fires from AdminApprovals.tsx when a Support Reply card is approved. The browser sends only the
// approval id. Who receives the reply, which address it comes from, and the subject are read from
// the approval row on the server (written by api/process-on-demand.ts), and the card must already be
// marked approved. A ticket claims its reply once, so a repeated call never sends a second email.
//
// Uses GHL_PRIVATE_INTEGRATIONS_KEY (plural), the same credential as api/ghl-newsletter-dispatch.ts.

import type { VercelRequest, VercelResponse } from "@vercel/node";
export const config = { maxDuration: 60 };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";
const GHL_LOCATION_ID = "gl07I4JnbkGgW8zJprSz";
const ALLOWED_FROM = ["support@support.druaiconsulting.com", "info@info.druaiconsulting.com"];

const sbHeaders = { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

async function sb(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...sbHeaders, ...(init?.headers ?? {}) } });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toHtml(text: string): string {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const body = paragraphs.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("\n");
  return `<div style="font-family: Georgia, serif; font-size: 15px; line-height: 1.6; color: #0A2342;">${body}</div>`;
}

async function findContactIdByEmail(email: string, apiKey: string): Promise<string | null> {
  const res = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
    body: JSON.stringify({ locationId: GHL_LOCATION_ID, email }),
  });
  if (!res.ok) { console.error(`[ghl-support-reply-dispatch] Contact lookup failed: ${res.status} ${await res.text()}`); return null; }
  const data = await res.json();
  return data?.contact?.id ?? null;
}

async function sendEmail(payload: Record<string, unknown>, apiKey: string): Promise<{ ok: boolean; status: number; detail: string }> {
  const res = await fetch(`${GHL_API_BASE}/conversations/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, status: res.status, detail: res.ok ? "" : await res.text() };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const approvalId = String(req.body?.approval_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(approvalId)) { res.status(400).json({ error: "approval_id required" }); return; }

  const apiKey = process.env.GHL_PRIVATE_INTEGRATIONS_KEY;
  if (!apiKey) { res.status(500).json({ error: "GHL_PRIVATE_INTEGRATIONS_KEY not set" }); return; }

  const aRes = await sb(`approvals?id=eq.${approvalId}&select=id,category,status,output,edited_output,context&limit=1`);
  const approval = aRes.ok ? (await aRes.json())?.[0] : null;
  if (!approval || approval.category !== "support_reply") { res.status(404).json({ error: "Support reply card not found" }); return; }
  if (approval.status !== "approved") { res.status(409).json({ error: "Card is not approved" }); return; }

  let ctx: Record<string, string | null> = {};
  try { ctx = JSON.parse(approval.context ?? "{}"); } catch { /* handled below */ }
  const ticketId = ctx.support_request_id ?? "";
  const fromEmail = String(ctx.from_email ?? "");
  const fromAddress = String(ctx.to_address ?? "");
  if (!ticketId || !fromEmail || !ALLOWED_FROM.includes(fromAddress)) {
    res.status(422).json({ error: "Card is missing its recipient details" });
    return;
  }

  const replyText = String(approval.edited_output || approval.output || "").trim();
  if (!replyText) { res.status(422).json({ error: "Reply is empty" }); return; }

  // Claim the reply once: only a ticket that is not already replied/replying can move on.
  const claim = await sb(`support_requests?id=eq.${ticketId}&status=not.in.(replied,replying)`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "replying" }),
  });
  const claimed = claim.ok ? await claim.json() : [];
  if (!Array.isArray(claimed) || claimed.length === 0) {
    res.status(200).json({ success: true, already: true });
    return;
  }

  const giveBack = async () => { await sb(`support_requests?id=eq.${ticketId}`, { method: "PATCH", body: JSON.stringify({ status: "awaiting_approval" }) }); };

  try {
    const contactId = ctx.ghl_contact_id || await findContactIdByEmail(fromEmail, apiKey);
    if (!contactId) { await giveBack(); res.status(502).json({ error: "No GHL contact found for the sender" }); return; }

    const original = String(ctx.subject ?? "").trim();
    const subject = /^re:/i.test(original) ? original : `Re: ${original || "your message"}`;
    const base = { type: "Email", contactId, subject, html: toHtml(replyText), emailFrom: fromAddress };

    // First try replying to the customer's own message so GHL threads it; if GHL does not accept that
    // reference, send again from the same address without it. A reply never goes out from another address.
    let result = ctx.ghl_message_id
      ? await sendEmail({ ...base, replyMessageId: ctx.ghl_message_id }, apiKey)
      : await sendEmail(base, apiKey);
    if (!result.ok && ctx.ghl_message_id && result.status >= 400 && result.status < 500) {
      console.warn(`[ghl-support-reply-dispatch] Threaded send refused (${result.status}): ${result.detail} — retrying without the message reference`);
      result = await sendEmail(base, apiKey);
    }

    if (!result.ok) {
      console.error(`[ghl-support-reply-dispatch] Send failed for approval ${approvalId}: ${result.status} ${result.detail}`);
      await giveBack();
      res.status(502).json({ error: "Send failed", status: result.status });
      return;
    }

    await sb(`support_requests?id=eq.${ticketId}`, { method: "PATCH", body: JSON.stringify({ status: "replied" }) });
    console.log(`[ghl-support-reply-dispatch] Reply sent from ${fromAddress} (approval ${approvalId}, ticket ${ticketId})`);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("[ghl-support-reply-dispatch] Fatal error:", err);
    await giveBack();
    res.status(500).json({ error: String(err) });
  }
}
