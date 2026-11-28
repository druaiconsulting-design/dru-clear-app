// api/grant-resume.ts
// Nov 28, 2026 -- built per DeAnna's direction. When Kwame's draft reaches DeAnna, the
// Chloe and Isabella reviews are finished. DeAnna pastes her finished draft into the
// "DeAnna's Finished Draft" box and presses Send to Kwame. Her words stay exactly as
// she wrote them: nothing reviews, rewrites or reorders them. Her draft becomes the
// card's body (under the grant header, with the status line "ready to use"), and the
// new card replaces Kwame's old card, for her records.

import type { VercelRequest, VercelResponse } from "@vercel/node";
export const config = { maxDuration: 60 };
import { buildDraftHeader } from './_lib/grantApplication.js';

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function dbGet(table: string, id: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}&limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] ?? null;
}

async function dbUpdate(table: string, id: string, updates: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`${table} update failed: ${res.status}`);
}

async function getGrantFactsByName(name: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/grant_opportunities?opportunity_name=ilike.${encodeURIComponent(name)}&limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const { approval_id, deanna_input } = req.body ?? {};
  const finishedDraft = String(deanna_input ?? '');
  if (!approval_id || !finishedDraft.trim()) {
    res.status(400).json({ error: "approval_id and deanna_input are required" });
    return;
  }

  try {
    // The approval card's context holds the queue row id, set when the card was created.
    const approval = await dbGet("approvals", approval_id as string);
    if (!approval) { res.status(404).json({ error: "Approval card not found" }); return; }
    const csqId = String(approval.context ?? '');
    const item = csqId ? await dbGet("chief_of_staff_queue", csqId) : null;
    if (!item) { res.status(404).json({ error: "Original grant draft not found" }); return; }

    const cleanName = String(item.context ?? '');
    const grantRow = await getGrantFactsByName(cleanName);

    const method = grantRow?.submission_method === 'email' && grantRow?.submission_email ? 'email' : 'portal';
    const submissionLine = method === 'email'
      ? `**Submission (email):** [Click to open a pre-filled email to ${grantRow?.submission_email}](mailto:${encodeURIComponent(String(grantRow?.submission_email))}?subject=${encodeURIComponent(`Grant Application — DRU AI Consulting — ${cleanName}`)}&body=${encodeURIComponent(finishedDraft)}) -- review before sending, nothing sends automatically.`
      : `**Submission (portal):** This funder takes applications through their own site, not email. Apply directly here: ${grantRow?.source_url ?? 'source URL not found'}`;

    const finalOutput = `${buildDraftHeader(cleanName, grantRow)}\n\n**Application status:** ready to use\n\n---\n\n${finishedDraft}\n\n---\n\n${submissionLine}`;

    const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Chicago" });

    await dbUpdate("chief_of_staff_queue", csqId, {
      raw_output: finalOutput,
      isabella_flags: 'none',
      correction_notes: '',
      status: "deanna_finished",
    });
    await dbUpdate("approvals", approval_id as string, {
      output: finalOutput,
      edited_output: null,
      status: "ready_to_use",
      task_brief: `${cleanName} | ${today}`,
    });
    console.log(`[grant-resume] DeAnna's finished draft is on the card: ${cleanName}`);
    res.status(200).json({ success: true, output: finalOutput });
  } catch (err) {
    console.error("[grant-resume] Error:", err);
    res.status(500).json({ error: String(err) });
  }
}
