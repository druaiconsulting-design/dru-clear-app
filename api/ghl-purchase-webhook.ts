import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Supabase admin client — service role bypasses RLS
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Pathway stage ordering (advance only, never downgrade) ────────────────────
const STAGE_RANK: Record<string, number> = {
  Discover: 1, Diagnose: 2, Design: 3, Deploy: 4, Dominate: 5,
};

// ── Keyword → stage mapping (highest stage checked first) ────────────────────
// CORRECTED Aug 18, 2026 — the original mapping was wrong in two ways:
//   1. "full-ecosystem" was wired straight to Dominate. It's actually one of the 3
//      "90-Day Journey" bundles (Full Ecosystem $26k, DRU CLEAR+2 $19.5k, DRU CLEAR+1
//      $13.5k) — all 3 land in Deploy on purchase, same as any individual framework.
//      Dominate is reached only by: (a) an Advisory Retainer purchase directly, or
//      (b) 91 days after entering Deploy (handled separately — see the daily
//      promoteDeployToDominate() check in ghl-agent-trigger.ts's runJaylen()).
//   2. Diagnostic purchases were mapped to 'Diagnose'. Diagnose & Design are reached
//      together as one milestone (buying either diagnostic gets you both) — the stored
//      value is 'Design', the higher of the pair. 'Diagnose' still exists in STAGE_RANK
//      for ordering purposes but this webhook never sets it directly anymore.
const KEYWORD_MAP: Array<{ pattern: RegExp; stage: string }> = [
  { pattern: /dominate|advisory[\s-]?retainer/i, stage: 'Dominate' },
  { pattern: /deploy|bundle|all[\s-]?in|complete[\s-]?package|full[\s-]?ecosystem|dru[\s-]?clear|5d[\s-]?leadership|5c[\s-]?cultural|ai[\s-]?sales[\s-]?mastery|90[\s-]?day|transformation[\s-]?session/i, stage: 'Deploy' },
  { pattern: /design|diagnos|diagnostic|deep[\s-]?dive/i, stage: 'Design' },
  { pattern: /discover|assess|scorecard|ai[\s-]?readiness|free[\s-]?result/i, stage: 'Discover' },
];

function detectStage(signals: string[]): string | null {
  const combined = signals.join(' ');
  for (const { pattern, stage } of KEYWORD_MAP) {
    if (pattern.test(combined)) return stage;
  }
  return null;
}

// =============================================================================
// GHL PURCHASE WEBHOOK
// Maps GHL product/tag signals to profiles.pathway_stage
//
// Required Vercel env vars to add (Settings -> Environment Variables):
//   SUPABASE_SERVICE_ROLE_KEY  — from Supabase dashboard, Project Settings -> API
//   GHL_WEBHOOK_SECRET         — any strong random string you choose
//
// GHL workflow setup:
//   Trigger: Order Created / Tag Added / Pipeline stage changed
//   Action:  Send Webhook -> POST https://app.druaiconsulting.com/api/ghl-purchase-webhook
//   Header:  x-webhook-secret: [same value as GHL_WEBHOOK_SECRET]
//
// Stage mapping:
//   Free assessment completed -> Discover
//   Diagnostic purchased      -> Diagnose  ($3,497 / $4,997)
//   Framework sessions begin  -> Design    (90-Day $20K-$25K+)
//   Bundle purchased          -> Deploy
//   Full Ecosystem / Advisory -> Dominate
// =============================================================================
const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION_ID = 'gl07I4JnbkGgW8zJprSz';
const GHL_VERSION = '2021-07-28';

// One pathway tag active at a time, same invariant as the tier tags (non-member/free-tier/
// navigator-tier/accelerator-tier). Design and Deploy are the only stages this webhook sets
// directly that have a tag; Dominate only gets tagged here on the direct Advisory Retainer
// path (the 91-day auto-promotion path tags it separately, see runJaylen()).
const PATHWAY_TAG_TO_ADD: Record<string, string> = {
  Design: 'diagnostic-purchased',
  Deploy: '90-day-purchased',
  Dominate: '90-day-completed',
};
const PATHWAY_TAGS_TO_REMOVE: Record<string, string[]> = {
  Design: [],
  Deploy: ['diagnostic-purchased'],
  Dominate: ['diagnostic-purchased', '90-day-purchased'],
};

// GHL's official upsert endpoint — finds-or-creates by email using GHL's own duplicate
// detection, replacing the unverified advanced-search approach entirely.
// https://marketplace.gohighlevel.com/docs/ghl/contacts/upsert-contact
async function findContactIdByEmail(email: string, apiKey: string): Promise<string | null> {
  const res = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
    body: JSON.stringify({ locationId: GHL_LOCATION_ID, email }),
  });
  if (!res.ok) {
    console.error(`[ghl-purchase-webhook] GHL contact upsert failed: ${res.status} ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  return data.contacts?.[0]?.id ?? null;
}

async function addTags(contactId: string, tags: string[], apiKey: string): Promise<boolean> {
  const res = await fetch(`${GHL_API_BASE}/contacts/${contactId}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) console.error(`[ghl-purchase-webhook] Add tags failed for ${contactId}: ${res.status} ${await res.text()}`);
  return res.ok;
}

