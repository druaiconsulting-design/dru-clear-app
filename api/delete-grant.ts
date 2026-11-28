// api/delete-grant.ts
// "Delete This Grant" on Adaeze's grant list card. DeAnna presses it on a grant she does not want to pursue.
// The grant is marked deleted in grant_opportunities. The row stays in the table so Adaeze, who checks every new
// find against the grants on file, never adds the same grant back. Every list on the page shows only status "new",
// so a deleted grant is hidden everywhere. The grant's text is removed from the card, and a card with no grants
// left is removed.
// Only DeAnna's admin login can call it.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdmin, supabaseConfig, sbHeaders } from "./_lib/hubShared.js";

export const config = { maxDuration: 30 };

const DIVIDER = "\n\n---\n\n";
const UUID = /^[0-9a-f-]{36}$/i;

// Same name cleaning the list card uses: the funder in parentheses is dropped from the grant name.
function cleanName(name: string, funder: string): string {
  const escaped = funder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return name.replace(new RegExp(`\\s*\\(${escaped}\\)`, "gi"), "").trim();
}

function chunkName(chunk: string): string | null {
  const m = chunk.match(/^\*\*(.+?)\*\*/);
  return m ? m[1].trim() : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "Method not allowed" }); return; }

  const cfg = supabaseConfig();
  if (!cfg) { res.status(500).json({ ok: false, error: "Database settings are missing." }); return; }
  if (!(await requireAdmin(req, res, cfg.url, cfg.serviceKey))) return;

  const grantId = String(req.body?.grant_id ?? "");
  const approvalId = String(req.body?.approval_id ?? "");
  if (!UUID.test(grantId)) { res.status(400).json({ ok: false, error: "grant_id required" }); return; }
  if (approvalId && !UUID.test(approvalId)) { res.status(400).json({ ok: false, error: "approval_id is not valid" }); return; }

  const headers = sbHeaders(cfg.serviceKey);

  // 1. Mark the grant deleted.
  const mark = await fetch(`${cfg.url}/rest/v1/grant_opportunities?id=eq.${grantId}&select=opportunity_name,funder`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({ status: "deleted" }),
  });
  const marked = mark.ok ? await mark.json() : [];
  if (!Array.isArray(marked) || marked.length === 0) {
    res.status(404).json({ ok: false, error: "That grant was not found." });
    return;
  }
  const grantName = String(marked[0].opportunity_name ?? "");
  const grantFunder = String(marked[0].funder ?? "");

  // 2. Take the grant's text off the card it was listed on.
  let cardRemoved = false;
  if (approvalId) {
    const cardRes = await fetch(`${cfg.url}/rest/v1/approvals?id=eq.${approvalId}&select=output,source`, { headers });
    const cards = cardRes.ok ? await cardRes.json() : [];
    const card = Array.isArray(cards) ? cards[0] : null;
    if (card && card.source === "adaeze_grants_full_list") {
      const wanted = [cleanName(grantName, grantFunder), grantName].map(n => n.toLowerCase());
      const chunks = String(card.output ?? "").split(DIVIDER);
      const kept = chunks.filter(c => { const n = chunkName(c); return !(n && wanted.includes(n.toLowerCase())); });
      if (kept.length !== chunks.length) {
        if (kept.length === 0) {
          const del = await fetch(`${cfg.url}/rest/v1/approvals?id=eq.${approvalId}`, { method: "DELETE", headers });
          cardRemoved = del.ok;
        } else {
          await fetch(`${cfg.url}/rest/v1/approvals?id=eq.${approvalId}`, {
            method: "PATCH", headers, body: JSON.stringify({ output: kept.join(DIVIDER) }),
          });
        }
      }
    }
  }

  res.status(200).json({ ok: true, grant: grantName, card_removed: cardRemoved });
}
