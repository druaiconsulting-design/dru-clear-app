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
import { SUPPORT_FROM_ADDRESSES, findContactIdByEmail, sendSupportEmail } from "./_lib/ghlSupportSend.js";
export const config = { maxDuration: 60 };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ALLOWED_FROM = SUPPORT_FROM_ADDRESSES;

const sbHeaders = { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

async function sb(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...sbHeaders, ...(init?.headers ?? {}) } });
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

    const result = await sendSupportEmail({
      contactId,
      fromAddress,
      originalSubject: String(ctx.subject ?? ""),
      replyText,
      replyToMessageId: ctx.ghl_message_id,
    }, apiKey);

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