async function removeTags(contactId: string, tags: string[], apiKey: string): Promise<boolean> {
  if (tags.length === 0) return true;
  const res = await fetch(`${GHL_API_BASE}/contacts/${contactId}/tags`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) console.error(`[ghl-purchase-webhook] Remove tags failed for ${contactId}: ${res.status} ${await res.text()}`);
  return res.ok;
}

// Syncs the GHL pathway tag to match the stage just set in Supabase. Never blocks or fails
// the webhook response — the pathway_stage update already succeeded, which is what matters
// for the member's portal experience; a GHL hiccup here just means Jaylen's targeting is
// stale until the next purchase event, logged clearly so it's visible, not silent.
async function syncPathwayTag(email: string, newStage: string): Promise<void> {
  const tagToAdd = PATHWAY_TAG_TO_ADD[newStage];
  if (!tagToAdd) return; // Discover has no tag to sync
  const apiKey = process.env.GHL_PRIVATE_INTEGRATIONS_KEY;
  if (!apiKey) { console.error('[ghl-purchase-webhook] GHL_PRIVATE_INTEGRATIONS_KEY not set — skipping tag sync'); return; }
  try {
    const contactId = await findContactIdByEmail(email, apiKey);
    if (!contactId) { console.error(`[ghl-purchase-webhook] No GHL contact found for ${email} — pathway tag sync skipped`); return; }
    const tagsToRemove = PATHWAY_TAGS_TO_REMOVE[newStage] ?? [];
    const [addOk, removeOk] = await Promise.all([
      addTags(contactId, [tagToAdd], apiKey),
      removeTags(contactId, tagsToRemove, apiKey),
    ]);
    console.log(`[ghl-purchase-webhook] Pathway tag sync for ${email}: added ${tagToAdd} (${addOk}), removed ${tagsToRemove.join(',') || 'none'} (${removeOk})`);
  } catch (err) {
    console.error(`[ghl-purchase-webhook] Pathway tag sync error for ${email}:`, err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify webhook secret
  const secret = process.env.GHL_WEBHOOK_SECRET;
  if (secret) {
    const incoming = req.headers['x-webhook-secret'] ?? req.headers['x-ghl-secret'];
    if (incoming !== secret) {
      console.error('[ghl-purchase-webhook] Unauthorized');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const body = req.body ?? {};

    // Extract contact email across multiple GHL payload shapes
    const email: string = (
      body?.contact?.email       ??
      body?.data?.contact?.email ??
      body?.email                ??
      ''
    ).toLowerCase().trim();

    if (!email) {
      console.error('[ghl-purchase-webhook] No email in payload');
      return res.status(400).json({ error: 'No contact email found in payload' });
    }

    // Collect signal strings
    const signals: string[] = [];
    const tags: unknown = body?.contact?.tags ?? body?.data?.contact?.tags ?? body?.tags;
    if (Array.isArray(tags)) signals.push(...tags.map(String));
    const productName = body?.product?.name ?? body?.data?.product?.name ?? body?.order?.product_name ?? body?.customData?.product ?? '';
    if (productName) signals.push(String(productName));
    const pipelineName = body?.opportunity?.pipeline_stage_name ?? body?.data?.pipeline_stage ?? '';
    if (pipelineName) signals.push(String(pipelineName));
    const workflowName = body?.workflow?.name ?? body?.triggerName ?? '';
    if (workflowName) signals.push(String(workflowName));
    const note = body?.contact?.customField?.purchase_type ?? body?.note ?? '';
    if (note) signals.push(String(note));

    console.log('[ghl-purchase-webhook] Email:', email, '| Signals:', signals);

    const newStage = detectStage(signals);
    if (!newStage) {
      return res.status(200).json({ ok: true, message: 'No stage mapped from payload', signals });
    }

    // Look up profile by email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, pathway_stage, first_name, last_name')
      .eq('email', email)
      .maybeSingle();

    if (profileError) {
      console.error('[ghl-purchase-webhook] DB lookup error:', profileError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!profile) {
      return res.status(200).json({ ok: true, message: 'No app profile found for this email yet', email, detectedStage: newStage });
    }

    // Only advance — never downgrade
    const currentRank = STAGE_RANK[profile.pathway_stage ?? ''] ?? 0;
    const newRank     = STAGE_RANK[newStage] ?? 0;

    if (newRank <= currentRank) {
      return res.status(200).json({ ok: true, message: 'Already at equal or higher stage', currentStage: profile.pathway_stage, detectedStage: newStage });
    }

    // Update
    const updateFields: Record<string, unknown> = { pathway_stage: newStage, updated_at: new Date().toISOString() };
    // Dedicated timestamp for the 91-day Deploy→Dominate check — profiles.updated_at gets
    // touched by unrelated edits (bio, headline, etc.) so it can't be trusted for this.
    if (newStage === 'Deploy') updateFields.deploy_started_at = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateFields)
      .eq('id', profile.id);

    if (updateError) {
      console.error('[ghl-purchase-webhook] Update error:', updateError);
      return res.status(500).json({ error: 'Failed to update pathway stage' });
    }

    const name = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || email;
    console.log(`[ghl-purchase-webhook] SUCCESS: ${name} -> ${profile.pathway_stage ?? 'null'} -> ${newStage}`);

    // Sync the GHL pathway tag to match (Aug 2026 addition).
    await syncPathwayTag(email, newStage);

    return res.status(200).json({ ok: true, email, name, previousStage: profile.pathway_stage, newStage, signals });

  } catch (err) {
    console.error('[ghl-purchase-webhook] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
