import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    return res.status(200).json({ success: true, email, tier });

  } catch (err) {
    console.error('[ghl-subscription-webhook] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
