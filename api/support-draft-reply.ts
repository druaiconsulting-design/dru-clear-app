// api/support-draft-reply.ts
// "Have Isaiah write it": DeAnna presses this on a Support Tickets ticket that has no reply drafted.
// Isaiah Carter writes the reply now and it appears in Waiting on you with Send Reply, Edit and Reject.
// Only DeAnna's admin login can call it. A ticket is claimed once, so a double click writes one reply.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdmin, supabaseConfig } from "./_lib/hubShared.js";
import { sb, ticketFromRow, loadPreface, draftReplyForReview, setTicketStatus } from "./_lib/supportIsaiah.js";

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "Method not allowed" }); return; }

  const cfg = supabaseConfig();
  if (!cfg) { res.status(500).json({ ok: false, error: "Database settings are missing." }); return; }
  if (!(await requireAdmin(req, res, cfg.url, cfg.serviceKey))) return;

  const ticketId = String(req.body?.ticket_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(ticketId)) { res.status(400).json({ ok: false, error: "ticket_id required" }); return; }

  // Claim the ticket: only one that is still "open" moves on.
  const claim = await sb(`support_requests?id=eq.${ticketId}&category=eq.email&status=eq.open`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "drafting" }),
  });
  const rows = claim.ok ? await claim.json() : [];
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(200).json({ ok: true, already: true });
    return;
  }

  try {
    const ticket = ticketFromRow(rows[0]);
    const preface = await loadPreface();
    const drafted = await draftReplyForReview(ticket, preface);
    if (!drafted) {
      await setTicketStatus(ticketId, "open");
      res.status(429).json({ ok: false, error: "Today's spend limit is reached. Try again tomorrow." });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(`[support-draft-reply] Draft failed for ticket ${ticketId}:`, err);
    await setTicketStatus(ticketId, "open");
    res.status(500).json({ ok: false, error: "Isaiah could not write the reply. The ticket is back in Waiting on you." });
  }
}
