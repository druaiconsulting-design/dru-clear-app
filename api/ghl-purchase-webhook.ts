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
const KEYWORD_MAP: Array<{ pattern: RegExp; stage: string }> = [
  { pattern: /dominate|full[\s-]?ecosystem|advisory[\s-]?retainer/i,         stage: 'Dominate' },
  { pattern: /deploy|bundle|all[\s-]?in|complete[\s-]?package/i,             stage: 'Deploy'   },
  { pattern: /design|framework|90[\s-]?day|transformation[\s-]?session/i,    stage: 'Design'   },
  { pattern: /diagnos|diagnostic|deep[\s-]?dive/i,                           stage: 'Diagnose' },
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
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ pathway_stage: newStage, updated_at: new Date().toISOString() })
      .eq('id', profile.id);

    if (updateError) {
      console.error('[ghl-purchase-webhook] Update error:', updateError);
      return res.status(500).json({ error: 'Failed to update pathway stage' });
    }

    const name = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || email;
    console.log(`[ghl-purchase-webhook] SUCCESS: ${name} -> ${profile.pathway_stage ?? 'null'} -> ${newStage}`);

    return res.status(200).json({ ok: true, email, name, previousStage: profile.pathway_stage, newStage, signals });

  } catch (err) {
    console.error('[ghl-purchase-webhook] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
