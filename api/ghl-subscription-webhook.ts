import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_LOCATION_ID = 'gl07I4JnbkGgW8zJprSz';
const GHL_VERSION = '2021-07-28';

// Which tag gets added per tier, and which tags must come off so a contact only ever
// carries one tier tag at a time (Aug 2026 — keeps the newsletter dispatch from double-sending).
const TAG_TO_ADD: Record<string, string> = { navigator: 'navigator-tier', accelerator: 'accelerator-tier' };
const TAGS_TO_REMOVE: Record<string, string[]> = {
  navigator:   ['non-member', 'free-tier'],
  accelerator: ['non-member', 'free-tier', 'navigator-tier'],
};

async function findContactIdByEmail(email: string, apiKey: string): Promise<string | null> {
  const res = await fetch(`${GHL_API_BASE}/contacts/search?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
  });
  if (!res.ok) {
    console.error(`[ghl-subscription-webhook] GHL contact search failed: ${res.status} ${await res.text()}`);
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
  if (!res.ok) console.error(`[ghl-subscription-webhook] Add tags failed for ${contactId}: ${res.status} ${await res.text()}`);
  return res.ok;
}

async function removeTags(contactId: string, tags: string[], apiKey: string): Promise<boolean> {
  const res = await fetch(`${GHL_API_BASE}/contacts/${contactId}/tags`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, Version: GHL_VERSION },
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) console.error(`[ghl-subscription-webhook] Remove tags failed for ${contactId}: ${res.status} ${await res.text()}`);
  return res.ok;
}

// Syncs GHL tags to match the tier just set in Supabase. Runs AFTER the Supabase update
// succeeds and never blocks or fails the response — the member's paid access already went
// through; a GHL tag hiccup shouldn't be allowed to look like a failed payment. Logs clearly
// so a silent tagging failure is still visible in Vercel logs.
async function syncGHLTag(email: string, tier: string): Promise<void> {
  const apiKey = process.env.GHL_PRIVATE_INTEGRATION_KEY;
  if (!apiKey) { console.error('[ghl-subscription-webhook] GHL_PRIVATE_INTEGRATION_KEY not set — skipping tag sync'); return; }
  try {
    const contactId = await findContactIdByEmail(email, apiKey);
    if (!contactId) { console.error(`[ghl-subscription-webhook] No GHL contact found for ${email} — tag sync skipped`); return; }
    const tagToAdd = TAG_TO_ADD[tier];
    const tagsToRemove = TAGS_TO_REMOVE[tier] ?? [];
    const [addOk, removeOk] = await Promise.all([
      addTags(contactId, [tagToAdd], apiKey),
      removeTags(contactId, tagsToRemove, apiKey),
    ]);
    console.log(`[ghl-subscription-webhook] Tag sync for ${email}: added ${tagToAdd} (${addOk}), removed ${tagsToRemove.join(',')} (${removeOk})`);
  } catch (err) {
    console.error(`[ghl-subscription-webhook] Tag sync error for ${email}:`, err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;

    console.log('[ghl-subscription-webhook] Incoming payload:', JSON.stringify(body));

    // Extract email — GHL can send it in different locations
    const email =
      body.email ||
      body.Email ||
      body.contact?.email ||
      body.customer?.email ||
      null;

    // Tier comes from query param — ?tier=navigator or ?tier=accelerator
    const tier = (req.query.tier as string)?.toLowerCase() || null;

    // Validate email
    if (!email) {
      console.error('[ghl-subscription-webhook] No email in payload');
      return res.status(400).json({ error: 'No email found in payload' });
    }

    // Validate tier
    if (!tier || !['navigator', 'accelerator'].includes(tier)) {
      console.error(`[ghl-subscription-webhook] Invalid or missing tier: ${tier}`);
      return res.status(400).json({ error: `Invalid or missing tier: ${tier}` });
    }

    console.log(`[ghl-subscription-webhook] Updating tier → email: ${email} | tier: ${tier}`);

    // Call Supabase RPC — looks up auth user by email, then updates/inserts profile safely
    const { data, error: rpcError } = await supabase.rpc('update_subscription_tier', {
      user_email: email.toLowerCase().trim(),
      new_tier: tier,
    });

    if (rpcError) {
      console.error('[ghl-subscription-webhook] RPC error:', rpcError);
      return res.status(500).json({ error: 'Database update failed', details: rpcError.message });
    }

    if (!data?.success) {
      console.error('[ghl-subscription-webhook] RPC returned failure:', data);
      return res.status(404).json({ error: data?.error || 'User not found' });
    }

    console.log(`[ghl-subscription-webhook] ✅ Success — ${email} upgraded to ${tier}`);

    // Sync GHL tags to match (Aug 2026 addition). Fire without awaiting the response body's
    // success on this — the Supabase update already succeeded, which is what matters for
    // the member's access. Vercel keeps the function alive until this promise settles since
    // it's awaited here, but its outcome never changes the HTTP response below.
    await syncGHLTag(email, tier);

    return res.status(200).json({ success: true, email, tier });

  } catch (err) {
    console.error('[ghl-subscription-webhook] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
